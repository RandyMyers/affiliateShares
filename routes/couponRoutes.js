const express = require('express');
const router = express.Router();
const couponController = require('../controller/couponController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');
const { body } = require('express-validator');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const createCouponValidation = [
  body('name').trim().notEmpty().withMessage('Coupon name is required'),
  body('store').notEmpty().withMessage('Store is required').isMongoId().withMessage('Invalid store ID'),
  body('type').isIn(['percentage', 'fixed', 'free-shipping']).withMessage('Invalid coupon type'),
  body('value').isFloat({ min: 0 }).withMessage('Coupon value must be positive'),
  body('code').optional().trim().isLength({ min: 3, max: 20 }).withMessage('Code must be between 3 and 20 characters')
];

const updateCouponValidation = [
  body('name').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('isActive').optional().isBoolean(),
  body('validUntil').optional().isISO8601().withMessage('Invalid date format')
];

// Affiliate routes (view only)
router.get('/affiliate', authorizeRoles(['admin', 'advertiser', 'affiliate']), couponController.getAffiliateCoupons);
router.get('/affiliate/program/:programId', authorizeRoles(['admin', 'advertiser', 'affiliate']), couponController.getProgramCoupons);
router.get('/affiliate/:id', authorizeRoles(['admin', 'advertiser', 'affiliate']), couponController.getAffiliateCoupon);
router.post('/affiliate/:id/track', authorizeRoles(['admin', 'advertiser', 'affiliate']), couponController.trackCouponUsage);

// Merchant routes (full CRUD)
router.get('/', authorizeRoles(['admin', 'advertiser']), couponController.getCoupons);
router.get('/:id', authorizeRoles(['admin', 'advertiser']), couponController.getCoupon);
router.get('/:id/usage', authorizeRoles(['admin', 'advertiser']), couponController.getCouponUsage);
router.post('/', authorizeRoles(['admin', 'advertiser']), validateRequest(createCouponValidation), couponController.createCoupon);
router.put('/:id', authorizeRoles(['admin', 'advertiser']), validateRequest(updateCouponValidation), couponController.updateCoupon);
router.delete('/:id', authorizeRoles(['admin', 'advertiser']), couponController.deleteCoupon);

module.exports = router;

