const Affiliate = require('../models/affiliate');
const User = require('../models/user');
const Store = require('../models/store');
const { sendResponse } = require('../utils/response');

// Get all affiliates across all stores for a merchant
exports.getAllMerchantAffiliates = async (req, res, next) => {
  try {
    const { 
      storeId,
      status, 
      page = 1, 
      limit = 20, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateJoinedFrom,
      dateJoinedTo,
      minClicks,
      maxClicks,
      minOrders,
      maxOrders,
      minCommissions,
      maxCommissions
    } = req.query;

    // Get all stores owned by merchant
    const merchantStores = await Store.find({ merchant: req.user.id }).select('_id');
    const storeIds = merchantStores.map(s => s._id);

    if (storeIds.length === 0) {
      return sendResponse(res, 200, 'No affiliates found', {
        affiliates: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      });
    }

    // Build query - affiliates who have applied to any of merchant's stores
    const query = {
      'stores.store': { $in: storeIds }
    };

    // Filter by specific store if provided
    if (storeId) {
      query['stores.store'] = storeId;
    }

    if (status) {
      query['stores.status'] = status;
    }

    // Support tag filtering
    if (req.query.tags) {
      const tags = Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags];
      query.tags = { $in: tags.map(tag => tag.toLowerCase().trim()) };
    }

    // Search functionality
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$or = [
        { referralCode: searchRegex },
        { 'user.username': searchRegex },
        { 'user.email': searchRegex }
      ];
    }

    // Date range filtering
    if (dateJoinedFrom || dateJoinedTo) {
      query.createdAt = {};
      if (dateJoinedFrom) {
        query.createdAt.$gte = new Date(dateJoinedFrom);
      }
      if (dateJoinedTo) {
        query.createdAt.$lte = new Date(dateJoinedTo);
      }
    }

    // Build sort object
    const sortObj = {};
    if (sortBy === 'name') {
      sortObj['user.username'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'email') {
      sortObj['user.email'] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }

    // Get affiliates
    let affiliates = await Affiliate.find(query)
      .populate('user', 'username email profile')
      .populate('stores.store', 'name domain')
      .select('-paymentInfo')
      .sort(sortObj)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Apply performance-based filtering and aggregate stats across all stores
    if (minClicks || maxClicks || minOrders || maxOrders || minCommissions || maxCommissions) {
      affiliates = affiliates.filter(affiliate => {
        // Aggregate stats across all merchant stores
        let totalClicks = 0;
        let totalOrders = 0;
        let totalCommissions = 0;

        affiliate.stores.forEach(storeApp => {
          const storeIdStr = storeApp.store._id ? storeApp.store._id.toString() : storeApp.store.toString();
          if (storeIds.includes(storeIdStr) || (storeId && storeIdStr === storeId)) {
            totalClicks += storeApp.stats?.clicks || 0;
            totalOrders += storeApp.stats?.orders || 0;
            totalCommissions += storeApp.stats?.commissions || 0;
          }
        });
        
        if (minClicks && totalClicks < parseInt(minClicks)) return false;
        if (maxClicks && totalClicks > parseInt(maxClicks)) return false;
        if (minOrders && totalOrders < parseInt(minOrders)) return false;
        if (maxOrders && totalOrders > parseInt(maxOrders)) return false;
        if (minCommissions && totalCommissions < parseFloat(minCommissions)) return false;
        if (maxCommissions && totalCommissions > parseFloat(maxCommissions)) return false;
        
        return true;
      });
    }

    const total = await Affiliate.countDocuments(query);

    return sendResponse(res, 200, 'Affiliates retrieved successfully', {
      affiliates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all affiliates for a store (merchant view)
exports.getStoreAffiliates = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { 
      status, 
      page = 1, 
      limit = 20, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateJoinedFrom,
      dateJoinedTo,
      minClicks,
      maxClicks,
      minOrders,
      maxOrders,
      minCommissions,
      maxCommissions
    } = req.query;

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Build query
    const query = {
      'stores.store': storeId
    };

    if (status) {
      query['stores.status'] = status;
    }

    // Support tag filtering
    if (req.query.tags) {
      const tags = Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags];
      query.tags = { $in: tags.map(tag => tag.toLowerCase().trim()) };
    }

    // Search functionality - search by name, email, or referral code
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$or = [
        { referralCode: searchRegex },
        { 'user.username': searchRegex },
        { 'user.email': searchRegex }
      ];
    }

    // Date range filtering (date joined)
    if (dateJoinedFrom || dateJoinedTo) {
      query.createdAt = {};
      if (dateJoinedFrom) {
        query.createdAt.$gte = new Date(dateJoinedFrom);
      }
      if (dateJoinedTo) {
        query.createdAt.$lte = new Date(dateJoinedTo);
      }
    }

    // Build sort object
    const sortObj = {};
    if (sortBy === 'name') {
      sortObj['user.username'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'email') {
      sortObj['user.email'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'clicks') {
      sortObj['stores.stats.clicks'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'orders') {
      sortObj['stores.stats.orders'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'commissions') {
      sortObj['stores.stats.commissions'] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }

    // Get affiliates with population
    let affiliates = await Affiliate.find(query)
      .populate('user', 'username email profile')
      .select('-paymentInfo')
      .sort(sortObj)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Apply performance-based filtering (after population, since stats are nested)
    if (minClicks || maxClicks || minOrders || maxOrders || minCommissions || maxCommissions) {
      affiliates = affiliates.filter(affiliate => {
        const storeApplication = affiliate.stores.find(s => s.store.toString() === storeId);
        const stats = storeApplication?.stats || {};
        
        if (minClicks && (stats.clicks || 0) < parseInt(minClicks)) return false;
        if (maxClicks && (stats.clicks || 0) > parseInt(maxClicks)) return false;
        if (minOrders && (stats.orders || 0) < parseInt(minOrders)) return false;
        if (maxOrders && (stats.orders || 0) > parseInt(maxOrders)) return false;
        if (minCommissions && (stats.commissions || 0) < parseFloat(minCommissions)) return false;
        if (maxCommissions && (stats.commissions || 0) > parseFloat(maxCommissions)) return false;
        
        return true;
      });
    }

    const total = await Affiliate.countDocuments(query);

    return sendResponse(res, 200, 'Affiliates retrieved successfully', {
      affiliates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get single affiliate details
exports.getAffiliate = async (req, res, next) => {
  try {
    const { affiliateId, storeId } = req.params;

    // If storeId provided, verify merchant owns the store
    if (storeId) {
      const store = await Store.findOne({
        _id: storeId,
        merchant: req.user.id
      });

      if (!store) {
        return sendResponse(res, 404, 'Store not found', null);
      }
    }

    const affiliate = await Affiliate.findOne({
      _id: affiliateId
    }).populate('user', 'username email profile');

    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate not found', null);
    }

    // If merchant, hide payment info
    if (req.user.role === 'advertiser' || req.user.role === 'admin') {
      affiliate.paymentInfo = undefined;
    }

    return sendResponse(res, 200, 'Affiliate retrieved successfully', affiliate);
  } catch (error) {
    next(error);
  }
};

// Get current user's affiliate profile (affiliate view)
exports.getMyAffiliateProfile = async (req, res, next) => {
  try {
    // Check if user has affiliate role
    if (req.user.role !== 'affiliate' && req.user.role !== 'admin') {
      return sendResponse(res, 403, 'Access denied. Affiliate role required.', null);
    }

    let affiliate = await Affiliate.findOne({ user: req.user.id })
      .populate('stores.store', 'name domain platform status');

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
      await affiliate.populate('stores.store', 'name domain platform status');
    }

    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate profile not found', null);
    }

    return sendResponse(res, 200, 'Affiliate profile retrieved successfully', affiliate);
  } catch (error) {
    next(error);
  }
};

// Create affiliate profile (when user registers as affiliate)
exports.createAffiliateProfile = async (req, res, next) => {
  try {
    // Check if affiliate profile already exists
    const existingAffiliate = await Affiliate.findOne({ user: req.user.id });

    if (existingAffiliate) {
      return sendResponse(res, 400, 'Affiliate profile already exists', null);
    }

    // Create affiliate profile
    const affiliate = new Affiliate({
      user: req.user.id,
      profile: req.body.profile || {},
      paymentInfo: req.body.paymentInfo || {}
    });

    await affiliate.save();
    await affiliate.populate('user', 'username email');

    return sendResponse(res, 201, 'Affiliate profile created successfully', affiliate);
  } catch (error) {
    next(error);
  }
};

// Update affiliate profile
exports.updateAffiliateProfile = async (req, res, next) => {
  try {
    const affiliate = await Affiliate.findOne({ user: req.user.id });

    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate profile not found', null);
    }

    // Update profile
    if (req.body.profile) {
      affiliate.profile = { ...affiliate.profile, ...req.body.profile };
    }

    // Update payment info
    if (req.body.paymentInfo) {
      affiliate.paymentInfo = { ...affiliate.paymentInfo, ...req.body.paymentInfo };
    }

    await affiliate.save();

    return sendResponse(res, 200, 'Affiliate profile updated successfully', affiliate);
  } catch (error) {
    next(error);
  }
};

// Apply to store (affiliate applies to join a store's program)
exports.applyToStore = async (req, res, next) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findById(storeId);

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Get or create affiliate profile
    let affiliate = await Affiliate.findOne({ user: req.user.id });

    if (!affiliate) {
      affiliate = new Affiliate({ user: req.user.id });
      await affiliate.save();
    }

    // Check if already applied
    const existingApplication = affiliate.stores.find(
      s => s.store.toString() === storeId
    );

    if (existingApplication) {
      return sendResponse(res, 400, 'Already applied to this store', null);
    }

    // Add store application
    affiliate.stores.push({
      store: storeId,
      status: 'pending'
    });

    await affiliate.save();

    return sendResponse(res, 200, 'Application submitted successfully', affiliate);
  } catch (error) {
    next(error);
  }
};

// Approve affiliate for store (merchant action)
exports.approveAffiliate = async (req, res, next) => {
  try {
    const { affiliateId, storeId } = req.params;

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Get affiliate
    const affiliate = await Affiliate.findById(affiliateId);

    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate not found', null);
    }

    // Approve affiliate for store
    await affiliate.approveForStore(storeId, req.user.id);

    // Update store stats
    store.stats.totalAffiliates += 1;
    await store.save();

    return sendResponse(res, 200, 'Affiliate approved successfully', affiliate);
  } catch (error) {
    next(error);
  }
};

