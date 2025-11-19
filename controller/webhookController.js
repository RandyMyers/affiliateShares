const Order = require('../models/order');
const Store = require('../models/store');
const { sendResponse } = require('../utils/response');
const crypto = require('crypto');

// Verify webhook signature (for Shopify)
const verifyShopifySignature = (body, signature, secret) => {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body, 'utf8');
  const calculatedSignature = hmac.digest('base64');
  return calculatedSignature === signature;
};

// WooCommerce webhook handler
exports.handleWooCommerceWebhook = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const webhookSecret = req.headers['x-webhook-secret'];

    // Find store
    const store = await Store.findById(storeId);
    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Verify webhook secret
    if (store.settings.webhookSecret && webhookSecret !== store.settings.webhookSecret) {
      return sendResponse(res, 401, 'Invalid webhook secret', null);
    }

    // Extract order data from WooCommerce webhook
    const wcOrder = req.body;

    // Check if order already exists
    const existingOrder = await Order.findOne({
      store: storeId,
      externalOrderId: wcOrder.id?.toString() || wcOrder.number?.toString()
    });

    if (existingOrder) {
      // Update existing order
      existingOrder.orderData = {
        orderNumber: wcOrder.number || wcOrder.id?.toString(),
        customerEmail: wcOrder.billing?.email,
        customerName: `${wcOrder.billing?.first_name || ''} ${wcOrder.billing?.last_name || ''}`.trim(),
        items: wcOrder.line_items?.map(item => ({
          productId: item.product_id?.toString(),
          productName: item.name,
          quantity: item.quantity,
          price: parseFloat(item.price),
          total: parseFloat(item.total)
        })) || [],
        subtotal: parseFloat(wcOrder.total) - (parseFloat(wcOrder.total_tax) || 0) - (parseFloat(wcOrder.shipping_total) || 0),
        tax: parseFloat(wcOrder.total_tax) || 0,
        shipping: parseFloat(wcOrder.shipping_total) || 0,
        discount: parseFloat(wcOrder.discount_total) || 0,
        total: parseFloat(wcOrder.total),
        currency: wcOrder.currency || 'USD',
        status: wcOrder.status,
        paymentMethod: wcOrder.payment_method,
        paymentStatus: wcOrder.paid ? 'paid' : 'pending',
        shippingAddress: {
          name: `${wcOrder.shipping?.first_name || ''} ${wcOrder.shipping?.last_name || ''}`.trim(),
          address1: wcOrder.shipping?.address_1,
          address2: wcOrder.shipping?.address_2,
          city: wcOrder.shipping?.city,
          state: wcOrder.shipping?.state,
          zip: wcOrder.shipping?.postcode,
          country: wcOrder.shipping?.country
        }
      };
      existingOrder.orderDate = new Date(wcOrder.date_created);
      existingOrder.status = wcOrder.status === 'completed' || wcOrder.status === 'processing' ? 'confirmed' : 'pending';
      await existingOrder.save();

      return sendResponse(res, 200, 'Order updated successfully', existingOrder);
    }

    // Extract affiliate tracking from order meta
    const affiliateRef = wcOrder.meta_data?.find(
      meta => meta.key === '_affiliate_ref' || meta.key === 'affiliate_ref'
    )?.value;

    // Get cookie ID from order meta or use referral code
    const cookieId = wcOrder.meta_data?.find(
      meta => meta.key === '_affiliate_cookie' || meta.key === 'affiliate_cookie'
    )?.value || affiliateRef;

    // Process new order
    const orderController = require('./orderController');
    req.body = {
      storeId,
      orderData: {
        orderNumber: wcOrder.number || wcOrder.id?.toString(),
        customerEmail: wcOrder.billing?.email,
        customerName: `${wcOrder.billing?.first_name || ''} ${wcOrder.billing?.last_name || ''}`.trim(),
        items: wcOrder.line_items?.map(item => ({
          productId: item.product_id?.toString(),
          productName: item.name,
          quantity: item.quantity,
          price: parseFloat(item.price),
          total: parseFloat(item.total)
        })) || [],
        subtotal: parseFloat(wcOrder.total) - (parseFloat(wcOrder.total_tax) || 0) - (parseFloat(wcOrder.shipping_total) || 0),
        tax: parseFloat(wcOrder.total_tax) || 0,
        shipping: parseFloat(wcOrder.shipping_total) || 0,
        discount: parseFloat(wcOrder.discount_total) || 0,
        total: parseFloat(wcOrder.total),
        currency: wcOrder.currency || 'USD',
        status: wcOrder.status,
        paymentMethod: wcOrder.payment_method,
        paymentStatus: wcOrder.paid ? 'paid' : 'pending',
        shippingAddress: {
          name: `${wcOrder.shipping?.first_name || ''} ${wcOrder.shipping?.last_name || ''}`.trim(),
          address1: wcOrder.shipping?.address_1,
          address2: wcOrder.shipping?.address_2,
          city: wcOrder.shipping?.city,
          state: wcOrder.shipping?.state,
          zip: wcOrder.shipping?.postcode,
          country: wcOrder.shipping?.country
        },
        orderDate: wcOrder.date_created
      },
      cookieId,
      referralCode: affiliateRef
    };

    return orderController.processOrder(req, res, next);
  } catch (error) {
    next(error);
  }
};

