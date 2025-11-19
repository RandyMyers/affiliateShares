const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  // Pricing
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  // Billing cycle
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true,
    default: 'monthly'
  },
  // Plan features/limits
  features: {
    maxStores: {
      type: Number,
      default: 1,
      min: 0
    },
    maxAffiliates: {
      type: Number,
      default: 10,
      min: 0
    },
    maxOrders: {
      type: Number,
      default: 100,
      min: 0
    },
    // Advanced features
    advancedAnalytics: {
      type: Boolean,
      default: false
    },
    customBranding: {
      type: Boolean,
      default: false
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    apiAccess: {
      type: Boolean,
      default: false
    },
    webhookAccess: {
      type: Boolean,
      default: true
    }
  },
  // Plan status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  // Display order
  displayOrder: {
    type: Number,
    default: 0
  },
  // Trial period (in days)
  trialPeriod: {
    type: Number,
    default: 0,
    min: 0
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
subscriptionPlanSchema.index({ isActive: 1, displayOrder: 1 });

// Pre-save hook
subscriptionPlanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get active plans
subscriptionPlanSchema.statics.getActivePlans = async function() {
  return await this.find({ isActive: true }).sort({ displayOrder: 1, price: 1 });
};

// Method to calculate yearly price (if monthly)
subscriptionPlanSchema.methods.getYearlyPrice = function() {
  if (this.billingCycle === 'yearly') {
    return this.price;
  }
  // Apply discount for yearly (typically 20% off)
  return Math.round(this.price * 12 * 0.8);
};

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

module.exports = SubscriptionPlan;