// Reject affiliate for store (merchant action)
exports.rejectAffiliate = async (req, res, next) => {
  try {
    const { affiliateId, storeId } = req.params;

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Get affiliate
    const affiliate = await Affiliate.findById(affiliateId);

    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate not found', null);
    }

    // Reject affiliate for store
    await affiliate.rejectForStore(storeId);

    return sendResponse(res, 200, 'Affiliate rejected successfully', affiliate);
  } catch (error) {
    next(error);
  }
};

// Suspend affiliate for store (merchant action)
exports.suspendAffiliate = async (req, res, next) => {
  try {
    const { affiliateId, storeId } = req.params;

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Get affiliate
    const affiliate = await Affiliate.findById(affiliateId);

    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate not found', null);
    }

    // Update store status
    const storeIndex = affiliate.stores.findIndex(
      s => s.store.toString() === storeId
    );

    if (storeIndex !== -1) {
      affiliate.stores[storeIndex].status = 'suspended';
      await affiliate.save();
    }

    return sendResponse(res, 200, 'Affiliate suspended successfully', affiliate);
  } catch (error) {
    next(error);
  }
};

// Get affiliate statistics
// Add tags to affiliate
exports.addTagsToAffiliate = async (req, res, next) => {
  try {
    const { affiliateId } = req.params;
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return sendResponse(res, 400, 'Tags array is required', null);
    }

    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate not found', null);
    }

    const normalizedTags = tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
    normalizedTags.forEach(tag => {
      if (!affiliate.tags.includes(tag)) {
        affiliate.tags.push(tag);
      }
    });

    await affiliate.save();
    return sendResponse(res, 200, 'Tags added successfully', affiliate);
  } catch (error) {
    next(error);
  }
};

