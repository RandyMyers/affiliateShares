const Payout = require('../models/payout');
const Commission = require('../models/commission');
const Affiliate = require('../models/affiliate');
const Store = require('../models/store');
const walletController = require('../controllers/walletController');
const feeService = require('../services/feeService');
const { sendResponse } = require('../utils/response');

// Get payouts for store (merchant view)
exports.getStorePayouts = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Build query
    const query = { store: storeId };
    if (status) query.status = status;

    const payouts = await Payout.find(query)
      .populate('affiliate', 'referralCode')
      .populate('commissions')
      .populate('processedBy', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payout.countDocuments(query);

    return sendResponse(res, 200, 'Payouts retrieved successfully', {
      payouts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get payouts for affiliate
exports.getAffiliatePayouts = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    // Get affiliate
    const affiliate = await Affiliate.findOne({ user: req.user.id });
    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate profile not found', null);
    }

    // Build query
    const query = { affiliate: affiliate._id };
    if (storeId) query.store = storeId;
    if (status) query.status = status;

    const payouts = await Payout.find(query)
      .populate('store', 'name domain')
      .populate('commissions')
      .populate('paymentMethodRef')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payout.countDocuments(query);

    return sendResponse(res, 200, 'Payouts retrieved successfully', {
      payouts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Request payout (affiliate action)
exports.requestPayout = async (req, res, next) => {
  try {
    const { storeId, commissionIds, paymentMethodId, amount, notes } = req.body;
    const PaymentMethod = require('../models/paymentMethod');

    // Get affiliate
    const affiliate = await Affiliate.findOne({ user: req.user.id });
    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate profile not found', null);
    }

    // Validate payment method
    if (!paymentMethodId) {
      return sendResponse(res, 400, 'Payment method is required', null);
    }

    const paymentMethod = await PaymentMethod.findOne({
      _id: paymentMethodId,
      affiliate: affiliate._id,
      status: 'active'
    });

    if (!paymentMethod) {
      return sendResponse(res, 400, 'Invalid or inactive payment method', null);
    }

    // Get pending commissions
    const query = {
      affiliate: affiliate._id,
      status: 'approved',
      paidOut: { $ne: true }
    };

    if (storeId) {
      query.store = storeId;
    }

    if (commissionIds && commissionIds.length > 0) {
      query._id = { $in: commissionIds };
    }

    const commissions = await Commission.find(query).populate('store');

    if (commissions.length === 0) {
      return sendResponse(res, 400, 'No eligible commissions found', null);
    }

    // Group by store
    const commissionsByStore = {};
    commissions.forEach(commission => {
      const storeId = commission.store._id.toString();
      if (!commissionsByStore[storeId]) {
        commissionsByStore[storeId] = {
          store: commission.store,
          commissions: []
        };
      }
      commissionsByStore[storeId].commissions.push(commission);
    });

    // Create payouts for each store
    const payouts = [];
    for (const storeId in commissionsByStore) {
      const { store, commissions: storeCommissions } = commissionsByStore[storeId];
      
      // Calculate total amount
      let totalAmount = storeCommissions.reduce((sum, c) => sum + c.amount, 0);
      
      // If amount is specified, use it (but validate it doesn't exceed available)
      if (amount && parseFloat(amount) > 0) {
        if (parseFloat(amount) > totalAmount) {
          return sendResponse(res, 400, `Requested amount exceeds available balance of $${totalAmount.toFixed(2)}`, null);
        }
        totalAmount = parseFloat(amount);
      }
      
      // Check minimum payout
      if (totalAmount < store.settings.minimumPayout) {
        continue; // Skip if below minimum
      }

      // Build payment details from payment method
      const paymentDetails = {};
      if (paymentMethod.type === 'paypal') {
        paymentDetails.recipientEmail = paymentMethod.paypalEmail;
      } else if (paymentMethod.type === 'bank_transfer') {
        paymentDetails.bankName = paymentMethod.bankName;
        paymentDetails.accountNumber = paymentMethod.accountNumber;
        paymentDetails.accountName = paymentMethod.accountName;
      } else {
        paymentDetails.recipientEmail = paymentMethod.gatewayEmail;
        paymentDetails.recipientPhone = paymentMethod.gatewayPhone;
      }

      // Create payout
      const payout = new Payout({
        affiliate: affiliate._id,
        store: store._id,
        commissions: storeCommissions.map(c => c._id),
        amount: totalAmount,
        currency: storeCommissions[0].currency || 'USD',
        paymentMethodRef: paymentMethod._id,
        paymentMethod: paymentMethod.type,
        paymentDetails: paymentDetails,
        notes: notes || '',
        status: 'pending'
      });

      await payout.save();
      payouts.push(payout);

      // Mark commissions as processing
      for (const commission of storeCommissions) {
        commission.paidOut = true;
        await commission.save();
      }
    }

    if (payouts.length === 0) {
      return sendResponse(res, 400, 'No payouts created. Check minimum payout requirements.', null);
    }

    // Populate payment method reference for response
    await Payout.populate(payouts, { path: 'paymentMethodRef' });

    return sendResponse(res, 201, 'Payout request created successfully', payouts);
  } catch (error) {
    next(error);
  }
};

// Process payout (merchant/admin action - will integrate with payment gateways)
exports.processPayout = async (req, res, next) => {
  try {
    const { payoutId } = req.params;
    const { gatewayResponse } = req.body;

    const payout = await Payout.findById(payoutId)
      .populate('store')
      .populate('affiliate')
      .populate('commissions');

    if (!payout) {
      return sendResponse(res, 404, 'Payout not found', null);
    }

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: payout.store,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 403, 'Access denied', null);
    }

    // Mark as processing
    await payout.markAsProcessing(req.user.id);

    // Integrate with payment gateways
    const paymentService = require('../services/payment/paymentService');
    
    try {
      // Prepare transfer data based on payment method
      let transferData = {};
      
      if (payout.paymentMethod === 'bank') {
        // Bank transfer
        transferData = {
          account_number: payout.paymentDetails.accountNumber,
          account_name: payout.paymentDetails.accountName,
          bank_code: payout.paymentDetails.bankCode || payout.paymentDetails.bankName,
          amount: payout.amount,
          currency: payout.currency,
          narration: `Affiliate commission payout - ${payout._id}`,
          reference: `PAYOUT_${payout._id}_${Date.now()}`
        };
      } else {
        // Payment gateway (Flutterwave, Paystack, Squad)
        transferData = {
          account_number: payout.paymentDetails.accountNumber,
          account_name: payout.paymentDetails.accountName,
          bank_code: payout.paymentDetails.bankCode,
          amount: payout.amount,
          currency: payout.currency,
          narration: `Affiliate commission payout - ${payout._id}`,
          reference: `PAYOUT_${payout._id}_${Date.now()}`
        };

        // Add gateway-specific fields
        if (payout.paymentMethod === 'paystack') {
          // Paystack requires recipient code first (if not already created)
          // For now, assume recipient exists or use account details directly
          transferData.recipient = payout.paymentDetails.recipientCode || payout.paymentDetails.accountNumber;
        } else if (payout.paymentMethod === 'flutterwave') {
          transferData.account_bank = payout.paymentDetails.bankCode;
          transferData.beneficiary_name = payout.paymentDetails.accountName;
        }
      }

      // Initiate transfer
      const transferResult = await paymentService.initiateTransfer(
        transferData,
        payout.paymentMethod
      );

      if (transferResult.success) {
        // Deduct from merchant wallet before marking as completed
        try {
          await walletController.deductFromWallet(
            store.merchant,
            payout.amount,
            {
              type: 'payout',
              id: payout._id
            },
            `Payout to affiliate ${payout.affiliate?.referralCode || payout.affiliate} - ${transferResult.reference || payout._id}`
          );

          // Charge payout processing fee
          // TODO: Get fee config from store settings or platform config
          const payoutFeeConfig = {
            type: 'percentage',
            rate: parseFloat(process.env.PAYOUT_FEE_RATE || 2.5) // Default 2.5%
          };
          try {
            await feeService.createPayoutProcessingFee(
              store.merchant,
              payout._id,
              payout.amount,
              payoutFeeConfig
            );
          } catch (feeError) {
            console.error('Failed to charge payout processing fee:', feeError);
            // Don't fail payout if fee charging fails
          }
        } catch (walletError) {
          // If wallet deduction fails, don't mark payout as completed
          console.error('Wallet deduction failed during payout processing:', walletError);
          await payout.markAsFailed({
            message: 'Insufficient wallet balance',
            code: 'INSUFFICIENT_BALANCE',
            details: { walletError: walletError.message }
          });
          return sendResponse(res, 400, 'Insufficient wallet balance to process payout', {
            error: 'Insufficient wallet balance',
            payout
          });
        }

        // Mark as completed
        await payout.markAsCompleted(
          transferResult.transferId || transferResult.transactionId,
          transferResult.reference,
          transferResult.gatewayResponse
        );
      } else {
        // Mark as failed
        await payout.markAsFailed({
          message: transferResult.message || 'Transfer failed',
          code: 'TRANSFER_FAILED',
          details: transferResult.gatewayResponse
        });
        return sendResponse(res, 400, 'Payout processing failed', {
          error: transferResult.message,
          payout
        });
      }
    } catch (error) {
      console.error('Payout processing error:', error);
      
      // Mark as failed
      await payout.markAsFailed({
        message: error.message || 'Transfer initiation failed',
        code: error.code || 'UNKNOWN',
        details: { error: error.toString() }
      });
      
      return sendResponse(res, 500, 'Failed to process payout', {
        error: error.message,
        payout
      });
    }

    // Update commissions
    for (const commission of payout.commissions) {
      await commission.markAsPaid(
        payout._id,
        payout.paymentMethod,
        transactionId
      );
    }

    // Update affiliate stats
    if (payout.affiliate) {
      const affiliate = await Affiliate.findById(payout.affiliate);
      if (affiliate) {
        affiliate.stats.totalPaid += payout.amount;
        affiliate.stats.totalPending -= payout.amount;
        await affiliate.save();
      }
    }

    return sendResponse(res, 200, 'Payout processed successfully', payout);
  } catch (error) {
    next(error);
  }
};

// Get single payout
exports.getPayout = async (req, res, next) => {
  try {
    const { payoutId } = req.params;

    const payout = await Payout.findById(payoutId)
      .populate('affiliate', 'referralCode')
      .populate('store', 'name domain')
      .populate('commissions')
      .populate('processedBy', 'username email');

    if (!payout) {
      return sendResponse(res, 404, 'Payout not found', null);
    }

    // Check permissions
    if (req.user.role === 'advertiser' || req.user.role === 'admin') {
      const store = await Store.findOne({ _id: payout.store, merchant: req.user.id });
      if (!store) {
        return sendResponse(res, 403, 'Access denied', null);
      }
    } else if (req.user.role === 'affiliate') {
      const affiliate = await Affiliate.findOne({ user: req.user.id });
      if (!affiliate || payout.affiliate.toString() !== affiliate._id.toString()) {
        return sendResponse(res, 403, 'Access denied', null);
      }
    }

    return sendResponse(res, 200, 'Payout retrieved successfully', payout);
  } catch (error) {
    next(error);
  }
};

// Cancel payout
exports.cancelPayout = async (req, res, next) => {
  try {
    const { payoutId } = req.params;
    const { reason } = req.body;

    const payout = await Payout.findById(payoutId);

    if (!payout) {
      return sendResponse(res, 404, 'Payout not found', null);
    }

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: payout.store,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 403, 'Access denied', null);
    }

    // Only cancel pending payouts
    if (payout.status !== 'pending') {
      return sendResponse(res, 400, 'Can only cancel pending payouts', null);
    }

    payout.status = 'cancelled';
    if (reason) payout.notes = reason;
    await payout.save();

    // Revert commission status
    const commissions = await Commission.find({ _id: { $in: payout.commissions } });
    for (const commission of commissions) {
      commission.status = 'approved';
      await commission.save();
    }

    return sendResponse(res, 200, 'Payout cancelled successfully', payout);
  } catch (error) {
    next(error);
  }
};

