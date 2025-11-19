const Affiliate = require('../models/affiliate');
const Store = require('../models/store');
const { sendResponse } = require('../utils/response');

// Get all discoverable affiliates (excluding those already in merchant's stores)
exports.discoverAffiliates = async (req, res, next) => {
  try {
    const {
      search,
      categories,
      minMonthlyVisitors,
      maxMonthlyVisitors,
      minConversionRate,
      maxConversionRate,
      minTotalClicks,
      maxTotalClicks,
      minTotalOrders,
      maxTotalOrders,
      verified,
      countries,
      platforms,
      discoverable = true,
      sortBy = 'relevance',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
      excludeStoreId
    } = req.query;

    // Get merchant's stores to exclude their affiliates
    const merchantStores = await Store.find({ merchant: req.user.id }).select('_id');
    const storeIds = merchantStores.map(s => s._id.toString());

    // Build query
    const query = {
      'discovery.discoverable': discoverable === 'true' || discoverable === true,
      'discovery.contactPreferences.allowInvitations': true
    };

    // Exclude affiliates already in merchant's stores
    if (storeIds.length > 0) {
      query['stores.store'] = { $nin: storeIds };
    }

    // Exclude specific store if provided
    if (excludeStoreId) {
      query['stores.store'] = { 
        $nin: [...storeIds, excludeStoreId] 
      };
    }

    // Search query
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$or = [
        { referralCode: searchRegex },
        { 'user.username': searchRegex },
        { 'user.email': searchRegex },
        { 'profile.bio': searchRegex },
        { 'profile.niche': searchRegex },
        { 'discovery.websiteInfo.url': searchRegex },
        { 'discovery.websiteInfo.domain': searchRegex },
        { 'discovery.websiteInfo.description': searchRegex }
      ];
    }

    // Category filter
    if (categories) {
      const categoryArray = Array.isArray(categories) ? categories : [categories];
      query['discovery.categories'] = { $in: categoryArray };
    }

    // Verification filter
    if (verified === 'true' || verified === true) {
      query['verification.verified'] = true;
    }

    // Traffic metrics filters
    if (minMonthlyVisitors || maxMonthlyVisitors) {
      query['discovery.trafficMetrics.monthlyVisitors'] = {};
      if (minMonthlyVisitors) {
        query['discovery.trafficMetrics.monthlyVisitors'].$gte = parseInt(minMonthlyVisitors);
      }
      if (maxMonthlyVisitors) {
        query['discovery.trafficMetrics.monthlyVisitors'].$lte = parseInt(maxMonthlyVisitors);
      }
    }

    // Conversion rate filter (calculate from network stats)
    // This will be handled in post-processing

    // Total clicks filter
    if (minTotalClicks || maxTotalClicks) {
      query['stats.totalClicks'] = {};
      if (minTotalClicks) {
        query['stats.totalClicks'].$gte = parseInt(minTotalClicks);
      }
      if (maxTotalClicks) {
        query['stats.totalClicks'].$lte = parseInt(maxTotalClicks);
      }
    }

    // Total orders filter
    if (minTotalOrders || maxTotalOrders) {
      query['stats.totalOrders'] = {};
      if (minTotalOrders) {
        query['stats.totalOrders'].$gte = parseInt(minTotalOrders);
      }
      if (maxTotalOrders) {
        query['stats.totalOrders'].$lte = parseInt(maxTotalOrders);
      }
    }

    // Country filter
    if (countries) {
      const countryArray = Array.isArray(countries) ? countries : [countries];
      query['discovery.trafficMetrics.topCountries.country'] = { $in: countryArray };
    }

    // Platform filter
    if (platforms) {
      const platformArray = Array.isArray(platforms) ? platforms : [platforms];
      query['discovery.websiteInfo.platform'] = { $in: platformArray };
    }

    // Build sort object
    const sortObj = {};
    if (sortBy === 'relevance' && search) {
      // For relevance, we'll use text search score
      // MongoDB text search will be handled separately
      sortObj.score = { $meta: 'textScore' };
    } else if (sortBy === 'performance') {
      sortObj['stats.totalClicks'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'name') {
      sortObj['user.username'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'joinDate') {
      sortObj.createdAt = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'quality') {
      sortObj['verification.qualityScore'] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortObj.createdAt = sortOrder === 'asc' ? 1 : -1;
    }

    // Execute query
    let affiliates = await Affiliate.find(query)
      .populate('user', 'username email profile')
      .select('-paymentInfo')
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Post-process: Filter by conversion rate if specified
    if (minConversionRate || maxConversionRate) {
      affiliates = affiliates.filter(affiliate => {
        const totalClicks = affiliate.stats?.totalClicks || 0;
        const totalOrders = affiliate.stats?.totalOrders || 0;
        const conversionRate = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0;
        
        if (minConversionRate && conversionRate < parseFloat(minConversionRate)) return false;
        if (maxConversionRate && conversionRate > parseFloat(maxConversionRate)) return false;
        return true;
      });
    }

    // Get total count (before conversion rate filtering for accurate pagination)
    const total = await Affiliate.countDocuments(query);

    return sendResponse(res, 200, 'Affiliates retrieved successfully', {
      affiliates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get detailed affiliate profile for discovery
exports.getAffiliateProfile = async (req, res, next) => {
  try {
    const { affiliateId } = req.params;

    // Get merchant's stores
    const merchantStores = await Store.find({ merchant: req.user.id }).select('_id');
    const storeIds = merchantStores.map(s => s._id.toString());

    const affiliate = await Affiliate.findById(affiliateId)
      .populate('user', 'username email profile')
      .select('-paymentInfo');

    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate not found', null);
    }

    // Check if affiliate is discoverable
    if (!affiliate.discovery?.discoverable) {
      return sendResponse(res, 403, 'Affiliate profile is not discoverable', null);
    }

    // Check if already in merchant's stores
    const isInMerchantStores = affiliate.stores.some(s => 
      storeIds.includes(s.store.toString())
    );

    return sendResponse(res, 200, 'Affiliate profile retrieved successfully', {
      affiliate,
      isInMerchantStores
    });
  } catch (error) {
    next(error);
  }
};

// Get search suggestions (autocomplete)
exports.getSearchSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return sendResponse(res, 200, 'Suggestions retrieved', []);
    }

    // Get merchant's stores to exclude
    const merchantStores = await Store.find({ merchant: req.user.id }).select('_id');
    const storeIds = merchantStores.map(s => s._id.toString());

    const query = {
      'discovery.discoverable': true,
      'discovery.contactPreferences.allowInvitations': true
    };

    if (storeIds.length > 0) {
      query['stores.store'] = { $nin: storeIds };
    }

    const searchRegex = { $regex: q, $options: 'i' };
    
    const affiliates = await Affiliate.find({
      ...query,
      $or: [
        { 'user.username': searchRegex },
        { 'profile.niche': searchRegex },
        { 'discovery.websiteInfo.domain': searchRegex }
      ]
    })
      .populate('user', 'username')
      .select('user profile discovery')
      .limit(10);

    const suggestions = affiliates.map(aff => ({
      id: aff._id,
      username: aff.user?.username,
      niche: aff.profile?.niche,
      domain: aff.discovery?.websiteInfo?.domain,
      categories: aff.discovery?.categories || []
    }));

    return sendResponse(res, 200, 'Suggestions retrieved successfully', suggestions);
  } catch (error) {
    next(error);
  }
};

// Get all available categories with counts
exports.getCategories = async (req, res, next) => {
  try {
    // Get merchant's stores to exclude
    const merchantStores = await Store.find({ merchant: req.user.id }).select('_id');
    const storeIds = merchantStores.map(s => s._id.toString());

    const query = {
      'discovery.discoverable': true,
      'discovery.contactPreferences.allowInvitations': true
    };

    if (storeIds.length > 0) {
      query['stores.store'] = { $nin: storeIds };
    }

    // Aggregate to get category counts
    const categoryCounts = await Affiliate.aggregate([
      { $match: query },
      { $unwind: '$discovery.categories' },
      {
        $group: {
          _id: '$discovery.categories',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const categories = categoryCounts.map(item => ({
      name: item._id,
      count: item.count
    }));

    return sendResponse(res, 200, 'Categories retrieved successfully', categories);
  } catch (error) {
    next(error);
  }
};

// Get discovery statistics
exports.getDiscoveryStats = async (req, res, next) => {
  try {
    // Get merchant's stores to exclude
    const merchantStores = await Store.find({ merchant: req.user.id }).select('_id');
    const storeIds = merchantStores.map(s => s._id.toString());

    const query = {
      'discovery.discoverable': true,
      'discovery.contactPreferences.allowInvitations': true
    };

    if (storeIds.length > 0) {
      query['stores.store'] = { $nin: storeIds };
    }

    const totalAffiliates = await Affiliate.countDocuments(query);
    const verifiedAffiliates = await Affiliate.countDocuments({
      ...query,
      'verification.verified': true
    });

    // Get category count
    const categoryCount = await Affiliate.distinct('discovery.categories', query).then(cats => cats.length);

    // Get average stats
    const avgStats = await Affiliate.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          avgClicks: { $avg: '$stats.totalClicks' },
          avgOrders: { $avg: '$stats.totalOrders' },
          avgQualityScore: { $avg: '$verification.qualityScore' }
        }
      }
    ]);

    return sendResponse(res, 200, 'Discovery statistics retrieved successfully', {
      totalAffiliates,
      verifiedAffiliates,
      categoryCount,
      averageStats: avgStats[0] || {
        avgClicks: 0,
        avgOrders: 0,
        avgQualityScore: 50
      }
    });
  } catch (error) {
    next(error);
  }
};

// Compare multiple affiliates
exports.compareAffiliates = async (req, res, next) => {
  try {
    const { affiliateIds } = req.body;

    if (!affiliateIds || !Array.isArray(affiliateIds) || affiliateIds.length === 0) {
      return sendResponse(res, 400, 'Please provide affiliate IDs to compare', null);
    }

    if (affiliateIds.length > 10) {
      return sendResponse(res, 400, 'Cannot compare more than 10 affiliates at once', null);
    }

    const affiliates = await Affiliate.find({
      _id: { $in: affiliateIds }
    })
      .populate('user', 'username email')
      .select('-paymentInfo');

    const comparison = affiliates.map(aff => ({
      id: aff._id,
      username: aff.user?.username,
      email: aff.user?.email,
      categories: aff.discovery?.categories || [],
      stats: {
        totalClicks: aff.stats?.totalClicks || 0,
        totalOrders: aff.stats?.totalOrders || 0,
        conversionRate: aff.stats?.totalClicks > 0 
          ? ((aff.stats.totalOrders / aff.stats.totalClicks) * 100).toFixed(2)
          : 0
      },
      trafficMetrics: aff.discovery?.trafficMetrics || {},
      engagementMetrics: aff.discovery?.engagementMetrics || {},
      qualityScore: aff.verification?.qualityScore || 50,
      verified: aff.verification?.verified || false,
      badges: aff.verification?.badges || []
    }));

    return sendResponse(res, 200, 'Comparison data retrieved successfully', comparison);
  } catch (error) {
    next(error);
  }
};

