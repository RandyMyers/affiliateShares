const MerchantWallet = require('../models/MerchantWallet');
const WalletTransaction = require('../models/WalletTransaction');
const webhookService = require('./webhookService');

/**
 * Calculate and create network transaction fee (commission fee)
 */
exports.createNetworkTransactionFee = async (merchantId, commissionId, commissionAmount, feeRate) => {
  try {
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    const feeAmount = WalletTransaction.calculateNetworkFee(commissionAmount, feeRate);

    if (feeAmount <= 0) {
      return null; // No fee to charge
    }

    const balanceBefore = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    // Deduct fee from wallet
    await wallet.deductFunds(feeAmount, false);

    const balanceAfter = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    // Create fee transaction
    const transaction = await WalletTransaction.createTransaction({
      wallet: wallet._id,
      merchant: merchantId,
      type: 'fee',
      amount: feeAmount,
      balanceBefore,
      balanceAfter,
      feeType: 'network_transaction',
      feeCalculation: {
        type: 'percentage',
        rate: feeRate,
        baseAmount: commissionAmount
      },
      feeStatus: 'charged',
      reference: {
        type: 'commission',
        id: commissionId
      },
      description: `Network transaction fee: ${feeRate}% of commission`
    });

    // Send webhook notification
    try {
      await webhookService.sendWalletTransactionWebhook(
        merchantId,
        webhookService.WALLET_EVENTS.FEE_CHARGED,
        {
          fee: transaction,
          transaction: transaction
        }
      );
    } catch (webhookError) {
      console.error('Failed to send fee webhook:', webhookError);
      // Don't fail fee charging if webhook fails
    }

    return transaction;
  } catch (error) {
    console.error('Error creating network transaction fee:', error);
    throw error;
  }
};

/**
 * Calculate and create payout processing fee
 */
exports.createPayoutProcessingFee = async (merchantId, payoutId, payoutAmount, feeConfig) => {
  try {
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    const feeAmount = WalletTransaction.calculatePayoutFee(payoutAmount, feeConfig);

    if (feeAmount <= 0) {
      return null; // No fee to charge
    }

    const balanceBefore = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    // Deduct fee from wallet
    await wallet.deductFunds(feeAmount, false);

    const balanceAfter = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    // Create fee transaction
    const transaction = await WalletTransaction.createTransaction({
      wallet: wallet._id,
      merchant: merchantId,
      type: 'fee',
      amount: feeAmount,
      balanceBefore,
      balanceAfter,
      feeType: 'payout_processing',
      feeCalculation: feeConfig,
      feeStatus: 'charged',
      reference: {
        type: 'payout',
        id: payoutId
      },
      description: `Payout processing fee`
    });

    // Send webhook notification
    try {
      await webhookService.sendWalletTransactionWebhook(
        merchantId,
        webhookService.WALLET_EVENTS.FEE_CHARGED,
        {
          fee: transaction,
          transaction: transaction
        }
      );
    } catch (webhookError) {
      console.error('Failed to send fee webhook:', webhookError);
      // Don't fail fee charging if webhook fails
    }

    return transaction;
  } catch (error) {
    console.error('Error creating payout processing fee:', error);
    throw error;
  }
};

/**
 * Create platform subscription fee
 */
exports.createPlatformSubscriptionFee = async (merchantId, amount, period = 'monthly') => {
  try {
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    const balanceBefore = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    // Deduct fee from wallet
    await wallet.deductFunds(amount, false);

    const balanceAfter = {
      available: wallet.balance.available,
      reserved: wallet.balance.reserved,
      total: wallet.balance.total
    };

    // Create fee transaction
    const transaction = await WalletTransaction.createTransaction({
      wallet: wallet._id,
      merchant: merchantId,
      type: 'fee',
      amount: amount,
      balanceBefore,
      balanceAfter,
      feeType: 'platform_subscription',
      feeCalculation: {
        type: 'fixed',
        fixedAmount: amount
      },
      feeStatus: 'charged',
      reference: {
        type: 'subscription'
      },
      metadata: {
        period: period
      },
      description: `Platform subscription fee (${period})`
    });

    // Send webhook notification
    try {
      await webhookService.sendWalletTransactionWebhook(
        merchantId,
        webhookService.WALLET_EVENTS.FEE_CHARGED,
        {
          fee: transaction,
          transaction: transaction
        }
      );
    } catch (webhookError) {
      console.error('Failed to send fee webhook:', webhookError);
      // Don't fail fee charging if webhook fails
    }

    return transaction;
  } catch (error) {
    console.error('Error creating platform subscription fee:', error);
    throw error;
  }
};

/**
 * Get fee summary for a merchant
 */
exports.getFeeSummary = async (merchantId, startDate, endDate) => {
  try {
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    const query = {
      merchant: merchantId,
      wallet: wallet._id,
      type: 'fee',
      feeStatus: 'charged'
    };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const fees = await WalletTransaction.find(query);

    const summary = {
      totalFees: 0,
      byType: {},
      byStatus: {},
      count: fees.length
    };

    fees.forEach(fee => {
      summary.totalFees += fee.amount;

      if (!summary.byType[fee.feeType]) {
        summary.byType[fee.feeType] = { count: 0, total: 0 };
      }
      summary.byType[fee.feeType].count++;
      summary.byType[fee.feeType].total += fee.amount;

      if (!summary.byStatus[fee.feeStatus]) {
        summary.byStatus[fee.feeStatus] = { count: 0, total: 0 };
      }
      summary.byStatus[fee.feeStatus].count++;
      summary.byStatus[fee.feeStatus].total += fee.amount;
    });

    return summary;
  } catch (error) {
    console.error('Error getting fee summary:', error);
    throw error;
  }
};

/**
 * Get all fees for a merchant
 */
exports.getMerchantFees = async (merchantId, filters = {}) => {
  try {
    const wallet = await MerchantWallet.getOrCreate(merchantId);

    const query = {
      merchant: merchantId,
      wallet: wallet._id,
      type: 'fee'
    };

    if (filters.feeType) {
      query.feeType = filters.feeType;
    }

    if (filters.status) {
      query.feeStatus = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const fees = await WalletTransaction.find(query)
      .populate('reference.id')
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50)
      .skip(filters.skip || 0);

    const total = await WalletTransaction.countDocuments(query);

    return {
      fees,
      pagination: {
        total,
        page: Math.floor((filters.skip || 0) / (filters.limit || 50)) + 1,
        limit: filters.limit || 50,
        pages: Math.ceil(total / (filters.limit || 50))
      }
    };
  } catch (error) {
    console.error('Error getting merchant fees:', error);
    throw error;
  }
};

