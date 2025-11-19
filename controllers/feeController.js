const feeService = require('../services/feeService');
const { sendResponse } = require('../utils/response');

// Get fee summary
exports.getFeeSummary = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { startDate, endDate } = req.query;

    // Check if user is merchant
    if (req.user.role !== 'advertiser' && req.user.role !== 'admin') {
      return sendResponse(res, 403, 'Access denied. Merchant role required.', null);
    }

    const summary = await feeService.getFeeSummary(merchantId, startDate, endDate);

    return sendResponse(res, 200, 'Fee summary retrieved successfully', summary);
  } catch (error) {
    next(error);
  }
};

// Get merchant fees
exports.getMerchantFees = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const {
      feeType,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    // Check if user is merchant
    if (req.user.role !== 'advertiser' && req.user.role !== 'admin') {
      return sendResponse(res, 403, 'Access denied. Merchant role required.', null);
    }

    const filters = {
      feeType,
      status,
      startDate,
      endDate,
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    };

    const result = await feeService.getMerchantFees(merchantId, filters);

    return sendResponse(res, 200, 'Fees retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

// Waive a fee (admin/merchant action)
exports.waiveFee = async (req, res, next) => {
  try {
    const { feeId } = req.params;
    const WalletTransaction = require('../models/WalletTransaction');

    // Check if user is merchant or admin
    if (req.user.role !== 'advertiser' && req.user.role !== 'admin') {
      return sendResponse(res, 403, 'Access denied.', null);
    }

    const fee = await WalletTransaction.findById(feeId)
      .populate('merchant');

    if (!fee) {
      return sendResponse(res, 404, 'Fee not found', null);
    }

    // Verify it's a fee transaction
    if (fee.type !== 'fee') {
      return sendResponse(res, 400, 'Transaction is not a fee', null);
    }

    // Verify merchant owns this fee (unless admin)
    if (req.user.role !== 'admin' && fee.merchant._id.toString() !== req.user.id) {
      return sendResponse(res, 403, 'Access denied', null);
    }

    // Only charged fees can be waived
    if (fee.feeStatus !== 'charged') {
      return sendResponse(res, 400, 'Only charged fees can be waived', null);
    }

    await fee.waiveFee(req.user.id);

    return sendResponse(res, 200, 'Fee waived successfully', fee);
  } catch (error) {
    next(error);
  }
};


