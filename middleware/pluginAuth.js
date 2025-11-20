const User = require('../models/user');
const Store = require('../models/store');

// Middleware to verify Merchant ID (simpler approach - like ShareASale)
const authenticatePlugin = async (req, res, next) => {
  try {
    // Get Merchant ID from header or query parameter
    const merchantId = req.headers['x-merchant-id'] || req.query.merchantId || req.body.merchantId;

    if (!merchantId) {
      return res.status(401).json({
        success: false,
        message: 'Merchant ID is required. Please provide it in X-Merchant-ID header or merchantId query parameter.',
        data: null
      });
    }

    // Find merchant user by merchantId
    const merchant = await User.findOne({ merchantId: merchantId });
    if (!merchant) {
      console.log(`[Plugin Auth] Merchant not found: ${merchantId}`);
      return res.status(404).json({
        success: false,
        message: `Merchant not found with ID: ${merchantId}. Please verify your Merchant ID is correct.`,
        data: null
      });
    }

    // Verify user is a merchant/advertiser
    if (merchant.role !== 'advertiser' && merchant.role !== 'admin') {
      console.log(`[Plugin Auth] User ${merchantId} is not a merchant/advertiser. Role: ${merchant.role}`);
      return res.status(403).json({
        success: false,
        message: `User is not a merchant. Current role: ${merchant.role}. Only advertisers and admins can use the plugin.`,
        data: null
      });
    }

    // Get domain from header or query (optional, for multi-store support)
    const domain = req.headers['x-domain'] || req.query.domain || req.body.domain;
    
    // Find store(s) for this merchant
    const query = { 
      merchant: merchant._id, 
      status: 'active',
      platform: 'woocommerce'
    };

    // If domain provided, match by domain (normalize for comparison)
    if (domain) {
      const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      console.log(`[Plugin Auth] Looking for store with domain: ${cleanDomain}`);
      
      // Use regex to match domain regardless of protocol in database
      // This handles cases where store domain is stored as 'https://domain.com' or 'domain.com'
      query.domain = {
        $regex: new RegExp(`^https?://${cleanDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$|^${cleanDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      };
    }

    const stores = await Store.find(query).select('-settings.webhookSecret').sort({ createdAt: -1 });
    console.log(`[Plugin Auth] Found ${stores.length} store(s) for merchant ${merchantId} matching criteria`);

    if (stores.length === 0) {
      // Check if merchant has any stores at all (for better error message)
      const allStores = await Store.find({ merchant: merchant._id }).select('name domain platform status');
      console.log(`[Plugin Auth] Merchant has ${allStores.length} total store(s):`, 
        allStores.map(s => ({ name: s.name, domain: s.domain, platform: s.platform, status: s.status })));
      
      if (allStores.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No store found for this merchant. Please create a WooCommerce store in your dashboard first.',
          data: null
        });
      } else {
        // Has stores but not matching the criteria
        const statusIssue = allStores.some(s => s.status !== 'active');
        const platformIssue = allStores.some(s => s.platform !== 'woocommerce');
        const domainIssue = domain && !allStores.some(s => {
          const storeDomain = s.domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
          const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
          return storeDomain === cleanDomain;
        });

        let errorMsg = 'No active WooCommerce store found';
        if (domainIssue) {
          errorMsg += ` for domain "${domain}"`;
        }
        if (statusIssue) {
          errorMsg += '. Some stores are not active';
        }
        if (platformIssue) {
          errorMsg += '. Some stores are not WooCommerce stores';
        }
        errorMsg += '. Please check your store settings in the dashboard.';
        
        // Add details about existing stores
        const storeDetails = allStores.map(s => 
          `- ${s.name} (${s.domain}): platform=${s.platform}, status=${s.status}`
        ).join('\n');
        errorMsg += `\n\nExisting stores:\n${storeDetails}`;

        return res.status(404).json({
          success: false,
          message: errorMsg,
          data: null
        });
      }
    }

    // Attach merchant and store data to request
    req.merchant = merchant;
    req.store = stores.length === 1 ? stores[0] : (domain ? stores[0] : stores[0]);
    req.merchantId = merchantId;
    
    console.log(`[Plugin Auth] Successfully authenticated merchant ${merchantId} with store ${req.store._id}`);
    next();
  } catch (error) {
    console.error('[Plugin Auth] Error:', error);
    return res.status(401).json({
      success: false,
      message: `Authentication failed: ${error.message}`,
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = { authenticatePlugin };

