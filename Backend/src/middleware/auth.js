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
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../utils/errors.js';
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

const normalizeRole = (role, fallback = ROLES.FARMER) => {
  if (role === ROLES.ADMIN || role === ROLES.EXPERT || role === ROLES.FARMER) {
    return role;
  }
  return fallback;
};

const normalizeEmail = (email) => {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

const isBootstrapAdminEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return config.auth.bootstrapAdminEmails.includes(normalized);
};

const toApiUser = (user) => {
  if (!user) return null;
  return {
    ...user,
    id: user._id || user.id,
  };
};

const isDatabaseUnavailableError = (error) => {
  const code = error?.cause?.code || error?.code;
  const message = String(error?.message || '').toLowerCase();
  return code === 'ECONNREFUSED' || code === 'ENOTFOUND' || message.includes('fetch failed');
};

const logUserAuditEvent = async (entry) => {
  try {
    await db.auditLogs.create({
      ...entry,
      created_at: Date.now(),
    });
  } catch (auditError) {
    logger.warn('Failed to write auth audit log:', auditError.message);
  }
};

/**
 * Extract and verify JWT token from Authorization header
 * @param {Request} req - Express request object
 * @returns {Promise<Object>} Decoded token payload
 */
const extractAndVerifyToken = async (req) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header', 'AUTH_FAILED');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = await verifyToken(token, {
      secretKey: config.clerk.secretKey
    });
    return payload;
  } catch (error) {
    logger.warn('Token verification failed:', error.message);
    throw new UnauthorizedError('Invalid or expired token', 'AUTH_FAILED');
  }
};

/**
 * Get or create user in database from Clerk data
 * @param {string} clerkId - Clerk user ID
 * @returns {Promise<Object>} User object from database
 */
