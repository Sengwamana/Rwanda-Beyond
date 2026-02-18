/**
 * User Routes
 * 
 * API endpoints for user management operations.
 * 
 * @module routes/users
 */

import { Router } from 'express';
import { authenticate, authorize, ROLES, requireMinimumRole } from '../middleware/auth.js';
import { validateUserUpdate, validateRoleAssignment, validatePagination, validateUUID, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { successResponse, paginatedResponse } from '../utils/response.js';
import * as userService from '../services/userService.js';

const router = Router();

/**
 * @route GET /api/v1/users
 * @desc Get all users (admin only)
 * @access Admin
 */
router.get('/',
  authenticate,
  authorize(ROLES.ADMIN),
  validatePagination,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page, limit, role, isActive, search } = req.query;
    
    const result = await userService.getUsers({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      role,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search
    });

    return paginatedResponse(
      res,
      result.users,
      result.page,
      result.limit,
      result.total,
      'Users retrieved successfully'
    );
  })
);

/**
 * @route GET /api/v1/users/me
 * @desc Get current user profile
 * @access Authenticated
 */
router.get('/me',
  authenticate,
  asyncHandler(async (req, res) => {
    return successResponse(res, req.user, 'Profile retrieved successfully');
  })
);

/**
 * @route PUT /api/v1/users/me
 * @desc Update current user profile
 * @access Authenticated
 */
router.put('/me',
  authenticate,
  validateUserUpdate,
  asyncHandler(async (req, res) => {
    const updatedUser = await userService.updateUser(req.user.id, req.body);
    return successResponse(res, updatedUser, 'Profile updated successfully');
  })
);

/**
 * @route GET /api/v1/users/stats
 * @desc Get user statistics
 * @access Admin
 */
router.get('/stats',
  authenticate,
  authorize(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const stats = await userService.getUserStats();
    return successResponse(res, stats, 'User statistics retrieved successfully');
  })
);

/**
 * @route GET /api/v1/users/:userId
 * @desc Get user by ID
 * @access Admin, Expert
 */
router.get('/:userId',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  ...validateUUID('userId'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.params.userId);
    return successResponse(res, user, 'User retrieved successfully');
  })
);

/**
 * @route PUT /api/v1/users/:userId/role
 * @desc Update user role
 * @access Admin
 */
router.put('/:userId/role',
  authenticate,
  authorize(ROLES.ADMIN),
  ...validateUUID('userId'),
  validateRoleAssignment,
  asyncHandler(async (req, res) => {
    const updatedUser = await userService.updateUserRole(
      req.params.userId,
      req.body.role,
      req.user.id
    );
    return successResponse(res, updatedUser, 'User role updated successfully');
  })
);

/**
 * @route POST /api/v1/users/:userId/deactivate
 * @desc Deactivate user account
 * @access Admin
 */
router.post('/:userId/deactivate',
  authenticate,
  authorize(ROLES.ADMIN),
  ...validateUUID('userId'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const user = await userService.deactivateUser(req.params.userId, req.user.id);
    return successResponse(res, user, 'User deactivated successfully');
  })
);

/**
 * @route POST /api/v1/users/:userId/reactivate
 * @desc Reactivate user account
 * @access Admin
 */
router.post('/:userId/reactivate',
  authenticate,
  authorize(ROLES.ADMIN),
  ...validateUUID('userId'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const user = await userService.reactivateUser(req.params.userId, req.user.id);
    return successResponse(res, user, 'User reactivated successfully');
  })
);

export default router;
