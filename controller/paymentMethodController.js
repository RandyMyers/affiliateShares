const PaymentMethod = require('../models/paymentMethod');
const Affiliate = require('../models/affiliate');
const { sendResponse } = require('../utils/response');

// Get all payment methods for affiliate
exports.getPaymentMethods = async (req, res, next) => {
  try {
    const affiliate = await Affiliate.findOne({ user: req.user.id });
    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate profile not found', null);
    }

    const paymentMethods = await PaymentMethod.find({ affiliate: affiliate._id })
      .sort({ isDefault: -1, createdAt: -1 });
    
    return sendResponse(res, 200, 'Payment methods retrieved successfully', paymentMethods);
  } catch (error) {
    next(error);
  }
};

// Get single payment method
exports.getPaymentMethod = async (req, res, next) => {
  try {
    const affiliate = await Affiliate.findOne({ user: req.user.id });
    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate profile not found', null);
    }

    const paymentMethod = await PaymentMethod.findOne({
      _id: req.params.id,
      affiliate: affiliate._id
    });

    if (!paymentMethod) {
      return sendResponse(res, 404, 'Payment method not found', null);
    }

    return sendResponse(res, 200, 'Payment method retrieved successfully', paymentMethod);
  } catch (error) {
    next(error);
  }
};

// Add new payment method
exports.addPaymentMethod = async (req, res, next) => {
  try {
    const affiliate = await Affiliate.findOne({ user: req.user.id });
    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate profile not found', null);
    }

    const {
      type,
      paypalEmail,
      bankName,
      accountNumber,
      accountName,
      bankCode,
      routingNumber,
      swiftCode,
      gatewayAccountId,
      gatewayEmail,
      gatewayPhone,
      isDefault,
      metadata
    } = req.body;

    // Validate required fields based on type
    if (type === 'paypal' && !paypalEmail) {
      return sendResponse(res, 400, 'PayPal email is required', null);
    }

    if (type === 'bank_transfer' && (!bankName || !accountNumber || !accountName)) {
      return sendResponse(res, 400, 'Bank name, account number, and account name are required', null);
    }

    if (['flutterwave', 'paystack', 'squad'].includes(type) && !gatewayEmail) {
      return sendResponse(res, 400, 'Email is required for payment gateway methods', null);
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await PaymentMethod.updateMany(
        { affiliate: affiliate._id },
        { $set: { isDefault: false } }
      );
    }

    const paymentMethod = new PaymentMethod({
      affiliate: affiliate._id,
      type,
      paypalEmail,
      bankName,
      accountNumber,
      accountName,
      bankCode,
      routingNumber,
      swiftCode,
      gatewayAccountId,
      gatewayEmail,
      gatewayPhone,
      isDefault: isDefault || false,
      metadata: metadata || {},
      status: 'pending_verification'
    });

    await paymentMethod.save();

    return sendResponse(res, 201, 'Payment method added successfully', paymentMethod);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return sendResponse(res, 400, messages.join(', '), null);
    }
    next(error);
  }
};

// Update payment method
exports.updatePaymentMethod = async (req, res, next) => {
  try {
    const affiliate = await Affiliate.findOne({ user: req.user.id });
    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate profile not found', null);
    }

    const paymentMethod = await PaymentMethod.findOne({
      _id: req.params.id,
      affiliate: affiliate._id
    });

    if (!paymentMethod) {
      return sendResponse(res, 404, 'Payment method not found', null);
    }

    const {
      paypalEmail,
      bankName,
      accountNumber,
      accountName,
      bankCode,
      routingNumber,
      swiftCode,
      gatewayAccountId,
      gatewayEmail,
      gatewayPhone,
      isDefault,
      metadata,
      status
    } = req.body;

    // Update fields
    if (paypalEmail !== undefined) paymentMethod.paypalEmail = paypalEmail;
    if (bankName !== undefined) paymentMethod.bankName = bankName;
    if (accountNumber !== undefined) paymentMethod.accountNumber = accountNumber;
    if (accountName !== undefined) paymentMethod.accountName = accountName;
    if (bankCode !== undefined) paymentMethod.bankCode = bankCode;
    if (routingNumber !== undefined) paymentMethod.routingNumber = routingNumber;
    if (swiftCode !== undefined) paymentMethod.swiftCode = swiftCode;
    if (gatewayAccountId !== undefined) paymentMethod.gatewayAccountId = gatewayAccountId;
    if (gatewayEmail !== undefined) paymentMethod.gatewayEmail = gatewayEmail;
    if (gatewayPhone !== undefined) paymentMethod.gatewayPhone = gatewayPhone;
    if (metadata !== undefined) paymentMethod.metadata = metadata;
    if (status !== undefined) paymentMethod.status = status;

    // Handle default setting
    if (isDefault !== undefined && isDefault !== paymentMethod.isDefault) {
      if (isDefault) {
        // Unset other defaults
        await PaymentMethod.updateMany(
          { affiliate: affiliate._id, _id: { $ne: paymentMethod._id } },
          { $set: { isDefault: false } }
        );
      }
      paymentMethod.isDefault = isDefault;
    }

    await paymentMethod.save();

    return sendResponse(res, 200, 'Payment method updated successfully', paymentMethod);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return sendResponse(res, 400, messages.join(', '), null);
    }
    next(error);
  }
};

// Delete payment method
exports.deletePaymentMethod = async (req, res, next) => {
  try {
    const affiliate = await Affiliate.findOne({ user: req.user.id });
    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate profile not found', null);
    }

    const paymentMethod = await PaymentMethod.findOne({
      _id: req.params.id,
      affiliate: affiliate._id
    });

    if (!paymentMethod) {
      return sendResponse(res, 404, 'Payment method not found', null);
    }

    // Don't allow deleting if it's the only payment method
    const count = await PaymentMethod.countDocuments({ affiliate: affiliate._id });
    if (count === 1) {
      return sendResponse(res, 400, 'Cannot delete the only payment method', null);
    }

    await PaymentMethod.deleteOne({ _id: req.params.id });

    // If deleted method was default, set another as default
    if (paymentMethod.isDefault) {
      const newDefault = await PaymentMethod.findOne({ affiliate: affiliate._id });
      if (newDefault) {
        newDefault.isDefault = true;
        await newDefault.save();
      }
    }

    return sendResponse(res, 200, 'Payment method deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

// Set default payment method
exports.setDefaultPaymentMethod = async (req, res, next) => {
  try {
    const affiliate = await Affiliate.findOne({ user: req.user.id });
    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate profile not found', null);
    }

    const paymentMethod = await PaymentMethod.findOne({
      _id: req.params.id,
      affiliate: affiliate._id
    });

    if (!paymentMethod) {
      return sendResponse(res, 404, 'Payment method not found', null);
    }

    // Unset other defaults
    await PaymentMethod.updateMany(
      { affiliate: affiliate._id, _id: { $ne: paymentMethod._id } },
      { $set: { isDefault: false } }
    );

    // Set this as default
    paymentMethod.isDefault = true;
    await paymentMethod.save();

    return sendResponse(res, 200, 'Default payment method updated successfully', paymentMethod);
  } catch (error) {
    next(error);
  }
};

