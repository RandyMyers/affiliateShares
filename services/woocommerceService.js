const axios = require('axios');
const crypto = require('crypto');

/**
 * WooCommerce REST API Service
 * Handles communication with WooCommerce stores via REST API v3
 */

/**
 * Normalize store URL (ensure proper format)
 */
const normalizeUrl = (url) => {
  if (!url) return null;
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized.replace(/\/$/, ''); // Remove trailing slash
};

/**
 * Create WooCommerce API client
 */
const createWooCommerceClient = (storeUrl, consumerKey, consumerSecret) => {
  const baseURL = normalizeUrl(storeUrl);
  if (!baseURL) {
    throw new Error('Invalid store URL');
  }

  // Use HTTP Basic Auth for HTTPS, OAuth 1.0a for HTTP
  const isHttps = baseURL.startsWith('https://');
  
  return {
    baseURL: `${baseURL}/wp-json/wc/v3`,
    auth: {
      username: consumerKey,
      password: consumerSecret
    },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'AffiliateNetwork/1.0'
    },
    timeout: 30000, // 30 seconds
    // For HTTPS, use Basic Auth
    // For HTTP, we'd need OAuth 1.0a (more complex, usually not needed)
    validateStatus: (status) => status < 500 // Don't throw on 4xx errors
  };
};

/**
 * Test WooCommerce API connection
 */
exports.testConnection = async (storeUrl, consumerKey, consumerSecret) => {
  try {
    const client = createWooCommerceClient(storeUrl, consumerKey, consumerSecret);
    
    // Test connection by fetching store info
    const response = await axios.get(`${client.baseURL}`, {
      auth: client.auth,
      headers: client.headers,
      timeout: client.timeout
    });

    if (response.status === 200) {
      return {
        success: true,
        connected: true,
        storeInfo: response.data,
        message: 'Connection successful'
      };
    }

    return {
      success: false,
      connected: false,
      message: `Connection failed: ${response.status} ${response.statusText}`
    };
  } catch (error) {
    if (error.response) {
      // API responded with error
      const status = error.response.status;
      const message = error.response.data?.message || error.response.statusText;
      
      if (status === 401) {
        return {
          success: false,
          connected: false,
          message: 'Invalid API credentials. Please check your Consumer Key and Consumer Secret.',
          error: 'AUTH_ERROR'
        };
      }
      
      return {
        success: false,
        connected: false,
        message: `Connection failed: ${message}`,
        error: 'CONNECTION_ERROR',
        status
      };
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        success: false,
        connected: false,
        message: 'Cannot connect to store. Please check the store URL.',
        error: 'NETWORK_ERROR'
      };
    } else if (error.code === 'ETIMEDOUT') {
      return {
        success: false,
        connected: false,
        message: 'Connection timeout. Please check your store URL and try again.',
        error: 'TIMEOUT_ERROR'
      };
    }
    
    return {
      success: false,
      connected: false,
      message: error.message || 'Connection failed',
      error: 'UNKNOWN_ERROR'
    };
  }
};

/**
 * Get WooCommerce store information
 */
exports.getStoreInfo = async (storeUrl, consumerKey, consumerSecret) => {
  try {
    const client = createWooCommerceClient(storeUrl, consumerKey, consumerSecret);
    
    const response = await axios.get(`${client.baseURL}`, {
      auth: client.auth,
      headers: client.headers,
      timeout: client.timeout
    });

    if (response.status === 200) {
      return {
        success: true,
        data: response.data
      };
    }

    throw new Error(`Failed to get store info: ${response.status}`);
  } catch (error) {
    throw error;
  }
};

/**
 * Create a test order via WooCommerce API
 */
