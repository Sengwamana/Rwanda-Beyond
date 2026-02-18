/**
 * Clerk Authentication Middleware
 * 
 * Provides authentication and authorization middleware for protecting routes
 * with Clerk JWT verification and role-based access control.
 * 
 * @module middleware/auth
 */

import { clerkClient, verifyToken } from '@clerk/clerk-sdk-node';
import config from '../config/index.js';
import { db } from '../database/convex.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * User roles hierarchy
 */
export const ROLES = {
  FARMER: 'farmer',
  EXPERT: 'expert',
  ADMIN: 'admin'
};

/**
 * Role hierarchy for permission checking
 * Higher index = more permissions
 */
const ROLE_HIERARCHY = [ROLES.FARMER, ROLES.EXPERT, ROLES.ADMIN];

/**
 * Extract and verify JWT token from Authorization header
 * @param {Request} req - Express request object
 * @returns {Promise<Object>} Decoded token payload
 */
const extractAndVerifyToken = async (req) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = await verifyToken(token, {
      secretKey: config.clerk.secretKey
    });
    return payload;
  } catch (error) {
    logger.warn('Token verification failed:', error.message);
    throw new UnauthorizedError('Invalid or expired token');
  }
};

/**
 * Get or create user in database from Clerk data
 * @param {string} clerkId - Clerk user ID
 * @returns {Promise<Object>} User object from database
 */
const getOrCreateUser = async (clerkId) => {
  // First, try to find existing user
  let user = await db.users.getByClerkId(clerkId);

  // If user doesn't exist, create from Clerk data
  if (!user) {
    try {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      
      const newUser = {
        clerk_id: clerkId,
        email: clerkUser.emailAddresses[0]?.emailAddress,
        phone_number: clerkUser.phoneNumbers[0]?.phoneNumber,
        first_name: clerkUser.firstName,
        last_name: clerkUser.lastName,
        profile_image_url: clerkUser.imageUrl,
        role: 'farmer', // Default role
        is_active: true,
        is_verified: clerkUser.emailAddresses[0]?.verification?.status === 'verified'
      };

      user = await db.users.create(newUser);
      logger.info(`New user created: ${user._id} (${user.email})`);
    } catch (clerkError) {
      logger.error('Failed to fetch Clerk user:', clerkError);
      throw new UnauthorizedError('Failed to verify user identity');
    }
  }

  // Update last login
  await db.users.update(user._id, { last_login_at: new Date().toISOString() });

  return user;
};

/**
 * Main authentication middleware
 * Verifies JWT and attaches user to request
 */
export const authenticate = async (req, res, next) => {
  try {
    const payload = await extractAndVerifyToken(req);
    const user = await getOrCreateUser(payload.sub);

    if (!user.is_active) {
      throw new ForbiddenError('User account is deactivated');
    }

    // Attach user to request
    req.user = user;
    req.clerkId = payload.sub;
    
    next();
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token present, but doesn't require it
 */
export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const payload = await extractAndVerifyToken(req);
    const user = await getOrCreateUser(payload.sub);
    req.user = user;
    req.clerkId = payload.sub;
  } catch (error) {
    // Silently continue without user
    logger.debug('Optional auth failed:', error.message);
  }
  
  next();
};

/**
 * Role-based authorization middleware factory
 * @param {...string} allowedRoles - Roles allowed to access the route
 * @returns {Function} Express middleware
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role;
    
    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(userRole)) {
      logger.warn(`Access denied for user ${req.user.id} with role ${userRole}`);
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        code: 'FORBIDDEN'
      });
    }

    next();
  };
};

/**
 * Check if user has minimum role level
 * @param {string} minimumRole - Minimum required role
 * @returns {Function} Express middleware
 */
export const requireMinimumRole = (minimumRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRoleIndex = ROLE_HIERARCHY.indexOf(req.user.role);
    const requiredRoleIndex = ROLE_HIERARCHY.indexOf(minimumRole);

    if (userRoleIndex < requiredRoleIndex) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        code: 'FORBIDDEN'
      });
    }

    next();
  };
};

/**
 * Resource ownership middleware factory
 * Checks if user owns the requested resource or has elevated privileges
 * @param {Function} getResourceUserId - Function to extract user ID from request
 * @returns {Function} Express middleware
 */
export const requireOwnership = (getResourceUserId) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Admins and experts can access any resource
    if ([ROLES.ADMIN, ROLES.EXPERT].includes(req.user.role)) {
      return next();
    }

    try {
      const resourceUserId = await getResourceUserId(req);
      
      if (resourceUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this resource',
          code: 'RESOURCE_ACCESS_DENIED'
        });
      }

      next();
    } catch (error) {
      logger.error('Ownership check failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify resource access',
        code: 'ACCESS_CHECK_FAILED'
      });
    }
  };
};

export default {
  authenticate,
  optionalAuth,
  authorize,
  requireMinimumRole,
  requireOwnership,
  ROLES
};
