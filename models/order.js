const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true
  },
  affiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    index: true
  },
  // External order information
  externalOrderId: {
    type: String,
    required: true,
    index: true
  },
  // Order data from e-commerce platform
  orderData: {
    orderNumber: {
      type: String,
      required: true
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true
    },
    customerName: {
      type: String,
      trim: true
    },
    // Order items
    items: [{
      productId: String,
      productName: String,
      quantity: Number,
      price: Number,
      total: Number
    }],
    // Order totals
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    tax: {
      type: Number,
      default: 0,
      min: 0
    },
    shipping: {
      type: Number,
      default: 0,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true
    },
    // Order status from platform
    status: {
      type: String,
      required: true
    },
    // Payment information
    paymentMethod: String,
    paymentStatus: String,
    // Shipping information
    shippingAddress: {
      name: String,
      address1: String,
      address2: String,
      city: String,
      state: String,
      zip: String,
      country: String
    }
  },
  // Tracking information
  clickId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Click'
  },
  cookieId: {
    type: String,
    index: true
  },
  referralCode: {
    type: String,
    index: true
  },
  // Commission information
  commission: {
    rate: {
      type: Number,
      min: 0,
      max: 100
    },
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    calculated: {
      type: Boolean,
      default: false
    },
    calculatedAt: {
      type: Date
    }
  },
  // Order status in our system
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'refunded'],
    default: 'pending',
    index: true
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Order date from platform
  orderDate: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes
orderSchema.index({ store: 1, externalOrderId: 1 }, { unique: true });
orderSchema.index({ affiliate: 1, createdAt: -1 });
orderSchema.index({ store: 1, status: 1, createdAt: -1 });
orderSchema.index({ referralCode: 1, createdAt: -1 });
orderSchema.index({ cookieId: 1 });
orderSchema.index({ 'orderData.orderNumber': 1 });

// Pre-save hook
orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to calculate commission
orderSchema.methods.calculateCommission = function(commissionRate, commissionType = 'percentage') {
  if (!this.commission.calculated) {
    if (commissionType === 'percentage') {
      this.commission.rate = commissionRate;
      this.commission.amount = (this.orderData.total * commissionRate) / 100;
    } else {
      // Fixed commission
      this.commission.amount = commissionRate;
    }
    
    this.commission.calculated = true;
    this.commission.calculatedAt = new Date();
  }
  
  return this.commission.amount;
};

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);