exports.createTestOrder = async (storeUrl, consumerKey, consumerSecret, testCode = 'TEST_ONBOARDING') => {
  try {
    const client = createWooCommerceClient(storeUrl, consumerKey, consumerSecret);
    
    // First, get a product to use in the test order
    let productId = null;
    try {
      const productsResponse = await axios.get(`${client.baseURL}/products?per_page=1&status=publish`, {
        auth: client.auth,
        headers: client.headers,
        timeout: client.timeout
      });
      
      if (productsResponse.data && productsResponse.data.length > 0) {
        productId = productsResponse.data[0].id;
      }
    } catch (error) {
      console.warn('Could not fetch products for test order:', error.message);
    }

    // Create test order
    const orderData = {
      payment_method: 'bacs',
      payment_method_title: 'Direct Bank Transfer',
      set_paid: false,
      billing: {
        first_name: 'Test',
        last_name: 'Customer',
        address_1: '123 Test Street',
        city: 'Test City',
        state: 'TS',
        postcode: '12345',
        country: 'US',
        email: 'test@example.com',
        phone: '1234567890'
      },
      shipping: {
        first_name: 'Test',
        last_name: 'Customer',
        address_1: '123 Test Street',
        city: 'Test City',
        state: 'TS',
        postcode: '12345',
        country: 'US'
      },
      line_items: productId ? [
        {
          product_id: productId,
          quantity: 1
        }
      ] : [],
      meta_data: [
        {
          key: '_affiliate_ref',
          value: testCode
        },
        {
          key: '_test_order',
          value: 'true'
        },
        {
          key: '_onboarding_test',
          value: 'true'
        }
      ],
      status: 'processing'
    };

    const response = await axios.post(`${client.baseURL}/orders`, orderData, {
      auth: client.auth,
      headers: client.headers,
      timeout: client.timeout
    });

    if (response.status === 201) {
      return {
        success: true,
        order: response.data,
        orderId: response.data.id,
        orderNumber: response.data.number || response.data.id.toString()
      };
    }

    throw new Error(`Failed to create test order: ${response.status}`);
  } catch (error) {
    if (error.response) {
      throw new Error(`Failed to create test order: ${error.response.data?.message || error.response.statusText}`);
    }
    throw error;
  }
};

/**
 * Get order by ID
 */
exports.getOrder = async (storeUrl, consumerKey, consumerSecret, orderId) => {
  try {
    const client = createWooCommerceClient(storeUrl, consumerKey, consumerSecret);
    
    const response = await axios.get(`${client.baseURL}/orders/${orderId}`, {
      auth: client.auth,
      headers: client.headers,
      timeout: client.timeout
    });

    if (response.status === 200) {
      return {
        success: true,
        order: response.data
      };
    }

    throw new Error(`Failed to get order: ${response.status}`);
  } catch (error) {
    throw error;
  }
};

/**
 * Check if plugin is active (by checking for plugin in active plugins list)
 * Note: This requires WordPress REST API access, not WooCommerce API
 */
exports.checkPluginStatus = async (storeUrl, consumerKey, consumerSecret) => {
  try {
    const baseURL = normalizeUrl(storeUrl);
    
    // Try to check via WordPress REST API
    // This might not work if REST API is restricted, but worth trying
    const response = await axios.get(`${baseURL}/wp-json/wp/v2/plugins`, {
      auth: {
        username: consumerKey,
        password: consumerSecret
      },
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000,
      validateStatus: () => true // Don't throw on any status
    });

    if (response.status === 200 && Array.isArray(response.data)) {
      const pluginName = 'affiliate-network-woocommerce';
      const isActive = response.data.some(plugin => 
        plugin.plugin && 
        plugin.plugin.includes(pluginName) && 
        plugin.status === 'active'
      );
      
      return {
        success: true,
        isActive,
        message: isActive ? 'Plugin is active' : 'Plugin not found or inactive'
      };
    }

    // If we can't check via API, return unknown status
    return {
      success: false,
      isActive: null,
      message: 'Unable to verify plugin status via API. Please verify manually in WordPress admin.'
    };
  } catch (error) {
    return {
      success: false,
      isActive: null,
      message: 'Unable to verify plugin status. Please verify manually in WordPress admin.'
    };
  }
};

/**
 * Create webhook automatically via WooCommerce API
 */
