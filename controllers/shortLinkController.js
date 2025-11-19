const ShortLink = require('../models/ShortLink');
const TrackingLink = require('../models/TrackingLink');
const Affiliate = require('../models/Affiliate');
const { generateSlug } = require('../utils/slugGenerator');

/**
 * Create a short link from a tracking link
 */
exports.createShortLink = async (req, res) => {
  try {
    const { trackingLinkId, customSlug } = req.body;
    
    // Get or create affiliate profile
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
          totalRevenue: 0,
          totalEarnings: 0,
          totalPaid: 0,
          totalPending: 0
        }
      });
      await affiliate.save();
    }

    if (!affiliate) {
      return res.status(403).json({ 
        message: 'Affiliate profile required. Please complete your profile first.' 
      });
    }

    const affiliateId = affiliate._id;

    // Get the tracking link
    const trackingLink = await TrackingLink.findOne({
      _id: trackingLinkId,
      affiliate: affiliateId
    });

    if (!trackingLink) {
      return res.status(404).json({ message: 'Tracking link not found' });
    }

    // Generate slug
    let slug = customSlug;
    if (!slug) {
      slug = await generateSlug();
    } else {
      // Validate custom slug
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return res.status(400).json({ 
          message: 'Custom slug can only contain lowercase letters, numbers, and hyphens' 
        });
      }
      
      // Check if slug already exists
      const existing = await ShortLink.findOne({ slug });
      if (existing) {
        return res.status(400).json({ message: 'This custom slug is already taken' });
      }
    }

    // Create short link
    const shortLink = new ShortLink({
      slug,
      trackingLink: trackingLink._id,
      affiliate: affiliateId,
      originalUrl: trackingLink.trackingUrl,
      isCustom: !!customSlug
    });

    shortLink.shortUrl = shortLink.generateShortUrl();
    await shortLink.save();

    res.status(201).json({
      message: 'Short link created successfully',
      shortLink
    });
  } catch (error) {
    console.error('Error creating short link:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to create short link' 
    });
  }
};

/**
 * Get all short links for the current affiliate
 */
exports.getShortLinks = async (req, res) => {
  try {
    // Get or create affiliate profile
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
          totalRevenue: 0,
          totalEarnings: 0,
          totalPaid: 0,
          totalPending: 0
        }
      });
      await affiliate.save();
    }

    if (!affiliate) {
      return res.status(403).json({ 
        message: 'Affiliate profile required' 
      });
    }

    const affiliateId = affiliate._id;

    const shortLinks = await ShortLink.find({ affiliate: affiliateId })
      .populate('trackingLink', 'store program trackingUrl')
      .sort({ createdAt: -1 });

    res.json({
      message: 'Short links fetched successfully',
      shortLinks
    });
  } catch (error) {
    console.error('Error fetching short links:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch short links' 
    });
  }
};

/**
 * Get a specific short link
 */
exports.getShortLink = async (req, res) => {
  try {
    const { shortLinkId } = req.params;
    
    // Get or create affiliate profile
    let affiliate = await Affiliate.findOne({ user: req.user.id });
    
    if (!affiliate && req.user.role === 'affiliate') {
      affiliate = new Affiliate({
        user: req.user.id,
        referralCode: `AFF${Date.now().toString(36).toUpperCase()}`,
        stores: [],
        stats: {
          totalClicks: 0,
          totalOrders: 0,
          totalRevenue: 0,
          totalEarnings: 0,
          totalPaid: 0,
          totalPending: 0
        }
      });
      await affiliate.save();
    }

    if (!affiliate) {
      return res.status(403).json({ message: 'Affiliate profile required' });
    }

    const affiliateId = affiliate._id;

    const shortLink = await ShortLink.findOne({
      _id: shortLinkId,
      affiliate: affiliateId
    }).populate('trackingLink', 'store program trackingUrl');

    if (!shortLink) {
      return res.status(404).json({ message: 'Short link not found' });
    }

    res.json({
      message: 'Short link fetched successfully',
      shortLink
    });
  } catch (error) {
    console.error('Error fetching short link:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch short link' 
    });
  }
};

/**
 * Update a short link
 */
