const express = require('express');
const router = express.Router();
const assetController = require('../controller/assetController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');
const { body } = require('express-validator');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const createAssetValidation = [
  body('name').trim().notEmpty().withMessage('Asset name is required'),
  body('type').isIn(['banner', 'image', 'text-link', 'product-image', 'logo']).withMessage('Invalid asset type'),
  body('url').notEmpty().withMessage('Asset URL is required')
];

const updateAssetValidation = [
  body('name').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('isActive').optional().isBoolean()
];

// Affiliate routes (view only)
router.get('/affiliate', authorizeRoles(['admin', 'advertiser', 'affiliate']), assetController.getAffiliateAssets);
router.get('/affiliate/program/:programId', authorizeRoles(['admin', 'advertiser', 'affiliate']), assetController.getProgramAssets);
router.get('/affiliate/:id', authorizeRoles(['admin', 'advertiser', 'affiliate']), assetController.getAffiliateAsset);
router.post('/affiliate/:id/download', authorizeRoles(['admin', 'advertiser', 'affiliate']), assetController.trackAssetDownload);

// Merchant routes (full CRUD)
router.get('/', authorizeRoles(['admin', 'advertiser']), assetController.getAssets);
router.get('/:id', authorizeRoles(['admin', 'advertiser']), assetController.getAsset);
router.post('/', authorizeRoles(['admin', 'advertiser']), validateRequest(createAssetValidation), assetController.createAsset);
router.put('/:id', authorizeRoles(['admin', 'advertiser']), validateRequest(updateAssetValidation), assetController.updateAsset);
router.delete('/:id', authorizeRoles(['admin', 'advertiser']), assetController.deleteAsset);
router.post('/:id/upload', authorizeRoles(['admin', 'advertiser']), assetController.uploadAsset);

// Asset performance analytics routes
router.get('/store/:storeId/performance', authorizeRoles(['admin', 'advertiser']), assetController.getAssetPerformance);
router.get('/:assetId/timeline', authorizeRoles(['admin', 'advertiser']), assetController.getAssetUsageTimeline);

module.exports = router;

