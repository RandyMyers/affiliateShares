const Store = require('../models/store');
const User = require('../models/user');
const { sendResponse } = require('../utils/response');

// Get all stores for authenticated merchant
exports.getStores = async (req, res, next) => {
  try {
    const stores = await Store.find({ merchant: req.user.id })
      .select('-settings.webhookSecret')
      .sort({ createdAt: -1 });
    
    return sendResponse(res, 200, 'Stores retrieved successfully', stores);
  } catch (error) {
    next(error);
  }
};

// Get single store by ID
exports.getStore = async (req, res, next) => {
  try {
    const store = await Store.findOne({
      _id: req.params.id,
      merchant: req.user.id
    }).select('-settings.webhookSecret');

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    return sendResponse(res, 200, 'Store retrieved successfully', store);
  } catch (error) {
    next(error);
  }
};

// Create new store
exports.createStore = async (req, res, next) => {
  try {
    const { name, domain, platform, description, settings } = req.body;

    // Check if domain already exists for this merchant
    const existingStore = await Store.findOne({
      merchant: req.user.id,
      domain: domain.toLowerCase()
    });

    if (existingStore) {
      return sendResponse(res, 400, 'Store with this domain already exists', null);
    }

    // Create store
    const store = new Store({
      merchant: req.user.id,
      name,
      domain: domain.toLowerCase(),
      platform: platform || 'woocommerce',
      description,
      settings: settings || {}
    });

    // Generate tracking code
    store.generateTrackingCode();

    await store.save();

    // Populate merchant info
    await store.populate('merchant', 'username email');

    return sendResponse(res, 201, 'Store created successfully', store);
  } catch (error) {
    if (error.code === 11000) {
      return sendResponse(res, 400, 'Store with this domain already exists', null);
    }
    next(error);
  }
};

// Update store
exports.updateStore = async (req, res, next) => {
  try {
    const { name, description, settings, status } = req.body;

    const store = await Store.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Update fields
    if (name) store.name = name;
    if (description !== undefined) store.description = description;
    if (status) store.status = status;
    if (settings) {
      store.settings = { ...store.settings, ...settings };
    }

    await store.save();

    return sendResponse(res, 200, 'Store updated successfully', store);
  } catch (error) {
    next(error);
  }
};

