/**
 * Request Validation Middleware
 * 
 * Provides input validation using express-validator with custom
 * validators for domain-specific data types.
 * 
 * @module middleware/validation
 */

import { validationResult, body, param, query } from 'express-validator';
import { ValidationError } from '../utils/errors.js';
import config from '../config/index.js';

const isResourceId = (value) => typeof value === 'string' && value.trim().length > 0;

const parseSensorTimestamp = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return null;
    }

    if (/^\d+(\.\d+)?$/.test(trimmedValue)) {
      const numericValue = Number(trimmedValue);
      if (Number.isFinite(numericValue)) {
        return numericValue < 1e12 ? numericValue * 1000 : numericValue;
      }
    }

    const parsedTimestamp = Date.parse(trimmedValue);
    return Number.isFinite(parsedTimestamp) ? parsedTimestamp : null;
  }

  return null;
};

const isValidSensorTimestamp = (value) => {
  return parseSensorTimestamp(value) !== null;
};

const SENSOR_READING_FIELD_ALIASES = {
  soilMoisture: ['soilMoisture', 'soil_moisture'],
  soilTemperature: ['soilTemperature', 'soil_temperature'],
  airTemperature: ['airTemperature', 'air_temperature'],
  humidity: ['humidity'],
  nitrogen: ['nitrogen'],
  phosphorus: ['phosphorus'],
  potassium: ['potassium'],
  phLevel: ['phLevel', 'ph_level'],
  lightIntensity: ['lightIntensity', 'light_intensity'],
  rainfallMm: ['rainfallMm', 'rainfall_mm'],
};

const LEGACY_SENSOR_TYPE_FIELD_MAP = {
  soil_moisture: ['soilMoisture'],
  soil_temperature: ['soilTemperature'],
  air_temperature: ['airTemperature'],
  humidity: ['humidity'],
  nitrogen: ['nitrogen'],
  phosphorus: ['phosphorus'],
  potassium: ['potassium'],
  ph: ['phLevel'],
  ph_level: ['phLevel'],
  light: ['lightIntensity'],
  light_intensity: ['lightIntensity'],
  rainfall: ['rainfallMm'],
  rainfall_mm: ['rainfallMm'],
  npk: ['nitrogen', 'phosphorus', 'potassium'],
};

const normalizeSensorReading = (reading = {}) => {
  const normalized = {};

  for (const [canonicalField, aliases] of Object.entries(SENSOR_READING_FIELD_ALIASES)) {
    for (const alias of aliases) {
      if (reading?.[alias] !== undefined && reading?.[alias] !== null && reading?.[alias] !== '') {
        normalized[canonicalField] = reading[alias];
        break;
      }
    }
  }

  const sensorType = String(reading?.sensorType ?? reading?.sensor_type ?? '').trim().toLowerCase();
  if (sensorType && reading?.value !== undefined) {
    const mappedFields = LEGACY_SENSOR_TYPE_FIELD_MAP[sensorType] || [];
    if (sensorType === 'npk' && reading.value && typeof reading.value === 'object') {
      normalized.nitrogen ??= reading.value.nitrogen ?? reading.value.n;
      normalized.phosphorus ??= reading.value.phosphorus ?? reading.value.p;
      normalized.potassium ??= reading.value.potassium ?? reading.value.k;
    } else if (mappedFields.length === 1) {
      normalized[mappedFields[0]] ??= reading.value;
    }
  }

  return normalized;
};

const hasEnvironmentalMeasurement = (reading = {}) => {
  const normalized = normalizeSensorReading(reading);
  return Object.values(normalized).some((value) => value !== undefined && value !== null && value !== '');
};

const validateNormalizedSensorReading = (reading = {}) => {
  const normalized = normalizeSensorReading(reading);
  const rangeChecks = [
    ['soilMoisture', 'Soil moisture', config.sensorValidation.soilMoisture],
    ['soilTemperature', 'Soil temperature', config.sensorValidation.temperature],
    ['airTemperature', 'Air temperature', config.sensorValidation.temperature],
    ['humidity', 'Humidity', config.sensorValidation.humidity],
    ['nitrogen', 'Nitrogen', config.sensorValidation.nitrogen],
    ['phosphorus', 'Phosphorus', config.sensorValidation.phosphorus],
    ['potassium', 'Potassium', config.sensorValidation.potassium],
  ];

  for (const [field, label, constraints] of rangeChecks) {
    const value = normalized[field];
    if (value === undefined || value === null || value === '') {
      continue;
    }

    if (!validateSensorValue(value, field, constraints)) {
      throw new Error(`${label} must be between ${constraints.min} and ${constraints.max}`);
    }
  }

  return true;
};

