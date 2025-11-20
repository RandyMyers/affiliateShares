const Store = require('../models/store');
const User = require('../models/user');
const { sendResponse } = require('../utils/response');

// Token functions removed - using Merchant ID directly (like ShareASale)

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

    const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:5000';

    // Return store info directly (no token needed - using Merchant ID)
    return sendResponse(res, 200, 'Store information retrieved successfully', {
      store: {
        id: store._id.toString(),
        name: store.name,
        domain: store.domain,
        trackingCode: store.trackingCode,
        cookieDuration: store.settings?.cookieDuration || 30,
        status: store.status
      },
      webhookUrl: `${API_URL}/api/webhooks/woocommerce/${store._id}`,
      apiUrl: API_URL
    });
  } catch (error) {
    next(error);
  }
};

// Get store info (with Merchant ID - simplified approach)
exports.getStoreInfo = async (req, res, next) => {
  try {
    const store = req.store; // Set by middleware

    if (!store.trackingCode) {
      // Generate tracking code if missing
      store.generateTrackingCode();
      await store.save();
    }

    const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:5000';

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
      },
      webhookUrl: `${API_URL}/api/webhooks/woocommerce/${store._id}`,
      apiUrl: API_URL
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

// Test connection endpoint (with Merchant ID - simplified approach)
exports.testConnection = async (req, res, next) => {
  try {
    const store = req.store; // Set by middleware

    return sendResponse(res, 200, 'Connection successful', {
      connected: true,
      storeName: store.name,
      status: store.status,
      merchantId: req.merchantId
    });
  } catch (error) {
    next(error);
  }
};

// Token functions removed - using Merchant ID directly

