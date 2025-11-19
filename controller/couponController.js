const Coupon = require('../models/coupon');
const Store = require('../models/store');
const Order = require('../models/order');
const { sendResponse } = require('../utils/response');

// Get all coupons for authenticated merchant
exports.getCoupons = async (req, res, next) => {
  try {
    const { store, program, affiliate, isActive } = req.query;
    const query = { merchant: req.user.id };
    
    if (store) query.store = store;
    if (program) query.program = program;
    if (affiliate) query.affiliate = affiliate;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const coupons = await Coupon.find(query)
      .populate('program', 'name')
      .populate('store', 'name domain')
      .populate('affiliate', 'referralCode')
      .sort({ createdAt: -1 });
    
    return sendResponse(res, 200, 'Coupons retrieved successfully', coupons);
  } catch (error) {
    next(error);
  }
};

// Get single coupon by ID
exports.getCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findOne({
      _id: req.params.id,
      merchant: req.user.id
    })
      .populate('program', 'name')
      .populate('store', 'name domain')
      .populate('affiliate', 'referralCode');

    if (!coupon) {
      return sendResponse(res, 404, 'Coupon not found', null);
    }

    return sendResponse(res, 200, 'Coupon retrieved successfully', coupon);
  } catch (error) {
    next(error);
  }
};

// Get coupon usage statistics
exports.getCouponUsage = async (req, res, next) => {
  try {
    const coupon = await Coupon.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!coupon) {
      return sendResponse(res, 404, 'Coupon not found', null);
    }

    // Get orders that used this coupon
    const orders = await Order.find({
      store: coupon.store,
      'discountCode': coupon.code
    });

    const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    const usage = {
      totalUses: orders.length,
      usedCount: coupon.usedCount,
      remainingUses: coupon.usageLimit ? coupon.usageLimit - coupon.usedCount : null,
      totalDiscount,
      totalRevenue,
      orders: orders.length
    };

    return sendResponse(res, 200, 'Coupon usage retrieved successfully', usage);
  } catch (error) {
    next(error);
  }
};

// Create new coupon
exports.createCoupon = async (req, res, next) => {
  try {
    const { 
      name, description, code, type, value, 
      minimumAmount, maximumDiscount, usageLimit,
      validFrom, validUntil, store, program, affiliate,
      isUnique
    } = req.body;

    // Verify store belongs to merchant
    const storeDoc = await Store.findOne({
      _id: store,
      merchant: req.user.id
    });

    if (!storeDoc) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Check if code already exists
    if (code) {
      const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
      if (existingCoupon) {
        return sendResponse(res, 400, 'Coupon code already exists', null);
      }
    }

    const coupon = new Coupon({
      merchant: req.user.id,
      program: program || null,
      store: store,
      affiliate: affiliate || null,
      name,
      description,
      code: code ? code.toUpperCase() : undefined,
      type,
      value,
      minimumAmount: minimumAmount || 0,
      maximumDiscount: maximumDiscount || null,
      usageLimit: usageLimit || null,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      isUnique: isUnique || false
    });

    await coupon.save();

    await coupon.populate('program', 'name');
    await coupon.populate('store', 'name domain');
    if (coupon.affiliate) {
      await coupon.populate('affiliate', 'referralCode');
    }

    return sendResponse(res, 201, 'Coupon created successfully', coupon);
  } catch (error) {
    if (error.code === 11000) {
      return sendResponse(res, 400, 'Coupon code already exists', null);
    }
    next(error);
  }
};

// Update coupon
exports.updateCoupon = async (req, res, next) => {
  try {
    const { 
      name, description, isActive, validUntil,
      usageLimit, value, minimumAmount, maximumDiscount
    } = req.body;

    const coupon = await Coupon.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!coupon) {
      return sendResponse(res, 404, 'Coupon not found', null);
    }

    if (name) coupon.name = name;
    if (description !== undefined) coupon.description = description;
    if (isActive !== undefined) coupon.isActive = isActive;
    if (validUntil) coupon.validUntil = new Date(validUntil);
    if (usageLimit !== undefined) coupon.usageLimit = usageLimit;
    if (value !== undefined) coupon.value = value;
    if (minimumAmount !== undefined) coupon.minimumAmount = minimumAmount;
    if (maximumDiscount !== undefined) coupon.maximumDiscount = maximumDiscount;

    await coupon.save();

    await coupon.populate('program', 'name');
    await coupon.populate('store', 'name domain');

    return sendResponse(res, 200, 'Coupon updated successfully', coupon);
  } catch (error) {
    next(error);
  }
};

