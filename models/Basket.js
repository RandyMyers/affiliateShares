const mongoose = require('mongoose');

const basketSchema = new mongoose.Schema({
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  affiliates: [{
    affiliate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Affiliate',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  tags: [String],
  campaign: {
    type: String,
    enum: ['recruitment', 're-engagement', 'category-specific', 'performance-based', 'other'],
    default: 'recruitment'
  },
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
basketSchema.index({ merchant: 1, createdAt: -1 });
basketSchema.index({ 'affiliates.affiliate': 1 });

// Pre-save hook
basketSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.models.Basket || mongoose.model('Basket', basketSchema);

