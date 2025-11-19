const analyticsService = require('../services/analyticsService');
const { sendResponse } = require('../utils/response');

// Get dashboard statistics
exports.getDashboardStats = async (req, res, next) => {
  try {
    const { startDate, endDate, days } = req.query;
    
    const dateRange = {};
    if (startDate && endDate) {
      dateRange.startDate = startDate;
      dateRange.endDate = endDate;
    } else if (days) {
      dateRange.days = parseInt(days);
    }

    const stats = await analyticsService.getDashboardStats(req.user.id, dateRange);
    
    return sendResponse(res, 200, 'Dashboard stats retrieved successfully', stats);
  } catch (error) {
    next(error);
  }
};

// Get program statistics
exports.getProgramStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, days } = req.query;
    
    const dateRange = {};
    if (startDate && endDate) {
      dateRange.startDate = startDate;
      dateRange.endDate = endDate;
    } else if (days) {
      dateRange.days = parseInt(days);
    }

    const stats = await analyticsService.getProgramStats(id, dateRange);
    
    return sendResponse(res, 200, 'Program stats retrieved successfully', stats);
  } catch (error) {
    next(error);
  }
};

// Get affiliate statistics
exports.getAffiliateStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, days } = req.query;
    
    // If user is affiliate, only allow access to their own stats
    if (req.user.role === 'affiliate' && req.user.id !== id) {
      return sendResponse(res, 403, 'Access denied', null);
    }
    
    const dateRange = {};
    if (startDate && endDate) {
      dateRange.startDate = startDate;
      dateRange.endDate = endDate;
    } else if (days) {
      dateRange.days = parseInt(days);
    }

    const stats = await analyticsService.getAffiliateStats(id, dateRange);
    
    return sendResponse(res, 200, 'Affiliate stats retrieved successfully', stats);
  } catch (error) {
    next(error);
  }
};

// Get time series data
exports.getTimeSeriesData = async (req, res, next) => {
  try {
    const { type, startDate, endDate, days } = req.query;
    
    if (!type) {
      return sendResponse(res, 400, 'Type parameter is required (revenue, orders, clicks, commissions)', null);
    }

    if (!['revenue', 'orders', 'clicks', 'commissions'].includes(type)) {
      return sendResponse(res, 400, 'Invalid type. Must be one of: revenue, orders, clicks, commissions', null);
    }
    
    const dateRange = {};
    if (startDate && endDate) {
      dateRange.startDate = startDate;
      dateRange.endDate = endDate;
    } else if (days) {
      dateRange.days = parseInt(days);
    }

    const data = await analyticsService.getTimeSeriesData(req.user.id, type, dateRange);
    
    return sendResponse(res, 200, 'Time series data retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

