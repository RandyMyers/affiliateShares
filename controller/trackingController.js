const Click = require('../models/click');
const Store = require('../models/store');
const Affiliate = require('../models/affiliate');
const { sendResponse } = require('../utils/response');
const crypto = require('crypto');

// Track click
exports.trackClick = async (req, res, next) => {
  try {
    const { trackingCode, url, ref } = req.query;

    // Find store by tracking code
    const store = await Store.findOne({ trackingCode });
    if (!store) {
      return res.status(404).send('Store not found');
    }

    // Get referral code from URL or referer
    let referralCode = null;
    if (ref) {
      referralCode = ref.toUpperCase();
    } else if (req.headers.referer) {
      // Extract referral code from referer URL if present
      const refMatch = req.headers.referer.match(/[?&]ref=([A-Z0-9]+)/i);
      if (refMatch) {
        referralCode = refMatch[1].toUpperCase();
      }
    }

    // Find affiliate by referral code
    let affiliate = null;
    if (referralCode) {
      affiliate = await Affiliate.findOne({ referralCode });
    }

    // Generate cookie ID
    const cookieId = req.cookies.affiliate_tracking || 
                    crypto.randomBytes(16).toString('hex');

    // Create click record
    const click = new Click({
      affiliate: affiliate ? affiliate._id : null,
      store: store._id,
      referralCode: referralCode || null,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      referer: req.headers.referer,
      landingPage: url || '/',
      cookieId: cookieId
    });

    await click.save();

    // Update affiliate stats if exists
    if (affiliate) {
      const storeApplication = affiliate.stores.find(
        s => s.store.toString() === store._id.toString()
      );

      if (storeApplication && storeApplication.status === 'approved') {
        storeApplication.stats.clicks += 1;
        affiliate.stats.totalClicks += 1;
        await affiliate.save();
      }
    }

    // Update store stats
    store.stats.totalClicks += 1;
    await store.save();

    // Set cookie
    // Note: For cross-domain tracking, cookies are set client-side by JavaScript
    // This server-side cookie is for the click tracking endpoint only
    res.cookie('affiliate_tracking', cookieId, {
      maxAge: store.settings.cookieDuration * 24 * 60 * 60 * 1000, // Convert days to ms
      httpOnly: false, // JavaScript needs to access this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: undefined // Don't set domain to allow cross-domain cookies
    });

    // Redirect to original URL
    const redirectUrl = url || store.domain;
    res.redirect(302, redirectUrl);
  } catch (error) {
    next(error);
  }
};

