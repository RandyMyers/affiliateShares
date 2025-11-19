const express = require('express');
const router = express.Router();
const savedSearchController = require('../controllers/savedSearchController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All routes require authentication and merchant role
router.get('/', authenticateToken, authorizeRoles(['admin', 'advertiser']), savedSearchController.getSavedSearches);
router.get('/:searchId', authenticateToken, authorizeRoles(['admin', 'advertiser']), savedSearchController.getSavedSearch);
router.post('/', authenticateToken, authorizeRoles(['admin', 'advertiser']), savedSearchController.createSavedSearch);
router.put('/:searchId', authenticateToken, authorizeRoles(['admin', 'advertiser']), savedSearchController.updateSavedSearch);
router.delete('/:searchId', authenticateToken, authorizeRoles(['admin', 'advertiser']), savedSearchController.deleteSavedSearch);
router.post('/:searchId/execute', authenticateToken, authorizeRoles(['admin', 'advertiser']), savedSearchController.executeSavedSearch);
router.post('/:searchId/alerts/toggle', authenticateToken, authorizeRoles(['admin', 'advertiser']), savedSearchController.toggleAlerts);

module.exports = router;

