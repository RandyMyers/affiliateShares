const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All routes require authentication and merchant/admin role
router.use(authenticateToken);
router.use(authorizeRoles('admin', 'advertiser'));

// Get all products for a store
router.get('/store/:storeId', productController.getStoreProducts);

// Get single product
router.get('/:productId', productController.getProduct);

// Create product
router.post('/store/:storeId', productController.createProduct);

// Update product
router.put('/:productId', productController.updateProduct);

// Delete product
router.delete('/:productId', productController.deleteProduct);

// Bulk import products
router.post('/store/:storeId/bulk', productController.bulkImportProducts);

module.exports = router;

