const MerchantWallet = require('../models/MerchantWallet');
const WalletTransaction = require('../models/WalletTransaction');
const webhookService = require('../services/webhookService');
const { sendResponse } = require('../utils/response');

// Helper function to handle MongoDB collection limit errors
const handleCollectionLimitError = (error, res, next) => {
  if (error.code === 8000 && error.codeName === 'AtlasError' && error.message.includes('cannot create a new collection')) {
    return sendResponse(res, 503, 'MongoDB Atlas collection limit reached. Please delete unused collections or upgrade your MongoDB Atlas tier. The free tier (M0) allows 500 collections.', {
      error: 'Collection limit reached',
      code: 'COLLECTION_LIMIT_REACHED',
      message: 'Your MongoDB Atlas database has reached the 500 collection limit. Please delete unused collections or upgrade to a higher tier.',
      solution: 'Delete unused collections from your database or upgrade your MongoDB Atlas tier'
    });
  }
  next(error);
};

// Get wallet balance
exports.getWalletBalance = async (req, res, next) => {
  try {
    const merchantId = req.user.id;

    // Check if user is merchant
    if (req.user.role !== 'advertiser' && req.user.role !== 'admin') {
      return sendResponse(res, 403, 'Access denied. Merchant role required.', null);
    }

    // Get or create wallet
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    return sendResponse(res, 200, 'Wallet balance retrieved successfully', {
      balance: {
        available: wallet.balance.available,
        reserved: wallet.balance.reserved,
        total: wallet.balance.total
      },
      currency: wallet.currency,
      lowBalance: wallet.isLowBalance(),
      lowBalanceThreshold: wallet.settings.lowBalanceAlert,
      autoDeposit: wallet.autoDeposit,
      stats: wallet.stats
    });
  } catch (error) {
    return handleCollectionLimitError(error, res, next);
  }
};

// Fund wallet (deposit)
exports.depositToWallet = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { amount, paymentGateway, paymentGatewayTransactionId, description } = req.body;

    // Check if user is merchant
    if (req.user.role !== 'advertiser' && req.user.role !== 'admin') {
      return sendResponse(res, 403, 'Access denied. Merchant role required.', null);
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return sendResponse(res, 400, 'Invalid amount. Amount must be greater than zero.', null);
    }

    // Get or create wallet
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    // Store balance before
    const balanceBefore = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    // Add funds
    await wallet.addFunds(amount);

    // Store balance after
    const balanceAfter = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    // Create transaction record
    const transaction = await WalletTransaction.createTransaction({
      wallet: wallet._id,
      merchant: merchantId,
      type: paymentGatewayTransactionId ? 'auto_deposit' : 'deposit',
      amount,
      balanceBefore,
      balanceAfter,
      reference: {
        type: 'deposit'
      },
      description: description || `Wallet deposit of ${wallet.currency} ${amount}`,
      paymentGateway: paymentGateway || 'credit_card',
      paymentGatewayTransactionId,
      metadata: {
        source: 'manual',
        ...req.body.metadata
      }
    });

    // Send webhook notification
    try {
      await webhookService.sendWalletTransactionWebhook(
        merchantId,
        webhookService.WALLET_EVENTS.DEPOSIT_COMPLETED,
        {
          transaction: transaction,
          balance: {
            available: wallet.balance.available,
            reserved: wallet.balance.reserved,
            total: wallet.balance.total
          }
        }
      );
    } catch (webhookError) {
      console.error('Failed to send deposit webhook:', webhookError);
      // Don't fail the deposit if webhook fails
    }

    return sendResponse(res, 200, 'Wallet funded successfully', {
      balance: {
        available: wallet.balance.available,
        reserved: wallet.balance.reserved,
        total: wallet.balance.total
      },
      transaction: transaction
    });
  } catch (error) {
    return handleCollectionLimitError(error, res, next);
  }
};

