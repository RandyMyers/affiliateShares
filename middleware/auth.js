const { verifyToken } = require('../utils/jwt');
const User = require('../models/user');

/**
 * Authenticate JWT token
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password -refreshToken');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid or expired token'
    });
  }
};

/**
 * Authorize based on roles
 * @param {...String} roles - Allowed roles
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Flatten roles array if nested
    const allowedRoles = roles.flat();
    
    if (!allowedRoles.includes(req.user.role)) {
      console.error(`Authorization failed: User role "${req.user.role}" not in allowed roles:`, allowedRoles);
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`
      });
    }

    next();
  };
};

/**
 * Check if user is admin
 */
const isAdmin = authorizeRoles('admin');

/**
 * Check if user is advertiser/merchant
 */
const isAdvertiser = authorizeRoles('admin', 'advertiser');

/**
 * Check if user is affiliate
 */
const isAffiliate = authorizeRoles('admin', 'affiliate');

module.exports = {
  authenticateToken,
  authorizeRoles,
  isAdmin,
  isAdvertiser,
  isAffiliate
};

