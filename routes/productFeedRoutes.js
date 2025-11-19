const express = require('express');
const router = express.Router();
const productFeedController = require('../controllers/productFeedController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Merchant routes (authenticated)
router.get('/store/:storeId/csv', authenticateToken, authorizeRoles('admin', 'advertiser'), productFeedController.generateCSVFeed);
router.get('/store/:storeId/xml', authenticateToken, authorizeRoles('admin', 'advertiser'), productFeedController.generateXMLFeed);
router.get('/store/:storeId/url', authenticateToken, authorizeRoles('admin', 'advertiser'), productFeedController.getFeedUrl);

module.exports = router;

