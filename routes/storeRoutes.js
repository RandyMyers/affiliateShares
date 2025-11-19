const express = require('express');
const router = express.Router();
const storeController = require('../controller/storeController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');
const { body } = require('express-validator');

// All routes require authentication and advertiser/admin role
router.use(authenticateToken);
router.use(authorizeRoles(['admin', 'advertiser']));

// Validation rules
const createStoreValidation = [
  body('name').trim().notEmpty().withMessage('Store name is required'),
  body('domain').trim().notEmpty().withMessage('Domain is required').isURL({ require_protocol: false }).withMessage('Invalid domain format'),
  body('platform').optional().isIn(['woocommerce', 'shopify', 'custom']).withMessage('Invalid platform')
];

const updateStoreValidation = [
  body('name').optional().trim().notEmpty(),
  body('status').optional().isIn(['active', 'inactive', 'suspended']),
  body('description').optional().trim()
];

// Routes
router.get('/', storeController.getStores);
router.get('/:id', storeController.getStore);
router.get('/:id/stats', storeController.getStoreStats);
router.get('/:id/tracking-snippet', storeController.getTrackingSnippet);
router.post('/', validateRequest(createStoreValidation), storeController.createStore);
router.put('/:id', validateRequest(updateStoreValidation), storeController.updateStore);
router.delete('/:id', storeController.deleteStore);

// WooCommerce onboarding and testing routes
router.post('/:storeId/test-connection', storeController.testWooCommerceConnection);
router.post('/:storeId/create-webhook', storeController.createWebhook);
router.post('/:storeId/create-test-order', storeController.createTestOrder);
router.get('/:storeId/verify-test-order', storeController.verifyTestOrder);
router.post('/:storeId/complete-onboarding', storeController.completeOnboarding);
router.get('/:storeId/installation-status', storeController.checkInstallationStatus);

module.exports = router;

