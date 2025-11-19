const InvitationTemplate = require('../models/InvitationTemplate');
const Invitation = require('../models/Invitation');
const { sendResponse } = require('../utils/response');

// Get all templates for merchant
exports.getTemplates = async (req, res, next) => {
  try {
    const templates = await InvitationTemplate.find({ merchant: req.user.id })
      .sort({ createdAt: -1 });

    return sendResponse(res, 200, 'Templates retrieved successfully', templates);
  } catch (error) {
    next(error);
  }
};

// Get single template
exports.getTemplate = async (req, res, next) => {
  try {
    const { templateId } = req.params;

    const template = await InvitationTemplate.findOne({
      _id: templateId,
      merchant: req.user.id
    });

    if (!template) {
      return sendResponse(res, 404, 'Template not found', null);
    }

    return sendResponse(res, 200, 'Template retrieved successfully', template);
  } catch (error) {
    next(error);
  }
};

// Create template
exports.createTemplate = async (req, res, next) => {
  try {
    const { name, category, subject, message, mergeFields, defaultIncentives, isDefault } = req.body;

    if (!name || !subject || !message) {
      return sendResponse(res, 400, 'Name, subject, and message are required', null);
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await InvitationTemplate.updateMany(
        { merchant: req.user.id, isDefault: true },
        { isDefault: false }
      );
    }

    const template = new InvitationTemplate({
      merchant: req.user.id,
      name,
      category,
      subject,
      message,
      mergeFields: mergeFields || [
        { field: '{affiliate_name}', description: 'Affiliate username' },
        { field: '{merchant_name}', description: 'Merchant username' },
        { field: '{program_name}', description: 'Program/store name' },
        { field: '{store_name}', description: 'Store name' }
      ],
      defaultIncentives: defaultIncentives || {},
      isDefault: isDefault || false
    });

    await template.save();

    return sendResponse(res, 201, 'Template created successfully', template);
  } catch (error) {
    next(error);
  }
};

// Update template
exports.updateTemplate = async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const { name, category, subject, message, mergeFields, defaultIncentives, isDefault } = req.body;

    const template = await InvitationTemplate.findOne({
      _id: templateId,
      merchant: req.user.id
    });

    if (!template) {
      return sendResponse(res, 404, 'Template not found', null);
    }

    if (name) template.name = name;
    if (category !== undefined) template.category = category;
    if (subject) template.subject = subject;
    if (message) template.message = message;
    if (mergeFields) template.mergeFields = mergeFields;
    if (defaultIncentives) template.defaultIncentives = defaultIncentives;

    // Handle default flag
    if (isDefault !== undefined) {
      if (isDefault && !template.isDefault) {
        await InvitationTemplate.updateMany(
          { merchant: req.user.id, isDefault: true },
          { isDefault: false }
        );
      }
      template.isDefault = isDefault;
    }

    await template.save();

    return sendResponse(res, 200, 'Template updated successfully', template);
  } catch (error) {
    next(error);
  }
};

// Delete template
exports.deleteTemplate = async (req, res, next) => {
  try {
    const { templateId } = req.params;

    const template = await InvitationTemplate.findOne({
      _id: templateId,
      merchant: req.user.id
    });

    if (!template) {
      return sendResponse(res, 404, 'Template not found', null);
    }

    // Check if template is being used
    const usageCount = await Invitation.countDocuments({ template: templateId });
    if (usageCount > 0) {
      return sendResponse(res, 400, `Cannot delete template. It has been used in ${usageCount} invitation(s)`, null);
    }

    await InvitationTemplate.deleteOne({ _id: templateId });

    return sendResponse(res, 200, 'Template deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

// Duplicate template
exports.duplicateTemplate = async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const { name } = req.body;

    const originalTemplate = await InvitationTemplate.findOne({
      _id: templateId,
      merchant: req.user.id
    });

    if (!originalTemplate) {
      return sendResponse(res, 404, 'Template not found', null);
    }

    const newTemplate = new InvitationTemplate({
      merchant: req.user.id,
      name: name || `${originalTemplate.name} (Copy)`,
      category: originalTemplate.category,
      subject: originalTemplate.subject,
      message: originalTemplate.message,
      mergeFields: originalTemplate.mergeFields,
      defaultIncentives: originalTemplate.defaultIncentives,
      isDefault: false
    });

    await newTemplate.save();

    return sendResponse(res, 201, 'Template duplicated successfully', newTemplate);
  } catch (error) {
    next(error);
  }
};

