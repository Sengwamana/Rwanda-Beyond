/**
 * User Service
 * 
 * Handles user management operations including CRUD operations,
 * role management, and profile updates.
 * 
 * @module services/userService
 */

import { db } from '../database/convex.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';
import logger from '../utils/logger.js';

const pickFields = (source, fields) =>
  Object.fromEntries(
    fields
      .filter((field) => source[field] !== undefined)
      .map((field) => [field, source[field]])
  );

const logUserAuditEvent = async (entry) => {
  try {
    await db.auditLogs.create(entry);
  } catch (error) {
    logger.warn('Failed to write user audit log:', error?.message || error);
  }
};

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User object
 */
export const getUserById = async (userId) => {
  const data = await db.users.getById(userId);
  if (!data) throw new NotFoundError('User not found');
  return { ...data, id: data._id };
};

/**
 * Get user by Clerk ID
 * @param {string} clerkId - Clerk user ID
 * @returns {Promise<Object>} User object
 */
export const getUserByClerkId = async (clerkId) => {
  const data = await db.users.getByClerkId(clerkId);
  if (!data) throw new NotFoundError('User not found');
  return { ...data, id: data._id };
};

/**
 * Get all users with pagination and filtering
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Users list with pagination info
 */
export const getUsers = async (options = {}) => {
  const {
    page = 1,
    limit = 20,
    role,
    isActive,
    search
  } = options;

  const result = await db.users.list({ page, limit, role, isActive, search });

  return {
    users: result.data.map(u => ({ ...u, id: u._id })),
    total: result.count,
    page,
    limit,
    totalPages: Math.ceil(result.count / limit)
  };
};

/**
 * Create a new user
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Created user
 */
export const createUser = async (userData) => {
  const {
    clerkId,
    email,
    phoneNumber,
    firstName,
    lastName,
    role = 'farmer',
    preferredLanguage = 'rw',
    profileImageUrl,
    metadata = {}
  } = userData;

  // Check for existing user with same clerk_id
  const existing = await db.users.getByClerkId(clerkId);
  if (existing) {
    throw new ConflictError('User already exists');
  }

  const data = await db.users.create({
    clerk_id: clerkId,
    email,
    phone_number: phoneNumber,
    first_name: firstName,
    last_name: lastName,
    role,
    preferred_language: preferredLanguage,
    profile_image_url: profileImageUrl,
    metadata
  });

  await logUserAuditEvent({
    user_id: data._id,
    action: 'CREATE_USER',
    entity_type: 'users',
    entity_id: data._id,
    new_values: pickFields(data, [
      'clerk_id',
      'email',
      'phone_number',
      'first_name',
      'last_name',
      'role',
      'preferred_language',
      'profile_image_url',
      'metadata',
      'is_active',
    ]),
  });

  logger.info(`User created: ${data._id}`);
  return { ...data, id: data._id };
};

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated user
 */
export const updateUser = async (userId, updateData) => {
  const currentUser = await getUserById(userId);

  const allowedFields = [
    'first_name',
    'last_name',
    'phone_number',
    'preferred_language',
    'profile_image_url',
    'metadata'
  ];

  // Map camelCase to snake_case and filter allowed fields
  const updates = {};
  const fieldMapping = {
    firstName: 'first_name',
    lastName: 'last_name',
    phoneNumber: 'phone_number',
    preferredLanguage: 'preferred_language',
    profileImageUrl: 'profile_image_url'
  };

  Object.entries(updateData).forEach(([key, value]) => {
    const dbField = fieldMapping[key] || key;
    if (allowedFields.includes(dbField) && value !== undefined) {
      updates[dbField] = value;
    }
  });

  if (Object.keys(updates).length === 0) {
    throw new BadRequestError('No valid fields to update');
  }

  const data = await db.users.update(userId, updates);
  if (!data) throw new NotFoundError('User not found');

  await logUserAuditEvent({
    user_id: userId,
    action: 'UPDATE_USER',
    entity_type: 'users',
    entity_id: userId,
    old_values: pickFields(currentUser, Object.keys(updates)),
    new_values: updates,
  });

  logger.info(`User updated: ${userId}`);
  return { ...data, id: data._id };
};

/**
 * Update user role (admin only)
 * @param {string} userId - User ID
 * @param {string} newRole - New role
 * @param {string} updatedBy - ID of admin making the change
 * @returns {Promise<Object>} Updated user
 */
export const updateUserRole = async (userId, newRole, updatedBy) => {
  const validRoles = ['farmer', 'expert', 'admin'];
  
  if (!validRoles.includes(newRole)) {
    throw new BadRequestError('Invalid role');
  }

  // Get current user for audit log
  const currentUser = await getUserById(userId);

  const data = await db.users.update(userId, { role: newRole });
  if (!data) throw new NotFoundError('User not found');

  // Create audit log entry
  await logUserAuditEvent({
    user_id: updatedBy,
    action: 'UPDATE_USER_ROLE',
    entity_type: 'users',
    entity_id: userId,
    old_values: { role: currentUser.role },
    new_values: { role: newRole }
  });

  logger.info(`User role updated: ${userId} -> ${newRole} by ${updatedBy}`);
  return { ...data, id: data._id };
};

/**
 * Deactivate user account
 * @param {string} userId - User ID
 * @param {string} deactivatedBy - ID of admin making the change
 * @returns {Promise<Object>} Updated user
 */
export const deactivateUser = async (userId, deactivatedBy) => {
  const currentUser = await getUserById(userId);
  const data = await db.users.update(userId, { is_active: false });
  if (!data) throw new NotFoundError('User not found');

  // Create audit log entry
  await logUserAuditEvent({
    user_id: deactivatedBy,
    action: 'DEACTIVATE_USER',
    entity_type: 'users',
    entity_id: userId,
    old_values: { is_active: currentUser.is_active },
    new_values: { is_active: false },
  });

  logger.info(`User deactivated: ${userId} by ${deactivatedBy}`);
  return { ...data, id: data._id };
};

/**
 * Reactivate user account
 * @param {string} userId - User ID
 * @param {string} reactivatedBy - ID of admin making the change
 * @returns {Promise<Object>} Updated user
 */
export const reactivateUser = async (userId, reactivatedBy) => {
  const currentUser = await getUserById(userId);
  const data = await db.users.update(userId, { is_active: true });
  if (!data) throw new NotFoundError('User not found');

  // Create audit log entry
  await logUserAuditEvent({
    user_id: reactivatedBy,
    action: 'REACTIVATE_USER',
    entity_type: 'users',
    entity_id: userId,
    old_values: { is_active: currentUser.is_active },
    new_values: { is_active: true },
  });

  logger.info(`User reactivated: ${userId} by ${reactivatedBy}`);
  return { ...data, id: data._id };
};

/**
 * Get user statistics
 * @returns {Promise<Object>} User statistics
 */
export const getUserStats = async () => {
  const data = await db.users.getStats();

  const stats = {
    total: data.length,
    active: data.filter(u => u.is_active).length,
    inactive: data.filter(u => !u.is_active).length,
    byRole: {
      farmer: data.filter(u => u.role === 'farmer').length,
      expert: data.filter(u => u.role === 'expert').length,
      admin: data.filter(u => u.role === 'admin').length
    }
  };

  return stats;
};

export default {
  getUserById,
  getUserByClerkId,
  getUsers,
  createUser,
  updateUser,
  updateUserRole,
  deactivateUser,
  reactivateUser,
  getUserStats
};
