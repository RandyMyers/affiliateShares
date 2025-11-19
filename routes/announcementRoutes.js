const express = require('express');
const router = express.Router();
const announcementController = require('../controller/announcementController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');
const { body } = require('express-validator');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const createAnnouncementValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('type').optional().isIn(['info', 'warning', 'success', 'important']).withMessage('Invalid announcement type'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority')
];

const updateAnnouncementValidation = [
  body('title').optional().trim().notEmpty(),
  body('message').optional().trim().notEmpty(),
  body('isActive').optional().isBoolean()
];

// Affiliate routes (view, mark as read) - MUST come before /:id routes
router.get('/affiliate/active', authorizeRoles(['admin', 'advertiser', 'affiliate']), announcementController.getActiveAnnouncements);
router.post('/:id/read', authorizeRoles(['admin', 'advertiser', 'affiliate']), announcementController.markAsRead);

// Merchant routes (create, manage)
router.get('/', authorizeRoles(['admin', 'advertiser']), announcementController.getAnnouncements);
router.get('/:id', authorizeRoles(['admin', 'advertiser']), announcementController.getAnnouncement);
router.post('/', authorizeRoles(['admin', 'advertiser']), validateRequest(createAnnouncementValidation), announcementController.createAnnouncement);
router.put('/:id', authorizeRoles(['admin', 'advertiser']), validateRequest(updateAnnouncementValidation), announcementController.updateAnnouncement);
router.delete('/:id', authorizeRoles(['admin', 'advertiser']), announcementController.deleteAnnouncement);

module.exports = router;

