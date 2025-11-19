const Asset = require('../models/asset');
const AssetUsage = require('../models/AssetUsage');
const Click = require('../models/click');
const Order = require('../models/order');
const { sendResponse } = require('../utils/response');
const cloudinary = require('cloudinary').v2;

// Get all assets for authenticated merchant
exports.getAssets = async (req, res, next) => {
  try {
    const { type, program, store, isActive } = req.query;
    const query = { merchant: req.user.id };
    
    if (type) query.type = type;
    if (program) query.program = program;
    if (store) query.store = store;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const assets = await Asset.find(query)
      .populate('program', 'name')
      .populate('store', 'name domain')
      .sort({ createdAt: -1 });
    
    return sendResponse(res, 200, 'Assets retrieved successfully', assets);
  } catch (error) {
    next(error);
  }
};

// Get single asset by ID
exports.getAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({
      _id: req.params.id,
      merchant: req.user.id
    })
      .populate('program', 'name')
      .populate('store', 'name domain');

    if (!asset) {
      return sendResponse(res, 404, 'Asset not found', null);
    }

    return sendResponse(res, 200, 'Asset retrieved successfully', asset);
  } catch (error) {
    next(error);
  }
};

// Create new asset
exports.createAsset = async (req, res, next) => {
  try {
    const { name, description, type, url, thumbnail, size, category, tags, program, store } = req.body;

    const asset = new Asset({
      merchant: req.user.id,
      program: program || null,
      store: store || null,
      name,
      description,
      type,
      url,
      thumbnail,
      size,
      category,
      tags: tags || []
    });

    await asset.save();

    await asset.populate('program', 'name');
    await asset.populate('store', 'name domain');

    return sendResponse(res, 201, 'Asset created successfully', asset);
  } catch (error) {
    next(error);
  }
};

// Upload asset file
exports.uploadAsset = async (req, res, next) => {
  try {
    if (!req.files || !req.files.file) {
      return sendResponse(res, 400, 'No file uploaded', null);
    }

    const file = req.files.file;
    const { type, name, description, program, store } = req.body;

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: `affiliate-network/assets/${req.user.id}`,
      resource_type: 'auto'
    });

    // Get image dimensions if it's an image
    let size = null;
    if (uploadResult.resource_type === 'image') {
      size = {
        width: uploadResult.width,
        height: uploadResult.height
      }
    }

    const asset = new Asset({
      merchant: req.user.id,
      program: program || null,
      store: store || null,
      name: name || file.name,
      description: description || '',
      type: type || 'image',
      url: uploadResult.secure_url,
      thumbnail: uploadResult.secure_url,
      size
    });

    await asset.save();

    await asset.populate('program', 'name');
    await asset.populate('store', 'name domain');

    return sendResponse(res, 201, 'Asset uploaded successfully', asset);
  } catch (error) {
    next(error);
  }
};

// Update asset
exports.updateAsset = async (req, res, next) => {
  try {
    const { name, description, isActive, category, tags } = req.body;

    const asset = await Asset.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!asset) {
      return sendResponse(res, 404, 'Asset not found', null);
    }

    if (name) asset.name = name;
    if (description !== undefined) asset.description = description;
    if (isActive !== undefined) asset.isActive = isActive;
    if (category !== undefined) asset.category = category;
    if (tags) asset.tags = tags;

    await asset.save();

    await asset.populate('program', 'name');
    await asset.populate('store', 'name domain');

    return sendResponse(res, 200, 'Asset updated successfully', asset);
  } catch (error) {
    next(error);
  }
};

