const mongoose = require('mongoose');

const shortLinkSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
  },
  trackingLink: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrackingLink',
    required: true
  },
  affiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true
  },
  originalUrl: {
    type: String,
    required: true
  },
  shortUrl: {
    type: String,
    required: true
  },
  clicks: {
    type: Number,
    default: 0
  },
  isCustom: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
shortLinkSchema.index({ slug: 1 });
shortLinkSchema.index({ affiliate: 1 });
shortLinkSchema.index({ trackingLink: 1 });
shortLinkSchema.index({ createdAt: -1 });

// Generate short URL
shortLinkSchema.methods.generateShortUrl = function() {
  const baseUrl = process.env.SHORT_LINK_BASE_URL || process.env.CLIENT_URL || 'http://localhost:3000';
  return `${baseUrl}/s/${this.slug}`;
};

module.exports = mongoose.models.ShortLink || mongoose.model('ShortLink', shortLinkSchema);

