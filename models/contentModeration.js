const mongoose = require('mongoose');

const { Schema } = mongoose;

const ContentModerationSchema = new Schema({
  creativeId: {
    type: Schema.Types.ObjectId,
    ref: 'Creative',
    required: true
  },
  status: {
    type: String,
    enum: ['approved', 'denied'],
    required: true
  },
  reason: {
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
ContentModerationSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const ContentModeration = mongoose.model('ContentModeration', ContentModerationSchema);

module.exports = ContentModeration;
