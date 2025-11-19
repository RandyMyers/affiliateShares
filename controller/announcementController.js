const Announcement = require('../models/announcement');
const Affiliate = require('../models/affiliate');
const { sendResponse } = require('../utils/response');

// Get all announcements for merchant
exports.getAnnouncements = async (req, res, next) => {
  try {
    const { program, store, isActive } = req.query;
    const query = { merchant: req.user.id };
    
    if (program) query.program = program;
    if (store) query.store = store;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const announcements = await Announcement.find(query)
      .populate('program', 'name')
      .populate('store', 'name domain')
      .populate('selectedAffiliates', 'referralCode')
      .sort({ createdAt: -1 });
    
    return sendResponse(res, 200, 'Announcements retrieved successfully', announcements);
  } catch (error) {
    next(error);
  }
};

// Get single announcement
exports.getAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findOne({
      _id: req.params.id,
      merchant: req.user.id
    })
      .populate('program', 'name')
      .populate('store', 'name domain')
      .populate('selectedAffiliates', 'referralCode')
      .populate('readBy.affiliate', 'referralCode');

    if (!announcement) {
      return sendResponse(res, 404, 'Announcement not found', null);
    }

    return sendResponse(res, 200, 'Announcement retrieved successfully', announcement);
  } catch (error) {
    next(error);
  }
};

// Get active announcements for affiliate
exports.getActiveAnnouncements = async (req, res, next) => {
  try {
    const now = new Date();
    const query = {
      isActive: true,
      $and: [
        {
          $or: [
            { scheduledFor: { $lte: now } },
            { scheduledFor: null }
          ]
        },
        {
          $or: [
            { expiresAt: { $gte: now } },
            { expiresAt: null }
          ]
        }
      ]
    };

    // If user is affiliate, filter by their approved stores/programs
    if (req.user.role === 'affiliate') {
      const affiliate = await Affiliate.findOne({ user: req.user.id });
      if (affiliate) {
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

        // Build query for affiliate's programs/stores
        query.$and = [
          ...(query.$and || []),
          {
            $or: [
              { store: { $in: approvedStoreIds } },
              { program: { $in: approvedProgramIds } },
              { targetAffiliates: 'all' },
              { targetAffiliates: 'active', selectedAffiliates: affiliate._id }
            ]
          }
        ];
      } else {
        return sendResponse(res, 200, 'Announcements retrieved successfully', []);
      }
    } else {
      // Merchant can see all their announcements
      query.merchant = req.user.id;
    }

    const announcements = await Announcement.find(query)
      .populate('program', 'name')
      .populate('store', 'name domain')
      .populate('readBy.affiliate', 'referralCode')
      .sort({ priority: -1, createdAt: -1 });
    
    // If user is affiliate, mark which announcements are read
    if (req.user.role === 'affiliate') {
      const affiliate = await Affiliate.findOne({ user: req.user.id });
      if (affiliate) {
        announcements.forEach(announcement => {
          announcement.read = announcement.readBy.some(
            r => r.affiliate && r.affiliate.toString() === affiliate._id.toString()
          );
        });
      }
    }
    
    return sendResponse(res, 200, 'Active announcements retrieved successfully', announcements);
  } catch (error) {
    next(error);
  }
};

// Create announcement
exports.createAnnouncement = async (req, res, next) => {
  try {
    const {
      title, message, type, priority, program, store,
      scheduledFor, expiresAt, targetAffiliates, selectedAffiliates
    } = req.body;

    const announcement = new Announcement({
      merchant: req.user.id,
      program: program || null,
      store: store || null,
      title,
      message,
      type: type || 'info',
      priority: priority || 'medium',
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      targetAffiliates: targetAffiliates || 'all',
      selectedAffiliates: selectedAffiliates || []
    });

    await announcement.save();

    await announcement.populate('program', 'name');
    await announcement.populate('store', 'name domain');

    return sendResponse(res, 201, 'Announcement created successfully', announcement);
  } catch (error) {
    next(error);
  }
};

// Update announcement
exports.updateAnnouncement = async (req, res, next) => {
  try {
    const {
      title, message, type, priority, isActive,
      scheduledFor, expiresAt, targetAffiliates, selectedAffiliates
    } = req.body;

    const announcement = await Announcement.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!announcement) {
      return sendResponse(res, 404, 'Announcement not found', null);
    }

    if (title) announcement.title = title;
    if (message) announcement.message = message;
    if (type) announcement.type = type;
    if (priority) announcement.priority = priority;
    if (isActive !== undefined) announcement.isActive = isActive;
    if (scheduledFor) announcement.scheduledFor = new Date(scheduledFor);
    if (expiresAt !== undefined) announcement.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (targetAffiliates) announcement.targetAffiliates = targetAffiliates;
    if (selectedAffiliates) announcement.selectedAffiliates = selectedAffiliates;

    await announcement.save();

    await announcement.populate('program', 'name');
    await announcement.populate('store', 'name domain');

    return sendResponse(res, 200, 'Announcement updated successfully', announcement);
  } catch (error) {
    next(error);
  }
};

// Mark announcement as read
exports.markAsRead = async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return sendResponse(res, 404, 'Announcement not found', null);
    }

    // If user is affiliate, mark as read
    if (req.user.role === 'affiliate') {
      const affiliate = await Affiliate.findOne({ user: req.user.id });
      if (affiliate) {
        const alreadyRead = announcement.readBy.some(
          r => r.affiliate && r.affiliate.toString() === affiliate._id.toString()
        );
        
        if (!alreadyRead) {
          announcement.readBy.push({
            affiliate: affiliate._id,
            readAt: new Date()
          });
          await announcement.save();
        }
      }
    }

    return sendResponse(res, 200, 'Announcement marked as read', announcement);
  } catch (error) {
    next(error);
  }
};

// Delete announcement
exports.deleteAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!announcement) {
      return sendResponse(res, 404, 'Announcement not found', null);
    }

    await Announcement.deleteOne({ _id: req.params.id });

    return sendResponse(res, 200, 'Announcement deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

