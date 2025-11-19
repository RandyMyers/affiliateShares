const flutterwaveService = require('./flutterwaveService');
const paystackService = require('./paystackService');
const squadService = require('./squadService');
const PaymentGateway = require('../../models/paymentGateway');

/**
 * Unified Payment Service
 * Provides a single interface for all payment gateways
 */
class PaymentService {
  /**
   * Get payment service instance for a specific gateway
   * @param {String} gatewayType - Gateway type (flutterwave, paystack, squad)
   * @returns {Object} Payment service instance
   */
  async getService(gatewayType) {
    switch (gatewayType) {
      case 'flutterwave':
        await flutterwaveService.initialize();
        return flutterwaveService;
      case 'paystack':
        await paystackService.initialize();
        return paystackService;
      case 'squad':
        await squadService.initialize();
        return squadService;
      default:
        throw new Error(`Unsupported payment gateway: ${gatewayType}`);
    }
  }

  /**
   * Get default payment gateway
   * @returns {Object} Payment service instance
   */
  async getDefaultService() {
    const defaultGateway = await PaymentGateway.getDefaultGateway();
    if (!defaultGateway) {
      throw new Error('No default payment gateway configured');
    }
    return await this.getService(defaultGateway.type);
  }

  /**
   * Initialize payment (unified interface)
   * @param {Object} paymentData - Payment details
   * @param {String} gatewayType - Optional gateway type (uses default if not provided)
   * @returns {Promise<Object>} Payment initialization response
   */
  async initializePayment(paymentData, gatewayType = null) {
    try {
      const service = gatewayType 
        ? await this.getService(gatewayType)
        : await this.getDefaultService();

      return await service.initializePayment(paymentData);
    } catch (error) {
      console.error('Payment initialization error:', error);
      throw error;
    }
  }

  /**
   * Verify payment (unified interface)
   * @param {String} transactionId - Transaction ID or reference
   * @param {String} gatewayType - Gateway type
   * @returns {Promise<Object>} Payment verification response
   */
  async verifyPayment(transactionId, gatewayType) {
    try {
      if (!gatewayType) {
        throw new Error('Gateway type is required for payment verification');
      }

      const service = await this.getService(gatewayType);
      return await service.verifyPayment(transactionId);
    } catch (error) {
      console.error('Payment verification error:', error);
      throw error;
    }
  }

  /**
   * Initiate transfer/payout (unified interface)
   * @param {Object} transferData - Transfer details
   * @param {String} gatewayType - Gateway type
   * @returns {Promise<Object>} Transfer response
   */
  async initiateTransfer(transferData, gatewayType) {
    try {
      if (!gatewayType) {
        throw new Error('Gateway type is required for transfers');
      }

      const service = await this.getService(gatewayType);
      return await service.initiateTransfer(transferData);
    } catch (error) {
      console.error('Transfer initiation error:', error);
      throw error;
    }
  }

  /**
   * Handle webhook (unified interface)
   * @param {Object} webhookData - Webhook payload
   * @param {String} gatewayType - Gateway type
   * @param {String} signature - Webhook signature
   * @returns {Promise<Object>} Processed webhook data
   */
  async handleWebhook(webhookData, gatewayType, signature = null) {
    try {
      if (!gatewayType) {
        throw new Error('Gateway type is required for webhook handling');
      }

      const service = await this.getService(gatewayType);

      // Verify signature if provided
      if (signature) {
        const isValid = service.verifyWebhookSignature(webhookData, signature);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      return await service.handleWebhook(webhookData);
    } catch (error) {
      console.error('Webhook handling error:', error);
      throw error;
    }
  }

  /**
   * Get available payment gateways
   * @returns {Promise<Array>} List of active gateways
   */
  async getAvailableGateways() {
    try {
      const gateways = await PaymentGateway.find({ isActive: true });
      return gateways.map(gateway => ({
        type: gateway.type,
        name: gateway.name,
        isDefault: gateway.isDefault,
        environment: gateway.environment
      }));
    } catch (error) {
      console.error('Error fetching gateways:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();