// Delete store
exports.deleteStore = async (req, res, next) => {
  try {
    const store = await Store.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    await Store.deleteOne({ _id: store._id });

    return sendResponse(res, 200, 'Store deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

// Get store statistics
exports.getStoreStats = async (req, res, next) => {
  try {
    const store = await Store.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Get additional stats from related collections
    const Click = require('../models/click');
    const Order = require('../models/order');
    const Commission = require('../models/commission');
    const Affiliate = require('../models/affiliate');

    const [
      totalClicks,
      totalOrders,
      totalCommissions,
      totalAffiliates
    ] = await Promise.all([
      Click.countDocuments({ store: store._id }),
      Order.countDocuments({ store: store._id }),
      Commission.aggregate([
        { $match: { store: store._id } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Affiliate.countDocuments({ 'stores.store': store._id, 'stores.status': 'approved' })
    ]);

    const stats = {
      ...store.stats.toObject(),
      totalClicks: totalClicks || store.stats.totalClicks,
      totalOrders: totalOrders || store.stats.totalOrders,
      totalCommissions: totalCommissions[0]?.total || store.stats.totalCommissions,
      totalAffiliates: totalAffiliates || store.stats.totalAffiliates
    };

    return sendResponse(res, 200, 'Store statistics retrieved successfully', stats);
  } catch (error) {
    next(error);
  }
};

// Get tracking snippet
exports.getTrackingSnippet = async (req, res, next) => {
  try {
    const store = await Store.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    if (!store.trackingCode) {
      store.generateTrackingCode();
      await store.save();
    }

    const snippet = store.trackingSnippet;

    return sendResponse(res, 200, 'Tracking snippet retrieved successfully', {
      trackingCode: store.trackingCode,
      snippet: snippet
    });
  } catch (error) {
    next(error);
  }
};

// Test WooCommerce connection
exports.testWooCommerceConnection = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { consumerKey, consumerSecret, apiUrl } = req.body;

    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    if (store.platform !== 'woocommerce') {
      return sendResponse(res, 400, 'This endpoint is only for WooCommerce stores', null);
    }

    const woocommerceService = require('../services/woocommerceService');
    const storeUrl = apiUrl || store.domain;

    // Test connection
    const result = await woocommerceService.testConnection(storeUrl, consumerKey, consumerSecret);

    if (result.success) {
      // Save credentials to store
      store.woocommerce = store.woocommerce || {};
      store.woocommerce.consumerKey = consumerKey;
      store.woocommerce.consumerSecret = consumerSecret;
      store.woocommerce.apiUrl = storeUrl;
      store.woocommerce.connectionStatus = 'connected';
      store.woocommerce.lastTested = new Date();
      await store.save();

      return sendResponse(res, 200, 'Connection successful', {
        connected: true,
        storeInfo: result.storeInfo
      });
    }

    return sendResponse(res, 400, result.message || 'Connection failed', {
      connected: false,
      error: result.error
    });
  } catch (error) {
    next(error);
  }
};

// Create webhook
exports.createWebhook = async (req, res, next) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    if (store.platform !== 'woocommerce') {
      return sendResponse(res, 400, 'This endpoint is only for WooCommerce stores', null);
    }

    if (!store.woocommerce?.consumerKey || !store.woocommerce?.consumerSecret) {
      return sendResponse(res, 400, 'WooCommerce API credentials not configured', null);
    }

    const woocommerceService = require('../services/woocommerceService');
    const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:5000';
    const webhookUrl = `${API_URL}/api/webhooks/woocommerce/${storeId}`;
    
    // Check if webhook URL is localhost/local - WooCommerce may reject these
    const isLocalhost = webhookUrl.includes('localhost') || 
                       webhookUrl.includes('127.0.0.1') || 
                       webhookUrl.includes('.local') ||
                       webhookUrl.includes('localwp') ||
                       !webhookUrl.startsWith('https://');
    
    if (isLocalhost) {
      // For localhost, we can't create webhook automatically
      // Save the webhook URL for manual configuration
      store.settings = store.settings || {};
      store.settings.webhookUrl = webhookUrl;
      const crypto = require('crypto');
      store.settings.webhookSecret = crypto.randomBytes(32).toString('hex');
      await store.save();

      return sendResponse(res, 200, 'Webhook URL saved for manual configuration', {
        webhookUrl: webhookUrl,
        requiresManualSetup: true,
        message: 'Localhost/LocalWP URLs cannot be used for automatic webhook creation. WooCommerce requires publicly accessible URLs. Please configure the webhook manually in WooCommerce settings, or use a tool like ngrok for local testing.'
      });
    }
    
    // Generate webhook secret
    const crypto = require('crypto');
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    const result = await woocommerceService.createWebhook(
      store.woocommerce.apiUrl || store.domain,
      store.woocommerce.consumerKey,
      store.woocommerce.consumerSecret,
      webhookUrl,
      webhookSecret
    );

    if (result.success) {
      // Save webhook secret to store settings
      store.settings = store.settings || {};
      store.settings.webhookSecret = webhookSecret;
      store.settings.webhookUrl = webhookUrl;
      await store.save();

      return sendResponse(res, 201, 'Webhook created successfully', {
        webhook: result.webhook,
        webhookId: result.webhookId
      });
    }

    // If webhook creation failed, still save the URL for manual setup
    store.settings = store.settings || {};
    store.settings.webhookUrl = webhookUrl;
    store.settings.webhookSecret = webhookSecret;
    await store.save();

    return sendResponse(res, 200, result.message || 'Webhook creation failed, please configure manually', {
      error: result.error,
      webhookUrl: webhookUrl,
      requiresManualSetup: true,
      details: result.message
    });
  } catch (error) {
    next(error);
  }
};

// Create test order
exports.createTestOrder = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { testCode } = req.body;

    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    if (store.platform !== 'woocommerce') {
      return sendResponse(res, 400, 'This endpoint is only for WooCommerce stores', null);
    }

    if (!store.woocommerce?.consumerKey || !store.woocommerce?.consumerSecret) {
      return sendResponse(res, 400, 'WooCommerce API credentials not configured', null);
    }

    const woocommerceService = require('../services/woocommerceService');
    const testAffiliateCode = testCode || 'TEST_ONBOARDING';

    const result = await woocommerceService.createTestOrder(
      store.woocommerce.apiUrl || store.domain,
      store.woocommerce.consumerKey,
      store.woocommerce.consumerSecret,
      testAffiliateCode
    );

    if (result.success) {
      // Save test order ID
      store.woocommerce = store.woocommerce || {};
      store.woocommerce.testOrderId = result.order.id || result.order.number;
      store.woocommerce.connectionStatus = 'testing';
      await store.save();

      return sendResponse(res, 201, 'Test order created successfully', {
        order: result.order,
        testCode: testAffiliateCode
      });
    }

    return sendResponse(res, 400, result.message || 'Failed to create test order', {
      error: result.error
    });
  } catch (error) {
    next(error);
  }
};

