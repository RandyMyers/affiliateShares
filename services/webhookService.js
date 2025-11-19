const crypto = require('crypto');
const axios = require('axios');

/**
 * Generate webhook signature for security
 */
exports.generateSignature = (payload, secret) => {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
};

/**
 * Verify webhook signature
 */
exports.verifySignature = (payload, signature, secret) => {
  const expectedSignature = exports.generateSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

/**
 * Send wallet transaction webhook
 */
exports.sendWalletTransactionWebhook = async (merchantId, event, data) => {
  try {
    const Store = require('../models/store');
    const User = require('../models/user');

    // Get merchant's stores to find webhook URLs
    const stores = await Store.find({ merchant: merchantId });

    const webhooks = [];

    // Collect all unique webhook URLs from stores
    stores.forEach(store => {
      if (store.settings.webhookUrl && store.settings.webhookSecret) {
        webhooks.push({
          url: store.settings.webhookUrl,
          secret: store.settings.webhookSecret,
          storeId: store._id
        });
      }
    });

    // Also check if merchant has a global webhook URL
    const merchant = await User.findById(merchantId);
    // TODO: Add merchant-level webhook settings if needed

    if (webhooks.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const payload = {
      event: event,
      timestamp: new Date().toISOString(),
      data: data
    };

    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    // Send webhook to each configured URL
    for (const webhook of webhooks) {
      try {
        const signature = exports.generateSignature(payload, webhook.secret);

        const response = await axios.post(webhook.url, payload, {
          headers: {
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        });

        if (response.status >= 200 && response.status < 300) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push({
            url: webhook.url,
            status: response.status,
            error: 'Non-2xx response'
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          url: webhook.url,
          error: error.message,
          code: error.code
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error sending wallet transaction webhook:', error);
    throw error;
  }
};

/**
 * Wallet event types
 */
exports.WALLET_EVENTS = {
  DEPOSIT_COMPLETED: 'wallet.deposit.completed',
  DEPOSIT_FAILED: 'wallet.deposit.failed',
  AUTO_DEPOSIT_TRIGGERED: 'wallet.auto_deposit.triggered',
  COMMISSION_PAID: 'wallet.commission.paid',
  PAYOUT_PROCESSED: 'wallet.payout.processed',
  FEE_CHARGED: 'wallet.fee.charged',
  LOW_BALANCE_ALERT: 'wallet.low_balance.alert',
  BALANCE_UPDATED: 'wallet.balance.updated',
  TRANSACTION_CREATED: 'wallet.transaction.created',
  TRANSACTION_COMPLETED: 'wallet.transaction.completed',
  TRANSACTION_FAILED: 'wallet.transaction.failed'
};