// Get wallet transactions
exports.getWalletTransactions = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { 
      page = 1, 
      limit = 20, 
      type, 
      status, 
      startDate, 
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search
    } = req.query;

    // Check if user is merchant
    if (req.user.role !== 'advertiser' && req.user.role !== 'admin') {
      return sendResponse(res, 403, 'Access denied. Merchant role required.', null);
    }

    // Get wallet
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    // Build query
    const query = { wallet: wallet._id, merchant: merchantId };

    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Search functionality
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { 'reference.externalId': { $regex: search, $options: 'i' } },
        { paymentGatewayTransactionId: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Get transactions
    const transactions = await WalletTransaction.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('reference.id', 'amount status')
      .lean();

    // Get total count
    const total = await WalletTransaction.countDocuments(query);

    // Get summary statistics for the filtered results
    const summary = await WalletTransaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    return sendResponse(res, 200, 'Transactions retrieved successfully', {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      summary
    });
  } catch (error) {
    return handleCollectionLimitError(error, res, next);
  }
};

// Setup auto-deposit
exports.setupAutoDeposit = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { enabled, threshold, amount, paymentMethod, paymentGatewayId } = req.body;

    // Check if user is merchant
    if (req.user.role !== 'advertiser' && req.user.role !== 'admin') {
      return sendResponse(res, 403, 'Access denied. Merchant role required.', null);
    }

    // Get or create wallet
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    // Update auto-deposit settings
    if (enabled !== undefined) {
      wallet.autoDeposit.enabled = enabled;
    }
    if (threshold !== undefined) {
      wallet.autoDeposit.threshold = threshold;
    }
    if (amount !== undefined) {
      wallet.autoDeposit.amount = amount;
    }
    if (paymentMethod !== undefined) {
      wallet.autoDeposit.paymentMethod = paymentMethod;
    }
    if (paymentGatewayId !== undefined) {
      wallet.autoDeposit.paymentGatewayId = paymentGatewayId;
    }

    await wallet.save();

    return sendResponse(res, 200, 'Auto-deposit settings updated successfully', {
      autoDeposit: wallet.autoDeposit
    });
  } catch (error) {
    return handleCollectionLimitError(error, res, next);
  }
};

// Update wallet settings (alerts, etc.)
exports.updateWalletSettings = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { lowBalanceAlert, alertEmail, alertEnabled } = req.body;

    // Check if user is merchant
    if (req.user.role !== 'advertiser' && req.user.role !== 'admin') {
      return sendResponse(res, 403, 'Access denied. Merchant role required.', null);
    }

    // Get or create wallet
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    // Update settings
    if (lowBalanceAlert !== undefined) {
      wallet.settings.lowBalanceAlert = lowBalanceAlert;
    }
    if (alertEmail !== undefined) {
      wallet.settings.alertEmail = alertEmail;
    }
    if (alertEnabled !== undefined) {
      wallet.settings.alertEnabled = alertEnabled;
    }

    await wallet.save();

    return sendResponse(res, 200, 'Wallet settings updated successfully', {
      settings: wallet.settings
    });
  } catch (error) {
    return handleCollectionLimitError(error, res, next);
  }
};

