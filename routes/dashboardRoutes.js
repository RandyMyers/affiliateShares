const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// @route   GET /api/dashboard/overview
// @desc    Get dashboard overview statistics
// @access  Private (Merchant/Admin)
router.get('/overview', authenticateToken, authorizeRoles(['admin', 'advertiser']), dashboardController.getDashboardOverview);

module.exports = router;

