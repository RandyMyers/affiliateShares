const Broadcast = require('../models/broadcast');
const Affiliate = require('../models/affiliate');
const AffiliateProgram = require('../models/affiliateProgram');
const emailService = require('../services/emailService');
const { sendResponse } = require('../utils/response');

// Get all broadcasts for merchant
exports.getBroadcasts = async (req, res, next) => {
  try {
    const { program, store, status } = req.query;
    const query = { merchant: req.user.id };
    
    if (program) query.program = program;
    if (store) query.store = store;
    if (status) query.status = status;

    const broadcasts = await Broadcast.find(query)
      .populate('program', 'name')
      .populate('store', 'name domain')
      .sort({ createdAt: -1 });
    
    return sendResponse(res, 200, 'Broadcasts retrieved successfully', broadcasts);
  } catch (error) {
    next(error);
  }
};

// Get single broadcast
exports.getBroadcast = async (req, res, next) => {
  try {
    const broadcast = await Broadcast.findOne({
      _id: req.params.id,
      merchant: req.user.id
    })
      .populate('program', 'name')
      .populate('store', 'name domain')
      .populate('selectedAffiliates', 'referralCode')
      .populate('recipients.affiliate', 'referralCode');

    if (!broadcast) {
      return sendResponse(res, 404, 'Broadcast not found', null);
    }

    return sendResponse(res, 200, 'Broadcast retrieved successfully', broadcast);
  } catch (error) {
    next(error);
  }
};

// Get broadcast statistics
exports.getBroadcastStats = async (req, res, next) => {
  try {
    const broadcast = await Broadcast.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!broadcast) {
      return sendResponse(res, 404, 'Broadcast not found', null);
    }

    const stats = {
      totalRecipients: broadcast.recipients.length,
      sentCount: broadcast.sentCount,
      failedCount: broadcast.failedCount,
      pendingCount: broadcast.recipients.filter(r => r.status === 'pending').length,
      successRate: broadcast.recipients.length > 0 
        ? ((broadcast.sentCount / broadcast.recipients.length) * 100).toFixed(2)
        : 0
    };

    return sendResponse(res, 200, 'Broadcast stats retrieved successfully', stats);
  } catch (error) {
    next(error);
  }
};

// Create broadcast
exports.createBroadcast = async (req, res, next) => {
  try {
    const {
      subject, message, htmlMessage, program, store,
      targetAffiliates, selectedAffiliates, scheduledFor
    } = req.body;

    const broadcast = new Broadcast({
      merchant: req.user.id,
      program: program || null,
      store: store || null,
      subject,
      message,
      htmlMessage: htmlMessage || null,
      targetAffiliates: targetAffiliates || 'all',
      selectedAffiliates: selectedAffiliates || [],
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      status: scheduledFor ? 'scheduled' : 'draft'
    });

    await broadcast.save();

    await broadcast.populate('program', 'name');
    await broadcast.populate('store', 'name domain');

    return sendResponse(res, 201, 'Broadcast created successfully', broadcast);
  } catch (error) {
    next(error);
  }
};

// Send broadcast
exports.sendBroadcast = async (req, res, next) => {
  try {
    const broadcast = await Broadcast.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!broadcast) {
      return sendResponse(res, 404, 'Broadcast not found', null);
    }

    if (broadcast.status === 'sent') {
      return sendResponse(res, 400, 'Broadcast has already been sent', null);
    }

    // Get target affiliates
    let affiliates = [];
    
    if (broadcast.targetAffiliates === 'all') {
      affiliates = await Affiliate.find({
        'programs.status': 'active'
      }).populate('userId', 'email');
    } else if (broadcast.targetAffiliates === 'active') {
      affiliates = await Affiliate.find({
        'programs.status': 'active'
      }).populate('userId', 'email');
    } else if (broadcast.targetAffiliates === 'selected') {
      affiliates = await Affiliate.find({
        _id: { $in: broadcast.selectedAffiliates }
      }).populate('userId', 'email');
    } else if (broadcast.targetAffiliates === 'program' && broadcast.program) {
      affiliates = await Affiliate.find({
        'programs.programId': broadcast.program,
        'programs.status': 'active'
      }).populate('userId', 'email');
    }

    // Update broadcast status
    broadcast.status = 'sending';
    broadcast.recipients = affiliates.map(affiliate => ({
      affiliate: affiliate._id,
      email: affiliate.userId?.email,
      status: 'pending'
    }));
    await broadcast.save();

    // Send emails (async, don't wait)
    let sentCount = 0;
    let failedCount = 0;

    for (const affiliate of affiliates) {
      if (affiliate.userId?.email) {
        try {
          await emailService.sendEmail({
            to: affiliate.userId.email,
            subject: broadcast.subject,
            text: broadcast.message,
            html: broadcast.htmlMessage || broadcast.message
          });

          // Update recipient status
          const recipient = broadcast.recipients.find(
            r => r.affiliate.toString() === affiliate._id.toString()
          );
          if (recipient) {
            recipient.status = 'sent';
            recipient.sentAt = new Date();
          }
          sentCount++;
        } catch (error) {
          const recipient = broadcast.recipients.find(
            r => r.affiliate.toString() === affiliate._id.toString()
          );
          if (recipient) {
            recipient.status = 'failed';
            recipient.error = error.message;
          }
          failedCount++;
        }
      }
    }

    // Update broadcast
    broadcast.status = 'sent';
    broadcast.sentAt = new Date();
    broadcast.sentCount = sentCount;
    broadcast.failedCount = failedCount;
    await broadcast.save();

    return sendResponse(res, 200, 'Broadcast sent successfully', {
      sentCount,
      failedCount,
      totalRecipients: affiliates.length
    });
  } catch (error) {
    next(error);
  }
};

// Update broadcast
exports.updateBroadcast = async (req, res, next) => {
  try {
    const {
      subject, message, htmlMessage, targetAffiliates,
      selectedAffiliates, scheduledFor
    } = req.body;

    const broadcast = await Broadcast.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!broadcast) {
      return sendResponse(res, 404, 'Broadcast not found', null);
    }

    if (broadcast.status === 'sent') {
      return sendResponse(res, 400, 'Cannot update a broadcast that has already been sent', null);
    }

    if (subject) broadcast.subject = subject;
    if (message) broadcast.message = message;
    if (htmlMessage !== undefined) broadcast.htmlMessage = htmlMessage;
    if (targetAffiliates) broadcast.targetAffiliates = targetAffiliates;
    if (selectedAffiliates) broadcast.selectedAffiliates = selectedAffiliates;
    if (scheduledFor) {
      broadcast.scheduledFor = new Date(scheduledFor);
      broadcast.status = 'scheduled';
    }

    await broadcast.save();

    await broadcast.populate('program', 'name');
    await broadcast.populate('store', 'name domain');

    return sendResponse(res, 200, 'Broadcast updated successfully', broadcast);
  } catch (error) {
    next(error);
  }
};

// Delete broadcast
exports.deleteBroadcast = async (req, res, next) => {
  try {
    const broadcast = await Broadcast.findOne({
      _id: req.params.id,
      merchant: req.user.id
    });

    if (!broadcast) {
      return sendResponse(res, 404, 'Broadcast not found', null);
    }

    await Broadcast.deleteOne({ _id: req.params.id });

    return sendResponse(res, 200, 'Broadcast deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

