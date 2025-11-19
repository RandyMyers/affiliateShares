const mongoose = require('mongoose');

const { Schema } = mongoose;

const CouponSchema = new Schema({
  merchant: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  program: {
    type: Schema.Types.ObjectId,
    ref: 'AffiliateProgram',
    index: true
  },
  store: {
    type: Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true
  },
  affiliate: {
    type: Schema.Types.ObjectId,
    ref: 'Affiliate',
    index: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed', 'free-shipping'],
    required: true,
    default: 'percentage'
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  minimumAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  maximumDiscount: {
    type: Number,
    min: 0
  },
  usageLimit: {
    type: Number,
    min: 0
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isUnique: {
    type: Boolean,
    default: false
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

// Pre-save hook
CouponSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Generate unique code if not provided
CouponSchema.pre('save', async function (next) {
  if (!this.code) {
    const prefix = this.name.substring(0, 3).toUpperCase().replace(/\s/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.code = `${prefix}${random}`;
    
    // Ensure uniqueness
    let isUnique = false;
    while (!isUnique) {
      const existing = await mongoose.model('Coupon').findOne({ code: this.code });
      if (!existing) {
        isUnique = true;
      } else {
        this.code = `${prefix}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      }
    }
  }
  next();
});

// Indexes
CouponSchema.index({ merchant: 1, isActive: 1 });
CouponSchema.index({ program: 1, isActive: 1 });
CouponSchema.index({ store: 1, isActive: 1 });
CouponSchema.index({ affiliate: 1 });

const Coupon = mongoose.model('Coupon', CouponSchema);

module.exports = Coupon;

