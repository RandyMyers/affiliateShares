const express = require('express');
const router = express.Router();
const programController = require('../controller/programController');
const { authenticateToken } = require('../middleware/auth');

// Public route - anyone can browse active programs
router.get('/browse', programController.getPublicPrograms);

// Authenticated routes for affiliates
router.use(authenticateToken);

// Get program details (affiliates can view)
router.get('/:id', programController.getPublicProgram);

// Apply to program
router.post('/:id/apply', programController.applyToProgram);

module.exports = router;

