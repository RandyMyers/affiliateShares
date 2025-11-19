const mongoose = require('mongoose');
const { Schema } = mongoose;

// Sub-schema for Payout Settings
const payoutSettingSchema = new Schema({
    advertiserId: {
        type: Schema.Types.ObjectId,
        ref: 'Advertiser',
        required: true
      },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true
  },
  threshold: {
    type: Number,
    required: true,
    min: [1, 'Threshold must be at least 1']
  },
  paymentMethod: {
    type: Schema.Types.ObjectId,
    ref: 'PaymentMethod', // Referencing the PaymentMethod model
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const PayoutSetting = mongoose.model('PayoutSetting', payoutSettingSchema);

module.exports = PayoutSetting;
