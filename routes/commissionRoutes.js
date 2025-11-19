const express = require('express');
const router = express.Router();
const commissionController = require('../controller/commissionController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Merchant routes
router.get('/store/:storeId', authenticateToken, authorizeRoles(['admin', 'advertiser']), commissionController.getStoreCommissions);
router.get('/store/:storeId/:commissionId', authenticateToken, authorizeRoles(['admin', 'advertiser']), commissionController.getCommission);
router.post('/store/:storeId/:commissionId/approve', authenticateToken, authorizeRoles(['admin', 'advertiser']), commissionController.approveCommission);
router.post('/store/:storeId/bulk-approve', authenticateToken, authorizeRoles(['admin', 'advertiser']), commissionController.bulkApproveCommissions);
router.post('/store/:storeId/:commissionId/cancel', authenticateToken, authorizeRoles(['admin', 'advertiser']), commissionController.cancelCommission);
router.put('/store/:storeId/:commissionId/adjust', authenticateToken, authorizeRoles(['admin', 'advertiser']), commissionController.adjustCommission);

// Affiliate routes
router.get('/affiliate', authenticateToken, authorizeRoles(['affiliate']), commissionController.getAffiliateCommissions);
router.get('/affiliate/store/:storeId', authenticateToken, authorizeRoles(['affiliate']), commissionController.getAffiliateCommissions);
router.get('/affiliate/:commissionId', authenticateToken, authorizeRoles(['affiliate']), commissionController.getCommission);

// General route
router.get('/:commissionId', authenticateToken, commissionController.getCommission);

module.exports = router;

