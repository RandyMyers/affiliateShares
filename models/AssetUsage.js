const mongoose = require('mongoose');

const assetUsageSchema = new mongoose.Schema({
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: true,
    index: true
  },
  affiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    index: true
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: ['view', 'download', 'click', 'conversion'],
    required: true,
    index: true
  },
  // Additional context
  referer: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  ipAddress: {
    type: String,
    trim: true
  },
  // Link to click/order if applicable
  click: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Click'
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }
}, {
  timestamps: true
});

// Indexes for analytics queries
assetUsageSchema.index({ asset: 1, createdAt: -1 });
assetUsageSchema.index({ store: 1, createdAt: -1 });
assetUsageSchema.index({ affiliate: 1, createdAt: -1 });
assetUsageSchema.index({ action: 1, createdAt: -1 });
assetUsageSchema.index({ store: 1, asset: 1, createdAt: -1 });

module.exports = mongoose.models.AssetUsage || mongoose.model('AssetUsage', assetUsageSchema);

