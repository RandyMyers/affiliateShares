const SavedSearch = require('../models/SavedSearch');
const { sendResponse } = require('../utils/response');

// Get all saved searches
exports.getSavedSearches = async (req, res, next) => {
  try {
    const savedSearches = await SavedSearch.find({ merchant: req.user.id })
      .sort({ createdAt: -1 });

    return sendResponse(res, 200, 'Saved searches retrieved successfully', savedSearches);
  } catch (error) {
    next(error);
  }
};

// Get single saved search
exports.getSavedSearch = async (req, res, next) => {
  try {
    const { searchId } = req.params;

    const savedSearch = await SavedSearch.findOne({
      _id: searchId,
      merchant: req.user.id
    });

    if (!savedSearch) {
      return sendResponse(res, 404, 'Saved search not found', null);
    }

    return sendResponse(res, 200, 'Saved search retrieved successfully', savedSearch);
  } catch (error) {
    next(error);
  }
};

// Create saved search
exports.createSavedSearch = async (req, res, next) => {
  try {
    const { name, criteria, alerts } = req.body;

    if (!name || !criteria) {
      return sendResponse(res, 400, 'Name and criteria are required', null);
    }

    const savedSearch = new SavedSearch({
      merchant: req.user.id,
      name,
      criteria: {
        searchQuery: criteria.searchQuery || '',
        categories: criteria.categories || [],
        filters: criteria.filters || {},
        sortBy: criteria.sortBy || 'relevance',
        sortOrder: criteria.sortOrder || 'desc'
      },
      alerts: alerts || {
        enabled: false,
        frequency: 'weekly',
        emailNotifications: true
      }
    });

    await savedSearch.save();

    return sendResponse(res, 201, 'Saved search created successfully', savedSearch);
  } catch (error) {
    next(error);
  }
};

// Update saved search
exports.updateSavedSearch = async (req, res, next) => {
  try {
    const { searchId } = req.params;
    const { name, criteria, alerts } = req.body;

    const savedSearch = await SavedSearch.findOne({
      _id: searchId,
      merchant: req.user.id
    });

    if (!savedSearch) {
      return sendResponse(res, 404, 'Saved search not found', null);
    }

    if (name) savedSearch.name = name;
    if (criteria) savedSearch.criteria = { ...savedSearch.criteria, ...criteria };
    if (alerts) savedSearch.alerts = { ...savedSearch.alerts, ...alerts };

    await savedSearch.save();

    return sendResponse(res, 200, 'Saved search updated successfully', savedSearch);
  } catch (error) {
    next(error);
  }
};

// Delete saved search
exports.deleteSavedSearch = async (req, res, next) => {
  try {
    const { searchId } = req.params;

    const savedSearch = await SavedSearch.findOne({
      _id: searchId,
      merchant: req.user.id
    });

    if (!savedSearch) {
      return sendResponse(res, 404, 'Saved search not found', null);
    }

    await SavedSearch.deleteOne({ _id: searchId });

    return sendResponse(res, 200, 'Saved search deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

// Execute saved search (returns search criteria for use in discovery endpoint)
exports.executeSavedSearch = async (req, res, next) => {
  try {
    const { searchId } = req.params;

    const savedSearch = await SavedSearch.findOne({
      _id: searchId,
      merchant: req.user.id
    });

    if (!savedSearch) {
      return sendResponse(res, 404, 'Saved search not found', null);
    }

    // Return the criteria to be used with discovery endpoint
    return sendResponse(res, 200, 'Search criteria retrieved successfully', {
      criteria: savedSearch.criteria,
      name: savedSearch.name
    });
  } catch (error) {
    next(error);
  }
};

// Toggle alerts
exports.toggleAlerts = async (req, res, next) => {
  try {
    const { searchId } = req.params;
    const { enabled } = req.body;

    const savedSearch = await SavedSearch.findOne({
      _id: searchId,
      merchant: req.user.id
    });

    if (!savedSearch) {
      return sendResponse(res, 404, 'Saved search not found', null);
    }

    savedSearch.alerts.enabled = enabled !== undefined ? enabled : !savedSearch.alerts.enabled;
    await savedSearch.save();

    return sendResponse(res, 200, `Alerts ${savedSearch.alerts.enabled ? 'enabled' : 'disabled'}`, savedSearch);
  } catch (error) {
    next(error);
  }
};