// Delete asset
exports.deleteAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!asset) {
      return sendResponse(res, 404, 'Asset not found', null);
    }

    // Delete from Cloudinary if it's a Cloudinary URL
    if (asset.url.includes('cloudinary.com')) {
      try {
        const publicId = asset.url.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`affiliate-network/assets/${req.user.id}/${publicId}`);
      } catch (cloudinaryError) {
        console.error('Error deleting from Cloudinary:', cloudinaryError);
      }
    }

    await Asset.deleteOne({ _id: req.params.id });

    return sendResponse(res, 200, 'Asset deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

// ============ AFFILIATE ROUTES ============

const Affiliate = require('../models/affiliate');

// Get all assets available to affiliate (based on their approved stores/programs)
exports.getAffiliateAssets = async (req, res, next) => {
  try {
    // Ensure user has affiliate role (should be checked by middleware, but double-check)
    if (req.user.role !== 'affiliate' && req.user.role !== 'admin' && req.user.role !== 'advertiser') {
      return sendResponse(res, 403, 'Access denied. Affiliate role required.', null);
    }
    
    const { type, program, store } = req.query;
    
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
      return sendResponse(res, 200, 'No assets available', []);
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
      return sendResponse(res, 200, 'No assets available', []);
    }

    // Build query - assets for approved stores or programs
    const query = {
      $or: [
        { store: { $in: approvedStoreIds } },
        { program: { $in: approvedProgramIds } },
        { program: null, store: { $in: approvedStoreIds } } // Assets not tied to specific program but for approved stores
      ],
      isActive: true
    };

    if (type) query.type = type;
    if (program) query.program = program;
    if (store) query.store = store;

    const assets = await Asset.find(query)
      .populate('program', 'name')
      .populate('store', 'name domain')
      .populate('merchant', 'username email')
      .sort({ createdAt: -1 });
    
    return sendResponse(res, 200, 'Assets retrieved successfully', assets);
  } catch (error) {
    next(error);
  }
};

// Get assets for a specific program
exports.getProgramAssets = async (req, res, next) => {
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
      return sendResponse(res, 200, 'No assets available', []);
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
      $or: [
        { program: programId },
        { program: null, store: program.store }
      ],
      isActive: true
    };

    if (type) query.type = type;

    const assets = await Asset.find(query)
      .populate('program', 'name')
      .populate('store', 'name domain')
      .populate('merchant', 'username email')
      .sort({ createdAt: -1 });
    
    return sendResponse(res, 200, 'Assets retrieved successfully', assets);
  } catch (error) {
    next(error);
  }
};

// Get single asset (if affiliate has access)
exports.getAffiliateAsset = async (req, res, next) => {
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
      return sendResponse(res, 200, 'No assets available', []);
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

    const asset = await Asset.findOne({
      _id: id,
      $or: [
        { store: { $in: approvedStoreIds } },
        { program: { $in: approvedProgramIds } },
        { program: null, store: { $in: approvedStoreIds } }
      ],
      isActive: true
    })
      .populate('program', 'name')
      .populate('store', 'name domain')
      .populate('merchant', 'username email');

    if (!asset) {
      return sendResponse(res, 404, 'Asset not found or access denied', null);
    }

    return sendResponse(res, 200, 'Asset retrieved successfully', asset);
  } catch (error) {
    next(error);
  }
};

// Track asset download
exports.trackAssetDownload = async (req, res, next) => {
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

    const asset = await Asset.findOne({
      _id: id,
      $or: [
        { store: { $in: approvedStoreIds } },
        { program: { $in: approvedProgramIds } },
        { program: null, store: { $in: approvedStoreIds } }
      ],
      isActive: true
    });

    if (!asset) {
      return sendResponse(res, 404, 'Asset not found or access denied', null);
    }

    // Track download
    asset.stats.downloads = (asset.stats.downloads || 0) + 1;
    asset.stats.lastUsed = new Date();
    asset.usageCount = (asset.usageCount || 0) + 1;
    await asset.save();

    // Create usage record
    const assetUsage = new AssetUsage({
      asset: asset._id,
      affiliate: affiliate._id,
      store: asset.store || approvedStoreIds[0],
      action: 'download',
      referer: req.headers.referer,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });
    await assetUsage.save();

    return sendResponse(res, 200, 'Download tracked successfully', { assetId: asset._id });
  } catch (error) {
    next(error);
  }
};

