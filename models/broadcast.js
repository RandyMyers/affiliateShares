const mongoose = require('mongoose');

const { Schema } = mongoose;

const BroadcastSchema = new Schema({
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
  subject: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  htmlMessage: {
    type: String,
    trim: true
  },
  targetAffiliates: {
    type: String,
    enum: ['all', 'active', 'selected', 'program'],
    default: 'all'
  },
  selectedAffiliates: [{
    type: Schema.Types.ObjectId,
    ref: 'Affiliate'
  }],
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'],
    default: 'draft',
    index: true
  },
  scheduledFor: {
    type: Date
  },
  sentAt: {
    type: Date
  },
  sentCount: {
    type: Number,
    default: 0
  },
  failedCount: {
    type: Number,
    default: 0
  },
  recipients: [{
    affiliate: {
      type: Schema.Types.ObjectId,
      ref: 'Affiliate'
    },
    email: String,
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'bounced'],
      default: 'pending'
    },
    sentAt: Date,
    error: String
  }],
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
BroadcastSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
BroadcastSchema.index({ merchant: 1, status: 1 });
BroadcastSchema.index({ program: 1, status: 1 });
BroadcastSchema.index({ scheduledFor: 1 });

const Broadcast = mongoose.model('Broadcast', BroadcastSchema);

module.exports = Broadcast;