// Shopify webhook handler
exports.handleShopifyWebhook = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const shopifySignature = req.headers['x-shopify-hmac-sha256'];
    const shopifyTopic = req.headers['x-shopify-topic'];
    const shopifyShop = req.headers['x-shopify-shop-domain'];

    // Find store
    const store = await Store.findById(storeId);
    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Verify webhook signature
    if (store.settings.webhookSecret) {
      const rawBody = JSON.stringify(req.body);
      if (!verifyShopifySignature(rawBody, shopifySignature, store.settings.webhookSecret)) {
        return sendResponse(res, 401, 'Invalid webhook signature', null);
      }
    }

    // Only process order creation/update
    if (!shopifyTopic.includes('orders')) {
      return sendResponse(res, 200, 'Webhook received but not processed', null);
    }

    // Extract order data from Shopify webhook
    const shopifyOrder = req.body;

    // Check if order already exists
    const existingOrder = await Order.findOne({
      store: storeId,
      externalOrderId: shopifyOrder.id?.toString() || shopifyOrder.order_number?.toString()
    });

    if (existingOrder && shopifyTopic.includes('updated')) {
      // Update existing order
      existingOrder.orderData = {
        orderNumber: shopifyOrder.order_number?.toString() || shopifyOrder.id?.toString(),
        customerEmail: shopifyOrder.email,
        customerName: `${shopifyOrder.shipping_address?.first_name || ''} ${shopifyOrder.shipping_address?.last_name || ''}`.trim(),
        items: shopifyOrder.line_items?.map(item => ({
          productId: item.product_id?.toString(),
          productName: item.name,
          quantity: item.quantity,
          price: parseFloat(item.price),
          total: parseFloat(item.line_price)
        })) || [],
        subtotal: parseFloat(shopifyOrder.subtotal_price),
        tax: parseFloat(shopifyOrder.total_tax) || 0,
        shipping: parseFloat(shopifyOrder.total_shipping_price_set?.shop_money?.amount) || 0,
        discount: parseFloat(shopifyOrder.total_discounts) || 0,
        total: parseFloat(shopifyOrder.total_price),
        currency: shopifyOrder.currency || 'USD',
        status: shopifyOrder.financial_status,
        paymentMethod: shopifyOrder.gateway,
        paymentStatus: shopifyOrder.financial_status,
        shippingAddress: {
          name: `${shopifyOrder.shipping_address?.first_name || ''} ${shopifyOrder.shipping_address?.last_name || ''}`.trim(),
          address1: shopifyOrder.shipping_address?.address1,
          address2: shopifyOrder.shipping_address?.address2,
          city: shopifyOrder.shipping_address?.city,
          state: shopifyOrder.shipping_address?.province,
          zip: shopifyOrder.shipping_address?.zip,
          country: shopifyOrder.shipping_address?.country
        }
      };
      existingOrder.orderDate = new Date(shopifyOrder.created_at);
      existingOrder.status = shopifyOrder.financial_status === 'paid' ? 'confirmed' : 'pending';
      await existingOrder.save();

      return sendResponse(res, 200, 'Order updated successfully', existingOrder);
    }

    // Extract affiliate tracking from order note attributes or tags
    const affiliateRef = shopifyOrder.note_attributes?.find(
      attr => attr.name === '_affiliate_ref' || attr.name === 'affiliate_ref'
    )?.value;

    const cookieId = shopifyOrder.note_attributes?.find(
      attr => attr.name === '_affiliate_cookie' || attr.name === 'affiliate_cookie'
    )?.value || affiliateRef;

    // Process new order
    const orderController = require('./orderController');
    req.body = {
      storeId,
      orderData: {
        orderNumber: shopifyOrder.order_number?.toString() || shopifyOrder.id?.toString(),
        customerEmail: shopifyOrder.email,
        customerName: `${shopifyOrder.shipping_address?.first_name || ''} ${shopifyOrder.shipping_address?.last_name || ''}`.trim(),
        items: shopifyOrder.line_items?.map(item => ({
          productId: item.product_id?.toString(),
          productName: item.name,
          quantity: item.quantity,
          price: parseFloat(item.price),
          total: parseFloat(item.line_price)
        })) || [],
        subtotal: parseFloat(shopifyOrder.subtotal_price),
        tax: parseFloat(shopifyOrder.total_tax) || 0,
        shipping: parseFloat(shopifyOrder.total_shipping_price_set?.shop_money?.amount) || 0,
        discount: parseFloat(shopifyOrder.total_discounts) || 0,
        total: parseFloat(shopifyOrder.total_price),
        currency: shopifyOrder.currency || 'USD',
        status: shopifyOrder.financial_status,
        paymentMethod: shopifyOrder.gateway,
        paymentStatus: shopifyOrder.financial_status,
        shippingAddress: {
          name: `${shopifyOrder.shipping_address?.first_name || ''} ${shopifyOrder.shipping_address?.last_name || ''}`.trim(),
          address1: shopifyOrder.shipping_address?.address1,
          address2: shopifyOrder.shipping_address?.address2,
          city: shopifyOrder.shipping_address?.city,
          state: shopifyOrder.shipping_address?.province,
          zip: shopifyOrder.shipping_address?.zip,
          country: shopifyOrder.shipping_address?.country
        },
        orderDate: shopifyOrder.created_at
      },
      cookieId,
      referralCode: affiliateRef
    };

    return orderController.processOrder(req, res, next);
  } catch (error) {
    next(error);
  }
};