exports.updateShortLink = async (req, res) => {
  try {
    const { shortLinkId } = req.params;
    const { customSlug, isActive, expiresAt } = req.body;
    
    // Get or create affiliate profile
    let affiliate = await Affiliate.findOne({ user: req.user.id });
    
    if (!affiliate && req.user.role === 'affiliate') {
      affiliate = new Affiliate({
        user: req.user.id,
        referralCode: `AFF${Date.now().toString(36).toUpperCase()}`,
        stores: [],
        stats: {
          totalClicks: 0,
          totalOrders: 0,
          totalRevenue: 0,
          totalEarnings: 0,
          totalPaid: 0,
          totalPending: 0
        }
      });
      await affiliate.save();
    }

    if (!affiliate) {
      return res.status(403).json({ message: 'Affiliate profile required' });
    }

    const affiliateId = affiliate._id;

    const shortLink = await ShortLink.findOne({
      _id: shortLinkId,
      affiliate: affiliateId
    });

    if (!shortLink) {
      return res.status(404).json({ message: 'Short link not found' });
    }

    // Update custom slug if provided
    if (customSlug && customSlug !== shortLink.slug) {
      if (!/^[a-z0-9-]+$/.test(customSlug)) {
        return res.status(400).json({ 
          message: 'Custom slug can only contain lowercase letters, numbers, and hyphens' 
        });
      }
      
      const existing = await ShortLink.findOne({ 
        slug: customSlug,
        _id: { $ne: shortLinkId }
      });
      if (existing) {
        return res.status(400).json({ message: 'This custom slug is already taken' });
      }
      
      shortLink.slug = customSlug;
      shortLink.isCustom = true;
      shortLink.shortUrl = shortLink.generateShortUrl();
    }

    if (typeof isActive === 'boolean') {
      shortLink.isActive = isActive;
    }

    if (expiresAt !== undefined) {
      shortLink.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    await shortLink.save();

    res.json({
      message: 'Short link updated successfully',
      shortLink
    });
  } catch (error) {
    console.error('Error updating short link:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to update short link' 
    });
  }
};

/**
 * Delete a short link
 */
exports.deleteShortLink = async (req, res) => {
  try {
    const { shortLinkId } = req.params;
    
    // Get or create affiliate profile
    let affiliate = await Affiliate.findOne({ user: req.user.id });
    
    if (!affiliate && req.user.role === 'affiliate') {
      affiliate = new Affiliate({
        user: req.user.id,
        referralCode: `AFF${Date.now().toString(36).toUpperCase()}`,
        stores: [],
        stats: {
          totalClicks: 0,
          totalOrders: 0,
          totalRevenue: 0,
          totalEarnings: 0,
          totalPaid: 0,
          totalPending: 0
        }
      });
      await affiliate.save();
    }

    if (!affiliate) {
      return res.status(403).json({ message: 'Affiliate profile required' });
    }

    const affiliateId = affiliate._id;

    const shortLink = await ShortLink.findOneAndDelete({
      _id: shortLinkId,
      affiliate: affiliateId
    });

    if (!shortLink) {
      return res.status(404).json({ message: 'Short link not found' });
    }

    res.json({ message: 'Short link deleted successfully' });
  } catch (error) {
    console.error('Error deleting short link:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to delete short link' 
    });
  }
};

/**
 * Get analytics for a short link
 */
exports.getShortLinkAnalytics = async (req, res) => {
  try {
    const { shortLinkId } = req.params;
    const { dateRange } = req.query;
    const affiliateId = req.user.affiliate?._id || req.user.affiliate;

    const shortLink = await ShortLink.findOne({
      _id: shortLinkId,
      affiliate: affiliateId
    }).populate('trackingLink');

    if (!shortLink) {
      return res.status(404).json({ message: 'Short link not found' });
    }

    // Get click data from tracking link
    const analytics = {
      totalClicks: shortLink.clicks,
      shortLink: {
        slug: shortLink.slug,
        shortUrl: shortLink.shortUrl,
        originalUrl: shortLink.originalUrl
      },
      trackingLink: shortLink.trackingLink
    };

    res.json({
      message: 'Analytics fetched successfully',
      analytics
    });
  } catch (error) {
    console.error('Error fetching short link analytics:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch analytics' 
    });
  }
};

/**
 * Redirect short link to original tracking URL
 */
exports.redirectShortLink = async (req, res) => {
  try {
    const { slug } = req.params;

    const shortLink = await ShortLink.findOne({ slug, isActive: true })
      .populate('trackingLink');

    if (!shortLink) {
      return res.status(404).json({ message: 'Short link not found or inactive' });
    }

    // Check if expired
    if (shortLink.expiresAt && new Date() > shortLink.expiresAt) {
      return res.status(410).json({ message: 'Short link has expired' });
    }

    // Increment click count
    shortLink.clicks += 1;
    await shortLink.save();

    // Redirect to original tracking URL
    res.redirect(shortLink.trackingLink.trackingUrl);
  } catch (error) {
    console.error('Error redirecting short link:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to redirect' 
    });
  }
};

