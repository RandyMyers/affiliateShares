const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true
  },
  // Product identifiers
  sku: {
    type: String,
    required: true,
    trim: true,
    index: true
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
  // Product details
  category: {
    type: String,
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  // Pricing
  price: {
    type: Number,
    required: true,
    min: 0
  },
  salePrice: {
    type: Number,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  // Product URLs
  productUrl: {
    type: String,
    required: true,
    trim: true
  },
  imageUrl: {
    type: String,
    trim: true
  },
  // Additional images
  additionalImages: [{
    type: String,
    trim: true
  }],
  // Availability
  inStock: {
    type: Boolean,
    default: true
  },
  stockQuantity: {
    type: Number,
    default: 0
  },
  // Commission info
  commissionRate: {
    type: Number,
    min: 0,
    max: 100
  },
  // Product status
  status: {
    type: String,
    enum: ['active', 'inactive', 'out_of_stock'],
    default: 'active',
    index: true
  },
  // SEO
  keywords: [{
    type: String,
    trim: true
  }],
  // Additional metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
productSchema.index({ store: 1, sku: 1 }, { unique: true });
productSchema.index({ store: 1, status: 1 });
productSchema.index({ store: 1, category: 1 });
productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);

