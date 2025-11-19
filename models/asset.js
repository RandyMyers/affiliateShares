const mongoose = require('mongoose');

const { Schema } = mongoose;

const AssetSchema = new Schema({
  merchant: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  program: {
    type: Schema.Types.ObjectId,
    ref: 'AffiliateProgram',
    index: true
  },
  store: {
    type: Schema.Types.ObjectId,
    ref: 'Store',
    index: true
  },
  type: {
    type: String,
    enum: ['banner', 'image', 'text-link', 'product-image', 'logo'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  thumbnail: {
    type: String,
    trim: true
  },
  size: {
    width: Number,
    height: Number
  },
  category: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  // Performance metrics
  stats: {
    views: {
      type: Number,
      default: 0
    },
    downloads: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    conversions: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date
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

// Pre-save hook
AssetSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
AssetSchema.index({ merchant: 1, type: 1 });
AssetSchema.index({ program: 1, isActive: 1 });

const Asset = mongoose.model('Asset', AssetSchema);

module.exports = Asset;

