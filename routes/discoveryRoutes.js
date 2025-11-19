const express = require('express');
const router = express.Router();
const discoveryController = require('../controllers/discoveryController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All routes require authentication and merchant role
router.get('/affiliates', authenticateToken, authorizeRoles(['admin', 'advertiser']), discoveryController.discoverAffiliates);
router.get('/affiliates/suggestions', authenticateToken, authorizeRoles(['admin', 'advertiser']), discoveryController.getSearchSuggestions);
router.get('/affiliates/:affiliateId', authenticateToken, authorizeRoles(['admin', 'advertiser']), discoveryController.getAffiliateProfile);
router.get('/categories', authenticateToken, authorizeRoles(['admin', 'advertiser']), discoveryController.getCategories);
router.get('/stats', authenticateToken, authorizeRoles(['admin', 'advertiser']), discoveryController.getDiscoveryStats);
router.post('/compare', authenticateToken, authorizeRoles(['admin', 'advertiser']), discoveryController.compareAffiliates);

module.exports = router;

