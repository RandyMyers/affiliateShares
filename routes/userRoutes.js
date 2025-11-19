const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Placeholder - will be implemented later
router.get('/profile', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'User profile endpoint',
    user: req.user
  });
});

module.exports = router;

