const express = require('express');
const router = express.Router();
const pluginController = require('../controller/pluginController');
const { authenticatePlugin } = require('../middleware/pluginAuth');

// Public route - no auth required (merchantId is the auth)
router.post('/authenticate', pluginController.authenticate);

// Protected routes - require plugin token
router.get('/store/:storeId', authenticatePlugin, pluginController.getStoreInfo);
router.get('/test', authenticatePlugin, pluginController.testConnection);

// Alternative API key route (for future implementation)
router.get('/store', pluginController.getStoreByApiKey);

module.exports = router;

