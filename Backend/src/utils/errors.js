/**
 * Custom Error Classes for Smart Maize Farming System
 * 
 * Provides standardized error handling with appropriate HTTP status codes
 * and error classification for API responses.
 * 
 * @module utils/errors
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request - Invalid input or malformed request
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

/**
 * 401 Unauthorized - Missing or invalid authentication
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

/**
 * 403 Forbidden - Authenticated but lacks permission
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

/**
 * 409 Conflict - Resource conflict (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

/**
 * 422 Unprocessable Entity - Validation errors
 */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = [], code = 'VALIDATION_ERROR') {
    super(message, 422, code);
    this.errors = errors;
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', code = 'RATE_LIMIT_EXCEEDED') {
    super(message, 429, code);
  }
}

/**
 * 503 Service Unavailable - External service failure
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', code = 'SERVICE_UNAVAILABLE') {
    super(message, 503, code);
  }
}

/**
 * Sensor-specific errors
 */
export class SensorDataError extends AppError {
  constructor(message = 'Invalid sensor data', code = 'SENSOR_DATA_ERROR') {
    super(message, 400, code);
  }
}

/**
 * IoT device authentication error
 */
export class DeviceAuthError extends AppError {
  constructor(message = 'Device authentication failed', code = 'DEVICE_AUTH_ERROR') {
    super(message, 401, code);
  }
}

/**
 * AI/ML service error
 */
export class AIServiceError extends AppError {
  constructor(message = 'AI service error', code = 'AI_SERVICE_ERROR') {
    super(message, 502, code);
  }
}

/**
 * Database operation error
 */
export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', code = 'DATABASE_ERROR') {
    super(message, 500, code);
  }
}

export default {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  ServiceUnavailableError,
  SensorDataError,
  DeviceAuthError,
  AIServiceError,
  DatabaseError
};
