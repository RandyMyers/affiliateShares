const express = require('express');
const router = express.Router();
const affiliateRatingController = require('../controllers/affiliateRatingController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All routes require authentication
router.post('/', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateRatingController.createOrUpdateRating);
router.get('/affiliate/:affiliateId', authenticateToken, affiliateRatingController.getAffiliateRatings);
router.get('/affiliate/:affiliateId/average', authenticateToken, affiliateRatingController.getAffiliateAverageRating);
router.delete('/:ratingId', authenticateToken, authorizeRoles(['admin', 'advertiser']), affiliateRatingController.deleteRating);

module.exports = router;

