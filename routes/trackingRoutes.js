const express = require('express');
const router = express.Router();
const trackingController = require('../controller/trackingController');
const { authenticateToken } = require('../middleware/auth');

// Public routes (no auth required for tracking)
router.get('/click', trackingController.trackClick);
router.get('/:trackingCode.js', trackingController.serveTrackingScript);

// Protected routes for statistics
router.get('/stats', authenticateToken, trackingController.getClickStats);

module.exports = router;

