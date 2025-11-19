const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MerchantWallet',
    required: true,
    index: true
  },
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'deposit',              // Manual deposit
      'auto_deposit',         // Automatic deposit
      'commission_payment',    // Payment for approved commission
      'commission_reserve',   // Reserve for pending commission
      'commission_release',   // Release reserved commission
      'payout',               // Affiliate payout deduction
      'refund',               // Refund to wallet
      'fee',                  // Platform/transaction fee
      'adjustment'            // Manual adjustment
    ],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  balanceBefore: {
    available: {
      type: Number,
      default: 0
    },
    reserved: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  },
  balanceAfter: {
    available: {
      type: Number,
      default: 0
    },
    reserved: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  reference: {
    type: {
      type: String,
      enum: ['commission', 'payout', 'deposit', 'order', 'refund', 'fee', 'adjustment']
    },
    id: {
      type: mongoose.Schema.Types.ObjectId
    },
    externalId: {
      type: String
    }
  },
  description: {
    type: String,
    trim: true
  },
  // Payment gateway information (for deposits)
  paymentGateway: {
    type: String,
    enum: ['flutterwave', 'paystack', 'squad', 'stripe', 'credit_card', 'bank_transfer']
  },
  paymentGatewayTransactionId: {
    type: String,
    index: true
  },
  // Fee-specific fields (only used when type is 'fee')
  feeType: {
    type: String,
    enum: [
      'network_transaction',  // Fee on commission (e.g., 20% of commission)
      'payout_processing',    // Fee for processing affiliate payout
      'platform_subscription', // Monthly/annual platform fee
      'deposit_fee',          // Fee for wallet deposits
      'withdrawal_fee',       // Fee for wallet withdrawals
      'chargeback_fee',       // Fee for chargebacks
      'refund_fee'            // Fee for refunds
    ],
    index: true
  },
  feeCalculation: {
    type: {
      type: String,
      enum: ['percentage', 'fixed', 'tiered']
    },
    rate: Number,        // Percentage rate (e.g., 20 for 20%)
    fixedAmount: Number, // Fixed amount
    baseAmount: Number,  // Base amount the fee was calculated on
    tiers: [{
      min: Number,
      max: Number,
      rate: Number
    }]
  },
  feeStatus: {
    type: String,
    enum: ['pending', 'charged', 'waived', 'refunded'],
    default: 'charged'
  },
  waivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  waivedAt: Date,
  // Metadata for additional information
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Error information
  error: {
    message: String,
    code: String,
    details: mongoose.Schema.Types.Mixed
  },
  // Processing information
  processedAt: {
    type: Date
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
walletTransactionSchema.index({ wallet: 1, createdAt: -1 });
walletTransactionSchema.index({ merchant: 1, type: 1, createdAt: -1 });
walletTransactionSchema.index({ status: 1, createdAt: -1 });
walletTransactionSchema.index({ 'reference.id': 1 });
walletTransactionSchema.index({ paymentGatewayTransactionId: 1 });
walletTransactionSchema.index({ type: 1, feeType: 1, createdAt: -1 }); // For fee queries
walletTransactionSchema.index({ type: 1, feeStatus: 1 }); // For fee status queries

// Pre-save hook
walletTransactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  if (this.status === 'completed' && !this.processedAt) {
    this.processedAt = new Date();
  }
  
  next();
});

// Method to mark as completed
walletTransactionSchema.methods.markCompleted = function(processedBy = null) {
  this.status = 'completed';
  this.processedAt = new Date();
  if (processedBy) {
    this.processedBy = processedBy;
  }
  return this.save();
};

// Method to mark as failed
walletTransactionSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  if (error) {
    this.error = {
      message: error.message || error,
      code: error.code,
      details: error.details
    };
  }
  return this.save();
};

// Static method to create transaction
walletTransactionSchema.statics.createTransaction = async function(data) {
  const {
    wallet,
    merchant,
    type,
    amount,
    balanceBefore,
    balanceAfter,
    reference = {},
    description,
    paymentGateway,
    paymentGatewayTransactionId,
    metadata = {},
    feeType,
    feeCalculation,
    feeStatus
  } = data;

  const transaction = new this({
    wallet,
    merchant,
    type,
    amount,
    balanceBefore,
    balanceAfter,
    reference,
    description,
    paymentGateway,
    paymentGatewayTransactionId,
    metadata,
    feeType,
    feeCalculation,
    feeStatus: feeStatus || (type === 'fee' ? 'charged' : undefined),
    status: 'completed' // Most transactions are immediate
  });

  await transaction.save();
  return transaction;
};

// Static methods for fee calculation
walletTransactionSchema.statics.calculateNetworkFee = function(commissionAmount, feeRate) {
  return (commissionAmount * feeRate) / 100;
};

walletTransactionSchema.statics.calculatePayoutFee = function(payoutAmount, feeConfig) {
  if (feeConfig.type === 'percentage') {
    return (payoutAmount * feeConfig.rate) / 100;
  } else if (feeConfig.type === 'fixed') {
    return feeConfig.amount;
  } else if (feeConfig.type === 'tiered') {
    // Calculate based on tiers
    for (const tier of feeConfig.tiers) {
      if (payoutAmount >= tier.min && (tier.max === null || payoutAmount <= tier.max)) {
        return (payoutAmount * tier.rate) / 100;
      }
    }
    return 0;
  }
  return 0;
};

// Method to waive a fee transaction
walletTransactionSchema.methods.waiveFee = async function(waivedBy) {
  if (this.type !== 'fee') {
    throw new Error('Can only waive fee transactions');
  }
  if (this.feeStatus !== 'charged') {
    throw new Error('Fee can only be waived if status is charged');
  }

  // Refund the fee amount to wallet
  const MerchantWallet = require('./MerchantWallet');
  const WalletTransaction = mongoose.model('WalletTransaction');
  const wallet = await MerchantWallet.findById(this.wallet);
  if (wallet) {
    await wallet.addFunds(this.amount);
    
    // Create refund transaction
    await WalletTransaction.createTransaction({
      wallet: wallet._id,
      merchant: this.merchant,
      type: 'refund',
      amount: this.amount,
      balanceBefore: {
        available: wallet.balance.available - this.amount,
        reserved: wallet.balance.reserved,
        total: wallet.balance.total - this.amount
      },
      balanceAfter: {
        available: wallet.balance.available,
        reserved: wallet.balance.reserved,
        total: wallet.balance.total
      },
      reference: {
        type: 'fee',
        id: this._id
      },
      description: `Fee waiver: ${this.description || this.feeType}`
    });
  }

  this.feeStatus = 'waived';
  this.waivedAt = new Date();
  this.waivedBy = waivedBy;
  await this.save();

  return this;
};

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);


