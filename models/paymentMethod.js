const mongoose = require('mongoose');

const { Schema } = mongoose;

const PaymentMethodSchema = new Schema({
  affiliate: {
    type: Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['paypal', 'bank_transfer', 'flutterwave', 'paystack', 'squad'],
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  // PayPal details
  paypalEmail: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        if (this.type === 'paypal') {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        }
        return true;
      },
      message: 'Invalid PayPal email address'
    }
  },
  // Bank transfer details
  bankName: {
    type: String,
    trim: true
  },
  accountNumber: {
    type: String,
    trim: true
  },
  accountName: {
    type: String,
    trim: true
  },
  bankCode: {
    type: String,
    trim: true
  },
  routingNumber: {
    type: String,
    trim: true
  },
  swiftCode: {
    type: String,
    trim: true
  },
  // Payment gateway details (Flutterwave, Paystack, Squad)
  gatewayAccountId: {
    type: String,
    trim: true
  },
  gatewayEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  gatewayPhone: {
    type: String,
    trim: true
  },
  // Verification status
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date
  },
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending_verification'],
    default: 'pending_verification'
  },
  // Additional metadata
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Pre-save hook
PaymentMethodSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // If this is set as default, unset other defaults for this affiliate
  if (this.isDefault && this.isModified('isDefault')) {
    mongoose.model('PaymentMethod').updateMany(
      { affiliate: this.affiliate, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    ).exec();
  }
  
  next();
});

// Indexes
PaymentMethodSchema.index({ affiliate: 1, isDefault: 1 });
PaymentMethodSchema.index({ affiliate: 1, status: 1 });
PaymentMethodSchema.index({ affiliate: 1, type: 1 });

// Validation: Ensure required fields based on type
PaymentMethodSchema.pre('validate', function(next) {
  if (this.type === 'paypal' && !this.paypalEmail) {
    this.invalidate('paypalEmail', 'PayPal email is required for PayPal payment method');
  }
  
  if (this.type === 'bank_transfer') {
    if (!this.bankName || !this.accountNumber || !this.accountName) {
      this.invalidate('bankName', 'Bank name, account number, and account name are required for bank transfer');
    }
  }
  
  if (['flutterwave', 'paystack', 'squad'].includes(this.type)) {
    if (!this.gatewayEmail) {
      this.invalidate('gatewayEmail', 'Email is required for payment gateway methods');
    }
  }
  
  next();
});

const PaymentMethod = mongoose.model('PaymentMethod', PaymentMethodSchema);

module.exports = PaymentMethod;
