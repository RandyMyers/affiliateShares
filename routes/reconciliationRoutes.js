const express = require('express');
const router = express.Router();
const reconciliationController = require('../controllers/reconciliationController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Reconcile transactions
router.post('/reconcile', reconciliationController.reconcileTransactions);

// Generate reconciliation report
router.get('/report', reconciliationController.generateReconciliationReport);

module.exports = router;


