const Basket = require('../models/Basket');
const Affiliate = require('../models/affiliate');
const { sendResponse } = require('../utils/response');

// Get all baskets for merchant
exports.getBaskets = async (req, res, next) => {
  try {
    const baskets = await Basket.find({ merchant: req.user.id })
      .populate('affiliates.affiliate', 'referralCode')
      .populate({
        path: 'affiliates.affiliate',
        populate: {
          path: 'user',
          select: 'username email'
        }
      })
      .sort({ createdAt: -1 });

    return sendResponse(res, 200, 'Baskets retrieved successfully', baskets);
  } catch (error) {
    next(error);
  }
};

// Get single basket with affiliates
exports.getBasket = async (req, res, next) => {
  try {
    const { basketId } = req.params;

    const basket = await Basket.findOne({
      _id: basketId,
      merchant: req.user.id
    })
      .populate('affiliates.affiliate')
      .populate({
        path: 'affiliates.affiliate',
        populate: {
          path: 'user',
          select: 'username email'
        }
      });

    if (!basket) {
      return sendResponse(res, 404, 'Basket not found', null);
    }

    return sendResponse(res, 200, 'Basket retrieved successfully', basket);
  } catch (error) {
    next(error);
  }
};

// Create basket
exports.createBasket = async (req, res, next) => {
  try {
    const { name, description, tags, campaign, affiliateIds } = req.body;

    if (!name) {
      return sendResponse(res, 400, 'Basket name is required', null);
    }

    const basket = new Basket({
      merchant: req.user.id,
      name,
      description,
      tags: tags || [],
      campaign: campaign || 'recruitment',
      affiliates: affiliateIds ? affiliateIds.map(id => ({ affiliate: id })) : []
    });

    await basket.save();

    return sendResponse(res, 201, 'Basket created successfully', basket);
  } catch (error) {
    next(error);
  }
};

// Update basket
exports.updateBasket = async (req, res, next) => {
  try {
    const { basketId } = req.params;
    const { name, description, tags, campaign } = req.body;

    const basket = await Basket.findOne({
      _id: basketId,
      merchant: req.user.id
    });

    if (!basket) {
      return sendResponse(res, 404, 'Basket not found', null);
    }

    if (name) basket.name = name;
    if (description !== undefined) basket.description = description;
    if (tags) basket.tags = tags;
    if (campaign) basket.campaign = campaign;

    await basket.save();

    return sendResponse(res, 200, 'Basket updated successfully', basket);
  } catch (error) {
    next(error);
  }
};

// Delete basket
exports.deleteBasket = async (req, res, next) => {
  try {
    const { basketId } = req.params;

    const basket = await Basket.findOne({
      _id: basketId,
      merchant: req.user.id
    });

    if (!basket) {
      return sendResponse(res, 404, 'Basket not found', null);
    }

    await Basket.deleteOne({ _id: basketId });

    return sendResponse(res, 200, 'Basket deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

// Add affiliates to basket
exports.addAffiliates = async (req, res, next) => {
  try {
    const { basketId } = req.params;
    const { affiliateIds } = req.body;

    if (!affiliateIds || !Array.isArray(affiliateIds) || affiliateIds.length === 0) {
      return sendResponse(res, 400, 'Please provide affiliate IDs', null);
    }

    const basket = await Basket.findOne({
      _id: basketId,
      merchant: req.user.id
    });

    if (!basket) {
      return sendResponse(res, 404, 'Basket not found', null);
    }

    // Add new affiliates (avoid duplicates)
    const existingIds = basket.affiliates.map(a => a.affiliate.toString());
    const newAffiliateIds = affiliateIds.filter(id => !existingIds.includes(id.toString()));

    if (newAffiliateIds.length === 0) {
      return sendResponse(res, 400, 'All affiliates are already in the basket', null);
    }

    newAffiliateIds.forEach(id => {
      basket.affiliates.push({ affiliate: id });
    });

    await basket.save();

    return sendResponse(res, 200, `Added ${newAffiliateIds.length} affiliate(s) to basket`, basket);
  } catch (error) {
    next(error);
  }
};

// Remove affiliate from basket
exports.removeAffiliate = async (req, res, next) => {
  try {
    const { basketId, affiliateId } = req.params;

    const basket = await Basket.findOne({
      _id: basketId,
      merchant: req.user.id
    });

    if (!basket) {
      return sendResponse(res, 404, 'Basket not found', null);
    }

    basket.affiliates = basket.affiliates.filter(
      a => a.affiliate.toString() !== affiliateId
    );

    await basket.save();

    return sendResponse(res, 200, 'Affiliate removed from basket', basket);
  } catch (error) {
    next(error);
  }
};

// Duplicate basket
exports.duplicateBasket = async (req, res, next) => {
  try {
    const { basketId } = req.params;
    const { name } = req.body;

    const originalBasket = await Basket.findOne({
      _id: basketId,
      merchant: req.user.id
    });

    if (!originalBasket) {
      return sendResponse(res, 404, 'Basket not found', null);
    }

    const newBasket = new Basket({
      merchant: req.user.id,
      name: name || `${originalBasket.name} (Copy)`,
      description: originalBasket.description,
      tags: originalBasket.tags,
      campaign: originalBasket.campaign,
      affiliates: originalBasket.affiliates.map(a => ({
        affiliate: a.affiliate,
        notes: a.notes
      }))
    });

    await newBasket.save();

    return sendResponse(res, 201, 'Basket duplicated successfully', newBasket);
  } catch (error) {
    next(error);
  }
};

// Export basket to CSV
exports.exportBasket = async (req, res, next) => {
  try {
    const { basketId } = req.params;

    const basket = await Basket.findOne({
      _id: basketId,
      merchant: req.user.id
    })
      .populate('affiliates.affiliate')
      .populate({
        path: 'affiliates.affiliate',
        populate: {
          path: 'user',
          select: 'username email'
        }
      });

    if (!basket) {
      return sendResponse(res, 404, 'Basket not found', null);
    }

    // Convert to CSV format
    const csvRows = [];
    csvRows.push('Username,Email,Referral Code,Website,Categories,Added Date');

    basket.affiliates.forEach(item => {
      const affiliate = item.affiliate;
      const username = affiliate?.user?.username || '';
      const email = affiliate?.user?.email || '';
      const referralCode = affiliate?.referralCode || '';
      const website = affiliate?.discovery?.websiteInfo?.url || affiliate?.profile?.website || '';
      const categories = (affiliate?.discovery?.categories || []).join('; ');
      const addedDate = item.addedAt ? new Date(item.addedAt).toLocaleDateString() : '';

      csvRows.push(`"${username}","${email}","${referralCode}","${website}","${categories}","${addedDate}"`);
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="basket-${basket.name}-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (error) {
    next(error);
  }
};

