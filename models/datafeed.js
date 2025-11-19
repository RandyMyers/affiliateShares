const mongoose = require('mongoose');

const { Schema } = mongoose;

const DatafeedSchema = new Schema({
  advertiser: {
    type: Schema.Types.ObjectId,
    ref: 'Advertiser',
    required: true
  },
  type: {
    type: String,
    enum: ['datafeed'],
    required: true
  },
  ImageUrl: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
    trim: true,
    match: [/(https?:\/\/[^\s]+)/, 'Please use a valid URL']
  },
  description: {
    type: String
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
DatafeedSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Datafeed = mongoose.model('Datafeed', DatafeedSchema);

module.exports = Datafeed;
