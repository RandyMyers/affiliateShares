const Invitation = require('../models/Invitation');
const InvitationTemplate = require('../models/InvitationTemplate');
const Affiliate = require('../models/affiliate');
const Store = require('../models/store');
const User = require('../models/user');
const { sendResponse } = require('../utils/response');
// const emailService = require('../services/emailService'); // Will be implemented later

// Create and send invitation(s)
exports.createInvitation = async (req, res, next) => {
  try {
    const {
      affiliateIds,
      storeId,
      message,
      subject,
      templateId,
      incentives,
      sendImmediately = true
    } = req.body;

    if (!affiliateIds || !Array.isArray(affiliateIds) || affiliateIds.length === 0) {
      return sendResponse(res, 400, 'Please provide affiliate IDs', null);
    }

    if (!storeId) {
      return sendResponse(res, 400, 'Please provide store ID', null);
    }

    if (!message) {
      return sendResponse(res, 400, 'Please provide invitation message', null);
    }

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Get template if provided
    let template = null;
    if (templateId) {
      template = await InvitationTemplate.findOne({
        _id: templateId,
        merchant: req.user.id
      });
    }

    // Verify affiliates exist and are discoverable
    const affiliates = await Affiliate.find({
      _id: { $in: affiliateIds },
      'discovery.discoverable': true,
      'discovery.contactPreferences.allowInvitations': true
    }).populate('user', 'email username');

    if (affiliates.length === 0) {
      return sendResponse(res, 400, 'No valid affiliates found', null);
    }

    // Check if affiliates are already in this store
    const existingInvitations = await Invitation.find({
      store: storeId,
      affiliate: { $in: affiliateIds },
      status: { $in: ['pending', 'sent', 'accepted'] }
    });

    const existingAffiliateIds = existingInvitations.map(inv => inv.affiliate.toString());
    const newAffiliateIds = affiliateIds.filter(id => !existingAffiliateIds.includes(id.toString()));

    if (newAffiliateIds.length === 0) {
      return sendResponse(res, 400, 'All selected affiliates already have pending or active invitations', null);
    }

    // Create invitations
    const invitations = [];
    const merchant = await User.findById(req.user.id);

    for (const affiliateId of newAffiliateIds) {
      const affiliate = affiliates.find(a => a._id.toString() === affiliateId.toString());
      if (!affiliate) continue;

      // Personalize message with merge fields
      let personalizedMessage = message;
      personalizedMessage = personalizedMessage.replace(/{affiliate_name}/g, affiliate.user?.username || 'Affiliate');
      personalizedMessage = personalizedMessage.replace(/{merchant_name}/g, merchant?.username || 'Merchant');
      personalizedMessage = personalizedMessage.replace(/{program_name}/g, store.name || 'Program');
      personalizedMessage = personalizedMessage.replace(/{store_name}/g, store.name || 'Store');

      const invitation = new Invitation({
        merchant: req.user.id,
        store: storeId,
        affiliate: affiliateId,
        message: personalizedMessage,
        subject: subject || `Invitation to join ${store.name}`,
        template: template?._id,
        incentives: incentives || {},
        status: sendImmediately ? 'sent' : 'pending',
        sentAt: sendImmediately ? new Date() : null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });

      await invitation.save();
      invitations.push(invitation);

      // Send email if sendImmediately
      if (sendImmediately && affiliate.user?.email) {
        // TODO: Implement email sending
        // await emailService.sendInvitationEmail(affiliate.user.email, invitation, store);
      }

      // Update template usage count
      if (template) {
        template.usageCount += 1;
        await template.save();
      }
    }

    return sendResponse(res, 201, `Invitations created successfully (${invitations.length} sent)`, {
      invitations,
      skipped: affiliateIds.length - newAffiliateIds.length
    });
  } catch (error) {
    next(error);
  }
};

