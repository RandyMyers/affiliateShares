const express = require('express');
const router = express.Router();
const payoutController = require('../controller/payoutController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');
const { body } = require('express-validator');

// Affiliate routes
router.post('/request', authenticateToken, authorizeRoles(['affiliate']), payoutController.requestPayout);
router.get('/affiliate', authenticateToken, authorizeRoles(['affiliate']), payoutController.getAffiliatePayouts);
router.get('/affiliate/store/:storeId', authenticateToken, authorizeRoles(['affiliate']), payoutController.getAffiliatePayouts);
router.get('/affiliate/:payoutId', authenticateToken, authorizeRoles(['affiliate']), payoutController.getPayout);

// Merchant routes
router.get('/store/:storeId', authenticateToken, authorizeRoles(['admin', 'advertiser']), payoutController.getStorePayouts);
router.get('/store/:storeId/:payoutId', authenticateToken, authorizeRoles(['admin', 'advertiser']), payoutController.getPayout);
router.post('/store/:storeId/:payoutId/process', authenticateToken, authorizeRoles(['admin', 'advertiser']), payoutController.processPayout);
router.post('/store/:storeId/:payoutId/cancel', authenticateToken, authorizeRoles(['admin', 'advertiser']), payoutController.cancelPayout);

// General route
router.get('/:payoutId', authenticateToken, payoutController.getPayout);

module.exports = router;