// Remove tags from affiliate
exports.removeTagsFromAffiliate = async (req, res, next) => {
  try {
    const { affiliateId } = req.params;
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return sendResponse(res, 400, 'Tags array is required', null);
    }

    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate not found', null);
    }

    const normalizedTags = tags.map(tag => tag.trim().toLowerCase());
    affiliate.tags = affiliate.tags.filter(tag => !normalizedTags.includes(tag));
    await affiliate.save();

    return sendResponse(res, 200, 'Tags removed successfully', affiliate);
  } catch (error) {
    next(error);
  }
};

// Get all unique tags for a store's affiliates
exports.getStoreAffiliateTags = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const store = await Store.findOne({ _id: storeId, merchant: req.user.id });
    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    const affiliates = await Affiliate.find({ 'stores.store': storeId }).select('tags');
    const allTags = affiliates.reduce((acc, affiliate) => {
      affiliate.tags.forEach(tag => {
        if (!acc.includes(tag)) acc.push(tag);
      });
      return acc;
    }, []);

    return sendResponse(res, 200, 'Tags retrieved successfully', { tags: allTags.sort() });
  } catch (error) {
    next(error);
  }
};

exports.getAffiliateStats = async (req, res, next) => {
  try {
    const { affiliateId, storeId } = req.params;

    const affiliate = await Affiliate.findById(affiliateId);

    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate not found', null);
    }

    // Get stats from related collections
    const Click = require('../models/click');
    const Order = require('../models/order');
    const Commission = require('../models/commission');

    const query = {
      affiliate: affiliateId
    };

    if (storeId) {
      query.store = storeId;
    }

    const [
      totalClicks,
      totalOrders,
      totalCommissions,
      totalEarnings
    ] = await Promise.all([
      Click.countDocuments(query),
      Order.countDocuments(query),
      Commission.countDocuments({ ...query, status: { $in: ['approved', 'paid'] } }),
      Commission.aggregate([
        { $match: { ...query, status: { $in: ['approved', 'paid'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    const stats = storeId 
      ? affiliate.stores.find(s => s.store.toString() === storeId)?.stats || {}
      : affiliate.stats.toObject();

    const result = {
      ...stats,
      totalClicks: totalClicks || stats.totalClicks || 0,
      totalOrders: totalOrders || stats.totalOrders || 0,
      totalCommissions: totalCommissions || 0,
      totalEarnings: totalEarnings[0]?.total || stats.totalEarnings || 0
    };

    return sendResponse(res, 200, 'Affiliate statistics retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

// Get store affiliate summary statistics
exports.getStoreAffiliateSummary = async (req, res, next) => {
  try {
    const { storeId } = req.params;

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Get all affiliates for this store
    const affiliates = await Affiliate.find({
      'stores.store': storeId
    }).populate('user', 'username email');

    // Calculate summary statistics
    const summary = {
      total: affiliates.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      suspended: 0,
      totalClicks: 0,
      totalOrders: 0,
      totalCommissions: 0,
      averageConversionRate: 0
    };

    let totalClicksForConversion = 0;

    affiliates.forEach(affiliate => {
      const storeApplication = affiliate.stores.find(s => s.store.toString() === storeId);
      const status = storeApplication?.status || 'pending';
      const stats = storeApplication?.stats || {};

      // Count by status
      if (status === 'pending') summary.pending++;
      else if (status === 'approved') summary.approved++;
      else if (status === 'rejected') summary.rejected++;
      else if (status === 'suspended') summary.suspended++;

      // Aggregate stats
      summary.totalClicks += stats.clicks || 0;
      summary.totalOrders += stats.orders || 0;
      summary.totalCommissions += stats.commissions || 0;
      totalClicksForConversion += stats.clicks || 0;
    });

    // Calculate average conversion rate
    if (totalClicksForConversion > 0) {
      summary.averageConversionRate = ((summary.totalOrders / totalClicksForConversion) * 100).toFixed(2);
    }

    return sendResponse(res, 200, 'Summary statistics retrieved successfully', summary);
  } catch (error) {
    next(error);
  }
};

// Get all merchant affiliates summary (across all stores)
exports.getMerchantAffiliateSummary = async (req, res, next) => {
  try {
    const { storeId } = req.query;

    // Get all stores owned by merchant
    const merchantStores = await Store.find({ merchant: req.user.id }).select('_id name');
    const storeIds = merchantStores.map(s => s._id);

    if (storeIds.length === 0) {
      return sendResponse(res, 200, 'Summary statistics retrieved successfully', {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        suspended: 0,
        totalClicks: 0,
        totalOrders: 0,
        totalCommissions: 0,
        averageConversionRate: 0
      });
    }

    // Build query
    const query = {
      'stores.store': { $in: storeIds }
    };

    if (storeId) {
      query['stores.store'] = storeId;
    }

    // Get all affiliates
    const affiliates = await Affiliate.find(query).populate('user', 'username email');

    // Calculate summary statistics
    const summary = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      suspended: 0,
      totalClicks: 0,
      totalOrders: 0,
      totalCommissions: 0,
      averageConversionRate: 0
    };

    const uniqueAffiliates = new Set();
    let totalClicksForConversion = 0;

    affiliates.forEach(affiliate => {
      // Count unique affiliates
      uniqueAffiliates.add(affiliate._id.toString());

      // Aggregate stats across all merchant stores
      affiliate.stores.forEach(storeApp => {
        const storeIdStr = storeApp.store._id ? storeApp.store._id.toString() : storeApp.store.toString();
        if (storeIds.includes(storeIdStr) || (storeId && storeIdStr === storeId)) {
          const status = storeApp.status || 'pending';
          const stats = storeApp.stats || {};

          // Count by status (count each store application)
          if (status === 'pending') summary.pending++;
          else if (status === 'approved') summary.approved++;
          else if (status === 'rejected') summary.rejected++;
          else if (status === 'suspended') summary.suspended++;

          // Aggregate stats
          summary.totalClicks += stats.clicks || 0;
          summary.totalOrders += stats.orders || 0;
          summary.totalCommissions += stats.commissions || 0;
          totalClicksForConversion += stats.clicks || 0;
        }
      });
    });

    summary.total = uniqueAffiliates.size;

    // Calculate average conversion rate
    if (totalClicksForConversion > 0) {
      summary.averageConversionRate = ((summary.totalOrders / totalClicksForConversion) * 100).toFixed(2);
    }

    return sendResponse(res, 200, 'Summary statistics retrieved successfully', summary);
  } catch (error) {
    next(error);
  }
};

// Activate/Reactivate affiliate for store
exports.activateAffiliate = async (req, res, next) => {
  try {
    const { affiliateId, storeId } = req.params;

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Get affiliate
    const affiliate = await Affiliate.findById(affiliateId);

    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate not found', null);
    }

    // Update store status to approved
    const storeIndex = affiliate.stores.findIndex(
      s => s.store.toString() === storeId
    );

    if (storeIndex !== -1) {
      affiliate.stores[storeIndex].status = 'approved';
      affiliate.stores[storeIndex].approvedAt = new Date();
      affiliate.stores[storeIndex].approvedBy = req.user.id;
      await affiliate.save();
    } else {
      return sendResponse(res, 404, 'Affiliate not associated with this store', null);
    }

    return sendResponse(res, 200, 'Affiliate activated successfully', affiliate);
  } catch (error) {
    next(error);
  }
};

// Terminate affiliate for store
exports.terminateAffiliate = async (req, res, next) => {
  try {
    const { affiliateId, storeId } = req.params;

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Get affiliate
    const affiliate = await Affiliate.findById(affiliateId);

    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate not found', null);
    }

    // Remove store from affiliate's stores array (terminate relationship)
    affiliate.stores = affiliate.stores.filter(
      s => s.store.toString() !== storeId
    );

    await affiliate.save();

    return sendResponse(res, 200, 'Affiliate terminated successfully', affiliate);
  } catch (error) {
    next(error);
  }
};

// Bulk actions for affiliates
exports.bulkUpdateAffiliates = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { affiliateIds, action, tags, commissionRate } = req.body;

    if (!Array.isArray(affiliateIds) || affiliateIds.length === 0) {
      return sendResponse(res, 400, 'affiliateIds array is required', null);
    }

    if (!action) {
      return sendResponse(res, 400, 'action is required', null);
    }

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    const results = {
      success: [],
      failed: []
    };

    for (const affiliateId of affiliateIds) {
      try {
        const affiliate = await Affiliate.findById(affiliateId);
        if (!affiliate) {
          results.failed.push({ affiliateId, reason: 'Affiliate not found' });
          continue;
        }

        const storeIndex = affiliate.stores.findIndex(
          s => s.store.toString() === storeId
        );

        if (storeIndex === -1) {
          results.failed.push({ affiliateId, reason: 'Affiliate not associated with this store' });
          continue;
        }

        // Perform action
        switch (action) {
          case 'approve':
            affiliate.stores[storeIndex].status = 'approved';
            affiliate.stores[storeIndex].approvedAt = new Date();
            affiliate.stores[storeIndex].approvedBy = req.user.id;
            break;
          case 'reject':
            affiliate.stores[storeIndex].status = 'rejected';
            break;
          case 'suspend':
            affiliate.stores[storeIndex].status = 'suspended';
            break;
          case 'activate':
            affiliate.stores[storeIndex].status = 'approved';
            affiliate.stores[storeIndex].approvedAt = new Date();
            affiliate.stores[storeIndex].approvedBy = req.user.id;
            break;
          case 'terminate':
            affiliate.stores.splice(storeIndex, 1);
            await affiliate.save();
            results.success.push(affiliateId);
            continue;
          case 'addTags':
            if (tags && Array.isArray(tags)) {
              const normalizedTags = tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
              normalizedTags.forEach(tag => {
                if (!affiliate.tags.includes(tag)) {
                  affiliate.tags.push(tag);
                }
              });
            }
            break;
          case 'updateCommissionRate':
            if (commissionRate !== undefined) {
              affiliate.stores[storeIndex].commissionRate = parseFloat(commissionRate);
            }
            break;
          default:
            results.failed.push({ affiliateId, reason: 'Invalid action' });
            continue;
        }

        await affiliate.save();
        results.success.push(affiliateId);
      } catch (error) {
        results.failed.push({ affiliateId, reason: error.message });
      }
    }

    return sendResponse(res, 200, 'Bulk update completed', results);
  } catch (error) {
    next(error);
  }
};

// Update commission rate for affiliate
exports.updateAffiliateCommissionRate = async (req, res, next) => {
  try {
    const { affiliateId, storeId } = req.params;
    const { commissionRate } = req.body;

    if (commissionRate === undefined) {
      return sendResponse(res, 400, 'commissionRate is required', null);
    }

    if (commissionRate < 0 || commissionRate > 100) {
      return sendResponse(res, 400, 'commissionRate must be between 0 and 100', null);
    }

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Get affiliate
    const affiliate = await Affiliate.findById(affiliateId);

    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate not found', null);
    }

    // Update commission rate
    const storeIndex = affiliate.stores.findIndex(
      s => s.store.toString() === storeId
    );

    if (storeIndex !== -1) {
      affiliate.stores[storeIndex].commissionRate = parseFloat(commissionRate);
      await affiliate.save();
    } else {
      return sendResponse(res, 404, 'Affiliate not associated with this store', null);
    }

    return sendResponse(res, 200, 'Commission rate updated successfully', affiliate);
  } catch (error) {
    next(error);
  }
};

// Export affiliates to CSV/Excel
exports.exportStoreAffiliates = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { format = 'csv' } = req.query;

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Get all affiliates (no pagination for export)
    const affiliates = await Affiliate.find({
      'stores.store': storeId
    })
      .populate('user', 'username email')
      .select('-paymentInfo')
      .sort({ createdAt: -1 });

    // Format data for export
    const exportData = affiliates.map(affiliate => {
      const storeApplication = affiliate.stores.find(s => s.store.toString() === storeId);
      const stats = storeApplication?.stats || {};
      
      return {
        'Affiliate Name': affiliate.user?.username || 'N/A',
        'Email': affiliate.user?.email || 'N/A',
        'Referral Code': affiliate.referralCode,
        'Status': storeApplication?.status || 'pending',
        'Date Joined': affiliate.createdAt.toISOString().split('T')[0],
        'Clicks': stats.clicks || 0,
        'Orders': stats.orders || 0,
        'Commissions': stats.commissions || 0,
        'Commission Rate': storeApplication?.commissionRate || 'Default',
        'Tags': affiliate.tags.join(', ')
      };
    });

    if (format === 'csv') {
      // Convert to CSV
      const csvHeader = Object.keys(exportData[0] || {}).join(',');
      const csvRows = exportData.map(row => 
        Object.values(row).map(val => `"${val}"`).join(',')
      );
      const csv = [csvHeader, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=affiliates_${storeId}_${Date.now()}.csv`);
      return res.send(csv);
    } else {
      // JSON format
      return sendResponse(res, 200, 'Affiliates exported successfully', exportData);
    }
  } catch (error) {
    next(error);
  }
};

