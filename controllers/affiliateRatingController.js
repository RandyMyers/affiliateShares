const mongoose = require('mongoose');
const AffiliateRating = require('../models/AffiliateRating');
const Affiliate = require('../models/affiliate');
const Store = require('../models/store');
const { sendResponse } = require('../utils/response');

// Create or update rating
exports.createOrUpdateRating = async (req, res, next) => {
  try {
    const { affiliateId, storeId, rating, review, categories } = req.body;

    if (!affiliateId || !storeId || !rating) {
      return sendResponse(res, 400, 'Affiliate ID, Store ID, and Rating are required', null);
    }

    if (rating < 1 || rating > 5) {
      return sendResponse(res, 400, 'Rating must be between 1 and 5', null);
    }

    // Verify store belongs to merchant
    const store = await Store.findOne({
      _id: storeId,
      merchant: req.user.id
    });

    if (!store) {
      return sendResponse(res, 404, 'Store not found', null);
    }

    // Check if affiliate is associated with this store
    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) {
      return sendResponse(res, 404, 'Affiliate not found', null);
    }

    const storeAssociation = affiliate.stores.find(s => s.store.toString() === storeId);
    if (!storeAssociation) {
      return sendResponse(res, 400, 'Affiliate is not associated with this store', null);
    }

    // Create or update rating
    const ratingData = {
      affiliate: affiliateId,
      store: storeId,
      merchant: req.user.id,
      rating,
      review: review || '',
      categories: categories || {},
      status: 'active'
    };

    const existingRating = await AffiliateRating.findOne({
      affiliate: affiliateId,
      store: storeId,
      merchant: req.user.id
    });

    let savedRating;
    if (existingRating) {
      existingRating.rating = rating;
      existingRating.review = review || existingRating.review;
      existingRating.categories = categories || existingRating.categories;
      savedRating = await existingRating.save();
    } else {
      savedRating = await AffiliateRating.create(ratingData);
    }

    // Update affiliate's average rating
    await updateAffiliateAverageRating(affiliateId);

    return sendResponse(res, existingRating ? 200 : 201, 'Rating saved successfully', savedRating);
  } catch (error) {
    next(error);
  }
};

// Get ratings for an affiliate
exports.getAffiliateRatings = async (req, res, next) => {
  try {
    const { affiliateId } = req.params;
    const { page = 1, limit = 20, storeId } = req.query;

    const query = {
      affiliate: affiliateId,
      status: 'active'
    };

    if (storeId) {
      query.store = storeId;
    }

    const ratings = await AffiliateRating.find(query)
      .populate('store', 'name domain')
      .populate('merchant', 'username')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await AffiliateRating.countDocuments(query);

    // Calculate average rating
    const avgRating = await AffiliateRating.aggregate([
      { $match: { affiliate: new mongoose.Types.ObjectId(affiliateId), status: 'active' } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    return sendResponse(res, 200, 'Ratings retrieved successfully', {
      ratings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      averageRating: avgRating[0]?.avgRating || 0,
      totalRatings: avgRating[0]?.count || 0
    });
  } catch (error) {
    next(error);
  }
};

// Get average rating for affiliate
exports.getAffiliateAverageRating = async (req, res, next) => {
  try {
    const { affiliateId } = req.params;

    const result = await AffiliateRating.aggregate([
      { $match: { affiliate: new mongoose.Types.ObjectId(affiliateId), status: 'active' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);

    if (result.length === 0) {
      return sendResponse(res, 200, 'No ratings found', {
        averageRating: 0,
        totalRatings: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      });
    }

    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    result[0].ratingDistribution.forEach(rating => {
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
    });

    return sendResponse(res, 200, 'Average rating retrieved successfully', {
      averageRating: parseFloat(result[0].averageRating.toFixed(2)),
      totalRatings: result[0].totalRatings,
      ratingDistribution
    });
  } catch (error) {
    next(error);
  }
};

// Delete rating
exports.deleteRating = async (req, res, next) => {
  try {
    const { ratingId } = req.params;

    const rating = await AffiliateRating.findOne({
      _id: ratingId,
      merchant: req.user.id
    });

    if (!rating) {
      return sendResponse(res, 404, 'Rating not found', null);
    }

    await AffiliateRating.deleteOne({ _id: ratingId });

    // Update affiliate's average rating
    await updateAffiliateAverageRating(rating.affiliate);

    return sendResponse(res, 200, 'Rating deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

// Helper function to update affiliate's average rating
const updateAffiliateAverageRating = async (affiliateId) => {
  try {
    const result = await AffiliateRating.aggregate([
      { $match: { affiliate: new mongoose.Types.ObjectId(affiliateId), status: 'active' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 }
        }
      }
    ]);

    const affiliate = await Affiliate.findById(affiliateId);
    if (affiliate) {
      if (!affiliate.verification) {
        affiliate.verification = {};
      }
      affiliate.verification.averageRating = result.length > 0 ? parseFloat(result[0].averageRating.toFixed(2)) : 0;
      affiliate.verification.totalRatings = result.length > 0 ? result[0].totalRatings : 0;
      await affiliate.save();
    }
  } catch (error) {
    console.error('Error updating affiliate average rating:', error);
  }
};

