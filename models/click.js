const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema({
  affiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true,
    index: true
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true
  },
  referralCode: {
    type: String,
    required: true,
    index: true
  },
  // Tracking information
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  referer: {
    type: String,
    trim: true
  },
  // URL information
  landingPage: {
    type: String,
    required: true,
    trim: true
  },
  // Conversion tracking
  converted: {
    type: Boolean,
    default: false
  },
  convertedAt: {
    type: Date
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  // Cookie information
  cookieId: {
    type: String,
    index: true
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false // We only want createdAt
});

// Indexes for performance
clickSchema.index({ affiliate: 1, createdAt: -1 });
clickSchema.index({ store: 1, createdAt: -1 });
clickSchema.index({ referralCode: 1, createdAt: -1 });
clickSchema.index({ cookieId: 1 });
clickSchema.index({ converted: 1, createdAt: -1 });

// Compound index for analytics queries
clickSchema.index({ store: 1, affiliate: 1, createdAt: -1 });
clickSchema.index({ store: 1, converted: 1, createdAt: -1 });

module.exports = mongoose.model('Click', clickSchema);