// Verify test order
exports.verifyTestOrder = async (req, res, next) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    if (store.platform !== 'woocommerce') {
      return sendResponse(res, 400, 'This endpoint is only for WooCommerce stores', null);
    }

    const Order = require('../models/order');
    const woocommerceService = require('../services/woocommerceService');
    
    // Check for orders received in the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    // Find recent orders
    const recentOrders = await Order.find({
      store: storeId,
      $or: [
        { createdAt: { $gte: fifteenMinutesAgo } },
        { orderDate: { $gte: fifteenMinutesAgo } }
      ]
    }).sort({ createdAt: -1 }).limit(10);

    // Also check if we have a test order ID and try to fetch it directly from WooCommerce
    let wcOrderData = null;
    if (store.woocommerce?.testOrderId && store.woocommerce?.consumerKey && store.woocommerce?.consumerSecret) {
      try {
        const wcOrderResult = await woocommerceService.getOrder(
          store.woocommerce.apiUrl || store.domain,
          store.woocommerce.consumerKey,
          store.woocommerce.consumerSecret,
          store.woocommerce.testOrderId
        );
        if (wcOrderResult.success) {
          wcOrderData = wcOrderResult.order;
        }
      } catch (error) {
        console.warn('Could not fetch order from WooCommerce:', error.message);
      }
    }

    // Check if any order has affiliate data
    let verifiedOrder = null;
    let hasAffiliateData = false;
    let webhookDelivered = false;
    let orderReceived = recentOrders.length > 0;

    for (const order of recentOrders) {
      // Check for affiliate data in various possible locations
      const affiliateRef = order.referralCode || 
                        order.affiliateRef || 
                        order.metadata?._affiliate_ref ||
                        (order.webhookData?.meta_data && 
                         order.webhookData.meta_data.find(m => m.key === '_affiliate_ref')?.value);

      if (affiliateRef) {
        hasAffiliateData = true;
        verifiedOrder = order;
        
        // Check if it's a test order
        const isTestOrder = affiliateRef.startsWith('TEST_ONBOARDING') ||
                          affiliateRef.includes('TEST') ||
                          order.metadata?._test_order === 'true' ||
                          order.metadata?._onboarding_test === 'true';
        
        if (isTestOrder) {
          // Check if webhook was received (order was created via webhook)
          webhookDelivered = true;
          
          return sendResponse(res, 200, 'Test order verified successfully', {
            verified: true,
            order: {
              id: order._id,
              orderNumber: order.orderData?.orderNumber || order.externalOrderId,
              affiliateRef: affiliateRef,
              createdAt: order.createdAt
            },
            checks: {
              orderReceived: true,
              affiliateDataPresent: true,
              webhookDelivered: true,
              trackingWorking: true
            }
          });
        }
      }
    }

    // If we have WooCommerce order data, check if it has affiliate metadata
    if (wcOrderData) {
      const wcAffiliateRef = wcOrderData.meta_data?.find(
        meta => meta.key === '_affiliate_ref' || meta.key === 'affiliate_ref'
      )?.value;

      // Check if order exists in our DB
      const orderInDb = recentOrders.find(o => 
        o.externalOrderId === wcOrderData.id?.toString() ||
        o.externalOrderId === wcOrderData.number?.toString() ||
        o.orderData?.orderNumber === wcOrderData.number?.toString()
      );

      if (orderInDb) {
        // Order is in DB, check for affiliate data
        const dbAffiliateRef = orderInDb.referralCode || orderInDb.affiliateRef;
        return sendResponse(res, 200, 'Test order found in database', {
          verified: !!dbAffiliateRef || !!wcAffiliateRef,
          order: {
            id: orderInDb._id,
            orderNumber: orderInDb.orderData?.orderNumber || orderInDb.externalOrderId,
            affiliateRef: dbAffiliateRef || wcAffiliateRef || null,
            createdAt: orderInDb.createdAt
          },
          checks: {
            orderReceived: true,
            affiliateDataPresent: !!(dbAffiliateRef || wcAffiliateRef),
            webhookDelivered: true,
            trackingWorking: !!(dbAffiliateRef || wcAffiliateRef)
          },
          message: wcAffiliateRef && !dbAffiliateRef 
            ? 'Order received but affiliate data not saved. Webhook may need to be triggered again.'
            : null
        });
      } else if (wcAffiliateRef) {
        // Order exists in WooCommerce with affiliate data, but not in our DB yet
        return sendResponse(res, 200, 'Test order found in WooCommerce, waiting for webhook', {
          verified: false,
          order: {
            orderNumber: wcOrderData.number || wcOrderData.id,
            affiliateRef: wcAffiliateRef,
            wcOrderId: wcOrderData.id
          },
          checks: {
            orderReceived: true,
            affiliateDataPresent: true,
            webhookDelivered: false,
            trackingWorking: false
          },
          message: 'Order found in WooCommerce with affiliate data, but webhook has not delivered it to our server yet. Please wait a few moments or check webhook configuration.'
        });
      }
    }

    // If we have a test order ID but no order found, check if it exists in WooCommerce
    if (store.woocommerce?.testOrderId && !wcOrderData) {
      const orderByWcId = recentOrders.find(o => 
        o.externalOrderId === store.woocommerce.testOrderId ||
        o.orderData?.orderNumber === store.woocommerce.testOrderId
      );

      if (orderByWcId) {
        const affiliateRef = orderByWcId.referralCode || orderByWcId.affiliateRef;
        
        return sendResponse(res, 200, 'Test order found', {
          verified: !!affiliateRef,
          order: {
            id: orderByWcId._id,
            orderNumber: orderByWcId.orderData?.orderNumber || orderByWcId.externalOrderId,
            affiliateRef: affiliateRef || null,
            createdAt: orderByWcId.createdAt
          },
          checks: {
            orderReceived: true,
            affiliateDataPresent: !!affiliateRef,
            webhookDelivered: true,
            trackingWorking: !!affiliateRef
          }
        });
      }
    }

    // No test order found yet
    return sendResponse(res, 200, 'Waiting for test order', {
      verified: false,
      order: null,
      checks: {
        orderReceived: orderReceived,
        affiliateDataPresent: hasAffiliateData,
        webhookDelivered: false,
        trackingWorking: false
      },
      message: orderReceived 
        ? 'Order received but no affiliate data found. Make sure you visited the store with ?ref=TEST_ONBOARDING before placing the order.'
        : 'No test order detected yet. Please place a test order on your WooCommerce store with an affiliate link (e.g., ?ref=TEST_ONBOARDING).'
    });
  } catch (error) {
    next(error);
  }
};

