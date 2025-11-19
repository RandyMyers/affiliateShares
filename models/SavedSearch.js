const mongoose = require('mongoose');

const savedSearchSchema = new mongoose.Schema({
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
  // Search criteria
  criteria: {
    searchQuery: String,
    categories: [String],
    filters: {
      minMonthlyVisitors: Number,
      maxMonthlyVisitors: Number,
      minConversionRate: Number,
      maxConversionRate: Number,
      minTotalClicks: Number,
      maxTotalClicks: Number,
      minTotalOrders: Number,
      maxTotalOrders: Number,
      verified: Boolean,
      countries: [String],
      platforms: [String],
      discoverable: Boolean
    },
    sortBy: String,
    sortOrder: String
  },
  // Alert settings
  alerts: {
    enabled: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly']
    },
    lastAlertSent: Date,
    emailNotifications: {
      type: Boolean,
      default: true
    }
  },
  resultCount: Number,
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
savedSearchSchema.index({ merchant: 1, createdAt: -1 });
savedSearchSchema.index({ 'alerts.enabled': 1, 'alerts.frequency': 1 });

// Pre-save hook
savedSearchSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.models.SavedSearch || mongoose.model('SavedSearch', savedSearchSchema);

