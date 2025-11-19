const express = require('express');
const router = express.Router();
const shortLinkController = require('../controllers/shortLinkController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All routes require authentication and affiliate role
router.use(authenticateToken);
router.use(authorizeRoles('affiliate', 'admin'));

// Create short link
router.post('/shorten', shortLinkController.createShortLink);

// Get all short links for current affiliate
router.get('/short', shortLinkController.getShortLinks);

// Get specific short link
router.get('/short/:shortLinkId', shortLinkController.getShortLink);

// Update short link
router.put('/short/:shortLinkId', shortLinkController.updateShortLink);

// Delete short link
router.delete('/short/:shortLinkId', shortLinkController.deleteShortLink);

// Get analytics for short link
router.get('/short/:shortLinkId/analytics', shortLinkController.getShortLinkAnalytics);

// Public redirect route (no auth required)
router.get('/s/:slug', shortLinkController.redirectShortLink);

module.exports = router;

