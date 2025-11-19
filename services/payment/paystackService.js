const Paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY || '');
const PaymentGateway = require('../../models/paymentGateway');

/**
 * Paystack Payment Service
 * Handles payment initialization, verification, and transfers
 */
class PaystackService {
  constructor() {
    this.paystack = null;
    this.gateway = null;
  }

  /**
   * Initialize Paystack client with gateway credentials
   */
  async initialize() {
    try {
      // Get active Paystack gateway
      this.gateway = await PaymentGateway.getActiveGateway('paystack');
      
      if (!this.gateway) {
        throw new Error('Paystack gateway not configured');
      }

      // Get decrypted secret key
      const secretKey = this.gateway.getSecretKey();
      const publicKey = this.gateway.publicKey;

      // Initialize Paystack client
      this.paystack = Paystack(secretKey);

      return true;
    } catch (error) {
      console.error('Failed to initialize Paystack:', error);
      throw error;
    }
  }

  /**
   * Initialize a payment transaction
   * @param {Object} paymentData - Payment details
   * @returns {Promise<Object>} Payment initialization response
   */
  async initializePayment(paymentData) {
    try {
      if (!this.paystack) {
        await this.initialize();
      }

      const {
        amount,
        email,
        reference,
        metadata = {},
        callback_url,
        currency = 'NGN'
      } = paymentData;

      const payload = {
        amount: amount * 100, // Paystack amounts are in kobo (smallest currency unit)
        email,
        reference: reference || `PAY_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        currency,
        callback_url,
        metadata
      };

      const response = await this.paystack.transaction.initialize(payload);

      if (response.status) {
        return {
          success: true,
          authorizationUrl: response.data.authorization_url,
          accessCode: response.data.access_code,
          transactionReference: response.data.reference,
          gatewayResponse: response
        };
      } else {
        throw new Error(response.message || 'Failed to initialize payment');
      }
    } catch (error) {
      console.error('Paystack payment initialization error:', error);
      throw error;
    }
  }

  /**
   * Verify a payment transaction
   * @param {String} reference - Transaction reference
   * @returns {Promise<Object>} Payment verification response
   */
  async verifyPayment(reference) {
    try {
      if (!this.paystack) {
        await this.initialize();
      }

      const response = await this.paystack.transaction.verify(reference);

      if (response.status && response.data) {
        const transaction = response.data;
        
        return {
          success: true,
          status: transaction.status === 'success' ? 'completed' : transaction.status,
          amount: transaction.amount / 100, // Convert from kobo
          currency: transaction.currency,
          transactionId: transaction.id.toString(),
          transactionReference: transaction.reference,
          customer: transaction.customer,
          gatewayResponse: response
        };
      } else {
        return {
          success: false,
          message: response.message || 'Payment verification failed',
          gatewayResponse: response
        };
      }
    } catch (error) {
      console.error('Paystack payment verification error:', error);
      throw error;
    }
  }

  /**
   * Initiate a transfer (for payouts)
   * @param {Object} transferData - Transfer details
   * @returns {Promise<Object>} Transfer response
   */
  async initiateTransfer(transferData) {
    try {
      if (!this.paystack) {
        await this.initialize();
      }

      const {
        source = 'balance',
        amount,
        recipient,
        reason,
        reference
      } = transferData;

      const payload = {
        source,
        amount: amount * 100, // Convert to kobo
        recipient,
        reason: reason || 'Affiliate commission payout',
        reference: reference || `TRF_${Date.now()}_${Math.random().toString(36).substring(7)}`
      };

      const response = await this.paystack.transfer.create(payload);

      if (response.status) {
        return {
          success: true,
          transferId: response.data.id.toString(),
          reference: response.data.reference,
          status: response.data.status,
          gatewayResponse: response
        };
      } else {
        throw new Error(response.message || 'Failed to initiate transfer');
      }
    } catch (error) {
      console.error('Paystack transfer error:', error);
      throw error;
    }
  }

  /**
   * Create transfer recipient
   * @param {Object} recipientData - Recipient details
   * @returns {Promise<Object>} Recipient response
   */
  async createTransferRecipient(recipientData) {
    try {
      if (!this.paystack) {
        await this.initialize();
      }

      const {
        type, // 'nuban', 'mobile_money', 'basa'
        name,
        account_number,
        bank_code,
        email,
        currency = 'NGN'
      } = recipientData;

      const payload = {
        type,
        name,
        account_number,
        bank_code,
        email,
        currency
      };

      const response = await this.paystack.transferrecipient.create(payload);

      if (response.status) {
        return {
          success: true,
          recipientCode: response.data.recipient_code,
          recipientId: response.data.id.toString(),
          gatewayResponse: response
        };
      } else {
        throw new Error(response.message || 'Failed to create transfer recipient');
      }
    } catch (error) {
      console.error('Paystack create recipient error:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   * @param {String} payload - Webhook payload
   * @param {String} signature - Webhook signature
   * @returns {Boolean} Signature validity
   */
  verifyWebhookSignature(payload, signature) {
    try {
      if (!this.gateway) {
        return false;
      }

      const secretHash = this.gateway.webhookSecret || process.env.PAYSTACK_WEBHOOK_SECRET;
      if (!secretHash) {
        return false;
      }

      const crypto = require('crypto');
      const hash = crypto.createHmac('sha512', secretHash)
        .update(JSON.stringify(payload))
        .digest('hex');

      return hash === signature;
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }

  /**
   * Handle webhook event
   * @param {Object} webhookData - Webhook payload
   * @returns {Promise<Object>} Processed webhook data
   */
  async handleWebhook(webhookData) {
    try {
      const { event, data } = webhookData;

      switch (event) {
        case 'charge.success':
          return {
            type: 'payment',
            status: 'completed',
            transactionId: data.id.toString(),
            transactionReference: data.reference,
            amount: data.amount / 100, // Convert from kobo
            currency: data.currency,
            customer: data.customer,
            gatewayResponse: data
          };

        case 'transfer.success':
          return {
            type: 'transfer',
            status: 'completed',
            transferId: data.id.toString(),
            reference: data.reference,
            amount: data.amount / 100, // Convert from kobo
            currency: data.currency,
            gatewayResponse: data
          };

        case 'charge.failed':
        case 'transfer.failed':
          return {
            type: event.includes('charge') ? 'payment' : 'transfer',
            status: 'failed',
            transactionId: data.id?.toString() || data.transfer_code,
            transactionReference: data.reference,
            gatewayResponse: data
          };

        default:
          return {
            type: 'unknown',
            event,
            gatewayResponse: data
          };
      }
    } catch (error) {
      console.error('Paystack webhook handling error:', error);
      throw error;
    }
  }
}

module.exports = new PaystackService();

