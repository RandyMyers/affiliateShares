const mongoose = require('mongoose');

// Define the User schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    maxlength: [50, 'Username cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    match: [/\S+@\S+\.\S+/, 'Please use a valid email address'],
    index: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  role: {
    type: String,
    enum: ['admin', 'advertiser', 'affiliate'],
    default: 'affiliate'
  },
  merchantId: {
    type: String,
    unique: true,
    sparse: true, // Only required for merchants/advertisers
    trim: true,
    index: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  },
  refreshToken: {
    type: String,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  profile: {
    avatar: {
      type: String,
      default: null
    },
    phone: {
      type: String,
      default: null
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
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

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ merchantId: 1 });

// Generate merchant ID for merchants/advertisers
userSchema.methods.generateMerchantId = function() {
  if ((this.role === 'advertiser' || this.role === 'admin') && !this.merchantId) {
    // Generate format: MERCH-XXXXX (5 alphanumeric characters)
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    this.merchantId = `MERCH-${randomPart}`;
  }
  return this.merchantId;
};

// Pre-save hook to generate merchant ID and update updatedAt
userSchema.pre('save', function(next) {
  // Generate merchant ID for merchants/advertisers if not set
  if ((this.role === 'advertiser' || this.role === 'admin') && !this.merchantId) {
    this.generateMerchantId();
  }
  this.updatedAt = Date.now();
  next();
});

// Create the User model
const User = mongoose.model('User', userSchema);

module.exports = User;