// Get wallet statements (financial reports)
exports.getWalletStatements = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { startDate, endDate, format = 'json' } = req.query;

    // Check if user is merchant
    if (req.user.role !== 'advertiser' && req.user.role !== 'admin') {
      return sendResponse(res, 403, 'Access denied. Merchant role required.', null);
    }

    // Get wallet
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    // Build date range
    const start = startDate ? new Date(startDate) : new Date(wallet.createdAt);
    const end = endDate ? new Date(endDate) : new Date();

    // Get all transactions in date range
    const transactions = await WalletTransaction.find({
      wallet: wallet._id,
      merchant: merchantId,
      createdAt: { $gte: start, $lte: end }
    }).sort({ createdAt: 1 }).lean();

    // Calculate summary
    const summary = {
      openingBalance: 0,
      closingBalance: wallet.balance.total,
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalCommissions: 0,
      totalPayouts: 0,
      totalFees: 0,
      totalRefunds: 0,
      transactionCount: transactions.length
    };

    // Calculate opening balance (first transaction balance before)
    if (transactions.length > 0) {
      summary.openingBalance = transactions[0].balanceBefore.total;
    }

    // Calculate totals
    transactions.forEach(transaction => {
      if (transaction.type === 'deposit' || transaction.type === 'auto_deposit' || transaction.type === 'refund') {
        summary.totalDeposits += transaction.amount;
        if (transaction.type === 'refund') {
          summary.totalRefunds += transaction.amount;
        }
      } else if (transaction.type === 'commission_payment') {
        summary.totalWithdrawals += transaction.amount;
        summary.totalCommissions += transaction.amount;
      } else if (transaction.type === 'payout') {
        summary.totalWithdrawals += transaction.amount;
        summary.totalPayouts += transaction.amount;
      } else if (transaction.type === 'fee') {
        summary.totalWithdrawals += transaction.amount;
        summary.totalFees += transaction.amount;
      }
    });

    // Calculate daily breakdown for charts
    const dailyBreakdown = {};
    transactions.forEach(transaction => {
      const date = new Date(transaction.createdAt).toISOString().split('T')[0];
      if (!dailyBreakdown[date]) {
        dailyBreakdown[date] = {
          date,
          deposits: 0,
          withdrawals: 0,
          commissions: 0,
          payouts: 0,
          fees: 0,
          count: 0
        };
      }
      dailyBreakdown[date].count++;
      if (transaction.type === 'deposit' || transaction.type === 'auto_deposit' || transaction.type === 'refund') {
        dailyBreakdown[date].deposits += transaction.amount;
      } else if (transaction.type === 'commission_payment') {
        dailyBreakdown[date].withdrawals += transaction.amount;
        dailyBreakdown[date].commissions += transaction.amount;
      } else if (transaction.type === 'payout') {
        dailyBreakdown[date].withdrawals += transaction.amount;
        dailyBreakdown[date].payouts += transaction.amount;
      } else if (transaction.type === 'fee') {
        dailyBreakdown[date].withdrawals += transaction.amount;
        dailyBreakdown[date].fees += transaction.amount;
      }
    });

    const dailyData = Object.values(dailyBreakdown).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    return sendResponse(res, 200, 'Wallet statement retrieved successfully', {
      wallet: {
        balance: wallet.balance,
        currency: wallet.currency
      },
      period: {
        startDate: start,
        endDate: end
      },
      summary,
      dailyBreakdown: dailyData,
      transactions
    });
  } catch (error) {
    return handleCollectionLimitError(error, res, next);
  }
};

