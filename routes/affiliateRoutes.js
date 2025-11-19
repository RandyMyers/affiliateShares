const express = require('express');
const router = express.Router();
const affiliateController = require('../controller/affiliateController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');
const { body } = require('express-validator');

// Public routes (for affiliates to manage their own profile)
router.get('/me', authenticateToken, affiliateController.getMyAffiliateProfile);
router.post('/me', authenticateToken, authorizeRoles(['admin', 'affiliate']), affiliateController.createAffiliateProfile);
router.put('/me', authenticateToken, authorizeRoles(['admin', 'affiliate']), affiliateController.updateAffiliateProfile);

// Merchant routes (all affiliates across all stores)
router.get('/merchant/all', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.getAllMerchantAffiliates);
router.get('/merchant/summary', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.getMerchantAffiliateSummary);

// Store-specific routes (for merchants)
router.get('/store/:storeId', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.getStoreAffiliates);
router.get('/store/:storeId/summary', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.getStoreAffiliateSummary);
router.get('/store/:storeId/stats/:affiliateId', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.getAffiliateStats);
router.get('/store/:storeId/export', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.exportStoreAffiliates);
router.post('/store/:storeId/apply', authenticateToken, authorizeRoles(['affiliate']), affiliateController.applyToStore);
router.post('/store/:storeId/approve/:affiliateId', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.approveAffiliate);
router.post('/store/:storeId/reject/:affiliateId', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.rejectAffiliate);
router.post('/store/:storeId/suspend/:affiliateId', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.suspendAffiliate);
router.post('/store/:storeId/activate/:affiliateId', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.activateAffiliate);
router.post('/store/:storeId/terminate/:affiliateId', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.terminateAffiliate);
router.put('/store/:storeId/commission/:affiliateId', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.updateAffiliateCommissionRate);
router.post('/store/:storeId/bulk', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.bulkUpdateAffiliates);

// Tag management routes
router.post('/store/:storeId/tags/:affiliateId', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.addTagsToAffiliate);
router.delete('/store/:storeId/tags/:affiliateId', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.removeTagsFromAffiliate);
router.get('/store/:storeId/tags', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateController.getStoreAffiliateTags);

// General affiliate routes
router.get('/:affiliateId', authenticateToken, affiliateController.getAffiliate);
router.get('/:affiliateId/stats', authenticateToken, affiliateController.getAffiliateStats);

module.exports = router;