const validateSensorReadingTimestamp = (reading = {}) => {
  const timestampCandidate =
    reading?.timestamp ??
    reading?.readingTimestamp ??
    reading?.reading_timestamp;

  if (timestampCandidate === undefined || timestampCandidate === null || timestampCandidate === '') {
    return true;
  }

  if (!isValidSensorTimestamp(timestampCandidate)) {
    throw new Error('Timestamp must be a valid reading timestamp');
  }

  return true;
};

/**
 * Handle validation errors from express-validator
 */
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));

    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: formattedErrors,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));

    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: formattedErrors,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

// =====================================================
// COMMON VALIDATORS
// =====================================================

/**
 * Resource ID parameter validator.
 * Accepts Convex document IDs as well as legacy UUID-shaped IDs.
 */
export const validateUUID = (paramName) => [
  param(paramName)
    .custom(isResourceId)
    .withMessage(`${paramName} must be a valid resource ID`)
];

/**
 * Pagination query validators
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt()
];

/**
 * Date range validators
 */
export const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date')
];

// =====================================================
// USER VALIDATORS
// =====================================================

export const validateUserRegistration = [
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),
  body('phoneNumber')
    .optional()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage('Invalid phone number format'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 100 })
    .withMessage('First name must be less than 100 characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 100 })
    .withMessage('Last name must be less than 100 characters'),
  body('preferredLanguage')
    .optional()
    .isIn(['en', 'rw', 'fr'])
    .withMessage('Language must be en, rw, or fr'),
  handleValidationErrors
];

export const validateUserUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters'),
  body('phoneNumber')
    .optional()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage('Invalid phone number format'),
  body('preferredLanguage')
    .optional()
    .isIn(['en', 'rw', 'fr'])
    .withMessage('Language must be en, rw, or fr'),
  handleValidationErrors
];

export const validateRoleAssignment = [
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['farmer', 'expert', 'admin'])
    .withMessage('Role must be farmer, expert, or admin'),
  handleValidationErrors
];

// =====================================================
// FARM VALIDATORS
// =====================================================

export const validateFarmCreation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Farm name is required')
    .isLength({ max: 255 })
    .withMessage('Farm name must be less than 255 characters'),
  body('districtId')
    .optional()
    .custom(isResourceId)
    .withMessage('District ID must be a valid resource ID'),
  body('locationName')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Location name must be less than 255 characters'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('sizeHectares')
    .optional()
    .isFloat({ min: 0.001 })
    .withMessage('Size must be a positive number'),
  body('soilType')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Soil type must be less than 100 characters'),
  body('cropVariety')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Crop variety must be less than 100 characters'),
  body('plantingDate')
    .optional()
    .isISO8601()
    .withMessage('Planting date must be a valid date'),
  handleValidationErrors
];

export const validateFarmUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Farm name must be between 1 and 255 characters'),
  body('locationName')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Location name must be less than 255 characters'),
  body('cropVariety')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Crop variety must be less than 255 characters'),
  body('sizeHectares')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Farm size must be a positive number'),
  body('currentGrowthStage')
    .optional()
    .isIn(['germination', 'vegetative', 'flowering', 'grain_filling', 'maturity'])
    .withMessage('Invalid growth stage'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  handleValidationErrors
];

// =====================================================
// SENSOR VALIDATORS
// =====================================================

export const validateSensorCreation = [
  body('deviceId')
    .trim()
    .notEmpty()
    .withMessage('Device ID is required')
    .isLength({ max: 100 })
    .withMessage('Device ID must be less than 100 characters'),
  body('farmId')
    .notEmpty()
    .withMessage('Farm ID is required')
    .custom(isResourceId)
    .withMessage('Farm ID must be a valid resource ID'),
  body('sensorType')
    .notEmpty()
    .withMessage('Sensor type is required')
    .isIn(['soil_moisture', 'temperature', 'humidity', 'npk', 'rainfall', 'light'])
    .withMessage('Invalid sensor type'),
  body('name')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Sensor name must be less than 255 characters'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  handleValidationErrors
];

// =====================================================
// SENSOR DATA VALIDATORS
// =====================================================

/**
 * Custom validator for sensor reading values
 */