const getOrCreateUser = async (clerkId, tokenPayload = {}) => {
  // First, try to find existing user
  let user = await db.users.getByClerkId(clerkId);

  // If user doesn't exist, create from Clerk data
  if (!user) {
    const metadataRole = tokenPayload?.metadata?.role
      || tokenPayload?.publicMetadata?.role
      || tokenPayload?.unsafeMetadata?.role;
    const inferredProfile = {
      email: tokenPayload?.email || undefined,
      phone_number: tokenPayload?.phone_number || undefined,
      first_name: tokenPayload?.given_name || tokenPayload?.first_name || undefined,
      last_name: tokenPayload?.family_name || tokenPayload?.last_name || undefined,
      profile_image_url: tokenPayload?.picture || undefined,
      is_verified: Boolean(tokenPayload?.email_verified),
    };

    let clerkProfile = {};
    try {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      clerkProfile = {
        email: clerkUser.emailAddresses[0]?.emailAddress,
        phone_number: clerkUser.phoneNumbers[0]?.phoneNumber,
        first_name: clerkUser.firstName,
        last_name: clerkUser.lastName,
        profile_image_url: clerkUser.imageUrl,
        is_verified: clerkUser.emailAddresses[0]?.verification?.status === 'verified',
        role: clerkUser?.publicMetadata?.role || clerkUser?.unsafeMetadata?.role,
      };
    } catch (clerkError) {
      // Do not hard-fail bootstrap when Clerk profile fetch is unavailable.
      logger.warn('Failed to fetch Clerk user during bootstrap, using token claims only:', clerkError.message);
    }

    const newUser = {
      clerk_id: clerkId,
      email: clerkProfile.email || inferredProfile.email,
      phone_number: clerkProfile.phone_number || inferredProfile.phone_number,
      first_name: clerkProfile.first_name || inferredProfile.first_name,
      last_name: clerkProfile.last_name || inferredProfile.last_name,
      profile_image_url: clerkProfile.profile_image_url || inferredProfile.profile_image_url,
      role: (() => {
        const requestedRole = normalizeRole(clerkProfile.role || metadataRole, ROLES.FARMER);
        const email = clerkProfile.email || inferredProfile.email;

        if (isBootstrapAdminEmail(email)) {
          return ROLES.ADMIN;
        }

        // Prevent open self-assignment of admin through client-managed metadata.
        if (requestedRole === ROLES.ADMIN) {
          logger.warn(`Blocked unauthorized admin bootstrap for ${clerkId} (${email || 'unknown-email'})`);
          return ROLES.FARMER;
        }

        return requestedRole;
      })(),
      preferred_language: tokenPayload?.locale || 'en',
      metadata: {
        is_verified: Boolean(clerkProfile.is_verified ?? inferredProfile.is_verified),
      },
    };

    try {
      user = await db.users.create(newUser);
      await logUserAuditEvent({
        user_id: user._id,
        action: 'CREATE_USER',
        entity_type: 'users',
        entity_id: user._id,
        new_values: {
          clerk_id: user.clerk_id,
          email: user.email,
          phone_number: user.phone_number,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          preferred_language: user.preferred_language,
          profile_image_url: user.profile_image_url,
          metadata: user.metadata,
          is_active: user.is_active,
        },
      });
      logger.info(`New user created: ${user._id} (${user.email})`);
    } catch (createError) {
      // Handle race condition where another request created this user first.
      logger.warn('User bootstrap create failed, retrying lookup:', createError.message);
      user = await db.users.getByClerkId(clerkId);
      if (!user) {
        throw createError;
      }
    }
  } else {
    try {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const metadataRole = clerkUser?.publicMetadata?.role || clerkUser?.unsafeMetadata?.role;
      const normalizedRole = normalizeRole(metadataRole, user.role);
      const clerkEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || user.email;

      let nextRole = normalizedRole;

      if (isBootstrapAdminEmail(clerkEmail)) {
        nextRole = ROLES.ADMIN;
      }

      // Allow admin elevation from Clerk metadata only for configured bootstrap emails.
      if (normalizedRole === ROLES.ADMIN && user.role !== ROLES.ADMIN && !isBootstrapAdminEmail(clerkEmail)) {
        logger.warn(`Ignoring unauthorized admin role sync for ${clerkId} (${clerkEmail || 'unknown-email'})`);
        nextRole = user.role;
      }

      if (nextRole !== user.role) {
        const previousRole = user.role;
        user = await db.users.update(user._id, {
          role: nextRole,
          updated_at: Date.now(),
        });
        await logUserAuditEvent({
          user_id: user._id,
          action: 'UPDATE_USER_ROLE',
          entity_type: 'users',
          entity_id: user._id,
          old_values: { role: previousRole },
          new_values: { role: nextRole },
        });
      }
    } catch (clerkError) {
      logger.warn('Failed to sync user role from Clerk metadata:', clerkError.message);
    }
  }

  // Update last login (best effort)
  try {
    const previousLastLogin = user.last_login_at ?? null;
    const nextLastLogin = Date.now();
    user = await db.users.update(user._id, { last_login_at: nextLastLogin });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await logUserAuditEvent({
      user_id: user._id,
      action: 'UPDATE_USER_LAST_LOGIN',
      entity_type: 'users',
      entity_id: user._id,
      old_values: { last_login_at: previousLastLogin },
      new_values: { last_login_at: nextLastLogin },
    });
  } catch (lastLoginError) {
    if (lastLoginError instanceof NotFoundError) {
      throw lastLoginError;
    }

    logger.warn('Failed to update last login timestamp:', lastLoginError.message);
  }

  return toApiUser(user);
};

/**
 * Main authentication middleware
 * Verifies JWT and attaches user to request
 */
export const authenticate = async (req, res, next) => {
  try {
    const payload = await extractAndVerifyToken(req);
    const user = await getOrCreateUser(payload.sub, payload);

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

    if (isDatabaseUnavailableError(error)) {
      logger.error('Authentication middleware database unavailable:', error);
      return res.status(503).json({
        success: false,
        message: 'Database service unavailable',
        code: 'DB_UNAVAILABLE'
      });
    }

    logger.error('Authentication middleware internal failure:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication service unavailable',
      code: 'AUTH_INTERNAL'
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
    const user = await getOrCreateUser(payload.sub, payload);
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
      const normalizedResourceUserId =
        resourceUserId && typeof resourceUserId === 'object'
          ? (resourceUserId.user_id || resourceUserId.userId || resourceUserId.id || resourceUserId._id)
          : resourceUserId;
      
      if (!normalizedResourceUserId || String(normalizedResourceUserId) !== String(req.user.id)) {
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
