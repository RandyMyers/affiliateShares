const express = require('express');
const router = express.Router();
const orderController = require('../controller/orderController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Public route for webhook (no auth required, but should verify webhook secret)
router.post('/webhook', orderController.processOrder);

// Merchant routes
router.get('/store/:storeId', authenticateToken, authorizeRoles(['admin', 'advertiser']), orderController.getStoreOrders);
router.get('/store/:storeId/:orderId', authenticateToken, authorizeRoles(['admin', 'advertiser']), orderController.getOrder);
router.put('/store/:storeId/:orderId/status', authenticateToken, authorizeRoles(['admin', 'advertiser']), orderController.updateOrderStatus);

// Affiliate routes
router.get('/affiliate', authenticateToken, authorizeRoles(['affiliate']), orderController.getAffiliateOrders);
router.get('/affiliate/store/:storeId', authenticateToken, authorizeRoles(['affiliate']), orderController.getAffiliateOrders);
router.get('/affiliate/:orderId', authenticateToken, authorizeRoles(['affiliate']), orderController.getOrder);

// General route
router.get('/:orderId', authenticateToken, orderController.getOrder);

module.exports = router;

