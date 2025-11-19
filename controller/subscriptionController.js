const Subscription = require('../models/subscription');
const SubscriptionPlan = require('../models/subscriptionPlan');
const User = require('../models/user');
const { sendResponse } = require('../utils/response');
const paymentService = require('../services/payment/paymentService');

/**
 * Get all subscription plans
 */
exports.getPlans = async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.getActivePlans();
    return sendResponse(res, 200, 'Subscription plans retrieved successfully', plans);
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's subscription
 */
exports.getCurrentSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.getActiveSubscription(req.user.id);
    
    if (!subscription) {
      return sendResponse(res, 404, 'No active subscription found', null);
    }

    return sendResponse(res, 200, 'Subscription retrieved successfully', subscription);
  } catch (error) {
    next(error);
  }
};

/**
 * Subscribe to a plan
 */
exports.subscribe = async (req, res, next) => {
  try {
    const { planId, paymentGateway } = req.body;

    // Get plan
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return sendResponse(res, 404, 'Subscription plan not found', null);
    }

    // Check if user already has an active subscription
    const existingSubscription = await Subscription.getActiveSubscription(req.user.id);
    if (existingSubscription) {
      return sendResponse(res, 400, 'User already has an active subscription', existingSubscription);
    }

    // Calculate dates
    const now = new Date();
    const endDate = new Date(now);
    
    if (plan.billingCycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (plan.billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Set trial end date if trial period exists
    let trialEndDate = null;
    if (plan.trialPeriod > 0) {
      trialEndDate = new Date(now);
      trialEndDate.setDate(trialEndDate.getDate() + plan.trialPeriod);
    }

    // Initialize payment
    const paymentGatewayType = paymentGateway || 'paystack';
    const transactionRef = `SUB_${req.user.id}_${Date.now()}`;

    const paymentData = {
      amount: plan.price,
      currency: plan.currency,
      email: req.user.email,
      reference: transactionRef,
      callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/subscription/callback`,
      metadata: {
        userId: req.user.id.toString(),
        planId: plan._id.toString(),
        planName: plan.name,
        type: 'subscription'
      }
    };

    const paymentResult = await paymentService.initializePayment(paymentData, paymentGatewayType);

    if (!paymentResult.success) {
      return sendResponse(res, 400, 'Failed to initialize payment', {
        error: paymentResult.message
      });
    }

    // Create subscription (in trial or active status)
    const subscription = await Subscription.create({
      user: req.user.id,
      plan: plan._id,
      status: plan.trialPeriod > 0 ? 'trial' : 'active',
      startDate: now,
      endDate: endDate,
      nextBillingDate: endDate,
      trialEndDate: trialEndDate,
      paymentGateway: paymentGatewayType,
      metadata: {
        transactionReference: transactionRef,
        gatewayResponse: paymentResult.gatewayResponse
      }
    });

    return sendResponse(res, 200, 'Subscription created successfully', {
      subscription,
      paymentLink: paymentResult.paymentLink || paymentResult.authorizationUrl,
      transactionReference: transactionRef
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify subscription payment and activate
 */
exports.verifyPayment = async (req, res, next) => {
  try {
    const { transactionReference, gatewayType } = req.body;

    if (!transactionReference || !gatewayType) {
      return sendResponse(res, 400, 'Transaction reference and gateway type are required', null);
    }

    // Verify payment
    const verificationResult = await paymentService.verifyPayment(transactionReference, gatewayType);

    if (!verificationResult.success || verificationResult.status !== 'completed') {
      return sendResponse(res, 400, 'Payment verification failed', {
        error: verificationResult.message
      });
    }

    // Find subscription by transaction reference
    const subscription = await Subscription.findOne({
      'metadata.transactionReference': transactionReference,
      user: req.user.id
    }).populate('plan');

    if (!subscription) {
      return sendResponse(res, 404, 'Subscription not found', null);
    }

    // Update subscription metadata
    subscription.metadata = {
      ...subscription.metadata,
      transactionId: verificationResult.transactionId,
      gatewayResponse: verificationResult.gatewayResponse
    };

    // Activate subscription if it was in trial
    if (subscription.status === 'trial') {
      subscription.status = 'active';
    }

    await subscription.save();

    return sendResponse(res, 200, 'Payment verified and subscription activated', subscription);
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel subscription
 */
exports.cancelSubscription = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const subscription = await Subscription.getActiveSubscription(req.user.id);
    
    if (!subscription) {
      return sendResponse(res, 404, 'No active subscription found', null);
    }

    await subscription.cancel(req.user.id, reason);

    return sendResponse(res, 200, 'Subscription cancelled successfully', subscription);
  } catch (error) {
    next(error);
  }
};

/**
 * Renew subscription
 */
exports.renewSubscription = async (req, res, next) => {
  try {
    const { planId, paymentGateway } = req.body;

    const subscription = await Subscription.findOne({
      user: req.user.id,
      status: { $in: ['active', 'expired'] }
    }).populate('plan');

    if (!subscription) {
      return sendResponse(res, 404, 'Subscription not found', null);
    }

    // Get plan (use existing plan if planId not provided)
    const plan = planId 
      ? await SubscriptionPlan.findById(planId)
      : subscription.plan;

    if (!plan || !plan.isActive) {
      return sendResponse(res, 404, 'Subscription plan not found', null);
    }

    // Initialize payment
    const paymentGatewayType = paymentGateway || subscription.paymentGateway || 'paystack';
    const transactionRef = `RENEW_${subscription._id}_${Date.now()}`;

    const paymentData = {
      amount: plan.price,
      currency: plan.currency,
      email: req.user.email,
      reference: transactionRef,
      callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/subscription/callback`,
      metadata: {
        userId: req.user.id.toString(),
        subscriptionId: subscription._id.toString(),
        planId: plan._id.toString(),
        type: 'renewal'
      }
    };

    const paymentResult = await paymentService.initializePayment(paymentData, paymentGatewayType);

    if (!paymentResult.success) {
      return sendResponse(res, 400, 'Failed to initialize payment', {
        error: paymentResult.message
      });
    }

    // Renew subscription
    await subscription.renew(plan._id, {
      transactionReference: transactionRef,
      gatewayResponse: paymentResult.gatewayResponse
    });

    return sendResponse(res, 200, 'Subscription renewal initiated', {
      subscription,
      paymentLink: paymentResult.paymentLink || paymentResult.authorizationUrl,
      transactionReference: transactionRef
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get subscription history
 */
exports.getSubscriptionHistory = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find({ user: req.user.id })
      .populate('plan')
      .sort({ createdAt: -1 });

    return sendResponse(res, 200, 'Subscription history retrieved successfully', subscriptions);
  } catch (error) {
    next(error);
  }
};

