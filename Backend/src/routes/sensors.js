/**
 * Sensor Routes
 * 
 * API endpoints for sensor management and data operations.
 * 
 * @module routes/sensors
 */

import { Router } from 'express';
import { authenticate, authorize, ROLES, requireOwnership, requireMinimumRole } from '../middleware/auth.js';
import { authenticateDevice } from '../middleware/deviceAuth.js';
import { validateSensorCreation, validateSensorData, validatePagination, validateDateRange, validateUUID, handleValidationErrors } from '../middleware/validation.js';
import { iotLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { successResponse, createdResponse, paginatedResponse } from '../utils/response.js';
import { db } from '../database/convex.js';
import * as sensorService from '../services/sensorService.js';

const router = Router();

/**
 * Get farm user ID for ownership check
 */
const getFarmUserId = async (req) => {
  const farmId = req.params.farmId || req.body.farmId;
  if (!farmId) return null;
  
  return await db.farms.getUserId(farmId);
};

const getSensorUserId = async (req) => {
  const sensorId = req.params.sensorId || req.body.sensorId;
  if (!sensorId) return null;

  const sensor = await db.sensors.getById(sensorId);
  if (!sensor?.farm_id) return null;

  return await db.farms.getUserId(sensor.farm_id);
};

// =====================================================
// SENSOR MANAGEMENT ROUTES
// =====================================================

/**
 * @route GET /api/v1/sensors/farm/:farmId
 * @desc Get sensors for a farm
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const { status, sensorType } = req.query;
    
    const sensors = await sensorService.getFarmSensors(req.params.farmId, {
      status,
      sensorType
    });

    return successResponse(res, sensors, 'Sensors retrieved successfully');
  })
);

/**
 * @route GET /api/v1/sensors/health
 * @desc Get sensor health status
 * @access Admin, Expert
 */
router.get('/health',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const { farmId } = req.query;
    const health = await sensorService.getSensorHealth(farmId);
    return successResponse(res, health, 'Sensor health retrieved successfully');
  })
);

/**
 * @route POST /api/v1/sensors
 * @desc Register a new sensor
 * @access Owner, Admin, Expert
 */
router.post('/',
  authenticate,
  validateSensorCreation,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const sensor = await sensorService.registerSensor(req.body);
    return createdResponse(res, sensor, 'Sensor registered successfully');
  })
);

/**
 * @route GET /api/v1/sensors/:sensorId
 * @desc Get sensor by ID
 * @access Owner, Admin, Expert
 */
router.get('/:sensorId',
  authenticate,
  ...validateUUID('sensorId'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const sensor = await sensorService.getSensorById(req.params.sensorId);
    
    // Check ownership for farmers
    if (req.user.role === ROLES.FARMER && sensor.farm.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        code: 'FORBIDDEN'
      });
    }

    return successResponse(res, sensor, 'Sensor retrieved successfully');
  })
);

/**
 * @route PUT /api/v1/sensors/:sensorId
 * @desc Update sensor
 * @access Owner, Admin, Expert
 */
router.put('/:sensorId',
  authenticate,
  ...validateUUID('sensorId'),
  handleValidationErrors,
  requireOwnership(getSensorUserId),
  asyncHandler(async (req, res) => {
    const sensor = await sensorService.updateSensor(req.params.sensorId, req.body);
    return successResponse(res, sensor, 'Sensor updated successfully');
  })
);

// =====================================================
// IOT DATA INGESTION ROUTES
// =====================================================

/**
 * @route POST /api/v1/sensors/data/ingest
 * @desc Ingest sensor data from IoT devices
 * @access Device authentication required
 */
router.post('/data/ingest',
  iotLimiter,
  authenticateDevice,
  validateSensorData,
  asyncHandler(async (req, res) => {
    const result = await sensorService.ingestSensorData(
      req.device.id,
      req.body.readings
    );

    return successResponse(res, result, 'Sensor data ingested successfully');
  })
);

/**
 * @route POST /api/v1/sensors/data/batch
 * @desc Batch ingest sensor data (for connectivity recovery)
 * @access Device authentication required
 */
router.post('/data/batch',
  iotLimiter,
  authenticateDevice,
  asyncHandler(async (req, res) => {
    const { readings } = req.body;
    
    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Readings array is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const result = await sensorService.ingestSensorData(
      req.device.id,
      readings
    );

    return successResponse(res, result, `Batch data ingested: ${result.valid} valid, ${result.invalid} invalid readings`);
  })
);

// =====================================================
// SENSOR DATA RETRIEVAL ROUTES
// =====================================================

/**
 * @route GET /api/v1/sensors/data/farm/:farmId
 * @desc Get sensor data for a farm
 * @access Owner, Admin, Expert
 */
router.get('/data/farm/:farmId',
  authenticate,
  ...validateUUID('farmId'),
  validatePagination,
  validateDateRange,
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const { page, limit, startDate, endDate, sensorId, validOnly } = req.query;

    const result = await sensorService.getSensorData(req.params.farmId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 100,
      startDate,
      endDate,
      sensorId,
      validOnly: validOnly !== 'false'
    });

    return paginatedResponse(
      res,
      result.data,
      result.page,
      result.limit,
      result.total,
      'Sensor data retrieved successfully'
    );
  })
);

/**
 * @route GET /api/v1/sensors/data/farm/:farmId/latest
 * @desc Get latest sensor readings for a farm
 * @access Owner, Admin, Expert
 */
router.get('/data/farm/:farmId/latest',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const readings = await sensorService.getLatestReadings(req.params.farmId);
    return successResponse(res, readings, 'Latest readings retrieved successfully');
  })
);

/**
 * @route GET /api/v1/sensors/data/farm/:farmId/aggregates
 * @desc Get daily aggregated sensor data
 * @access Owner, Admin, Expert
 */
router.get('/data/farm/:farmId/aggregates',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const aggregates = await sensorService.getDailyAggregates(req.params.farmId, days);
    return successResponse(res, aggregates, 'Daily aggregates retrieved successfully');
  })
);

/**
 * @route GET /api/v1/sensors/data/farm/:farmId/daily
 * @desc Alias for /aggregates (frontend calls /daily)
 * @access Owner, Admin, Expert
 */
router.get('/data/farm/:farmId/daily',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const aggregates = await sensorService.getDailyAggregates(req.params.farmId, days);
    return successResponse(res, aggregates, 'Daily aggregates retrieved successfully');
  })
);

/**
 * @route DELETE /api/v1/sensors/:sensorId
 * @desc Delete a sensor
 * @access Owner, Admin, Expert
 */
router.delete('/:sensorId',
  authenticate,
  ...validateUUID('sensorId'),
  handleValidationErrors,
  requireOwnership(getSensorUserId),
  asyncHandler(async (req, res) => {
    await db.sensors.remove(req.params.sensorId);
    return successResponse(res, { id: req.params.sensorId }, 'Sensor deleted successfully');
  })
);

export default router;