const validateSensorValue = (value, field, constraints) => {
  if (value === null || value === undefined) return true;
  const num = parseFloat(value);
  if (isNaN(num)) return false;
  return num >= constraints.min && num <= constraints.max;
};

export const validateSensorData = [
  body('readings')
    .isArray({ min: 1 })
    .withMessage('Readings must be a non-empty array')
    .custom((value) => Array.isArray(value) && value.length <= config.iot.maxBatchReadings)
    .withMessage(`Readings batch must contain at most ${config.iot.maxBatchReadings} items`),
  body('readings.*')
    .custom((reading) => hasEnvironmentalMeasurement(reading))
    .withMessage('Each reading must include at least one environmental measurement'),
  body('readings.*')
    .custom((reading) => validateSensorReadingTimestamp(reading)),
  body('readings.*')
    .custom((reading) => validateNormalizedSensorReading(reading)),
  handleValidationErrors
];

// =====================================================
// RECOMMENDATION VALIDATORS
// =====================================================

export const validateRecommendationResponse = [
  body()
    .custom((value) => {
      const status = value?.status;
      const action = value?.action;
      if (!status && !action) {
        throw new Error('Either status or action is required');
      }

      if (status && !['accepted', 'rejected', 'deferred'].includes(status)) {
        throw new Error('Status must be accepted, rejected, or deferred');
      }

      if (action && !['accept', 'reject', 'defer'].includes(action)) {
        throw new Error('Action must be accept, reject, or defer');
      }

      return true;
    }),
  body('responseNotes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Response notes must be less than 1000 characters'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Reason must be less than 1000 characters'),
  body('deferredUntil')
    .optional()
    .isISO8601()
    .withMessage('Deferred until must be a valid ISO 8601 date'),
  body('deferUntil')
    .optional()
    .isISO8601()
    .withMessage('deferUntil must be a valid ISO 8601 date'),
  handleValidationErrors
];

// =====================================================
// PEST DETECTION VALIDATORS
// =====================================================

export const validatePestDetection = [
  body('farmId')
    .notEmpty()
    .withMessage('Farm ID is required')
    .custom(isResourceId)
    .withMessage('Farm ID must be a valid resource ID'),
  body('locationDescription')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Location description must be less than 255 characters'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  handleValidationErrors
];

// =====================================================
// IRRIGATION SCHEDULE VALIDATORS
// =====================================================

export const validateIrrigationSchedule = [
  body('farmId')
    .notEmpty()
    .withMessage('Farm ID is required')
    .custom(isResourceId)
    .withMessage('Farm ID must be a valid resource ID'),
  body('scheduledDate')
    .notEmpty()
    .withMessage('Scheduled date is required')
    .isISO8601()
    .withMessage('Scheduled date must be a valid date'),
  body('scheduledTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Scheduled time must be in HH:MM format'),
  body('durationMinutes')
    .notEmpty()
    .withMessage('Duration is required')
    .isInt({ min: 1, max: 1440 })
    .withMessage('Duration must be between 1 and 1440 minutes'),
  body('waterVolumeLiters')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Water volume must be a positive number'),
  handleValidationErrors
];

// =====================================================
// FERTILIZATION SCHEDULE VALIDATORS
// =====================================================

export const validateFertilizationSchedule = [
  body('farmId')
    .notEmpty()
    .withMessage('Farm ID is required')
    .custom(isResourceId)
    .withMessage('Farm ID must be a valid resource ID'),
  body('scheduledDate')
    .notEmpty()
    .withMessage('Scheduled date is required')
    .isISO8601()
    .withMessage('Scheduled date must be a valid date'),
  body('fertilizerType')
    .trim()
    .notEmpty()
    .withMessage('Fertilizer type is required')
    .isLength({ max: 100 })
    .withMessage('Fertilizer type must be less than 100 characters'),
  body('nitrogenKg')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Nitrogen must be a positive number'),
  body('phosphorusKg')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Phosphorus must be a positive number'),
  body('potassiumKg')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Potassium must be a positive number'),
  body('totalQuantityKg')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total quantity must be a positive number'),
  handleValidationErrors
];

export default {
  validateRequest,
  handleValidationErrors,
  validateUUID,
  validatePagination,
  validateDateRange,
  validateUserRegistration,
  validateUserUpdate,
  validateRoleAssignment,
  validateFarmCreation,
  validateFarmUpdate,
  validateSensorCreation,
  validateSensorData,
  validateRecommendationResponse,
  validatePestDetection,
  validateIrrigationSchedule,
  validateFertilizationSchedule
};