// Delete coupon
exports.deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!coupon) {
      return sendResponse(res, 404, 'Coupon not found', null);
    }

    await Coupon.deleteOne({ _id: req.params.id });

    return sendResponse(res, 200, 'Coupon deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

// ============ AFFILIATE ROUTES ============

const Affiliate = require('../models/affiliate');

// Get all coupons available to affiliate (based on their approved stores/programs)
exports.getAffiliateCoupons = async (req, res, next) => {
  try {
    const { program, store, type } = req.query;
    
    // Get affiliate's approved stores
    let affiliate = await Affiliate.findOne({ user: req.user.id });
    
    // If no affiliate profile exists and user is affiliate, create one
    if (!affiliate && req.user.role === 'affiliate') {
      affiliate = new Affiliate({
        user: req.user.id,
        referralCode: `AFF${Date.now().toString(36).toUpperCase()}`,
        stores: [],
        stats: {
          totalClicks: 0,
          totalOrders: 0,
          totalCommissions: 0,
          totalEarnings: 0
        }
      });
      await affiliate.save();
    }
    
    if (!affiliate) {
      return sendResponse(res, 200, 'No coupons available', []);
    }

    // Get approved store IDs
    const approvedStoreIds = affiliate.stores
      .filter(s => s.status === 'approved')
      .map(s => s.store.toString());

    // Get programs associated with approved stores
    const AffiliateProgram = require('../models/affiliateProgram');
    const approvedPrograms = await AffiliateProgram.find({
      store: { $in: approvedStoreIds },
      status: 'active'
    }).select('_id');

    const approvedProgramIds = approvedPrograms.map(p => p._id.toString());

    if (approvedStoreIds.length === 0 && approvedProgramIds.length === 0) {
      return sendResponse(res, 200, 'No coupons available', []);
    }

    // Build query - coupons available to affiliate
    const query = {
      $and: [
        {
          $or: [
            { store: { $in: approvedStoreIds } },
            { program: { $in: approvedProgramIds } },
            { affiliate: affiliate._id }, // Coupons specifically assigned to this affiliate
            { affiliate: null, program: null, store: { $in: approvedStoreIds } } // General coupons for approved stores
          ]
        },
        {
          $or: [
            { validUntil: { $gte: new Date() } },
            { validUntil: null }
          ]
        }
      ],
      isActive: true
    };

    if (program) query.program = program;
    if (store) query.store = store;
    if (type) query.type = type;

    const coupons = await Coupon.find(query)
      .populate('program', 'name')
      .populate('store', 'name domain')
      .populate('merchant', 'username email')
      .sort({ createdAt: -1 });
    
    return sendResponse(res, 200, 'Coupons retrieved successfully', coupons);
  } catch (error) {
    next(error);
  }
};

// Get coupons for a specific program
exports.getProgramCoupons = async (req, res, next) => {
  try {
    const { programId } = req.params;
    const { type } = req.query;
    
    // Verify affiliate has access to this program
    let affiliate = await Affiliate.findOne({ user: req.user.id });
    
    // If no affiliate profile exists and user is affiliate, create one
    if (!affiliate && req.user.role === 'affiliate') {
      affiliate = new Affiliate({
        user: req.user.id,
        referralCode: `AFF${Date.now().toString(36).toUpperCase()}`,
        stores: [],
        stats: {
          totalClicks: 0,
          totalOrders: 0,
          totalCommissions: 0,
          totalEarnings: 0
        }
      });
      await affiliate.save();
    }
    
    if (!affiliate) {
      return sendResponse(res, 200, 'No coupons available', []);
    }

    // Check if program exists and affiliate has access via store
    const AffiliateProgram = require('../models/affiliateProgram');
    const program = await AffiliateProgram.findById(programId);
    
    if (!program) {
      return sendResponse(res, 404, 'Program not found', null);
    }

    // Check if affiliate has access to the store associated with this program
    const hasAccess = affiliate.stores.some(
      s => s.store.toString() === program.store.toString() && s.status === 'approved'
    );

    if (!hasAccess) {
      return sendResponse(res, 403, 'Access denied to this program', null);
    }

    const query = {
      $and: [
        {
          $or: [
            { program: programId },
            { program: null, store: program.store }
          ]
        },
        {
          $or: [
            { validUntil: { $gte: new Date() } },
            { validUntil: null }
          ]
        }
      ],
      isActive: true
    };

    if (type) query.type = type;

    const coupons = await Coupon.find(query)
      .populate('program', 'name')
      .populate('store', 'name domain')
      .populate('merchant', 'username email')
      .sort({ createdAt: -1 });
    
    return sendResponse(res, 200, 'Coupons retrieved successfully', coupons);
  } catch (error) {
    next(error);
  }
};

// Get single coupon (if affiliate has access)
exports.getAffiliateCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get affiliate's approved stores
    let affiliate = await Affiliate.findOne({ user: req.user.id });
    
    // If no affiliate profile exists and user is affiliate, create one
    if (!affiliate && req.user.role === 'affiliate') {
      affiliate = new Affiliate({
        user: req.user.id,
        referralCode: `AFF${Date.now().toString(36).toUpperCase()}`,
        stores: [],
        stats: {
          totalClicks: 0,
          totalOrders: 0,
          totalCommissions: 0,
          totalEarnings: 0
        }
      });
      await affiliate.save();
    }
    
    if (!affiliate) {
      return sendResponse(res, 404, 'Coupon not found', null);
    }

    const approvedStoreIds = affiliate.stores
      .filter(s => s.status === 'approved')
      .map(s => s.store.toString());

    // Get programs for approved stores
    const AffiliateProgram = require('../models/affiliateProgram');
    const approvedPrograms = await AffiliateProgram.find({
      store: { $in: approvedStoreIds },
      status: 'active'
    }).select('_id');

    const approvedProgramIds = approvedPrograms.map(p => p._id.toString());

    const coupon = await Coupon.findOne({
      _id: id,
      $or: [
        { store: { $in: approvedStoreIds } },
        { program: { $in: approvedProgramIds } },
        { affiliate: affiliate._id },
        { affiliate: null, program: null, store: { $in: approvedStoreIds } }
      ],
      isActive: true
    })
      .populate('program', 'name')
      .populate('store', 'name domain')
      .populate('merchant', 'username email');

    if (!coupon) {
      return sendResponse(res, 404, 'Coupon not found or access denied', null);
    }

    // Check if coupon is still valid
    if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) {
      return sendResponse(res, 400, 'Coupon has expired', null);
    }

    return sendResponse(res, 200, 'Coupon retrieved successfully', coupon);
  } catch (error) {
    next(error);
  }
};

// Track coupon usage
exports.trackCouponUsage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verify affiliate has access
    const affiliate = await Affiliate.findOne({ user: req.user.id });
    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate profile not found', null);
    }

    const approvedStoreIds = affiliate.stores
      .filter(s => s.status === 'approved')
      .map(s => s.store.toString());

    const AffiliateProgram = require('../models/affiliateProgram');
    const approvedPrograms = await AffiliateProgram.find({
      store: { $in: approvedStoreIds },
      status: 'active'
    }).select('_id');

    const approvedProgramIds = approvedPrograms.map(p => p._id.toString());

    const coupon = await Coupon.findOne({
      _id: id,
      $or: [
        { store: { $in: approvedStoreIds } },
        { program: { $in: approvedProgramIds } },
        { affiliate: affiliate._id },
        { affiliate: null, program: null, store: { $in: approvedStoreIds } }
      ],
      isActive: true
    });

    if (!coupon) {
      return sendResponse(res, 404, 'Coupon not found or access denied', null);
    }

    // Track usage (you can add tracking logic here)
    // For now, just return success
    return sendResponse(res, 200, 'Coupon usage tracked successfully', { couponId: coupon._id, code: coupon.code });
  } catch (error) {
    next(error);
  }
};

