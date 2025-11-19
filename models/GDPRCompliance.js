const mongoose = require('mongoose');

const { Schema } = mongoose;

const GDPRComplianceSchema = new Schema({
  affiliate: {
    type: Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true
  },
  dataConsent: {
    type: Boolean,
    required: true
  },
  rights: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to update `updatedAt` field before saving
GDPRComplianceSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const GDPRCompliance = mongoose.model('GDPRCompliance', GDPRComplianceSchema);

module.exports = GDPRCompliance;
