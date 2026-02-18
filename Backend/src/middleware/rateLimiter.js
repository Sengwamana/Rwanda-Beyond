/**
 * Rate Limiting Middleware
 * 
 * Protects API endpoints from abuse with configurable rate limits
 * based on endpoint sensitivity and user roles.
 * 
 * @module middleware/rateLimiter
 */

import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Create rate limit error response
 */
const createLimitResponse = (req, res) => {
  logger.warn('Rate limit exceeded:', {
    ip: req.ip,
    path: req.path,
    userId: req.user?.id
  });

  res.status(429).json({
    success: false,
    message: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000),
    timestamp: new Date().toISOString()
  });
};

/**
 * Standard rate limiter for general API endpoints
 */
export const standardLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs, // 15 minutes
  max: config.security.rateLimitMaxRequests, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitResponse,
  skip: (req) => {
    // Skip rate limiting for admin users
    return req.user?.role === 'admin';
  }
});

// Alias for backwards compatibility
export const apiLimiter = standardLimiter;

/**
 * Strict rate limiter for sensitive endpoints (auth, password reset)
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitResponse
});

/**
 * IoT device rate limiter (higher limits for sensor data)
 */
export const iotLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute (1 per second average)
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by device ID instead of IP
    return req.headers['x-device-id'] || req.ip;
  },
  handler: createLimitResponse
});

/**
 * Upload rate limiter for image uploads
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitResponse
});

/**
 * Analytics rate limiter (expensive queries)
 */
export const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitResponse
});

/**
 * SMS/Notification rate limiter
 */
export const notificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 notifications per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID
    return req.user?.id || req.ip;
  },
  handler: createLimitResponse
});

export default {
  standardLimiter,
  strictLimiter,
  iotLimiter,
  uploadLimiter,
  analyticsLimiter,
  notificationLimiter
};