// Get asset performance analytics
exports.getAssetPerformance = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { assetId, startDate, endDate } = req.query;

    // Verify store belongs to merchant
    const Store = require('../models/store');
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Build query
    const query = { store: storeId };
    if (assetId) query.asset = assetId;

    // Date range filter
    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
    }

    // Get asset usage stats
    const usageStats = await AssetUsage.aggregate([
      { $match: { ...query, ...dateQuery } },
      {
        $group: {
          _id: '$asset',
          views: { $sum: { $cond: [{ $eq: ['$action', 'view'] }, 1, 0] } },
          downloads: { $sum: { $cond: [{ $eq: ['$action', 'download'] }, 1, 0] } },
          clicks: { $sum: { $cond: [{ $eq: ['$action', 'click'] }, 1, 0] } },
          conversions: { $sum: { $cond: [{ $eq: ['$action', 'conversion'] }, 1, 0] } },
          uniqueAffiliates: { $addToSet: '$affiliate' },
          lastUsed: { $max: '$createdAt' }
        }
      },
      {
        $project: {
          _id: 1,
          views: 1,
          downloads: 1,
          clicks: 1,
          conversions: 1,
          uniqueAffiliates: { $size: '$uniqueAffiliates' },
          lastUsed: 1,
          conversionRate: {
            $cond: [
              { $gt: ['$clicks', 0] },
              { $multiply: [{ $divide: ['$conversions', '$clicks'] }, 100] },
              0
            ]
          }
        }
      }
    ]);

    // Get asset details
    const assetIds = usageStats.map(s => s._id);
    const assets = await Asset.find({
      _id: { $in: assetIds },
      merchant: req.user.id
    }).select('name type url thumbnail');

    // Combine asset data with stats
    const performanceData = usageStats.map(stat => {
      const asset = assets.find(a => a._id.toString() === stat._id.toString());
      return {
        asset: asset || { _id: stat._id },
        stats: {
          views: stat.views,
          downloads: stat.downloads,
          clicks: stat.clicks,
          conversions: stat.conversions,
          uniqueAffiliates: stat.uniqueAffiliates,
          conversionRate: stat.conversionRate.toFixed(2),
          lastUsed: stat.lastUsed
        }
      };
    });

    // If specific asset requested, return single asset
    if (assetId) {
      return sendResponse(res, 200, 'Asset performance retrieved successfully', performanceData[0] || null);
    }

    return sendResponse(res, 200, 'Asset performance retrieved successfully', {
      assets: performanceData,
      summary: {
        totalAssets: performanceData.length,
        totalViews: performanceData.reduce((sum, a) => sum + a.stats.views, 0),
        totalDownloads: performanceData.reduce((sum, a) => sum + a.stats.downloads, 0),
        totalClicks: performanceData.reduce((sum, a) => sum + a.stats.clicks, 0),
        totalConversions: performanceData.reduce((sum, a) => sum + a.stats.conversions, 0)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get asset usage timeline
exports.getAssetUsageTimeline = async (req, res, next) => {
  try {
    const { assetId } = req.params;
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Verify asset belongs to merchant
    const asset = await Asset.findOne({
      _id: assetId,
      merchant: req.user.id
    });

    if (!asset) {
      return sendResponse(res, 404, 'Asset not found', null);
    }

    // Build date query
    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
    }

    // Group by day/week/month
    let dateFormat = '%Y-%m-%d';
    if (groupBy === 'week') dateFormat = '%Y-%W';
    if (groupBy === 'month') dateFormat = '%Y-%m';

    const timeline = await AssetUsage.aggregate([
      { $match: { asset: asset._id, ...dateQuery } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: dateFormat, date: '$createdAt' } },
            action: '$action'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    return sendResponse(res, 200, 'Asset usage timeline retrieved successfully', timeline);
  } catch (error) {
    next(error);
  }
};

