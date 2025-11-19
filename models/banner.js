const mongoose = require('mongoose');

const { Schema } = mongoose;

const BannerSchema = new Schema({
  advertiser: {
    type: Schema.Types.ObjectId,
    ref: 'Advertiser',
    required: true
  },
  type: {
    type: String,
    enum: ['banner'],
    required: true
  },
  imageUrl: {
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
BannerSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Banner = mongoose.model('Banner', BannerSchema);

module.exports = Banner;
