const express = require('express');
const router = express.Router();
const invitationTemplateController = require('../controllers/invitationTemplateController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All routes require authentication and merchant role
router.get('/', authenticateToken, authorizeRoles(['admin', 'advertiser']), invitationTemplateController.getTemplates);
router.get('/:templateId', authenticateToken, authorizeRoles(['admin', 'advertiser']), invitationTemplateController.getTemplate);
router.post('/', authenticateToken, authorizeRoles(['admin', 'advertiser']), invitationTemplateController.createTemplate);
router.put('/:templateId', authenticateToken, authorizeRoles(['admin', 'advertiser']), invitationTemplateController.updateTemplate);
router.delete('/:templateId', authenticateToken, authorizeRoles(['admin', 'advertiser']), invitationTemplateController.deleteTemplate);
router.post('/:templateId/duplicate', authenticateToken, authorizeRoles(['admin', 'advertiser']), invitationTemplateController.duplicateTemplate);

module.exports = router;

