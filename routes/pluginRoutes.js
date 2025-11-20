const express = require('express');
const router = express.Router();
const pluginController = require('../controller/pluginController');
const { authenticatePlugin } = require('../middleware/pluginAuth');

// Simplified approach: All routes use Merchant ID (like ShareASale)
// Merchant ID can be sent in:
// - Header: X-Merchant-ID
// - Query: ?merchantId=...
// - Body: { merchantId: ... }

// Get store info - requires Merchant ID
router.get('/store', authenticatePlugin, pluginController.getStoreInfo);

// Test connection - requires Merchant ID
router.get('/test', authenticatePlugin, pluginController.testConnection);

// Keep authenticate endpoint for backward compatibility (optional)
router.post('/authenticate', pluginController.authenticate);

module.exports = router;

