const mongoose = require('mongoose');
const { Schema } = mongoose;

// Sub-schema for Commission Structure
const commissionStructureSchema = new Schema({
    advertiserId: {
        type: Schema.Types.ObjectId,
        ref: 'Advertiser',
        required: true
      },
    type: {
      type: String,
      enum: ['flat', 'percentage', 'tiered'],
      required: true
    },
    rate: {
      type: Number,
      required: true,
      min: [0, 'Commission rate must be positive']
    },
    tieredRates: [{
      tier: {
        type: Number,
        required: true,
        min: [1, 'Tier must be greater than 0']
      },
      rate: {
        type: Number,
        required: true,
        min: [0, 'Rate must be positive']
      }
    }]
  });

  const CommissionStructure = mongoose.model('CommissionStructure', commissionStructureSchema);

  module.exports = CommissionStructure;