// Serve JavaScript tracking snippet
exports.serveTrackingScript = async (req, res, next) => {
  try {
    const { trackingCode } = req.params;

    const store = await Store.findOne({ trackingCode });
    if (!store) {
      return res.status(404).send('// Store not found');
    }

    const API_URL = process.env.API_URL || process.env.BASE_URL || 'https://affiliateshares.onrender.com';
    const cookieDuration = store.settings.cookieDuration || 30;

    // Generate improved JavaScript snippet with WooCommerce support
    const script = `
(function() {
  'use strict';
  
  // Configuration
  var API_URL = '${API_URL}';
  var TRACKING_CODE = '${trackingCode}';
  var COOKIE_NAME = 'affiliate_ref';
  var COOKIE_DURATION = ${cookieDuration}; // days
  var TRACKING_COOKIE = 'affiliate_tracking';
  
  // Utility functions
  function getCookie(name) {
    var value = "; " + document.cookie;
    var parts = value.split("; " + name + "=");
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  }
  
  function setCookie(name, value, days) {
    var expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + '=' + value + ';expires=' + expires.toUTCString() + ';path=/;SameSite=Lax';
    // Also store in localStorage as backup
    try {
      localStorage.setItem(name, value);
    } catch(e) {}
  }
  
  function getUrlParam(name) {
    var urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }
  
  // Get referral code from URL
  var ref = getUrlParam('ref') || getUrlParam('affiliate') || getUrlParam('aff');
  
  // Debug logging (remove in production if needed)
  if (ref) {
    console.log('[Affiliate Network] Found ref parameter:', ref);
  }
  
  // Get existing cookie or tracking cookie
  var affiliateRef = getCookie(COOKIE_NAME) || getCookie(TRACKING_COOKIE);
  
  // If we have a new ref parameter, update cookie
  if (ref) {
    console.log('[Affiliate Network] Setting cookie:', COOKIE_NAME, '=', ref);
    setCookie(COOKIE_NAME, ref, COOKIE_DURATION);
    affiliateRef = ref;
    // Verify cookie was set
    var verifyCookie = getCookie(COOKIE_NAME);
    if (verifyCookie) {
      console.log('[Affiliate Network] Cookie set successfully:', verifyCookie);
    } else {
      console.error('[Affiliate Network] Failed to set cookie!');
    }
  }
  
  // Track click if we have affiliate reference
  if (affiliateRef || ref) {
    var trackingUrl = API_URL + '/api/tracking/click?trackingCode=' + TRACKING_CODE + '&url=' + encodeURIComponent(window.location.href);
    if (ref) {
      trackingUrl += '&ref=' + encodeURIComponent(ref);
    }
    
    // Send tracking request
    if (navigator.sendBeacon) {
      navigator.sendBeacon(trackingUrl);
    } else {
      var img = new Image();
      img.src = trackingUrl;
    }
  }
  
  // WooCommerce Integration
  if (typeof jQuery !== 'undefined' && typeof wc_add_to_cart_params !== 'undefined') {
    // Wait for jQuery and WooCommerce to be ready
    jQuery(document).ready(function($) {
      var affiliateId = getCookie(COOKIE_NAME) || getCookie(TRACKING_COOKIE);
      
      if (affiliateId) {
        // Add affiliate data to checkout form
        $(document.body).on('checkout_place_order', function() {
          if (affiliateId) {
            // Add hidden fields to checkout form
            if ($('#affiliate_ref').length === 0) {
              $('<input>').attr({
                type: 'hidden',
                id: 'affiliate_ref',
                name: 'affiliate_ref',
                value: affiliateId
              }).appendTo('form.checkout');
            }
            
            // Also try to set via AJAX for better reliability
            if (typeof wc_checkout_params !== 'undefined') {
              $(document.body).trigger('update_checkout', {
                affiliate_ref: affiliateId
              });
            }
          }
        });
        
        // Also add to cart data (for tracking before checkout)
        $(document.body).on('added_to_cart', function() {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('affiliate_ref', affiliateId);
          }
        });
      }
    });
  }
  
  // Shopify Integration
  if (typeof Shopify !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
      var affiliateId = getCookie(COOKIE_NAME) || getCookie(TRACKING_COOKIE);
      
      if (affiliateId) {
        // Add to cart forms
        var forms = document.querySelectorAll('form[action*="/cart/add"]');
        forms.forEach(function(form) {
          form.addEventListener('submit', function(e) {
            if (affiliateId) {
              var input = document.createElement('input');
              input.type = 'hidden';
              input.name = 'properties[_affiliate_ref]';
              input.value = affiliateId;
              form.appendChild(input);
            }
          });
        });
        
        // Add to checkout
        if (typeof Shopify.checkout !== 'undefined') {
          Shopify.checkout.attributes = Shopify.checkout.attributes || {};
          Shopify.checkout.attributes._affiliate_ref = affiliateId;
        }
      }
    });
  }
  
  // Generic e-commerce: Store in sessionStorage for later use
  if (typeof sessionStorage !== 'undefined') {
    var storedRef = getCookie(COOKIE_NAME) || getCookie(TRACKING_COOKIE);
    if (storedRef) {
      sessionStorage.setItem('affiliate_ref', storedRef);
    }
  }
})();
`;

    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow cross-origin requests
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(script);
  } catch (error) {
    next(error);
  }
};

// Get click statistics
exports.getClickStats = async (req, res, next) => {
  try {
    const { storeId, affiliateId, startDate, endDate } = req.query;

    // Build query
    const query = {};
    if (storeId) query.store = storeId;
    if (affiliateId) query.affiliate = affiliateId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const stats = await Click.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalClicks: { $sum: 1 },
          uniqueClicks: { $addToSet: '$cookieId' },
          conversions: { $sum: { $cond: ['$converted', 1, 0] } },
          uniqueVisitors: { $addToSet: '$ipAddress' }
        }
      },
      {
        $project: {
          totalClicks: 1,
          uniqueClicks: { $size: '$uniqueClicks' },
          conversions: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' },
          conversionRate: {
            $cond: [
              { $eq: ['$totalClicks', 0] },
              0,
              { $multiply: [{ $divide: ['$conversions', '$totalClicks'] }, 100] }
            ]
          }
        }
      }
    ]);

    return sendResponse(res, 200, 'Click statistics retrieved successfully', 
      stats[0] || {
        totalClicks: 0,
        uniqueClicks: 0,
        conversions: 0,
        uniqueVisitors: 0,
        conversionRate: 0
      }
    );
  } catch (error) {
    next(error);
  }
};

