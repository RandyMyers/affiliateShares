const mongoose = require('mongoose');
const crypto = require('crypto');

// Encryption/Decryption helpers (simple - in production, use proper encryption library)
const encrypt = (text, secret) => {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(secret || process.env.ENCRYPTION_SECRET || 'default-secret', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (encryptedText, secret) => {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(secret || process.env.ENCRYPTION_SECRET || 'default-secret', 'salt', 32);
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

const paymentGatewaySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['flutterwave', 'paystack', 'squad'],
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Public key (can be stored in plain text)
  publicKey: {
    type: String,
    required: true,
    trim: true
  },
  // Secret key (should be encrypted)
  secretKey: {
    type: String,
    required: true,
    trim: true
  },
  // Webhook secret for verifying webhooks
  webhookSecret: {
    type: String,
    trim: true
  },
  // Merchant ID (if applicable)
  merchantId: {
    type: String,
    trim: true
  },
  // Environment (test or live)
  environment: {
    type: String,
    enum: ['test', 'live'],
    default: 'test'
  },
  // Is this gateway active?
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  // Is this the default gateway?
  isDefault: {
    type: Boolean,
    default: false
  },
  // Additional configuration (gateway-specific)
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Created by (admin user)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Timestamps
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
paymentGatewaySchema.index({ type: 1, isActive: 1 });
paymentGatewaySchema.index({ isDefault: 1 });

// Virtual for decrypted secret key
paymentGatewaySchema.virtual('decryptedSecretKey').get(function() {
  try {
    return decrypt(this.secretKey);
  } catch (error) {
    return null;
  }
});

// Pre-save hook to encrypt secret key
paymentGatewaySchema.pre('save', function(next) {
  if (this.isModified('secretKey') && !this.secretKey.includes(':')) {
    // Only encrypt if not already encrypted (doesn't contain ':')
    this.secretKey = encrypt(this.secretKey);
  }
  this.updatedAt = Date.now();
  next();
});

// Method to get decrypted secret key
paymentGatewaySchema.methods.getSecretKey = function() {
  try {
    return decrypt(this.secretKey);
  } catch (error) {
    throw new Error('Failed to decrypt secret key');
  }
};

// Static method to get active gateway by type
paymentGatewaySchema.statics.getActiveGateway = async function(type) {
  return await this.findOne({ type, isActive: true });
};

// Static method to get default gateway
paymentGatewaySchema.statics.getDefaultGateway = async function() {
  return await this.findOne({ isDefault: true, isActive: true });
};

const PaymentGateway = mongoose.model('PaymentGateway', paymentGatewaySchema);

module.exports = PaymentGateway;

