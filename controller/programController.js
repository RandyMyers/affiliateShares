const AffiliateProgram = require('../models/affiliateProgram');
const Affiliate = require('../models/affiliate');
const { sendResponse } = require('../utils/response');

// Get all affiliate programs for the authenticated merchant
exports.getPrograms = async (req, res, next) => {
  try {
    const programs = await AffiliateProgram.find({ merchant: req.user.id })
      .populate('store', 'name domain')
      .sort({ createdAt: -1 });
    return sendResponse(res, 200, 'Affiliate programs retrieved successfully', programs);
  } catch (error) {
    next(error);
  }
};

// Get public programs (for affiliates to browse)
exports.getPublicPrograms = async (req, res, next) => {
  try {
    const { 
      search, 
      category, 
      commissionType, 
      sort = 'newest',
      minCommission,
      maxCommission,
      cookieDuration,
      minPayout
    } = req.query;
    
    const query = { status: 'active' };
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Note: Category filter will be applied after populating store

    // Commission type filter
    if (commissionType && commissionType !== 'all') {
      query['commissionStructure.type'] = commissionType;
    }

    // Commission rate range filter
    if (minCommission || maxCommission) {
      query['commissionStructure.rate'] = {};
      if (minCommission) {
        query['commissionStructure.rate'].$gte = parseFloat(minCommission);
      }
      if (maxCommission) {
        query['commissionStructure.rate'].$lte = parseFloat(maxCommission);
      }
    }

    // Cookie duration filter
    if (cookieDuration) {
      const durationMap = {
        'short': { $gte: 1, $lte: 7 },
        'medium': { $gte: 8, $lte: 30 },
        'long': { $gte: 31, $lte: 60 },
        'very-long': { $gte: 61 }
      };
      if (durationMap[cookieDuration]) {
        query['settings.cookieDuration'] = durationMap[cookieDuration];
      }
    }

    // Minimum payout filter
    if (minPayout) {
      query['settings.minimumPayout'] = { $lte: parseFloat(minPayout) };
    }

    // Build sort object
    let sortObj = {};
    switch (sort) {
      case 'highest-commission':
        sortObj = { 'commissionStructure.rate': -1 };
        break;
      case 'most-popular':
        sortObj = { 'stats.totalAffiliates': -1 };
        break;
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'alphabetical':
        sortObj = { name: 1 };
        break;
      case 'highest-revenue':
        sortObj = { 'stats.totalRevenue': -1 };
        break;
      case 'most-conversions':
        sortObj = { 'stats.totalConversions': -1 };
        break;
      case 'featured':
        sortObj = { isFeatured: -1, createdAt: -1 };
        break;
      default:
        sortObj = { createdAt: -1 };
    }

    const programs = await AffiliateProgram.find(query)
      .populate('store', 'name domain platform category')
      .populate('merchant', 'username')
      .select('-settings.allowSelfReferrals')
      .sort(sortObj)
      .limit(100);
    
    // Remove allowSelfReferrals from settings for public view
    programs.forEach(program => {
      if (program.settings && program.settings.allowSelfReferrals !== undefined) {
        delete program.settings.allowSelfReferrals;
      }
    });
    
    // Apply category filter after populating store
    let filteredPrograms = programs.filter(p => p.store);
    if (category && category !== 'all') {
      filteredPrograms = filteredPrograms.filter(p => p.store && p.store.category === category);
    }
    
    return sendResponse(res, 200, 'Public programs retrieved successfully', filteredPrograms);
  } catch (error) {
    next(error);
  }
};

// Get public program details (for affiliates)
exports.getPublicProgram = async (req, res, next) => {
  try {
    const program = await AffiliateProgram.findOne({
      _id: req.params.id,
      status: 'active'
    })
      .populate('store', 'name domain platform')
      .populate('merchant', 'username')
      .select('-settings');

    if (!program) {
      return sendResponse(res, 404, 'Program not found or not available', null);
    }

    // Check if affiliate has already applied
    let applicationStatus = null;
    if (req.user && req.user.role === 'affiliate') {
      const affiliate = await Affiliate.findOne({ user: req.user.id });
      if (affiliate) {
        const storeApplication = affiliate.stores.find(
          s => s.store.toString() === program.store._id.toString()
        );
        if (storeApplication) {
          applicationStatus = storeApplication.status;
        }
      }
    }

    return sendResponse(res, 200, 'Program retrieved successfully', {
      program,
      applicationStatus
    });
  } catch (error) {
    next(error);
  }
};

