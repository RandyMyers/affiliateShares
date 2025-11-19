const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true,
    index: true
  },
  // Subscription status
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'trial', 'past_due'],
    default: 'trial',
    index: true
  },
  // Subscription dates
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  // Next billing date
  nextBillingDate: {
    type: Date
  },
  // Trial information
  trialEndDate: {
    type: Date
  },
  // Auto-renewal
  autoRenew: {
    type: Boolean,
    default: true
  },
  // Payment method reference
  paymentMethod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentMethod'
  },
  // Payment gateway used
  paymentGateway: {
    type: String,
    enum: ['flutterwave', 'paystack', 'squad'],
    default: 'paystack'
  },
  // Subscription metadata
  metadata: {
    transactionId: String,
    transactionReference: String,
    gatewayResponse: mongoose.Schema.Types.Mixed
  },
  // Cancellation information
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ status: 1, nextBillingDate: 1 });
subscriptionSchema.index({ nextBillingDate: 1 });

// Pre-save hook
subscriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if subscription is active
subscriptionSchema.methods.isActive = function() {
  const now = new Date();
  return this.status === 'active' && this.endDate > now;
};

// Method to check if subscription is in trial
subscriptionSchema.methods.isTrial = function() {
  const now = new Date();
  return this.status === 'trial' && this.trialEndDate && this.trialEndDate > now;
};

// Method to cancel subscription
subscriptionSchema.methods.cancel = async function(userId, reason) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancelledBy = userId;
  this.cancellationReason = reason;
  this.autoRenew = false;
  await this.save();
};

// Method to renew subscription
subscriptionSchema.methods.renew = async function(plan, paymentDetails) {
  const now = new Date();
  const planDoc = await mongoose.model('SubscriptionPlan').findById(plan);
  
  if (!planDoc) {
    throw new Error('Subscription plan not found');
  }

  // Calculate new end date based on billing cycle
  const endDate = new Date(now);
  if (planDoc.billingCycle === 'monthly') {
    endDate.setMonth(endDate.getMonth() + 1);
  } else if (planDoc.billingCycle === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  this.plan = plan;
  this.status = 'active';
  this.startDate = now;
  this.endDate = endDate;
  this.nextBillingDate = endDate;
  this.metadata = {
    ...this.metadata,
    ...paymentDetails
  };
  await this.save();
};

// Static method to get active subscription for user
subscriptionSchema.statics.getActiveSubscription = async function(userId) {
  return await this.findOne({
    user: userId,
    status: { $in: ['active', 'trial'] }
  }).populate('plan');
};

// Static method to find subscriptions due for renewal
subscriptionSchema.statics.findDueForRenewal = async function() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return await this.find({
    status: 'active',
    autoRenew: true,
    nextBillingDate: {
      $gte: now,
      $lte: tomorrow
    }
  }).populate('plan').populate('user');
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;

