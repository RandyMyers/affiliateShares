const mongoose = require('mongoose');

const invitationTemplateSchema = new mongoose.Schema({
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
  category: String,
  subject: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 2000
  },
  // Merge fields available
  mergeFields: [{
    field: String,
    description: String
  }],
  // Default incentives
  defaultIncentives: {
    firstSaleBonus: Number,
    commissionIncrease: Number
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  usageCount: {
    type: Number,
    default: 0
  },
  successRate: Number, // percentage
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
invitationTemplateSchema.index({ merchant: 1, createdAt: -1 });

// Pre-save hook
invitationTemplateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.models.InvitationTemplate || mongoose.model('InvitationTemplate', invitationTemplateSchema);

