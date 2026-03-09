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
import logger from '../utils/logger.js';

const router = Router();

const logFarmAuditEvent = async (entry) => {
  try {
    await db.auditLogs.create({
      ...entry,
      created_at: Date.now(),
    });
  } catch (error) {
    logger.warn('Failed to write farm route audit log:', error?.message || error);
  }
};

/**
 * Get farm user ID for ownership check
 */
const getFarmUserId = async (req) => {
  const farmOwner = await db.farms.getUserId(req.params.farmId);
  return farmOwner?.user_id || farmOwner?.userId || farmOwner || null;
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
    const body = req.body || {};
    const data = {
      farm_id: req.params.farmId,
      scheduled_date: body.scheduledDate || body.scheduled_date,
      scheduled_time: body.scheduledTime || body.scheduled_time,
      duration_minutes: body.durationMinutes ?? body.duration_minutes,
      water_volume_liters: body.waterVolumeLiters ?? body.water_volume_liters,
      trigger_source: body.triggerSource || body.trigger_source,
      notes: body.notes,
      recommendation_id: body.recommendationId || body.recommendation_id,
      soil_moisture_at_scheduling: body.soilMoistureAtScheduling ?? body.soil_moisture_at_scheduling,
      target_soil_moisture: body.targetSoilMoisture ?? body.target_soil_moisture,
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
    const { actualDurationMinutes, actualWaterVolume, notes } = req.body || {};
    const schedule = await db.irrigationSchedules.update(req.params.scheduleId, {
      is_executed: true,
      executed_at: Date.now(),
      ...(actualDurationMinutes !== undefined ? { actual_duration_minutes: actualDurationMinutes } : {}),
      ...(actualWaterVolume !== undefined ? { actual_water_volume: actualWaterVolume } : {}),
      ...(notes !== undefined ? { notes } : {}),
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
    const body = req.body || {};
    const data = {
      farm_id: req.params.farmId,
      scheduled_date: body.scheduledDate || body.scheduled_date,
      fertilizer_type: body.fertilizerType || body.fertilizer_type,
      application_method: body.applicationMethod || body.application_method,
      nitrogen_kg: body.nitrogenKg ?? body.nitrogen_kg,
      phosphorus_kg: body.phosphorusKg ?? body.phosphorus_kg,
      potassium_kg: body.potassiumKg ?? body.potassium_kg,
      total_quantity_kg: body.totalQuantityKg ?? body.total_quantity_kg,
      notes: body.notes,
      recommendation_id: body.recommendationId || body.recommendation_id,
      growth_stage: body.growthStage || body.growth_stage,
      soil_npk_at_scheduling: body.soilNpkAtScheduling || body.soil_npk_at_scheduling,
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
    const { actualQuantityKg, notes } = req.body || {};
    const schedule = await db.fertilizationSchedules.update(req.params.scheduleId, {
      is_executed: true,
      executed_at: Date.now(),
      ...(actualQuantityKg !== undefined ? { actual_quantity_kg: actualQuantityKg } : {}),
      ...(notes !== undefined ? { notes } : {}),
    });
    return successResponse(res, schedule, 'Fertilization schedule marked as executed');
  })
);

/**
 * @route PUT /api/v1/farms/:farmId/fertilization/:scheduleId
 * @desc Update a fertilization schedule
 * @access Owner, Admin
 */
router.put('/:farmId/fertilization/:scheduleId',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const updates = {
      ...(body.scheduledDate !== undefined || body.scheduled_date !== undefined
        ? { scheduled_date: body.scheduledDate || body.scheduled_date }
        : {}),
      ...(body.fertilizerType !== undefined || body.fertilizer_type !== undefined
        ? { fertilizer_type: body.fertilizerType || body.fertilizer_type }
        : {}),
      ...(body.applicationMethod !== undefined || body.application_method !== undefined
        ? { application_method: body.applicationMethod || body.application_method }
        : {}),
      ...(body.nitrogenKg !== undefined || body.nitrogen_kg !== undefined
        ? { nitrogen_kg: body.nitrogenKg ?? body.nitrogen_kg }
        : {}),
      ...(body.phosphorusKg !== undefined || body.phosphorus_kg !== undefined
        ? { phosphorus_kg: body.phosphorusKg ?? body.phosphorus_kg }
        : {}),
      ...(body.potassiumKg !== undefined || body.potassium_kg !== undefined
        ? { potassium_kg: body.potassiumKg ?? body.potassium_kg }
        : {}),
      ...(body.totalQuantityKg !== undefined || body.total_quantity_kg !== undefined
        ? { total_quantity_kg: body.totalQuantityKg ?? body.total_quantity_kg }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.growthStage !== undefined || body.growth_stage !== undefined
        ? { growth_stage: body.growthStage || body.growth_stage }
        : {}),
      ...(body.soilNpkAtScheduling !== undefined || body.soil_npk_at_scheduling !== undefined
        ? { soil_npk_at_scheduling: body.soilNpkAtScheduling || body.soil_npk_at_scheduling }
        : {}),
    };

    const schedule = await db.fertilizationSchedules.update(req.params.scheduleId, updates);
    return successResponse(res, schedule, 'Fertilization schedule updated successfully');
  })
);

