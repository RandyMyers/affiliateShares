const mongoose = require('mongoose');

const affiliateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  referralCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending',
    index: true
  },
  // Store-specific affiliate data
  stores: [{
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending'
    },
    approvedAt: {
      type: Date
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // Custom commission rate for this store (overrides store default)
    commissionRate: {
      type: Number,
      min: 0,
      max: 100
    },
    // Performance metrics for this store
    stats: {
      clicks: {
        type: Number,
        default: 0
      },
      orders: {
        type: Number,
        default: 0
      },
      revenue: {
        type: Number,
        default: 0
      },
      commissions: {
        type: Number,
        default: 0
      },
      conversions: {
        type: Number,
        default: 0
      }
    }
  }],
  // Payment information
  paymentInfo: {
    method: {
      type: String,
      enum: ['flutterwave', 'paystack', 'squad', 'bank'],
      default: 'paystack'
    },
    accountDetails: {
      // For bank transfers
      bankName: String,
      accountNumber: String,
      accountName: String,
      // For payment gateways
      email: String,
      phone: String
    }
  },
  // Overall statistics
  stats: {
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
    totalEarnings: {
      type: Number,
      default: 0
    },
    totalPaid: {
      type: Number,
      default: 0
    },
    totalPending: {
      type: Number,
      default: 0
    }
  },
  // Profile information
  profile: {
    website: {
      type: String,
      trim: true
    },
    socialMedia: {
      facebook: String,
      twitter: String,
      instagram: String,
      youtube: String
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500
    },
    niche: {
      type: String,
      trim: true
    }
  },
  // Tags for categorization and filtering
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  // Discovery & Profile Fields
  discovery: {
    // Categories (array of category strings)
    categories: [{
      type: String,
      enum: [
        // Social Media
        'twitter', 'instagram', 'tiktok', 'youtube', 'twitch', 
        'facebook', 'linkedin', 'pinterest',
        // Content Types
        'blogger', 'review-site', 'coupon-site', 'comparison-site',
        'news-site', 'educational-site',
        // Business Verticals
        'fashion', 'electronics', 'health-beauty', 'home-garden',
        'food-beverage', 'travel', 'finance', 'technology',
        'sports-fitness', 'automotive', 'business-services',
        'entertainment', 'education', 'other'
      ],
      index: true
    }],
    // Website Information
    websiteInfo: {
      url: String,
      domain: String,
      screenshot: String,
      description: String,
      alexaRank: Number,
      domainAge: Date,
      sslStatus: {
        type: Boolean,
        default: true
      },
      platform: String, // 'wordpress', 'shopify', 'custom', etc.
      cms: String
    },
    // Traffic Metrics
    trafficMetrics: {
      monthlyVisitors: Number,
      monthlyPageViews: Number,
      trafficSources: {
        organic: Number,
        social: Number,
        paid: Number,
        direct: Number
      },
      topCountries: [{
        country: String,
        percentage: Number
      }]
    },
    // Engagement Metrics
    engagementMetrics: {
      socialFollowers: {
        twitter: Number,
        instagram: Number,
        facebook: Number,
        youtube: Number,
        tiktok: Number
      },
      engagementRate: Number,
      averagePostReach: Number,
      emailListSize: Number
    },
    // Network-Wide Stats (aggregated across all programs)
    networkStats: {
      totalPrograms: {
        type: Number,
        default: 0
      },
      activePrograms: {
        type: Number,
        default: 0
      },
      totalClicks: {
        type: Number,
        default: 0
      },
      totalConversions: {
        type: Number,
        default: 0
      },
      totalCommissions: {
        type: Number,
        default: 0
      },
      averageConversionRate: Number,
      averageOrderValue: Number
    },
    // Discovery Settings
    discoverable: {
      type: Boolean,
      default: true,
      index: true
    },
    publicProfile: {
      type: Boolean,
      default: true
    },
    contactPreferences: {
      allowInvitations: {
        type: Boolean,
        default: true
      },
      allowDirectContact: {
        type: Boolean,
        default: false
      }
    }
  },
  // Verification & Quality
  verification: {
    verified: {
      type: Boolean,
      default: false,
      index: true
    },
    verifiedAt: Date,
    qualityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    badges: [{
      type: String,
      enum: ['top-performer', 'rising-star', 'verified', 'premium']
    }],
    // Rating information
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    totalRatings: {
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
  },
  lastActive: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
affiliateSchema.index({ referralCode: 1 });
affiliateSchema.index({ status: 1 });
affiliateSchema.index({ 'stores.store': 1, 'stores.status': 1 });
affiliateSchema.index({ 'discovery.categories': 1 });
affiliateSchema.index({ 'discovery.discoverable': 1 });
affiliateSchema.index({ 'discovery.websiteInfo.domain': 1 });
affiliateSchema.index({ 'verification.verified': 1 });
affiliateSchema.index({ 'verification.qualityScore': -1 });
affiliateSchema.index({ 'stats.totalClicks': -1 });
affiliateSchema.index({ 'stats.totalOrders': -1 });
// Text search index
affiliateSchema.index({ 
  'user.username': 'text',
  'profile.bio': 'text',
  'profile.niche': 'text',
  'discovery.websiteInfo.description': 'text'
});

// Pre-save hook
affiliateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate referral code if not exists
  if (!this.referralCode) {
    const randomString = Math.random().toString(36).substring(2, 10).toUpperCase();
    this.referralCode = `AFF${randomString}`;
  }
  
  next();
});

// Method to approve affiliate for a store
affiliateSchema.methods.approveForStore = function(storeId, approvedBy) {
  const storeIndex = this.stores.findIndex(s => s.store.toString() === storeId.toString());
  
  if (storeIndex === -1) {
    this.stores.push({
      store: storeId,
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: approvedBy
    });
  } else {
    this.stores[storeIndex].status = 'approved';
    this.stores[storeIndex].approvedAt = new Date();
    this.stores[storeIndex].approvedBy = approvedBy;
  }
  
  return this.save();
};

// Method to reject affiliate for a store
affiliateSchema.methods.rejectForStore = function(storeId) {
  const storeIndex = this.stores.findIndex(s => s.store.toString() === storeId.toString());
  
  if (storeIndex !== -1) {
    this.stores[storeIndex].status = 'rejected';
  }
  
  return this.save();
};

module.exports = mongoose.models.Affiliate || mongoose.model('Affiliate', affiliateSchema);
