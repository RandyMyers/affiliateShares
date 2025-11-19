const mongoose = require('mongoose');

const { Schema } = mongoose;

const LinkSchema = new Schema({
  advertiser: {
    type: Schema.Types.ObjectId,
    ref: 'Advertiser',
    required: true
  },
  type: {
    type: String,
    enum: ['link'],
    required: true
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
LinkSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Link = mongoose.model('Link', LinkSchema);

module.exports = Link;
