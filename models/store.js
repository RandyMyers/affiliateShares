const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  domain: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  platform: {
    type: String,
    enum: ['woocommerce', 'shopify', 'custom'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  settings: {
    // Commission settings
    defaultCommissionRate: {
      type: Number,
      default: 10,
      min: 0,
      max: 100
    },
    commissionType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage'
    },
    // Payout settings
    minimumPayout: {
      type: Number,
      default: 50
    },
    payoutSchedule: {
      type: String,
      enum: ['weekly', 'bi-weekly', 'monthly'],
      default: 'monthly'
    },
    // Tracking settings
    cookieDuration: {
      type: Number,
      default: 30, // days
      min: 1,
      max: 365
    },
    // Webhook settings
    webhookUrl: {
      type: String,
      trim: true
    },
    webhookSecret: {
      type: String,
      trim: true
    }
  },
  // JavaScript snippet settings
  trackingCode: {
    type: String,
    unique: true,
    sparse: true
  },
  // WooCommerce API credentials (encrypted in production)
  woocommerce: {
    consumerKey: {
      type: String,
      trim: true,
      sparse: true // Only for WooCommerce stores
    },
    consumerSecret: {
      type: String,
      trim: true,
      sparse: true
    },
    apiUrl: {
      type: String,
      trim: true
    },
    connectionStatus: {
      type: String,
      enum: ['not_connected', 'connected', 'testing', 'verified'],
      default: 'not_connected'
    },
    lastTested: {
      type: Date
    },
    testOrderId: {
      type: String // WooCommerce order ID of test order for verification
    },
    onboardingCompleted: {
      type: Boolean,
      default: false
    }
  },
  // Store metadata
  description: {
    type: String,
    trim: true
  },
  logo: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['fashion', 'electronics', 'health-beauty', 'home-garden', 
           'food-beverage', 'travel', 'finance', 'education', 
           'software', 'sports', 'automotive', 'business-services', 
           'entertainment', 'other'],
    default: 'other',
    index: true
  },
  // Statistics
  stats: {
    totalAffiliates: {
      type: Number,
      default: 0
    },
    totalClicks: {
      type: Number,
      default: 0
    },
    totalOrders: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    totalCommissions: {
      type: Number,
      default: 0
    }
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
storeSchema.index({ merchant: 1, domain: 1 }, { unique: true });
storeSchema.index({ trackingCode: 1 });
storeSchema.index({ status: 1 });
storeSchema.index({ category: 1, status: 1 });

// Pre-save hook to update updatedAt
storeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Generate unique tracking code
storeSchema.methods.generateTrackingCode = function() {
  const randomString = Math.random().toString(36).substring(2, 15) + 
                       Math.random().toString(36).substring(2, 15);
  this.trackingCode = `AN_${this._id.toString().substring(0, 8)}_${randomString}`;
  return this.trackingCode;
};

// Virtual for JavaScript snippet
storeSchema.virtual('trackingSnippet').get(function() {
  if (!this.trackingCode) return null;
  
  return `<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${process.env.API_URL || 'http://localhost:5000'}/api/tracking/${this.trackingCode}.js';
    script.async = true;
    document.head.appendChild(script);
  })();
</script>`;
});

module.exports = mongoose.models.Store || mongoose.model('Store', storeSchema);

