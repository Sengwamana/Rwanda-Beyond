/**
 * Global Error Handler Middleware
 * 
 * Centralized error handling for all API routes with
 * appropriate logging and response formatting.
 * 
 * @module middleware/errorHandler
 */

import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import config from '../config/index.js';

/**
 * Not Found handler for undefined routes
 */
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString()
  });
};

/**
 * Global error handler
 */
export const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error('Error occurred:', {
    message: err.message,
    code: err.code,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  // Handle known operational errors
  if (err instanceof AppError) {
    const response = {
      success: false,
      message: err.message,
      code: err.code,
      timestamp: new Date().toISOString()
    };

    // Include validation errors if present
    if (err.errors) {
      response.errors = err.errors;
    }

    return res.status(err.statusCode).json(response);
  }

  // Handle Convex database errors
  if (err.message?.includes('ConvexError') || err.name === 'ConvexError' || err.code?.startsWith('CONV')) {
    let message = 'Database operation failed';
    let statusCode = 500;

    if (err.message?.includes('not found') || err.message?.includes('Document not found')) {
      message = 'Resource not found';
      statusCode = 404;
    } else if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
      message = 'Resource already exists';
      statusCode = 409;
    } else if (err.message?.includes('invalid') || err.message?.includes('validation')) {
      message = 'Invalid input';
      statusCode = 400;
    }

    return res.status(statusCode).json({
      success: false,
      message,
      code: 'DATABASE_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      code: 'AUTH_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  // Handle validation errors from express-validator
  if (err.array && typeof err.array === 'function') {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: err.array(),
      timestamp: new Date().toISOString()
    });
  }

  // Handle multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large',
      code: 'FILE_TOO_LARGE',
      timestamp: new Date().toISOString()
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field',
      code: 'UNEXPECTED_FILE',
      timestamp: new Date().toISOString()
    });
  }

  // Handle syntax errors in JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
      timestamp: new Date().toISOString()
    });
  }

  // Default internal server error
  // Don't expose internal error details in production
  const response = {
    success: false,
    message: config.server.isProduction 
      ? 'An unexpected error occurred' 
      : err.message,
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  };

  // Include stack trace in development
  if (config.server.isDevelopment) {
    response.stack = err.stack;
  }

  res.status(500).json(response);
};

/**
 * Async error wrapper for route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function with error handling
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default {
  notFoundHandler,
  errorHandler,
  asyncHandler
};