/**
 * @route DELETE /api/v1/farms/:farmId/fertilization/:scheduleId
 * @desc Delete a fertilization schedule
 * @access Owner, Admin
 */
router.delete('/:farmId/fertilization/:scheduleId',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    await db.fertilizationSchedules.remove(req.params.scheduleId);
    return successResponse(res, { id: req.params.scheduleId }, 'Fertilization schedule deleted successfully');
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
    const existingFarm = await db.farms.getById(req.params.farmId);
    if (!existingFarm) {
      return res.status(404).json({
        success: false,
        message: 'Farm not found',
        code: 'NOT_FOUND',
      });
    }

    const farm = await db.farms.update(req.params.farmId, { current_growth_stage: growthStage });
    if (!farm) {
      return res.status(404).json({
        success: false,
        message: 'Farm not found',
        code: 'NOT_FOUND',
      });
    }

    await logFarmAuditEvent({
      user_id: req.user.id,
      action: 'UPDATE_FARM_GROWTH_STAGE',
      entity_type: 'farms',
      entity_id: req.params.farmId,
      old_values: existingFarm ? { current_growth_stage: existingFarm.current_growth_stage } : undefined,
      new_values: { current_growth_stage: growthStage },
    });

    return successResponse(res, farm, 'Growth stage updated successfully');
  })
);

/**
 * @route POST /api/v1/farms/:farmId/image
 * @desc Save farm image metadata
 * @access Owner, Admin
 */
router.post('/:farmId/image',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const firstImage = Array.isArray(body.images) ? body.images[0] : undefined;
    const imageUrl =
      body.imageUrl ||
      body.image_url ||
      (firstImage && typeof firstImage === 'object'
        ? firstImage.url || firstImage.imageUrl || firstImage.image_url
        : firstImage);

    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'imageUrl is required (or images[0])' });
    }

    const farm = await db.farms.getById(req.params.farmId);
    if (!farm) {
      return res.status(404).json({
        success: false,
        message: 'Farm not found',
        code: 'NOT_FOUND',
      });
    }

    const existingMetadata = (farm?.metadata && typeof farm.metadata === 'object') ? farm.metadata : {};
    const existingImages = Array.isArray(existingMetadata.images) ? existingMetadata.images : [];

    const imageEntry = {
      url: imageUrl,
      captured_at:
        body.capturedAt ||
        body.captured_at ||
        (firstImage && typeof firstImage === 'object'
          ? firstImage.capturedAt || firstImage.captured_at
          : undefined) ||
        new Date().toISOString(),
      uploaded_at: Date.now(),
      uploaded_by: req.user.id,
    };

    const metadata = {
      ...existingMetadata,
      latest_image_url: imageUrl,
      images: [...existingImages, imageEntry],
    };

    const updatedFarm = await db.farms.update(req.params.farmId, { metadata });
    if (!updatedFarm) {
      return res.status(404).json({
        success: false,
        message: 'Farm not found',
        code: 'NOT_FOUND',
      });
    }

    await logFarmAuditEvent({
      user_id: req.user.id,
      action: 'ADD_FARM_IMAGE',
      entity_type: 'farms',
      entity_id: req.params.farmId,
      old_values: {
        latest_image_url: existingMetadata.latest_image_url,
        image_count: existingImages.length,
      },
      new_values: {
        latest_image_url: imageUrl,
        image_count: metadata.images.length,
      },
    });

    return successResponse(res, {
      farm: updatedFarm,
      image: imageEntry,
      totalImages: metadata.images.length,
    }, 'Farm image updated successfully');
  })
);

export default router;
