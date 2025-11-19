const express = require('express');
const router = express.Router();
const broadcastController = require('../controller/broadcastController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');
const { body } = require('express-validator');

// All routes require authentication and advertiser/admin role
router.use(authenticateToken);
router.use(authorizeRoles(['admin', 'advertiser']));

// Validation rules
const createBroadcastValidation = [
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('targetAffiliates').isIn(['all', 'active', 'selected', 'program']).withMessage('Invalid target type')
];

// Routes
router.get('/', broadcastController.getBroadcasts);
router.get('/:id', broadcastController.getBroadcast);
router.get('/:id/stats', broadcastController.getBroadcastStats);
router.post('/', validateRequest(createBroadcastValidation), broadcastController.createBroadcast);
router.post('/:id/send', broadcastController.sendBroadcast);
router.put('/:id', validateRequest(createBroadcastValidation), broadcastController.updateBroadcast);
router.delete('/:id', broadcastController.deleteBroadcast);

module.exports = router;

