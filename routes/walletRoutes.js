const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get wallet balance
router.get('/balance', walletController.getWalletBalance);

// Fund wallet (deposit)
router.post('/deposit', walletController.depositToWallet);

// Get wallet transactions
router.get('/transactions', walletController.getWalletTransactions);

// Setup auto-deposit
router.post('/auto-deposit', walletController.setupAutoDeposit);

// Update wallet settings
router.put('/settings', walletController.updateWalletSettings);

// Get wallet statements
router.get('/statements', walletController.getWalletStatements);

// Export transactions
router.get('/transactions/export', walletController.exportTransactions);

// Get wallet summary/analytics
router.get('/summary', walletController.getWalletSummary);

module.exports = router;