// Apply to program (affiliate action)
exports.applyToProgram = async (req, res, next) => {
  try {
    const { programId } = req.params;

    if (req.user.role !== 'affiliate') {
      return sendResponse(res, 403, 'Only affiliates can apply to programs', null);
    }

    const program = await AffiliateProgram.findOne({
      _id: programId,
      status: 'active'
    }).populate('store');

    if (!program) {
      return sendResponse(res, 404, 'Program not found or not available', null);
    }

    // Get or create affiliate profile
    let affiliate = await Affiliate.findOne({ user: req.user.id });

    if (!affiliate) {
      affiliate = new Affiliate({ user: req.user.id });
      await affiliate.save();
    }

    // Check if already applied
    const existingApplication = affiliate.stores.find(
      s => s.store.toString() === program.store._id.toString()
    );

    if (existingApplication) {
      return sendResponse(res, 400, 'Already applied to this program', null);
    }

    // Add store application
    affiliate.stores.push({
      store: program.store._id,
      status: program.settings.approvalWorkflow === 'auto' ? 'approved' : 'pending'
    });

    await affiliate.save();

    return sendResponse(res, 200, 'Application submitted successfully', {
      affiliate,
      status: program.settings.approvalWorkflow === 'auto' ? 'approved' : 'pending'
    });
  } catch (error) {
    next(error);
  }
};

// Get a single affiliate program by ID (merchant view)
exports.getProgram = async (req, res, next) => {
  try {
    const program = await AffiliateProgram.findOne({
      _id: req.params.id,
      merchant: req.user.id
    }).populate('store', 'name domain');

    if (!program) {
      return sendResponse(res, 404, 'Affiliate program not found', null);
    }
    return sendResponse(res, 200, 'Affiliate program retrieved successfully', program);
  } catch (error) {
    next(error);
  }
};

// Create a new affiliate program
exports.createProgram = async (req, res, next) => {
  try {
    const { name, description, store, commissionStructure, terms, settings } = req.body;

    const program = new AffiliateProgram({
      merchant: req.user.id,
      store,
      name,
      description,
      commissionStructure,
      terms,
      settings: settings || {}
    });

    await program.save();
    await program.populate('store', 'name domain');

    return sendResponse(res, 201, 'Affiliate program created successfully', program);
  } catch (error) {
    next(error);
  }
};

// Update an existing affiliate program
exports.updateProgram = async (req, res, next) => {
  try {
    const { name, description, commissionStructure, terms, status, settings } = req.body;

    const program = await AffiliateProgram.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!program) {
      return sendResponse(res, 404, 'Affiliate program not found', null);
    }

    if (name) program.name = name;
    if (description !== undefined) program.description = description;
    if (commissionStructure) program.commissionStructure = commissionStructure;
    if (terms !== undefined) program.terms = terms;
    if (status) program.status = status;
    if (settings) {
      program.settings = { ...program.settings, ...settings };
    }

    await program.save();
    await program.populate('store', 'name domain');

    return sendResponse(res, 200, 'Affiliate program updated successfully', program);
  } catch (error) {
    next(error);
  }
};

// Update program settings
exports.updateProgramSettings = async (req, res, next) => {
  try {
    const { cookieDuration, approvalWorkflow, allowSelfReferrals, minimumPayout } = req.body;

    const program = await AffiliateProgram.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!program) {
      return sendResponse(res, 404, 'Affiliate program not found', null);
    }

    if (cookieDuration !== undefined) program.settings.cookieDuration = cookieDuration;
    if (approvalWorkflow) program.settings.approvalWorkflow = approvalWorkflow;
    if (allowSelfReferrals !== undefined) program.settings.allowSelfReferrals = allowSelfReferrals;
    if (minimumPayout !== undefined) program.settings.minimumPayout = minimumPayout;

    await program.save();

    return sendResponse(res, 200, 'Program settings updated successfully', program);
  } catch (error) {
    next(error);
  }
};

// Update commission structure
exports.updateCommissionStructure = async (req, res, next) => {
  try {
    const { type, rate, tieredRates } = req.body;

    const program = await AffiliateProgram.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!program) {
      return sendResponse(res, 404, 'Affiliate program not found', null);
    }

    // Update commission structure
    program.commissionStructure = {
      type,
      rate,
      tieredRates: tieredRates || []
    };

    await program.save();
    await program.populate('store', 'name domain');

    return sendResponse(res, 200, 'Commission structure updated successfully', program);
  } catch (error) {
    next(error);
  }
};