exports.createWebhook = async (storeUrl, consumerKey, consumerSecret, webhookUrl, webhookSecret = null) => {
  try {
    console.log('[WooCommerce Service] createWebhook called');
    console.log('[WooCommerce Service] Store URL:', storeUrl);
    console.log('[WooCommerce Service] Webhook URL:', webhookUrl);
    console.log('[WooCommerce Service] Consumer Key:', consumerKey ? `${consumerKey.substring(0, 10)}...` : 'MISSING');
    
    const client = createWooCommerceClient(storeUrl, consumerKey, consumerSecret);
    console.log('[WooCommerce Service] Client baseURL:', client.baseURL);
    console.log('[WooCommerce Service] Full webhook endpoint:', `${client.baseURL}/webhooks`);
    
    // Generate secret if not provided
    const secret = webhookSecret || crypto.randomBytes(32).toString('hex');
    
    const webhookData = {
      name: 'Affiliate Network - Order Tracking',
      topic: 'order.created',
      delivery_url: webhookUrl,
      secret: secret,
      status: 'active'
    };

    console.log('[WooCommerce Service] Webhook data to send:', {
      name: webhookData.name,
      topic: webhookData.topic,
      delivery_url: webhookData.delivery_url,
      status: webhookData.status,
      secret: secret ? '***' : 'MISSING'
    });

    const response = await axios.post(`${client.baseURL}/webhooks`, webhookData, {
      auth: client.auth,
      headers: client.headers,
      timeout: client.timeout,
      validateStatus: () => true
    });

    console.log('[WooCommerce Service] Response status:', response.status);
    console.log('[WooCommerce Service] Response data:', JSON.stringify(response.data, null, 2));

    if (response.status === 201) {
      console.log('[WooCommerce Service] ✅ Webhook created successfully! ID:', response.data.id);
      return {
        success: true,
        webhook: response.data,
        webhookId: response.data.id,
        secret: secret,
        message: 'Webhook created successfully'
      };
    }

    // Check if webhook already exists
    if (response.status === 400 && response.data?.code === 'woocommerce_rest_webhook_delivery_url_exists') {
      console.log('[WooCommerce Service] ⚠️ Webhook already exists');
      return {
        success: false,
        message: 'Webhook with this URL already exists',
        error: 'DUPLICATE_WEBHOOK'
      };
    }

    // Check for common error reasons
    let errorMessage = response.data?.message || `Failed to create webhook: ${response.status}`;
    let errorCode = 'CREATE_FAILED';
    
    if (response.status === 400) {
      console.log('[WooCommerce Service] ❌ 400 Error - Response code:', response.data?.code);
      console.log('[WooCommerce Service] ❌ 400 Error - Full response:', JSON.stringify(response.data, null, 2));
      
      // Check for specific error codes
      if (response.data?.code === 'woocommerce_rest_invalid_delivery_url') {
        errorMessage = 'Invalid webhook URL. Localhost URLs may not be accepted by WooCommerce. Please configure webhook manually.';
        errorCode = 'INVALID_URL';
      } else if (response.data?.code === 'woocommerce_rest_webhook_invalid_delivery_url') {
        errorMessage = 'Webhook URL is invalid or not accessible. For localhost, please configure webhook manually.';
        errorCode = 'INVALID_URL';
      } else if (response.data?.code === 'rest_cannot_create') {
        errorMessage = 'Cannot create webhook. Check API permissions. Consumer Key needs Write permission.';
        errorCode = 'PERMISSION_ERROR';
      } else if (response.data?.code === 'woocommerce_rest_authentication_error') {
        errorMessage = 'Authentication failed. Invalid Consumer Key or Consumer Secret.';
        errorCode = 'AUTH_ERROR';
      }
    } else if (response.status === 401) {
      console.log('[WooCommerce Service] ❌ 401 Unauthorized - Authentication failed');
      errorMessage = 'Authentication failed. Invalid Consumer Key or Consumer Secret.';
      errorCode = 'AUTH_ERROR';
    } else if (response.status === 403) {
      console.log('[WooCommerce Service] ❌ 403 Forbidden - Permission denied');
      errorMessage = 'Permission denied. Consumer Key needs Write permission for webhooks.';
      errorCode = 'PERMISSION_ERROR';
    } else {
      console.log('[WooCommerce Service] ❌ Unexpected status:', response.status);
    }

    return {
      success: false,
      message: errorMessage,
      error: errorCode,
      details: response.data,
      status: response.status
    };
  } catch (error) {
    console.error('[WooCommerce Service] ❌ Exception caught:', error.message);
    console.error('[WooCommerce Service] ❌ Error stack:', error.stack);
    
    if (error.response) {
      console.error('[WooCommerce Service] ❌ Error response status:', error.response.status);
      console.error('[WooCommerce Service] ❌ Error response data:', JSON.stringify(error.response.data, null, 2));
      return {
        success: false,
        message: error.response.data?.message || `Failed to create webhook: ${error.response.status}`,
        error: 'API_ERROR',
        status: error.response.status,
        details: error.response.data
      };
    } else if (error.request) {
      console.error('[WooCommerce Service] ❌ No response received:', error.request);
      return {
        success: false,
        message: 'No response from WooCommerce API. Check store URL and network connection.',
        error: 'NETWORK_ERROR'
      };
    }
    return {
      success: false,
      message: error.message || 'Failed to create webhook',
      error: 'UNKNOWN_ERROR'
    };
  }
};

