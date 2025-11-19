const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
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
  // Commission references
  commissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Commission',
    required: true
  }],
  // Payout details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  // Payment method reference
  paymentMethodRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentMethod',
    index: true
  },
  // Payment information (legacy support + snapshot)
  paymentMethod: {
    type: String,
    enum: ['paypal', 'bank_transfer', 'flutterwave', 'paystack', 'squad'],
    required: true
  },
  paymentDetails: {
    // For payment gateways
    recipientEmail: String,
    recipientPhone: String,
    // For bank transfers
    bankName: String,
    accountNumber: String,
    accountName: String,
    // Gateway-specific
    gatewayResponse: mongoose.Schema.Types.Mixed
  },
  // Payout status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  // Transaction information
  transactionId: {
    type: String,
    index: true
  },
  transactionReference: {
    type: String,
    index: true
  },
  // Processing information
  processedAt: {
    type: Date
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Error information
  error: {
    message: String,
    code: String,
    details: mongoose.Schema.Types.Mixed
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
  }
}, {
  timestamps: true
});

// Indexes
payoutSchema.index({ affiliate: 1, status: 1, createdAt: -1 });
payoutSchema.index({ store: 1, status: 1, createdAt: -1 });
payoutSchema.index({ status: 1, createdAt: -1 });
payoutSchema.index({ transactionId: 1 });
payoutSchema.index({ transactionReference: 1 });

// Pre-save hook
payoutSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to mark as processing
payoutSchema.methods.markAsProcessing = function(processedBy) {
  this.status = 'processing';
  this.processedAt = new Date();
  this.processedBy = processedBy;
  return this.save();
};

// Method to mark as completed
payoutSchema.methods.markAsCompleted = function(transactionId, transactionReference, gatewayResponse) {
  this.status = 'completed';
  this.transactionId = transactionId;
  this.transactionReference = transactionReference;
  if (gatewayResponse) {
    this.paymentDetails.gatewayResponse = gatewayResponse;
  }
  return this.save();
};

// Method to mark as failed
payoutSchema.methods.markAsFailed = function(error) {
  this.status = 'failed';
  this.error = {
    message: error.message || 'Payment processing failed',
    code: error.code || 'UNKNOWN',
    details: error
  };
  return this.save();
};

module.exports = mongoose.models.Payout || mongoose.model('Payout', payoutSchema);

