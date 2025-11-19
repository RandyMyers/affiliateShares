const express = require('express');
const router = express.Router();
const invitationController = require('../controllers/invitationController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All routes require authentication and merchant role
router.post('/', authenticateToken, authorizeRoles(['admin', 'advertiser']), invitationController.createInvitation);
router.get('/', authenticateToken, authorizeRoles(['admin', 'advertiser']), invitationController.getInvitations);
router.get('/analytics', authenticateToken, authorizeRoles(['admin', 'advertiser']), invitationController.getInvitationAnalytics);
router.get('/:invitationId', authenticateToken, authorizeRoles(['admin', 'advertiser']), invitationController.getInvitation);
router.put('/:invitationId', authenticateToken, authorizeRoles(['admin', 'advertiser']), invitationController.updateInvitation);
router.delete('/:invitationId', authenticateToken, authorizeRoles(['admin', 'advertiser']), invitationController.deleteInvitation);
router.post('/:invitationId/resend', authenticateToken, authorizeRoles(['admin', 'advertiser']), invitationController.resendInvitation);
router.post('/:invitationId/reminder', authenticateToken, authorizeRoles(['admin', 'advertiser']), invitationController.sendReminder);

// Public tracking routes (no auth required)
router.get('/track/open', invitationController.trackOpen);
router.get('/track/click', invitationController.trackClick);

module.exports = router;

