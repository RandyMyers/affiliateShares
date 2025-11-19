const Store = require('../models/store');
const User = require('../models/user');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sendResponse } = require('../utils/response');

// Generate API token for plugin
const generatePluginToken = (storeId, merchantId) => {
  const payload = {
    storeId: storeId.toString(),
    merchantId: merchantId.toString(),
    type: 'plugin',
    iat: Math.floor(Date.now() / 1000)
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '365d' // Plugin tokens last 1 year
  });
};

// Verify plugin token
const verifyPluginToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (decoded.type !== 'plugin') {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
};

// Authenticate plugin with merchantId
exports.authenticate = async (req, res, next) => {
  try {
    const { merchantId, domain } = req.body;

    if (!merchantId) {
      return sendResponse(res, 400, 'Merchant ID is required', null);
    }

    // Find merchant user by merchantId (custom ID, not MongoDB _id)
    const merchant = await User.findOne({ merchantId: merchantId });
    if (!merchant) {
      return sendResponse(res, 404, 'Merchant not found', null);
    }
    
    // Verify user is a merchant/advertiser
    if (merchant.role !== 'advertiser' && merchant.role !== 'admin') {
      return sendResponse(res, 403, 'User is not a merchant', null);
    }

    // Find store(s) for this merchant (use MongoDB _id for store query)
    const query = { 
      merchant: merchant._id, 
      status: 'active',
      platform: 'woocommerce'
    };

    // If domain provided, match by domain
    if (domain) {
      const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      query.domain = cleanDomain;
    }

    const stores = await Store.find(query).select('-settings.webhookSecret').sort({ createdAt: -1 });

    if (stores.length === 0) {
      return sendResponse(res, 404, 'No active WooCommerce store found for this merchant. Please create a store in your dashboard first.', null);
    }

    // If multiple stores and domain not provided, return all
    // If single store or domain matched, return that store
    const store = stores.length === 1 ? stores[0] : 
                  domain ? stores[0] : stores[0]; // Default to first store

    if (!store.trackingCode) {
      // Generate tracking code if missing
      store.generateTrackingCode();
      await store.save();
    }

    // Generate API token (use MongoDB _id for token)
    const apiToken = generatePluginToken(store._id, merchant._id.toString());

    const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:5000';

    return sendResponse(res, 200, 'Authentication successful', {
      store: {
        id: store._id.toString(),
        name: store.name,
        domain: store.domain,
        trackingCode: store.trackingCode,
        cookieDuration: store.settings?.cookieDuration || 30,
        status: store.status
      },
      apiToken,
      webhookUrl: `${API_URL}/api/webhooks/woocommerce/${store._id}`,
      apiUrl: API_URL
    });
  } catch (error) {
    next(error);
  }
};

// Get store info by storeId (with API token)
exports.getStoreInfo = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const tokenData = req.pluginToken; // Set by middleware

    if (!tokenData || tokenData.storeId !== storeId) {
      return sendResponse(res, 403, 'Invalid token for this store', null);
    }

    const store = await Store.findById(storeId).select('-settings.webhookSecret');

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    if (store.merchant.toString() !== tokenData.merchantId) {
      return sendResponse(res, 403, 'Access denied', null);
    }

    return sendResponse(res, 200, 'Store information retrieved successfully', {
      store: {
        id: store._id.toString(),
        name: store.name,
        domain: store.domain,
        trackingCode: store.trackingCode,
        cookieDuration: store.settings?.cookieDuration || 30,
        status: store.status,
        settings: {
          defaultCommissionRate: store.settings?.defaultCommissionRate || 10,
          commissionType: store.settings?.commissionType || 'percentage'
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get store info by API key (alternative method)
exports.getStoreByApiKey = async (req, res, next) => {
  try {
    const { apiKey } = req.query;

    if (!apiKey) {
      return sendResponse(res, 400, 'API key is required', null);
    }

    // Find store by API key (if we add this field to Store model)
    // For now, we'll use the token-based approach
    // This can be implemented later if needed

    return sendResponse(res, 501, 'API key authentication not yet implemented', null);
  } catch (error) {
    next(error);
  }
};

// Test connection endpoint
exports.testConnection = async (req, res, next) => {
  try {
    const tokenData = req.pluginToken;

    if (!tokenData) {
      return sendResponse(res, 401, 'Invalid or missing token', null);
    }

    const store = await Store.findById(tokenData.storeId);

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    return sendResponse(res, 200, 'Connection successful', {
      connected: true,
      storeName: store.name,
      status: store.status
    });
  } catch (error) {
    next(error);
  }
};

// Export token verification function for middleware
exports.verifyPluginToken = verifyPluginToken;