// Complete onboarding
exports.completeOnboarding = async (req, res, next) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    if (store.platform !== 'woocommerce') {
      return sendResponse(res, 400, 'This endpoint is only for WooCommerce stores', null);
    }

    store.woocommerce = store.woocommerce || {};
    store.woocommerce.onboardingCompleted = true;
    store.woocommerce.connectionStatus = 'verified';
    await store.save();

    return sendResponse(res, 200, 'Onboarding completed successfully', {
      store: store
    });
  } catch (error) {
    next(error);
  }
};

// Check installation status
exports.checkInstallationStatus = async (req, res, next) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    if (store.platform !== 'woocommerce') {
      return sendResponse(res, 400, 'This endpoint is only for WooCommerce stores', null);
    }

    if (!store.woocommerce?.consumerKey || !store.woocommerce?.consumerSecret) {
      return sendResponse(res, 400, 'WooCommerce API credentials not configured', null);
    }

    const woocommerceService = require('../services/woocommerceService');
    const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:5000';
    const webhookUrl = `${API_URL}/api/webhooks/woocommerce/${storeId}`;

    // Check plugin status
    const pluginStatus = await woocommerceService.checkPluginStatus(
      store.woocommerce.apiUrl || store.domain,
      store.woocommerce.consumerKey,
      store.woocommerce.consumerSecret
    );

    // Check webhook status
    const webhookStatus = await woocommerceService.verifyWebhook(
      store.woocommerce.apiUrl || store.domain,
      store.woocommerce.consumerKey,
      store.woocommerce.consumerSecret,
      webhookUrl
    );

    return sendResponse(res, 200, 'Installation status retrieved', {
      plugin: {
        installed: pluginStatus.installed || false,
        active: pluginStatus.active || false,
        configured: pluginStatus.configured || false
      },
      webhook: {
        configured: webhookStatus.configured || false,
        active: webhookStatus.active || false,
        url: webhookUrl
      },
      allVerified: (pluginStatus.active && webhookStatus.configured) || false
    });
  } catch (error) {
    next(error);
  }
};

