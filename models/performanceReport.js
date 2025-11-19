const mongoose = require('mongoose');
const { Schema } = mongoose;

const performanceReportSchema = new Schema({
  advertiserId: {
     type: Schema.Types.ObjectId,
      ref: 'Advertiser',
      required: true
      },
  affiliateProgramId: {
    type: Schema.Types.ObjectId,
    ref: 'AffiliateProgram',
    required: true
  },
  clicks: {
    type: Number,
    required: true,
    min: [0, 'Clicks must be non-negative']
  },
  conversions: {
    type: Number,
    required: true,
    min: [0, 'Conversions must be non-negative']
  },
  earnings: {
    type: Number,
    required: true,
    min: [0, 'Earnings must be non-negative']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PerformanceReport', performanceReportSchema);
