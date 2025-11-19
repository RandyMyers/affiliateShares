const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
  affiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true,
    index: true
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true,
    index: true
  },
  // Commission details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  rate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  orderTotal: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  // Commission status
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'cancelled', 'refunded'],
    default: 'pending',
    index: true
  },
  // Payout information
  payout: {
    payoutId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payout'
    },
    paidAt: {
      type: Date
    },
    paymentMethod: {
      type: String,
      enum: ['flutterwave', 'paystack', 'squad', 'bank']
    },
    transactionId: {
      type: String
    }
  },
  // Notes
  notes: {
    type: String,
    trim: true
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
  approvedAt: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
commissionSchema.index({ affiliate: 1, status: 1, createdAt: -1 });
commissionSchema.index({ store: 1, status: 1, createdAt: -1 });
commissionSchema.index({ status: 1, createdAt: -1 });
commissionSchema.index({ 'payout.payoutId': 1 });

// Pre-save hook
commissionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  if (this.status === 'approved' && !this.approvedAt) {
    this.approvedAt = new Date();
  }
  
  next();
});

// Method to approve commission
commissionSchema.methods.approve = function(approvedBy) {
  this.status = 'approved';
  this.approvedAt = new Date();
  this.approvedBy = approvedBy;
  return this.save();
};

// Method to mark as paid
commissionSchema.methods.markAsPaid = function(payoutId, paymentMethod, transactionId) {
  this.status = 'paid';
  this.payout.paidAt = new Date();
  this.payout.payoutId = payoutId;
  this.payout.paymentMethod = paymentMethod;
  this.payout.transactionId = transactionId;
  return this.save();
};

module.exports = mongoose.model('Commission', commissionSchema);