// Export transactions (CSV)
exports.exportTransactions = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { startDate, endDate, format = 'csv' } = req.query;

    // Check if user is merchant
    if (req.user.role !== 'advertiser' && req.user.role !== 'admin') {
      return sendResponse(res, 403, 'Access denied. Merchant role required.', null);
    }

    // Get wallet
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    // Build date range
    const start = startDate ? new Date(startDate) : new Date(wallet.createdAt);
    const end = endDate ? new Date(endDate) : new Date();

    // Get all transactions
    const transactions = await WalletTransaction.find({
      wallet: wallet._id,
      merchant: merchantId,
      createdAt: { $gte: start, $lte: end }
    }).sort({ createdAt: 1 }).lean();

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Date,Type,Amount,Status,Description,Balance Before,Balance After\n';
      const csvRows = transactions.map(t => {
        const date = new Date(t.createdAt).toISOString();
        const type = t.type;
        const amount = t.amount;
        const status = t.status;
        const description = (t.description || '').replace(/,/g, ';');
        const balanceBefore = t.balanceBefore.total;
        const balanceAfter = t.balanceAfter.total;
        return `${date},${type},${amount},${status},"${description}",${balanceBefore},${balanceAfter}`;
      }).join('\n');

      const csv = csvHeader + csvRows;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="wallet-transactions-${Date.now()}.csv"`);
      return res.send(csv);
    }

    // Default to JSON
    return sendResponse(res, 200, 'Transactions exported successfully', {
      transactions,
      period: { startDate: start, endDate: end }
    });
  } catch (error) {
    return handleCollectionLimitError(error, res, next);
  }
};

// Get wallet summary/analytics
exports.getWalletSummary = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { startDate, endDate } = req.query;

    // Check if user is merchant
    if (req.user.role !== 'advertiser' && req.user.role !== 'admin') {
      return sendResponse(res, 403, 'Access denied. Merchant role required.', null);
    }

    const walletService = require('../services/walletService');
    const summary = await walletService.getWalletSummary(merchantId, startDate, endDate);

    return sendResponse(res, 200, 'Wallet summary retrieved successfully', summary);
  } catch (error) {
    return handleCollectionLimitError(error, res, next);
  }
};

// Internal helper function to deduct from wallet (used by commission/payout systems)
exports.deductFromWallet = async (merchantId, amount, reference, description) => {
  try {
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    const balanceBefore = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    await wallet.deductFunds(amount, false);

    const balanceAfter = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    const transaction = await WalletTransaction.createTransaction({
      wallet: wallet._id,
      merchant: merchantId,
      type: reference.type === 'commission' ? 'commission_payment' : 'payout',
      amount,
      balanceBefore,
      balanceAfter,
      reference,
      description: description || `Deduction for ${reference.type}`,
      metadata: { source: 'system' }
    });

    // Send webhook notification
    try {
      const event = reference.type === 'commission' 
        ? webhookService.WALLET_EVENTS.COMMISSION_PAID
        : webhookService.WALLET_EVENTS.PAYOUT_PROCESSED;
      
      await webhookService.sendWalletTransactionWebhook(
        merchantId,
        event,
        {
          transaction: transaction,
          balance: {
            available: wallet.balance.available,
            reserved: wallet.balance.reserved,
            total: wallet.balance.total
          },
          reference: reference
        }
      );
    } catch (webhookError) {
      console.error('Failed to send deduction webhook:', webhookError);
      // Don't fail the deduction if webhook fails
    }

    return wallet;
  } catch (error) {
    throw error;
  }
};

// Internal helper function to reserve funds
exports.reserveFunds = async (merchantId, amount, reference, description) => {
  try {
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    const balanceBefore = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    await wallet.reserveFunds(amount);

    const balanceAfter = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    await WalletTransaction.createTransaction({
      wallet: wallet._id,
      merchant: merchantId,
      type: 'commission_reserve',
      amount,
      balanceBefore,
      balanceAfter,
      reference,
      description: description || `Reserve for pending commission`,
      metadata: { source: 'system' }
    });

    return wallet;
  } catch (error) {
    throw error;
  }
};

// Internal helper function to release reservation
exports.releaseReservation = async (merchantId, amount, reference, description) => {
  try {
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    const balanceBefore = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    await wallet.releaseReservation(amount);

    const balanceAfter = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    await WalletTransaction.createTransaction({
      wallet: wallet._id,
      merchant: merchantId,
      type: 'commission_release',
      amount,
      balanceBefore,
      balanceAfter,
      reference,
      description: description || `Release reserved commission`,
      metadata: { source: 'system' }
    });

    return wallet;
  } catch (error) {
    throw error;
  }
};

// Internal helper function to approve commission
exports.approveCommission = async (merchantId, amount, reference, description) => {
  try {
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    const balanceBefore = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    await wallet.approveCommission(amount);

    const balanceAfter = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    await WalletTransaction.createTransaction({
      wallet: wallet._id,
      merchant: merchantId,
      type: 'commission_payment',
      amount,
      balanceBefore,
      balanceAfter,
      reference,
      description: description || `Commission payment`,
      metadata: { source: 'system' }
    });

    return wallet;
  } catch (error) {
    throw error;
  }
};

// Internal helper function to refund
exports.refundToWallet = async (merchantId, amount, reference, description) => {
  try {
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    const balanceBefore = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    await wallet.refundFunds(amount);

    const balanceAfter = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    await WalletTransaction.createTransaction({
      wallet: wallet._id,
      merchant: merchantId,
      type: 'refund',
      amount,
      balanceBefore,
      balanceAfter,
      reference,
      description: description || `Refund to wallet`,
      metadata: { source: 'system' }
    });

    return wallet;
  } catch (error) {
    throw error;
  }
};