// Get program statistics
exports.getProgramStats = async (req, res, next) => {
  try {
    const program = await AffiliateProgram.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!program) {
      return sendResponse(res, 404, 'Affiliate program not found', null);
    }

    return sendResponse(res, 200, 'Program statistics retrieved successfully', program.stats);
  } catch (error) {
    next(error);
  }
};

// Delete an affiliate program
exports.deleteProgram = async (req, res, next) => {
  try {
    const program = await AffiliateProgram.findOneAndDelete({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!program) {
      return sendResponse(res, 404, 'Affiliate program not found', null);
    }

    return sendResponse(res, 200, 'Affiliate program deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

// Get all affiliate applications for a specific program
exports.getProgramApplications = async (req, res, next) => {
  try {
    const { id: programId } = req.params;

    // Ensure the program belongs to the merchant
    const program = await AffiliateProgram.findOne({ _id: programId, merchant: req.user.id });
    if (!program) {
      return sendResponse(res, 404, 'Affiliate program not found', null);
    }

    // Get affiliates who applied to this program's store
    const affiliates = await Affiliate.find({
      'stores.store': program.store
    })
      .populate('user', 'username email profile.avatar')
      .select('-paymentInfo');

    const applications = affiliates.map(affiliate => {
      const storeApp = affiliate.stores.find(
        s => s.store.toString() === program.store.toString()
      );
      return {
        _id: affiliate._id,
        affiliate: {
          _id: affiliate._id,
          referralCode: affiliate.referralCode,
          user: affiliate.user
        },
        status: storeApp?.status || 'pending',
        appliedAt: storeApp?.createdAt || affiliate.createdAt,
        approvedAt: storeApp?.approvedAt
      };
    });

    return sendResponse(res, 200, 'Affiliate applications retrieved successfully', applications);
  } catch (error) {
    next(error);
  }
};

// Approve an affiliate application
exports.approveAffiliateApplication = async (req, res, next) => {
  try {
    const { id: programId, applicationId } = req.params;

    // Ensure the program belongs to the merchant
    const program = await AffiliateProgram.findOne({ _id: programId, merchant: req.user.id });
    if (!program) {
      return sendResponse(res, 404, 'Affiliate program not found', null);
    }

    const affiliate = await Affiliate.findById(applicationId);
    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate not found', null);
    }

    // Approve affiliate for the program's store
    const storeIndex = affiliate.stores.findIndex(
      s => s.store.toString() === program.store.toString()
    );

    if (storeIndex === -1) {
      return sendResponse(res, 404, 'Application not found', null);
    }

    affiliate.stores[storeIndex].status = 'approved';
    affiliate.stores[storeIndex].approvedAt = new Date();
    affiliate.stores[storeIndex].approvedBy = req.user.id;

    await affiliate.save();

    // Update program stats
    program.stats.totalAffiliates += 1;
    await program.save();

    return sendResponse(res, 200, 'Affiliate application approved successfully', affiliate);
  } catch (error) {
    next(error);
  }
};

// Reject an affiliate application
exports.rejectAffiliateApplication = async (req, res, next) => {
  try {
    const { id: programId, applicationId } = req.params;

    // Ensure the program belongs to the merchant
    const program = await AffiliateProgram.findOne({ _id: programId, merchant: req.user.id });
    if (!program) {
      return sendResponse(res, 404, 'Affiliate program not found', null);
    }

    const affiliate = await Affiliate.findById(applicationId);
    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate not found', null);
    }

    // Reject affiliate for the program's store
    const storeIndex = affiliate.stores.findIndex(
      s => s.store.toString() === program.store.toString()
    );

    if (storeIndex === -1) {
      return sendResponse(res, 404, 'Application not found', null);
    }

    affiliate.stores[storeIndex].status = 'rejected';
    await affiliate.save();

    return sendResponse(res, 200, 'Affiliate application rejected successfully', affiliate);
  } catch (error) {
    next(error);
  }
};

// Legacy methods for backward compatibility
exports.approveApplication = exports.approveAffiliateApplication;
exports.rejectApplication = exports.rejectAffiliateApplication;
exports.getApplications = exports.getProgramApplications;
