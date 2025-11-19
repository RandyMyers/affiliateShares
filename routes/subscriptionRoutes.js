const express = require('express');
const router = express.Router();
const subscriptionController = require('../controller/subscriptionController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');
const { body } = require('express-validator');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const subscribeValidation = [
  body('planId')
    .notEmpty()
    .withMessage('Plan ID is required')
    .isMongoId()
    .withMessage('Invalid plan ID'),
  body('paymentGateway')
    .optional()
    .isIn(['flutterwave', 'paystack', 'squad'])
    .withMessage('Invalid payment gateway')
];

const verifyPaymentValidation = [
  body('transactionReference')
    .notEmpty()
    .withMessage('Transaction reference is required'),
  body('gatewayType')
    .notEmpty()
    .withMessage('Gateway type is required')
    .isIn(['flutterwave', 'paystack', 'squad'])
    .withMessage('Invalid gateway type')
];

const cancelValidation = [
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
];

const renewValidation = [
  body('planId')
    .optional()
    .isMongoId()
    .withMessage('Invalid plan ID'),
  body('paymentGateway')
    .optional()
    .isIn(['flutterwave', 'paystack', 'squad'])
    .withMessage('Invalid payment gateway')
];

// Routes
router.get('/plans', subscriptionController.getPlans);
router.get('/current', subscriptionController.getCurrentSubscription);
router.get('/history', subscriptionController.getSubscriptionHistory);
router.post('/subscribe', validateRequest(subscribeValidation), subscriptionController.subscribe);
router.post('/verify-payment', validateRequest(verifyPaymentValidation), subscriptionController.verifyPayment);
router.post('/cancel', validateRequest(cancelValidation), subscriptionController.cancelSubscription);
router.post('/renew', validateRequest(renewValidation), subscriptionController.renewSubscription);

module.exports = router;

