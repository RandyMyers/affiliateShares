const mongoose = require('mongoose');

const { Schema } = mongoose;

const AffiliateProgramSchema = new Schema({
  merchant: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  store: {
    type: Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  commissionStructure: {
    type: {
      type: String,
      enum: ['flat', 'percentage', 'tiered'],
      required: true
    },
    rate: {
      type: Number,
      required: true,
      min: 0
    },
    tieredRates: [{
      tier: {
        type: Number,
        required: true,
        min: 1
      },
      rate: {
        type: Number,
        required: true,
        min: 0
      }
    }]
  },
  terms: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'terminated'],
    default: 'active',
    index: true
  },
  settings: {
    cookieDuration: {
      type: Number,
      default: 30, // days
      min: 1,
      max: 365
    },
    approvalWorkflow: {
      type: String,
      enum: ['auto', 'manual'],
      default: 'manual'
    },
    allowSelfReferrals: {
      type: Boolean,
      default: false
    },
    minimumPayout: {
      type: Number,
      default: 50,
      min: 0
    }
  },
  isFeatured: {
    type: Boolean,
    default: false,
    index: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  paymentTerms: {
    type: String,
    enum: ['net-15', 'net-30', 'net-60', 'weekly', 'bi-weekly', 'monthly'],
    default: 'net-30'
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
    totalConversions: {
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to update `updatedAt` field before saving
AffiliateProgramSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
AffiliateProgramSchema.index({ merchant: 1, status: 1 });
AffiliateProgramSchema.index({ store: 1, status: 1 });
AffiliateProgramSchema.index({ isFeatured: 1, status: 1 });
AffiliateProgramSchema.index({ 'commissionStructure.type': 1, status: 1 });

const AffiliateProgram = mongoose.model('AffiliateProgram', AffiliateProgramSchema);

module.exports = AffiliateProgram;