/**
 * Verify webhook is configured
 * Check WooCommerce webhooks via API
 */
exports.verifyWebhook = async (storeUrl, consumerKey, consumerSecret, webhookUrl) => {
  try {
    const client = createWooCommerceClient(storeUrl, consumerKey, consumerSecret);
    
    const response = await axios.get(`${client.baseURL}/webhooks`, {
      auth: client.auth,
      headers: client.headers,
      timeout: client.timeout,
      validateStatus: () => true
    });

    if (response.status === 200 && Array.isArray(response.data)) {
      // Normalize URLs for comparison (remove trailing slashes, convert to lowercase)
      const normalizeUrl = (url) => {
        if (!url) return '';
        return url.toString().toLowerCase().replace(/\/$/, '').trim();
      };
      
      const normalizedWebhookUrl = normalizeUrl(webhookUrl);
      
      // Find webhook by matching the delivery URL
      // Check both exact match and partial match (in case of URL encoding differences)
      const webhook = response.data.find(wh => {
        if (!wh.delivery_url) return false;
        const normalizedDeliveryUrl = normalizeUrl(wh.delivery_url);
        
        // Exact match
        if (normalizedDeliveryUrl === normalizedWebhookUrl) return true;
        
        // Partial match - check if the path matches (ignore protocol/host differences)
        const webhookPath = normalizedWebhookUrl.split('/api/')[1]; // Get path after domain
        const deliveryPath = normalizedDeliveryUrl.split('/api/')[1];
        if (webhookPath && deliveryPath && deliveryPath === webhookPath) return true;
        
        // Also check if delivery URL contains the webhook path
        if (webhookPath && normalizedDeliveryUrl.includes(webhookPath)) return true;
        
        return false;
      });
      
      if (webhook) {
        return {
          success: true,
          configured: true,
          active: webhook.status === 'active',
          webhook: {
            id: webhook.id,
            name: webhook.name,
            status: webhook.status,
            topic: webhook.topic,
            deliveryUrl: webhook.delivery_url
          },
          message: 'Webhook is configured'
        };
      }
      
      // Log all webhooks for debugging (only in development)
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Webhook Verify] Webhook URL to find:', normalizedWebhookUrl);
        console.log('[Webhook Verify] Found webhooks:', response.data.map(wh => ({
          id: wh.id,
          name: wh.name,
          delivery_url: wh.delivery_url,
          status: wh.status
        })));
      }
      
      return {
        success: true,
        configured: false,
        message: 'Webhook not found. Please configure the webhook in WooCommerce settings.'
      };
    }

    return {
      success: false,
      configured: null,
      message: 'Unable to verify webhook status. Please verify manually in WooCommerce settings.'
    };
  } catch (error) {
    return {
      success: false,
      configured: null,
      message: 'Unable to verify webhook status. Please verify manually in WooCommerce settings.'
    };
  }
};

