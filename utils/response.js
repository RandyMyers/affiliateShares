/**
 * Success response formatter
 */
const successResponse = (res, statusCode = 200, message = 'Success', data = null) => {
  const response = {
    success: true,
    message
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Error response formatter
 */
const errorResponse = (res, statusCode = 400, message = 'Error', errors = null) => {
  const response = {
    success: false,
    message
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Unified response formatter (alias for successResponse/errorResponse)
 */
const sendResponse = (res, statusCode = 200, message = 'Success', data = null) => {
  if (statusCode >= 200 && statusCode < 300) {
    return successResponse(res, statusCode, message, data);
  } else {
    return errorResponse(res, statusCode, message, data);
  }
};

module.exports = {
  successResponse,
  errorResponse,
  sendResponse
};

