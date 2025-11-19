const express = require('express');
const router = express.Router();
const programController = require('../controller/programController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');
const { body } = require('express-validator');

// All routes require authentication and advertiser/admin role
router.use(authenticateToken);
router.use(authorizeRoles(['admin', 'advertiser']));

// Validation rules
const createProgramValidation = [
  body('name').trim().notEmpty().withMessage('Program name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('store').notEmpty().withMessage('Store is required').isMongoId().withMessage('Invalid store ID'),
  body('commissionStructure.type').isIn(['flat', 'percentage', 'tiered']).withMessage('Invalid commission type'),
  body('commissionStructure.rate').isFloat({ min: 0 }).withMessage('Commission rate must be positive'),
  body('terms').trim().notEmpty().withMessage('Terms are required'),
  body('settings.cookieDuration').optional().isInt({ min: 1, max: 365 }).withMessage('Cookie duration must be between 1 and 365 days'),
  body('settings.approvalWorkflow').optional().isIn(['auto', 'manual']).withMessage('Invalid approval workflow')
];

const updateProgramValidation = [
  body('name').optional().trim().notEmpty(),
  body('description').optional().trim().notEmpty(),
  body('status').optional().isIn(['active', 'paused', 'terminated']),
  body('settings.cookieDuration').optional().isInt({ min: 1, max: 365 }),
  body('settings.approvalWorkflow').optional().isIn(['auto', 'manual'])
];

// Routes
router.get('/', programController.getPrograms);
router.get('/:id', programController.getProgram);
router.get('/:id/stats', programController.getProgramStats);
router.get('/:id/applications', programController.getApplications);
router.post('/', validateRequest(createProgramValidation), programController.createProgram);
router.put('/:id', validateRequest(updateProgramValidation), programController.updateProgram);
router.put('/:id/settings', validateRequest(updateProgramValidation), programController.updateProgramSettings);
router.put('/:id/commission', validateRequest([
  body('type').isIn(['flat', 'percentage', 'tiered']).withMessage('Invalid commission type'),
  body('rate').isFloat({ min: 0 }).withMessage('Commission rate must be positive')
]), programController.updateCommissionStructure);
router.post('/:id/applications/:appId/approve', programController.approveApplication);
router.post('/:id/applications/:appId/reject', programController.rejectApplication);
router.delete('/:id', programController.deleteProgram);

module.exports = router;

