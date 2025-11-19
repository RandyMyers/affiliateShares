const express = require('express');
const router = express.Router();
const analyticsController = require('../controller/analyticsController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Dashboard stats - available to merchants and admins
router.get('/dashboard', authorizeRoles(['admin', 'advertiser']), analyticsController.getDashboardStats);

// Program analytics - available to merchants and admins
router.get('/programs/:id', authorizeRoles(['admin', 'advertiser']), analyticsController.getProgramStats);

// Affiliate analytics - available to merchants, affiliates, and admins
router.get('/affiliates/:id', authorizeRoles(['admin', 'advertiser', 'affiliate']), analyticsController.getAffiliateStats);

// Time series data - available to merchants and admins
router.get('/timeseries', authorizeRoles(['admin', 'advertiser']), analyticsController.getTimeSeriesData);

module.exports = router;

