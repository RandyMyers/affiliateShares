const mongoose = require('mongoose');

const { Schema } = mongoose;

const AnnouncementSchema = new Schema({
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
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'success', 'important'],
    default: 'info'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  scheduledFor: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  targetAffiliates: {
    type: String,
    enum: ['all', 'active', 'selected'],
    default: 'all'
  },
  selectedAffiliates: [{
    type: Schema.Types.ObjectId,
    ref: 'Affiliate'
  }],
  readBy: [{
    affiliate: {
      type: Schema.Types.ObjectId,
      ref: 'Affiliate'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
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
AnnouncementSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
AnnouncementSchema.index({ merchant: 1, isActive: 1 });
AnnouncementSchema.index({ program: 1, isActive: 1 });
AnnouncementSchema.index({ scheduledFor: 1 });

const Announcement = mongoose.model('Announcement', AnnouncementSchema);

module.exports = Announcement;

