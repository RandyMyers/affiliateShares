const express = require('express');
const router = express.Router();
const webhookController = require('../controller/webhookController');
const paymentService = require('../services/payment/paymentService');
const Subscription = require('../models/subscription');
const Payout = require('../models/payout');

// Webhook routes (no auth required, but verify webhook secret)
router.post('/woocommerce/:storeId', webhookController.handleWooCommerceWebhook);
router.post('/shopify/:storeId', webhookController.handleShopifyWebhook);

// Payment Gateway Webhooks
// Flutterwave webhook
router.post('/payment/flutterwave', async (req, res) => {
  try {
    const signature = req.headers['verif-hash'] || req.headers['x-flutterwave-signature'];
    const webhookData = req.body;

    // Verify signature
    const flutterwaveService = await paymentService.getService('flutterwave');
    const isValid = flutterwaveService.verifyWebhookSignature(webhookData, signature);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    // Handle webhook
    const result = await paymentService.handleWebhook(webhookData, 'flutterwave', signature);

    // Process based on webhook type
    if (result.type === 'payment' && result.status === 'completed') {
      // Handle subscription payment
      if (result.gatewayResponse?.meta?.type === 'subscription') {
        const subscription = await Subscription.findOne({
          'metadata.transactionReference': result.transactionReference
        });

        if (subscription) {
          subscription.metadata.transactionId = result.transactionId;
          subscription.status = 'active';
          await subscription.save();
        }
      }

      // Handle payout
      if (result.gatewayResponse?.meta?.type === 'payout') {
        const payout = await Payout.findOne({
          transactionReference: result.transactionReference
        });

        if (payout) {
          await payout.markAsCompleted(
            result.transactionId,
            result.transactionReference,
            result.gatewayResponse
          );
        }
      }
    }

    return res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Flutterwave webhook error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Paystack webhook
router.post('/payment/paystack', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const webhookData = req.body;

    // Verify signature
    const paystackService = await paymentService.getService('paystack');
    const isValid = paystackService.verifyWebhookSignature(webhookData, signature);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    // Handle webhook
    const result = await paymentService.handleWebhook(webhookData, 'paystack', signature);

    // Process based on webhook type
    if (result.type === 'payment' && result.status === 'completed') {
      // Handle subscription payment
      if (result.gatewayResponse?.metadata?.type === 'subscription') {
        const subscription = await Subscription.findOne({
          'metadata.transactionReference': result.transactionReference
        });

        if (subscription) {
          subscription.metadata.transactionId = result.transactionId;
          subscription.status = 'active';
          await subscription.save();
        }
      }

      // Handle payout
      if (result.gatewayResponse?.metadata?.type === 'payout') {
        const payout = await Payout.findOne({
          transactionReference: result.transactionReference
        });

        if (payout) {
          await payout.markAsCompleted(
            result.transactionId,
            result.transactionReference,
            result.gatewayResponse
          );
        }
      }
    }

    return res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Paystack webhook error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Squad webhook
router.post('/payment/squad', async (req, res) => {
  try {
    const signature = req.headers['x-squad-signature'] || req.headers['authorization'];
    const webhookData = req.body;

    // Verify signature
    const squadService = await paymentService.getService('squad');
    const isValid = squadService.verifyWebhookSignature(webhookData, signature);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    // Handle webhook
    const result = await paymentService.handleWebhook(webhookData, 'squad', signature);

    // Process based on webhook type
    if (result.type === 'payment' && result.status === 'completed') {
      // Handle subscription payment
      if (result.gatewayResponse?.metadata?.type === 'subscription') {
        const subscription = await Subscription.findOne({
          'metadata.transactionReference': result.transactionReference
        });

        if (subscription) {
          subscription.metadata.transactionId = result.transactionId;
          subscription.status = 'active';
          await subscription.save();
        }
      }

      // Handle payout
      if (result.gatewayResponse?.metadata?.type === 'payout') {
        const payout = await Payout.findOne({
          transactionReference: result.transactionReference
        });

        if (payout) {
          await payout.markAsCompleted(
            result.transactionId,
            result.transactionReference,
            result.gatewayResponse
          );
        }
      }
    }

    return res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Squad webhook error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

