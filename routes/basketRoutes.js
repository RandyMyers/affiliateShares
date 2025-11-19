const express = require('express');
const router = express.Router();
const basketController = require('../controllers/basketController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All routes require authentication and merchant role
router.get('/', authenticateToken, authorizeRoles(['admin', 'advertiser']), basketController.getBaskets);
router.get('/:basketId', authenticateToken, authorizeRoles(['admin', 'advertiser']), basketController.getBasket);
router.post('/', authenticateToken, authorizeRoles(['admin', 'advertiser']), basketController.createBasket);
router.put('/:basketId', authenticateToken, authorizeRoles(['admin', 'advertiser']), basketController.updateBasket);
router.delete('/:basketId', authenticateToken, authorizeRoles(['admin', 'advertiser']), basketController.deleteBasket);
router.post('/:basketId/affiliates', authenticateToken, authorizeRoles(['admin', 'advertiser']), basketController.addAffiliates);
router.delete('/:basketId/affiliates/:affiliateId', authenticateToken, authorizeRoles(['admin', 'advertiser']), basketController.removeAffiliate);
router.post('/:basketId/duplicate', authenticateToken, authorizeRoles(['admin', 'advertiser']), basketController.duplicateBasket);
router.get('/:basketId/export', authenticateToken, authorizeRoles(['admin', 'advertiser']), basketController.exportBasket);

module.exports = router;

