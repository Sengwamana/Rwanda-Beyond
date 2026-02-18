/**
 * Farm Routes
 * 
 * API endpoints for farm management operations.
 * 
 * @module routes/farms
 */

import { Router } from 'express';
import { authenticate, authorize, ROLES, requireOwnership, requireMinimumRole } from '../middleware/auth.js';
import { validateFarmCreation, validateFarmUpdate, validatePagination, validateUUID, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { successResponse, createdResponse, paginatedResponse, noContentResponse } from '../utils/response.js';
import { db } from '../database/convex.js';
import * as farmService from '../services/farmService.js';

const router = Router();

/**
 * Get farm user ID for ownership check
 */
const getFarmUserId = async (req) => {
  return await db.farms.getUserId(req.params.farmId);
};

/**
 * @route GET /api/v1/farms
 * @desc Get farms (own farms for farmers, all farms for admin/expert)
 * @access Authenticated
 */
router.get('/',
  authenticate,
  validatePagination,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page, limit, districtId, isActive, search, userId } = req.query;

    let result;
    
    if (req.user.role === ROLES.FARMER) {
      // Farmers can only see their own farms
      result = await farmService.getUserFarms(req.user.id, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined
      });
    } else {
      // Admins and experts can see all farms
      result = await farmService.getAllFarms({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        districtId,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        search,
        userId
      });
    }

    return paginatedResponse(
      res,
      result.farms,
      result.page,
      result.limit,
      result.total,
      'Farms retrieved successfully'
    );
  })
);

/**
 * @route GET /api/v1/farms/districts
 * @desc Get all districts
 * @access Public
 */
router.get('/districts',
  asyncHandler(async (req, res) => {
    const districts = await farmService.getDistricts();
    return successResponse(res, districts, 'Districts retrieved successfully');
  })
);

/**
 * @route GET /api/v1/farms/stats
 * @desc Get farm statistics
 * @access Authenticated
 */
router.get('/stats',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.role === ROLES.FARMER ? req.user.id : null;
    const stats = await farmService.getFarmStats(userId);
    return successResponse(res, stats, 'Farm statistics retrieved successfully');
  })
);

/**
 * @route POST /api/v1/farms
 * @desc Create a new farm
 * @access Authenticated
 */
router.post('/',
  authenticate,
  validateFarmCreation,
  asyncHandler(async (req, res) => {
    const farm = await farmService.createFarm(req.user.id, req.body);
    return createdResponse(res, farm, 'Farm created successfully');
  })
);

/**
 * @route GET /api/v1/farms/:farmId
 * @desc Get farm by ID
 * @access Owner, Admin, Expert
 */
router.get('/:farmId',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const farm = await farmService.getFarmById(req.params.farmId);
    return successResponse(res, farm, 'Farm retrieved successfully');
  })
);

/**
 * @route GET /api/v1/farms/:farmId/summary
 * @desc Get farm summary with latest data
 * @access Owner, Admin, Expert
 */
router.get('/:farmId/summary',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const summary = await farmService.getFarmSummary(req.params.farmId);
    return successResponse(res, summary, 'Farm summary retrieved successfully');
  })
);

/**
 * @route PUT /api/v1/farms/:farmId
 * @desc Update farm
 * @access Owner, Admin
 */
router.put('/:farmId',
  authenticate,
  ...validateUUID('farmId'),
  validateFarmUpdate,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const farm = await farmService.updateFarm(req.params.farmId, req.body, req.user.id);
    return successResponse(res, farm, 'Farm updated successfully');
  })
);

/**
 * @route DELETE /api/v1/farms/:farmId
 * @desc Delete farm (soft delete)
 * @access Owner, Admin
 */
router.delete('/:farmId',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    await farmService.deleteFarm(req.params.farmId, req.user.id);
    return noContentResponse(res);
  })
);

// ============ IRRIGATION SCHEDULES ============

/**
 * @route GET /api/v1/farms/:farmId/irrigation
 * @desc Get irrigation schedules for a farm
 * @access Owner, Admin, Expert
 */
