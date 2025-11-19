const mongoose = require('mongoose');

const merchantWalletSchema = new mongoose.Schema({
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  balance: {
    available: {
      type: Number,
      default: 0,
      min: 0
    },
    reserved: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  autoDeposit: {
    enabled: {
      type: Boolean,
      default: false
    },
    threshold: {
      type: Number,
      default: 0,
      min: 0
    },
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'bank_transfer', 'flutterwave', 'paystack', 'squad'],
      default: 'credit_card'
    },
    paymentGatewayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentGateway'
    }
  },
  settings: {
    lowBalanceAlert: {
      type: Number,
      default: 100,
      min: 0
    },
    alertEmail: {
      type: String,
      trim: true
    },
    alertEnabled: {
      type: Boolean,
      default: true
    }
  },
  // Statistics
  stats: {
    totalDeposits: {
      type: Number,
      default: 0
    },
    totalWithdrawals: {
      type: Number,
      default: 0
    },
    totalCommissionsPaid: {
      type: Number,
      default: 0
    },
    totalFees: {
      type: Number,
      default: 0
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
}, {
  timestamps: true
});

// Indexes
merchantWalletSchema.index({ merchant: 1 });
merchantWalletSchema.index({ 'balance.total': -1 });

// Pre-save hook to update total balance
merchantWalletSchema.pre('save', function(next) {
  this.balance.total = this.balance.available + this.balance.reserved;
  this.updatedAt = Date.now();
  next();
});

// Method to add funds (deposit)
merchantWalletSchema.methods.addFunds = async function(amount, transactionId) {
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }
  
  this.balance.available += amount;
  this.stats.totalDeposits += amount;
  await this.save();
  
  return this;
};

// Method to reserve funds (for pending commissions)
merchantWalletSchema.methods.reserveFunds = async function(amount) {
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }
  
  if (this.balance.available < amount) {
    throw new Error('Insufficient available balance');
  }
  
  this.balance.available -= amount;
  this.balance.reserved += amount;
  await this.save();
  
  return this;
};

// Method to release reserved funds (when commission cancelled)
merchantWalletSchema.methods.releaseReservation = async function(amount) {
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }
  
  if (this.balance.reserved < amount) {
    throw new Error('Insufficient reserved balance');
  }
  
  this.balance.reserved -= amount;
  this.balance.available += amount;
  await this.save();
  
  return this;
};

// Method to deduct funds (when commission approved or payout processed)
merchantWalletSchema.methods.deductFunds = async function(amount, fromReserved = false) {
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }
  
  if (fromReserved) {
    if (this.balance.reserved < amount) {
      throw new Error('Insufficient reserved balance');
    }
    this.balance.reserved -= amount;
  } else {
    if (this.balance.available < amount) {
      throw new Error('Insufficient available balance');
    }
    this.balance.available -= amount;
  }
  
  this.stats.totalWithdrawals += amount;
  await this.save();
  
  return this;
};

// Method to approve commission (move from reserved to paid)
merchantWalletSchema.methods.approveCommission = async function(amount) {
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }
  
  if (this.balance.reserved < amount) {
    throw new Error('Insufficient reserved balance');
  }
  
  this.balance.reserved -= amount;
  this.stats.totalCommissionsPaid += amount;
  await this.save();
  
  return this;
};

// Method to refund funds (when commission refunded)
merchantWalletSchema.methods.refundFunds = async function(amount) {
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }
  
  this.balance.available += amount;
  await this.save();
  
  return this;
};

// Method to add fee
merchantWalletSchema.methods.addFee = async function(amount) {
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }
  
  if (this.balance.available < amount) {
    throw new Error('Insufficient available balance for fee');
  }
  
  this.balance.available -= amount;
  this.stats.totalFees += amount;
  await this.save();
  
  return this;
};

// Static method to get or create wallet for merchant
merchantWalletSchema.statics.getOrCreate = async function(merchantId) {
  let wallet = await this.findOne({ merchant: merchantId });
  
  if (!wallet) {
    wallet = new this({
      merchant: merchantId,
      balance: {
        available: 0,
        reserved: 0,
        total: 0
      }
    });
    await wallet.save();
  }
  
  return wallet;
};

// Check if balance is low
merchantWalletSchema.methods.isLowBalance = function() {
  return this.balance.available < this.settings.lowBalanceAlert;
};

module.exports = mongoose.model('MerchantWallet', merchantWalletSchema);


