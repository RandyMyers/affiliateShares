const Flutterwave = require('flutterwave-node-v3');
const PaymentGateway = require('../../models/paymentGateway');

/**
 * Flutterwave Payment Service
 * Handles payment initialization, verification, and transfers
 */
class FlutterwaveService {
  constructor() {
    this.flw = null;
    this.gateway = null;
  }

  /**
   * Initialize Flutterwave client with gateway credentials
   */
  async initialize() {
    try {
      // Get active Flutterwave gateway
      this.gateway = await PaymentGateway.getActiveGateway('flutterwave');
      
      if (!this.gateway) {
        throw new Error('Flutterwave gateway not configured');
      }

      // Get decrypted secret key
      const secretKey = this.gateway.getSecretKey();
      const publicKey = this.gateway.publicKey;

      // Initialize Flutterwave client
      this.flw = new Flutterwave(publicKey, secretKey);

      return true;
    } catch (error) {
      console.error('Failed to initialize Flutterwave:', error);
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
      if (!this.flw) {
        await this.initialize();
      }

      const {
        amount,
        currency = 'NGN',
        email,
        phone,
        name,
        tx_ref,
        redirect_url,
        metadata = {}
      } = paymentData;

      const payload = {
        tx_ref,
        amount,
        currency,
        redirect_url,
        payment_options: 'card,banktransfer,ussd',
        customer: {
          email,
          phonenumber: phone,
          name
        },
        customizations: {
          title: 'Affiliate Network Payment',
          description: 'Subscription Payment',
          logo: metadata.logo || ''
        },
        meta: metadata
      };

      const response = await this.flw.Payment.initialize(payload);

      if (response.status === 'success') {
        return {
          success: true,
          paymentLink: response.data.link,
          transactionReference: tx_ref,
          gatewayResponse: response
        };
      } else {
        throw new Error(response.message || 'Failed to initialize payment');
      }
    } catch (error) {
      console.error('Flutterwave payment initialization error:', error);
      throw error;
    }
  }

  /**
   * Verify a payment transaction
   * @param {String} transactionId - Transaction ID or reference
   * @returns {Promise<Object>} Payment verification response
   */
  async verifyPayment(transactionId) {
    try {
      if (!this.flw) {
        await this.initialize();
      }

      const response = await this.flw.Transaction.verify({ id: transactionId });

      if (response.status === 'success' && response.data) {
        const transaction = response.data;
        
        return {
          success: true,
          status: transaction.status,
          amount: transaction.amount,
          currency: transaction.currency,
          transactionId: transaction.id.toString(),
          transactionReference: transaction.tx_ref,
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
      console.error('Flutterwave payment verification error:', error);
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
      if (!this.flw) {
        await this.initialize();
      }

      const {
        account_bank,
        account_number,
        amount,
        currency = 'NGN',
        narration,
        beneficiary_name,
        reference
      } = transferData;

      const payload = {
        account_bank,
        account_number,
        amount,
        narration,
        currency,
        reference,
        beneficiary_name,
        callback_url: process.env.FLUTTERWAVE_TRANSFER_WEBHOOK_URL || ''
      };

      const response = await this.flw.Transfer.initiate(payload);

      if (response.status === 'success') {
        return {
          success: true,
          transferId: response.data.id,
          reference: response.data.reference,
          status: response.data.status,
          gatewayResponse: response
        };
      } else {
        throw new Error(response.message || 'Failed to initiate transfer');
      }
    } catch (error) {
      console.error('Flutterwave transfer error:', error);
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

      const secretHash = this.gateway.webhookSecret || process.env.FLUTTERWAVE_WEBHOOK_SECRET;
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
        case 'charge.completed':
          return {
            type: 'payment',
            status: data.status === 'successful' ? 'completed' : 'failed',
            transactionId: data.id.toString(),
            transactionReference: data.tx_ref,
            amount: data.amount,
            currency: data.currency,
            customer: data.customer,
            gatewayResponse: data
          };

        case 'transfer.completed':
          return {
            type: 'transfer',
            status: data.status === 'SUCCESSFUL' ? 'completed' : 'failed',
            transferId: data.id.toString(),
            reference: data.reference,
            amount: data.amount,
            currency: data.currency,
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
      console.error('Flutterwave webhook handling error:', error);
      throw error;
    }
  }
}

module.exports = new FlutterwaveService();

