const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true
  },
  affiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true,
    index: true
  },
  // Invitation Details
  message: {
    type: String,
    required: true,
    maxlength: 2000
  },
  subject: {
    type: String,
    maxlength: 200
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InvitationTemplate'
  },
  // Incentives
  incentives: {
    firstSaleBonus: {
      amount: Number,
      currency: {
        type: String,
        default: 'USD'
      }
    },
    commissionIncrease: {
      percentage: Number,
      duration: Number // days
    },
    limitedTimeOffer: {
      description: String,
      validUntil: Date
    }
  },
  // Status Tracking
  status: {
    type: String,
    enum: ['pending', 'sent', 'opened', 'clicked', 'accepted', 'declined', 'expired'],
    default: 'pending',
    index: true
  },
  sentAt: Date,
  openedAt: Date,
  clickedAt: Date,
  respondedAt: Date,
  expiresAt: Date,
  // Tracking
  trackingToken: {
    type: String,
    unique: true,
    sparse: true
  },
  // Analytics
  analytics: {
    openCount: {
      type: Number,
      default: 0
    },
    clickCount: {
      type: Number,
      default: 0
    },
    responseTime: Number // milliseconds
  },
  // Notes
  notes: String,
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
invitationSchema.index({ merchant: 1, status: 1 });
invitationSchema.index({ affiliate: 1, status: 1 });
invitationSchema.index({ store: 1, createdAt: -1 });
invitationSchema.index({ trackingToken: 1 });

// Pre-save hook
invitationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate tracking token if not exists
  if (!this.trackingToken && this.status === 'sent') {
    const crypto = require('crypto');
    this.trackingToken = crypto.randomBytes(32).toString('hex');
  }
  
  next();
});

module.exports = mongoose.models.Invitation || mongoose.model('Invitation', invitationSchema);

