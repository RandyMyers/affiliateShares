const { validationResult } = require('express-validator');

/**
 * Validation middleware
 * Checks for validation errors and returns them if any
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  next();
};

/**
 * Validate request with validation rules
 * Returns a middleware that runs validation rules and checks for errors
 */
const validateRequest = (validationRules) => {
  return [
    ...validationRules,
    validate
  ];
};

module.exports = validate;
module.exports.validateRequest = validateRequest;

