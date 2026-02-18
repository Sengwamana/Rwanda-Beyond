/**
 * Response Helper Utilities
 * 
 * Standardized API response formatting for consistent client communication.
 * 
 * @module utils/response
 */

/**
 * Send a successful response
 * @param {Response} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
export const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Send a created response (201)
 * @param {Response} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} message - Success message
 */
export const createdResponse = (res, data = null, message = 'Resource created successfully') => {
  return successResponse(res, data, message, 201);
};

/**
 * Send an error response
 * @param {Response} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {string} code - Error code
 * @param {Array} errors - Validation errors array
 */
export const errorResponse = (res, message = 'An error occurred', statusCode = 500, code = 'ERROR', errors = null) => {
  const response = {
    success: false,
    message,
    code,
    timestamp: new Date().toISOString()
  };
  
  if (errors) {
    response.errors = errors;
  }
  
  return res.status(statusCode).json(response);
};

/**
 * Send a paginated response
 * @param {Response} res - Express response object
 * @param {Array} data - Array of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @param {string} message - Success message
 */
export const paginatedResponse = (res, data, page, limit, total, message = 'Success') => {
  const totalPages = Math.ceil(total / limit);
  
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * Send a no content response (204)
 * @param {Response} res - Express response object
 */
export const noContentResponse = (res) => {
  return res.status(204).send();
};

export default {
  successResponse,
  createdResponse,
  errorResponse,
  paginatedResponse,
  noContentResponse
};