router.get('/:farmId/irrigation',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const { isExecuted, afterDate, limit } = req.query;
    const opts = {};
    if (isExecuted !== undefined) opts.isExecuted = isExecuted === 'true';
    if (afterDate) opts.afterDate = afterDate;
    if (limit) opts.limit = parseInt(limit);

    const schedules = await db.irrigationSchedules.getByFarm(req.params.farmId, opts);
    return successResponse(res, schedules, 'Irrigation schedules retrieved successfully');
  })
);

/**
 * @route POST /api/v1/farms/:farmId/irrigation
 * @desc Create an irrigation schedule for a farm
 * @access Owner, Admin
 */
router.post('/:farmId/irrigation',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const data = {
      ...req.body,
      farmId: req.params.farmId,
    };
    const schedule = await db.irrigationSchedules.create(data);
    return createdResponse(res, schedule, 'Irrigation schedule created successfully');
  })
);

/**
 * @route PUT /api/v1/farms/:farmId/irrigation/:scheduleId/execute
 * @desc Mark an irrigation schedule as executed
 * @access Owner, Admin
 */
router.put('/:farmId/irrigation/:scheduleId/execute',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const schedule = await db.irrigationSchedules.update(req.params.scheduleId, {
      isExecuted: true,
      executedAt: new Date().toISOString(),
      ...req.body,
    });
    return successResponse(res, schedule, 'Irrigation schedule marked as executed');
  })
);

// ============ FERTILIZATION SCHEDULES ============

/**
 * @route GET /api/v1/farms/:farmId/fertilization
 * @desc Get fertilization schedules for a farm
 * @access Owner, Admin, Expert
 */
router.get('/:farmId/fertilization',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const { since, isExecuted } = req.query;
    const opts = {};
    if (since) opts.since = since;
    if (isExecuted !== undefined) opts.isExecuted = isExecuted === 'true';

    const schedules = await db.fertilizationSchedules.getByFarm(req.params.farmId, opts);
    return successResponse(res, schedules, 'Fertilization schedules retrieved successfully');
  })
);

/**
 * @route POST /api/v1/farms/:farmId/fertilization
 * @desc Create a fertilization schedule for a farm
 * @access Owner, Admin
 */
router.post('/:farmId/fertilization',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const data = {
      ...req.body,
      farmId: req.params.farmId,
    };
    const schedule = await db.fertilizationSchedules.create(data);
    return createdResponse(res, schedule, 'Fertilization schedule created successfully');
  })
);

/**
 * @route PUT /api/v1/farms/:farmId/fertilization/:scheduleId/execute
 * @desc Mark a fertilization schedule as executed
 * @access Owner, Admin
 */
router.put('/:farmId/fertilization/:scheduleId/execute',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const schedule = await db.fertilizationSchedules.update(req.params.scheduleId, {
      isExecuted: true,
      executedAt: new Date().toISOString(),
      ...req.body,
    });
    return successResponse(res, schedule, 'Fertilization schedule marked as executed');
  })
);

// ============ GROWTH STAGE & IMAGE ============

/**
 * @route PUT /api/v1/farms/:farmId/growth-stage
 * @desc Update farm growth stage
 * @access Owner, Admin
 */
router.put('/:farmId/growth-stage',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const { growthStage } = req.body;
    if (!growthStage) {
      return res.status(400).json({ success: false, message: 'growthStage is required' });
    }
    const farm = await db.farms.update(req.params.farmId, { growthStage });
    return successResponse(res, farm, 'Growth stage updated successfully');
  })
);

/**
 * @route POST /api/v1/farms/:farmId/image
 * @desc Upload farm image (placeholder)
 * @access Owner, Admin
 */
router.post('/:farmId/image',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    // Placeholder: accept image URL from body and store it on the farm record
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'imageUrl is required' });
    }
    const farm = await db.farms.update(req.params.farmId, { imageUrl });
    return successResponse(res, farm, 'Farm image updated successfully');
  })
);

export default router;
