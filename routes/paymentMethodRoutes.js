const express = require('express');
const router = express.Router();
const paymentMethodController = require('../controller/paymentMethodController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');
const { body } = require('express-validator');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const addPaymentMethodValidation = [
  body('type').isIn(['paypal', 'bank_transfer', 'flutterwave', 'paystack', 'squad']).withMessage('Invalid payment method type'),
  body('paypalEmail').if(body('type').equals('paypal')).isEmail().withMessage('Valid PayPal email is required'),
  body('bankName').if(body('type').equals('bank_transfer')).notEmpty().withMessage('Bank name is required'),
  body('accountNumber').if(body('type').equals('bank_transfer')).notEmpty().withMessage('Account number is required'),
  body('accountName').if(body('type').equals('bank_transfer')).notEmpty().withMessage('Account name is required'),
  body('gatewayEmail').if(body('type').isIn(['flutterwave', 'paystack', 'squad'])).isEmail().withMessage('Valid email is required for payment gateway')
];

const updatePaymentMethodValidation = [
  body('paypalEmail').optional().isEmail().withMessage('Valid PayPal email is required'),
  body('gatewayEmail').optional().isEmail().withMessage('Valid email is required'),
  body('status').optional().isIn(['active', 'inactive', 'pending_verification']).withMessage('Invalid status')
];

// Routes (all require affiliate or admin role)
router.get('/', authorizeRoles(['admin', 'affiliate']), paymentMethodController.getPaymentMethods);
router.get('/:id', authorizeRoles(['admin', 'affiliate']), paymentMethodController.getPaymentMethod);
router.post('/', authorizeRoles(['admin', 'affiliate']), validateRequest(addPaymentMethodValidation), paymentMethodController.addPaymentMethod);
router.put('/:id', authorizeRoles(['admin', 'affiliate']), validateRequest(updatePaymentMethodValidation), paymentMethodController.updatePaymentMethod);
router.delete('/:id', authorizeRoles(['admin', 'affiliate']), paymentMethodController.deletePaymentMethod);
router.put('/:id/default', authorizeRoles(['admin', 'affiliate']), paymentMethodController.setDefaultPaymentMethod);

module.exports = router;