// Get all invitations for merchant
exports.getInvitations = async (req, res, next) => {
  try {
    const {
      status,
      storeId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {
      merchant: req.user.id
    };

    if (status) {
      query.status = status;
    }

    if (storeId) {
      query.store = storeId;
    }

    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const invitations = await Invitation.find(query)
      .populate('store', 'name domain')
      .populate('affiliate', 'referralCode')
      .populate({
        path: 'affiliate',
        populate: {
          path: 'user',
          select: 'username email'
        }
      })
      .populate('template', 'name')
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Invitation.countDocuments(query);

    return sendResponse(res, 200, 'Invitations retrieved successfully', {
      invitations,
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

// Get single invitation details
exports.getInvitation = async (req, res, next) => {
  try {
    const { invitationId } = req.params;

    const invitation = await Invitation.findOne({
      _id: invitationId,
      merchant: req.user.id
    })
      .populate('store', 'name domain')
      .populate('affiliate')
      .populate({
        path: 'affiliate',
        populate: {
          path: 'user',
          select: 'username email'
        }
      })
      .populate('template', 'name subject message');

    if (!invitation) {
      return sendResponse(res, 404, 'Invitation not found', null);
    }

    return sendResponse(res, 200, 'Invitation retrieved successfully', invitation);
  } catch (error) {
    next(error);
  }
};

// Update invitation
exports.updateInvitation = async (req, res, next) => {
  try {
    const { invitationId } = req.params;
    const { message, subject, incentives, status } = req.body;

    const invitation = await Invitation.findOne({
      _id: invitationId,
      merchant: req.user.id
    });

    if (!invitation) {
      return sendResponse(res, 404, 'Invitation not found', null);
    }

    if (invitation.status === 'accepted' || invitation.status === 'declined') {
      return sendResponse(res, 400, 'Cannot update accepted or declined invitation', null);
    }

    if (message) invitation.message = message;
    if (subject) invitation.subject = subject;
    if (incentives) invitation.incentives = { ...invitation.incentives, ...incentives };
    if (status) invitation.status = status;

    await invitation.save();

    return sendResponse(res, 200, 'Invitation updated successfully', invitation);
  } catch (error) {
    next(error);
  }
};

// Delete/Cancel invitation
exports.deleteInvitation = async (req, res, next) => {
  try {
    const { invitationId } = req.params;

    const invitation = await Invitation.findOne({
      _id: invitationId,
      merchant: req.user.id
    });

    if (!invitation) {
      return sendResponse(res, 404, 'Invitation not found', null);
    }

    if (invitation.status === 'accepted') {
      return sendResponse(res, 400, 'Cannot delete accepted invitation', null);
    }

    await Invitation.deleteOne({ _id: invitationId });

    return sendResponse(res, 200, 'Invitation deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

// Resend invitation
exports.resendInvitation = async (req, res, next) => {
  try {
    const { invitationId } = req.params;

    const invitation = await Invitation.findOne({
      _id: invitationId,
      merchant: req.user.id
    })
      .populate('store')
      .populate({
        path: 'affiliate',
        populate: {
          path: 'user',
          select: 'email username'
        }
      });

    if (!invitation) {
      return sendResponse(res, 404, 'Invitation not found', null);
    }

    if (invitation.status === 'accepted') {
      return sendResponse(res, 400, 'Cannot resend accepted invitation', null);
    }

    invitation.status = 'sent';
    invitation.sentAt = new Date();
    invitation.analytics.openCount = 0;
    invitation.analytics.clickCount = 0;
    await invitation.save();

    // Send email
    if (invitation.affiliate?.user?.email) {
      // TODO: Implement email sending
      // await emailService.sendInvitationEmail(invitation.affiliate.user.email, invitation, invitation.store);
    }

    return sendResponse(res, 200, 'Invitation resent successfully', invitation);
  } catch (error) {
    next(error);
  }
};

// Send reminder
exports.sendReminder = async (req, res, next) => {
  try {
    const { invitationId } = req.params;

    const invitation = await Invitation.findOne({
      _id: invitationId,
      merchant: req.user.id,
      status: { $in: ['sent', 'opened', 'clicked'] }
    })
      .populate('store')
      .populate({
        path: 'affiliate',
        populate: {
          path: 'user',
          select: 'email username'
        }
      });

    if (!invitation) {
      return sendResponse(res, 404, 'Invitation not found or cannot send reminder', null);
    }

    // Send reminder email
    if (invitation.affiliate?.user?.email) {
      // TODO: Implement reminder email
      // await emailService.sendInvitationReminder(invitation.affiliate.user.email, invitation, invitation.store);
    }

    return sendResponse(res, 200, 'Reminder sent successfully', invitation);
  } catch (error) {
    next(error);
  }
};

// Get invitation analytics
exports.getInvitationAnalytics = async (req, res, next) => {
  try {
    const { storeId, startDate, endDate } = req.query;

    const query = {
      merchant: req.user.id
    };

    if (storeId) {
      query.store = storeId;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const invitations = await Invitation.find(query);

    const total = invitations.length;
    const sent = invitations.filter(i => i.status === 'sent' || i.status === 'opened' || i.status === 'clicked' || i.status === 'accepted' || i.status === 'declined').length;
    const opened = invitations.filter(i => i.analytics?.openCount > 0).length;
    const clicked = invitations.filter(i => i.analytics?.clickCount > 0).length;
    const accepted = invitations.filter(i => i.status === 'accepted').length;
    const declined = invitations.filter(i => i.status === 'declined').length;

    const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(2) : 0;
    const clickRate = opened > 0 ? ((clicked / opened) * 100).toFixed(2) : 0;
    const acceptanceRate = sent > 0 ? ((accepted / sent) * 100).toFixed(2) : 0;

    return sendResponse(res, 200, 'Analytics retrieved successfully', {
      total,
      sent,
      opened,
      clicked,
      accepted,
      declined,
      openRate: parseFloat(openRate),
      clickRate: parseFloat(clickRate),
      acceptanceRate: parseFloat(acceptanceRate)
    });
  } catch (error) {
    next(error);
  }
};

// Track invitation open (webhook/pixel)
exports.trackOpen = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return sendResponse(res, 400, 'Tracking token required', null);
    }

    const invitation = await Invitation.findOne({ trackingToken: token });

    if (!invitation) {
      return sendResponse(res, 404, 'Invitation not found', null);
    }

    if (!invitation.openedAt) {
      invitation.openedAt = new Date();
      invitation.analytics.openCount = 1;
      invitation.status = 'opened';
    } else {
      invitation.analytics.openCount += 1;
    }

    await invitation.save();

    // Return 1x1 transparent pixel
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.send(pixel);
  } catch (error) {
    next(error);
  }
};

// Track invitation click
exports.trackClick = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return sendResponse(res, 400, 'Tracking token required', null);
    }

    const invitation = await Invitation.findOne({ trackingToken: token });

    if (!invitation) {
      return sendResponse(res, 404, 'Invitation not found', null);
    }

    if (!invitation.clickedAt) {
      invitation.clickedAt = new Date();
      invitation.analytics.clickCount = 1;
      invitation.status = 'clicked';
    } else {
      invitation.analytics.clickCount += 1;
    }

    await invitation.save();

    // Redirect to store or program page
    const store = await Store.findById(invitation.store);
    const redirectUrl = store?.domain || '/';

    return res.redirect(redirectUrl);
  } catch (error) {
    next(error);
  }
};

