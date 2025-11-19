const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get fee summary
router.get('/summary', feeController.getFeeSummary);

// Get merchant fees
router.get('/', feeController.getMerchantFees);

// Waive fee
router.post('/:feeId/waive', feeController.waiveFee);

module.exports = router;


