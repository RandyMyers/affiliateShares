const axios = require('axios');
const PaymentGateway = require('../../models/paymentGateway');
const crypto = require('crypto');

/**
 * Squad Payment Service
 * Handles payment initialization, verification, and transfers
 * Squad uses REST API (no official SDK)
 */
class SquadService {
  constructor() {
    this.baseUrl = 'https://sandbox-api-d.squadco.com'; // Change to production URL in production
    this.gateway = null;
    this.secretKey = null;
    this.publicKey = null;
  }

  /**
   * Initialize Squad client with gateway credentials
   */
  async initialize() {
    try {
      // Get active Squad gateway
      this.gateway = await PaymentGateway.getActiveGateway('squad');
      
      if (!this.gateway) {
        throw new Error('Squad gateway not configured');
      }

      // Get decrypted secret key
      this.secretKey = this.gateway.getSecretKey();
      this.publicKey = this.gateway.publicKey;

      // Set base URL based on environment
      if (this.gateway.environment === 'live') {
        this.baseUrl = 'https://api-d.squadco.com';
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize Squad:', error);
      throw error;
    }
  }

  /**
   * Generate authorization header for Squad API
   */
  generateAuthHeader() {
    if (!this.secretKey) {
      throw new Error('Squad secret key not initialized');
    }
    return `Bearer ${this.secretKey}`;
  }

  /**
   * Initialize a payment transaction
   * @param {Object} paymentData - Payment details
   * @returns {Promise<Object>} Payment initialization response
   */
  async initializePayment(paymentData) {
    try {
      if (!this.secretKey) {
        await this.initialize();
      }

      const {
        amount,
        email,
        currency = 'NGN',
        reference,
        callback_url,
        metadata = {}
      } = paymentData;

      const payload = {
        amount: amount * 100, // Squad amounts are in kobo
        email,
        currency,
        initiate_type: 'inline',
        transaction_ref: reference || `SQD_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        callback_url,
        customer_name: metadata.name || email,
        metadata
      };

      const response = await axios.post(
        `${this.baseUrl}/transaction/initiate`,
        payload,
        {
          headers: {
            'Authorization': this.generateAuthHeader(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.status === 'success') {
        return {
          success: true,
          paymentLink: response.data.data.checkout_url,
          transactionReference: response.data.data.transaction_ref,
          checkoutId: response.data.data.checkout_id,
          gatewayResponse: response.data
        };
      } else {
        throw new Error(response.data?.message || 'Failed to initialize payment');
      }
    } catch (error) {
      console.error('Squad payment initialization error:', error);
      if (error.response) {
        throw new Error(error.response.data?.message || error.message);
      }
      throw error;
    }
  }

  /**
   * Verify a payment transaction
   * @param {String} transactionRef - Transaction reference
   * @returns {Promise<Object>} Payment verification response
   */
  async verifyPayment(transactionRef) {
    try {
      if (!this.secretKey) {
        await this.initialize();
      }

      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${transactionRef}`,
        {
          headers: {
            'Authorization': this.generateAuthHeader(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.status === 'success') {
        const transaction = response.data.data;
        
        return {
          success: true,
          status: transaction.transaction_status === 'success' ? 'completed' : transaction.transaction_status,
          amount: transaction.amount / 100, // Convert from kobo
          currency: transaction.currency,
          transactionId: transaction.transaction_id?.toString(),
          transactionReference: transaction.transaction_ref,
          customer: {
            email: transaction.customer_email,
            name: transaction.customer_name
          },
          gatewayResponse: response.data
        };
      } else {
        return {
          success: false,
          message: response.data?.message || 'Payment verification failed',
          gatewayResponse: response.data
        };
      }
    } catch (error) {
      console.error('Squad payment verification error:', error);
      if (error.response) {
        throw new Error(error.response.data?.message || error.message);
      }
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
      if (!this.secretKey) {
        await this.initialize();
      }

      const {
        account_number,
        account_name,
        bank_code,
        amount,
        currency = 'NGN',
        narration,
        reference
      } = transferData;

      const payload = {
        account_number,
        account_name,
        bank_code,
        amount: amount * 100, // Convert to kobo
        currency,
        narration: narration || 'Affiliate commission payout',
        transaction_ref: reference || `TRF_${Date.now()}_${Math.random().toString(36).substring(7)}`
      };

      const response = await axios.post(
        `${this.baseUrl}/payout/initiate`,
        payload,
        {
          headers: {
            'Authorization': this.generateAuthHeader(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.status === 'success') {
        return {
          success: true,
          transferId: response.data.data.transfer_id?.toString(),
          reference: response.data.data.transaction_ref,
          status: response.data.data.status,
          gatewayResponse: response.data
        };
      } else {
        throw new Error(response.data?.message || 'Failed to initiate transfer');
      }
    } catch (error) {
      console.error('Squad transfer error:', error);
      if (error.response) {
        throw new Error(error.response.data?.message || error.message);
      }
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

      const secretHash = this.gateway.webhookSecret || process.env.SQUAD_WEBHOOK_SECRET;
      if (!secretHash) {
        return false;
      }

      // Squad uses HMAC SHA256
      const hash = crypto.createHmac('sha256', secretHash)
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
        case 'transaction.success':
          return {
            type: 'payment',
            status: 'completed',
            transactionId: data.transaction_id?.toString(),
            transactionReference: data.transaction_ref,
            amount: data.amount / 100, // Convert from kobo
            currency: data.currency,
            customer: {
              email: data.customer_email,
              name: data.customer_name
            },
            gatewayResponse: data
          };

        case 'payout.success':
          return {
            type: 'transfer',
            status: 'completed',
            transferId: data.transfer_id?.toString(),
            reference: data.transaction_ref,
            amount: data.amount / 100, // Convert from kobo
            currency: data.currency,
            gatewayResponse: data
          };

        case 'transaction.failed':
        case 'payout.failed':
          return {
            type: event.includes('transaction') ? 'payment' : 'transfer',
            status: 'failed',
            transactionId: data.transaction_id?.toString() || data.transfer_id?.toString(),
            transactionReference: data.transaction_ref,
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
      console.error('Squad webhook handling error:', error);
      throw error;
    }
  }
}

module.exports = new SquadService();

