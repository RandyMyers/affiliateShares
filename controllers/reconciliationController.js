const reconciliationService = require('../services/reconciliationService');
const { sendResponse } = require('../utils/response');

// Reconcile transactions
exports.reconcileTransactions = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { externalRecords, options } = req.body;

    // Check if user is merchant
    if (req.user.role !== 'advertiser' && req.user.role !== 'admin') {
      return sendResponse(res, 403, 'Access denied. Merchant role required.', null);
    }

    if (!externalRecords || !Array.isArray(externalRecords)) {
      return sendResponse(res, 400, 'External records array is required', null);
    }

    const reconciliation = await reconciliationService.reconcileTransactions(
      merchantId,
      externalRecords,
      options || {}
    );

    return sendResponse(res, 200, 'Reconciliation completed successfully', reconciliation);
  } catch (error) {
    next(error);
  }
};

// Generate reconciliation report
exports.generateReconciliationReport = async (req, res, next) => {
  try {
    const merchantId = req.user.id;
    const { startDate, endDate } = req.query;

    // Check if user is merchant
    if (req.user.role !== 'advertiser' && req.user.role !== 'admin') {
      return sendResponse(res, 403, 'Access denied. Merchant role required.', null);
    }

    const report = await reconciliationService.generateReconciliationReport(
      merchantId,
      startDate,
      endDate
    );

    return sendResponse(res, 200, 'Reconciliation report generated successfully', report);
  } catch (error) {
    next(error);
  }
};


