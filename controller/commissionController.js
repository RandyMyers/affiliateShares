const Commission = require('../models/commission');
const Order = require('../models/order');
const Store = require('../models/store');
const Affiliate = require('../models/affiliate');
const walletController = require('../controllers/walletController');
const feeService = require('../services/feeService');
const { sendResponse } = require('../utils/response');

// Get commissions for store (merchant view)
exports.getStoreCommissions = async (req, res, next) => {
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

    const commissions = await Commission.find(query)
      .populate('affiliate', 'referralCode')
      .populate('order', 'orderData.orderNumber orderData.total orderData.currency orderDate')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Commission.countDocuments(query);

    // Calculate totals
    const totals = await Commission.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    return sendResponse(res, 200, 'Commissions retrieved successfully', {
      commissions,
      totals,
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

// Get commissions for affiliate
exports.getAffiliateCommissions = async (req, res, next) => {
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

    const commissions = await Commission.find(query)
      .populate('store', 'name domain')
      .populate('order', 'orderData.orderNumber orderData.total orderData.currency orderDate')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Commission.countDocuments(query);

    // Calculate totals
    const totals = await Commission.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    return sendResponse(res, 200, 'Commissions retrieved successfully', {
      commissions,
      totals,
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

// Get single commission
exports.getCommission = async (req, res, next) => {
  try {
    const { commissionId } = req.params;

    const commission = await Commission.findById(commissionId)
      .populate('affiliate', 'referralCode')
      .populate('store', 'name domain')
      .populate('order')
      .populate('approvedBy', 'username email');

    if (!commission) {
      return sendResponse(res, 404, 'Commission not found', null);
    }

    // Check permissions
    if (req.user.role === 'advertiser' || req.user.role === 'admin') {
      const store = await Store.findOne({ _id: commission.store, merchant: req.user.id });
      if (!store) {
        return sendResponse(res, 403, 'Access denied', null);
      }
    } else if (req.user.role === 'affiliate') {
      const affiliate = await Affiliate.findOne({ user: req.user.id });
      if (!affiliate || commission.affiliate.toString() !== affiliate._id.toString()) {
        return sendResponse(res, 403, 'Access denied', null);
      }
    }

    return sendResponse(res, 200, 'Commission retrieved successfully', commission);
  } catch (error) {
    next(error);
  }
};

// Approve commission (merchant action)
exports.approveCommission = async (req, res, next) => {
  try {
    const { commissionId } = req.params;

    const commission = await Commission.findById(commissionId)
      .populate('store')
      .populate('affiliate');

    if (!commission) {
      return sendResponse(res, 404, 'Commission not found', null);
    }

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: commission.store,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 403, 'Access denied', null);
    }

    // Check if commission was previously reserved (pending status)
    const wasPending = commission.status === 'pending';
    
    // Approve commission
    await commission.approve(req.user.id);

    // Update wallet: Approve commission (deduct from reserved balance)
    try {
      if (wasPending) {
        // Commission was pending, so it should have been reserved
        // Approve it (deduct from reserved, mark as paid)
        await walletController.approveCommission(
          req.user.id,
          commission.amount,
          {
            type: 'commission',
            id: commission._id
          },
          `Commission approved for order ${commission.order?.orderData?.orderNumber || commission.order}`
        );
      } else {
        // Commission was not pending, deduct directly from available balance
        await walletController.deductFromWallet(
          req.user.id,
          commission.amount,
          {
            type: 'commission',
            id: commission._id
          },
          `Commission payment for order ${commission.order?.orderData?.orderNumber || commission.order}`
        );
      }

      // Charge network transaction fee (e.g., 20% of commission)
      // TODO: Get fee rate from store settings or platform config
      const networkFeeRate = process.env.NETWORK_FEE_RATE || 20; // Default 20%
      try {
        await feeService.createNetworkTransactionFee(
          req.user.id,
          commission._id,
          commission.amount,
          networkFeeRate
        );
      } catch (feeError) {
        console.error('Failed to charge network fee:', feeError);
        // Don't fail commission approval if fee charging fails
      }
    } catch (walletError) {
      // If wallet operation fails, log but don't fail the approval
      // Commission is already approved, but wallet wasn't updated
      console.error('Wallet operation failed during commission approval:', walletError);
      // Optionally, you could revert the commission approval here
    }

    // Update affiliate stats
    if (commission.affiliate) {
      const affiliate = await Affiliate.findById(commission.affiliate);
      if (affiliate) {
        const storeApplication = affiliate.stores.find(
          s => s.store.toString() === commission.store.toString()
        );
        if (storeApplication) {
          storeApplication.stats.commissions += commission.amount;
        }
        affiliate.stats.totalPending -= commission.amount;
        await affiliate.save();
      }
    }

    return sendResponse(res, 200, 'Commission approved successfully', commission);
  } catch (error) {
    next(error);
  }
};

// Bulk approve commissions
exports.bulkApproveCommissions = async (req, res, next) => {
  try {
    const { commissionIds, storeId } = req.body;

    // Verify store belongs to merchant if storeId provided
    if (storeId) {
      const store = await Store.findOne({
        _id: storeId,
        merchant: req.user.id
      });

      if (!store) {
        return sendResponse(res, 404, 'Store not found', null);
      }
    }

    // Build query
    const query = { _id: { $in: commissionIds }, status: 'pending' };
    if (storeId) query.store = storeId;

    const commissions = await Commission.find(query);

    // Approve all commissions
    for (const commission of commissions) {
      const wasPending = commission.status === 'pending';
      
      await commission.approve(req.user.id);

      // Update wallet
      try {
        if (wasPending) {
          await walletController.approveCommission(
            req.user.id,
            commission.amount,
            {
              type: 'commission',
              id: commission._id
            },
            `Bulk commission approval for order ${commission.order}`
          );
        } else {
          await walletController.deductFromWallet(
            req.user.id,
            commission.amount,
            {
              type: 'commission',
              id: commission._id
            },
            `Bulk commission payment for order ${commission.order}`
          );
        }
      } catch (walletError) {
        console.error(`Wallet operation failed for commission ${commission._id}:`, walletError);
      }

      // Update affiliate stats
      if (commission.affiliate) {
        const affiliate = await Affiliate.findById(commission.affiliate);
        if (affiliate) {
          const storeApplication = affiliate.stores.find(
            s => s.store.toString() === commission.store.toString()
          );
          if (storeApplication) {
            storeApplication.stats.commissions += commission.amount;
          }
          affiliate.stats.totalPending -= commission.amount;
          await affiliate.save();
        }
      }
    }

    return sendResponse(res, 200, `${commissions.length} commissions approved successfully`, {
      approved: commissions.length
    });
  } catch (error) {
    next(error);
  }
};

// Cancel/Refund commission
exports.cancelCommission = async (req, res, next) => {
  try {
    const { commissionId } = req.params;
    const { reason } = req.body;

    const commission = await Commission.findById(commissionId);

    if (!commission) {
      return sendResponse(res, 404, 'Commission not found', null);
    }

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: commission.store,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 403, 'Access denied', null);
    }

    // Only cancel pending or approved commissions
    if (commission.status === 'paid') {
      return sendResponse(res, 400, 'Cannot cancel paid commission', null);
    }

    const wasPending = commission.status === 'pending';
    const wasApproved = commission.status === 'approved';

    commission.status = 'cancelled';
    if (reason) commission.notes = reason;
    await commission.save();

    // Update wallet: Release reservation if was pending
    try {
      if (wasPending) {
        // Release reserved funds
        await walletController.releaseReservation(
          req.user.id,
          commission.amount,
          {
            type: 'commission',
            id: commission._id
          },
          `Commission cancelled: ${reason || 'No reason provided'}`
        );
      } else if (wasApproved) {
        // Was approved, refund to wallet
        await walletController.refundToWallet(
          req.user.id,
          commission.amount,
          {
            type: 'commission',
            id: commission._id
          },
          `Commission cancelled and refunded: ${reason || 'No reason provided'}`
        );
      }
    } catch (walletError) {
      console.error('Wallet operation failed during commission cancellation:', walletError);
    }

    // Update affiliate stats
    if (commission.affiliate) {
      const affiliate = await Affiliate.findById(commission.affiliate);
      if (affiliate) {
        if (wasApproved) {
          // Was approved, so remove from pending
          affiliate.stats.totalPending -= commission.amount;
        }
        affiliate.stats.totalEarnings -= commission.amount;
        await affiliate.save();
      }
    }

    return sendResponse(res, 200, 'Commission cancelled successfully', commission);
  } catch (error) {
    next(error);
  }
};

// Adjust commission amount (manual override)
exports.adjustCommission = async (req, res, next) => {
  try {
    const { commissionId } = req.params;
    const { newAmount, reason } = req.body;

    if (!newAmount || newAmount < 0) {
      return sendResponse(res, 400, 'Valid new amount is required', null);
    }

    const commission = await Commission.findById(commissionId);

    if (!commission) {
      return sendResponse(res, 404, 'Commission not found', null);
    }

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: commission.store,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 403, 'Access denied', null);
    }

    // Cannot adjust paid commissions
    if (commission.status === 'paid') {
      return sendResponse(res, 400, 'Cannot adjust paid commission', null);
    }

    const oldAmount = commission.amount;
    const difference = newAmount - oldAmount;

    // Update commission
    commission.amount = newAmount;
    commission.rate = (newAmount / commission.orderTotal) * 100;
    
    // Add adjustment note
    const adjustmentNote = `Manual adjustment: ${oldAmount.toFixed(2)} → ${newAmount.toFixed(2)}${reason ? ` - ${reason}` : ''}`;
    commission.notes = commission.notes 
      ? `${commission.notes}\n${adjustmentNote}` 
      : adjustmentNote;

    await commission.save();

    // Update affiliate stats if commission was approved
    if (commission.affiliate && commission.status === 'approved') {
      const affiliate = await Affiliate.findById(commission.affiliate);
      if (affiliate) {
        affiliate.stats.totalPending += difference;
        affiliate.stats.totalEarnings += difference;
        await affiliate.save();
      }
    }

    return sendResponse(res, 200, 'Commission adjusted successfully', commission);
  } catch (error) {
    next(error);
  }
};

