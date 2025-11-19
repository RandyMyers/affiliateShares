const express = require('express');
const router = express.Router();
const merchantNoteController = require('../controllers/merchantNoteController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All routes require authentication and merchant role
router.get('/affiliate/:affiliateId', authenticateToken, authorizeRoles(['admin', 'advertiser']), merchantNoteController.getAffiliateNotes);
router.post('/', authenticateToken, authorizeRoles(['admin', 'advertiser']), merchantNoteController.createNote);
router.put('/:noteId', authenticateToken, authorizeRoles(['admin', 'advertiser']), merchantNoteController.updateNote);
router.delete('/:noteId', authenticateToken, authorizeRoles(['admin', 'advertiser']), merchantNoteController.deleteNote);

module.exports = router;

