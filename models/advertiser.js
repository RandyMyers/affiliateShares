const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define the Advertiser schema
const advertiserSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    auto: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Advertiser name is required'],
    trim: true,
    maxlength: [100, 'Advertiser name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Contact email is required'],
    unique: true,
    trim: true,
    match: [/\S+@\S+\.\S+/, 'Please use a valid email address']
  },
  website: {
    type: String,
    required: [true, 'Website URL is required'],
    trim: true,
    match: [/(https?:\/\/[^\s]+)/, 'Please use a valid URL']
  },
  
  
  affiliateProgramId: [{
    type: Schema.Types.ObjectId,
    ref: 'AffiliateProgram'
  }],
  trackingLinks: [{
    url: {
      type: String,
      required: true,
      trim: true,
      match: [/(https?:\/\/[^\s]+)/, 'Please use a valid URL']
    },
    generatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update `updatedAt` field before saving
advertiserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create the Advertiser model
const Advertiser = mongoose.model('Advertiser', advertiserSchema);

module.exports = Advertiser;
