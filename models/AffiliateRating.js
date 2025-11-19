const mongoose = require('mongoose');

const affiliateRatingSchema = new mongoose.Schema({
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
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Rating (1-5 stars)
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    index: true
  },
  // Review text
  review: {
    type: String,
    maxlength: 2000,
    trim: true
  },
  // Rating categories
  categories: {
    performance: {
      type: Number,
      min: 1,
      max: 5
    },
    communication: {
      type: Number,
      min: 1,
      max: 5
    },
    reliability: {
      type: Number,
      min: 1,
      max: 5
    },
    professionalism: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  // Status
  status: {
    type: String,
    enum: ['active', 'hidden'],
    default: 'active',
    index: true
  },
  // Helpful votes
  helpfulVotes: {
    type: Number,
    default: 0
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
affiliateRatingSchema.index({ affiliate: 1, store: 1, merchant: 1 }, { unique: true });
affiliateRatingSchema.index({ affiliate: 1, status: 1 });
affiliateRatingSchema.index({ rating: -1 });
affiliateRatingSchema.index({ createdAt: -1 });

// Pre-save hook
affiliateRatingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.models.AffiliateRating || mongoose.model('AffiliateRating', affiliateRatingSchema);

