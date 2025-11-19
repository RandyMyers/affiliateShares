const mongoose = require('mongoose');

const merchantNoteSchema = new mongoose.Schema({
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  affiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true,
    index: true
  },
  note: {
    type: String,
    required: true,
    maxlength: 2000
  },
  tags: [String],
  isPrivate: {
    type: Boolean,
    default: true
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
merchantNoteSchema.index({ merchant: 1, affiliate: 1 });
merchantNoteSchema.index({ merchant: 1, createdAt: -1 });

// Pre-save hook
merchantNoteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.models.MerchantNote || mongoose.model('MerchantNote', merchantNoteSchema);

