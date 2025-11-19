const { verifyPluginToken } = require('../controller/pluginController');

// Middleware to verify plugin API token
const authenticatePlugin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Authorization header missing',
        data: null
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    const decoded = verifyPluginToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        data: null
      });
    }

    // Attach token data to request
    req.pluginToken = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token verification failed',
      data: null
    });
  }
};

module.exports = { authenticatePlugin };

