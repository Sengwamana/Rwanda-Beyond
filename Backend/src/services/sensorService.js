/**
 * Sensor Service
 * 
 * Handles sensor management and data ingestion operations including
 * sensor registration, data validation, and retrieval.
 * 
 * @module services/sensorService
 */

import { db } from '../database/convex.js';
import { NotFoundError, BadRequestError, SensorDataError } from '../utils/errors.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const pickDefinedFields = (source, fields) =>
  Object.fromEntries(
    fields
      .filter((field) => source?.[field] !== undefined)
      .map((field) => [field, source[field]])
  );

const logSensorAuditEvent = async (entry) => {
  try {
    await db.auditLogs.create({
      ...entry,
      created_at: Date.now(),
    });
  } catch (error) {
    logger.warn('Failed to write sensor audit log:', error?.message || error);
  }
};

const triggerFarmAnalysisLifecycle = async ({
  farmId,
  sensorId,
  deviceId,
  insertedCount,
  latestReadingTimestamp,
}) => {
  try {
    const [
      { runComprehensiveAnalysis },
      { sendSensorAnalysisLifecycleNotifications },
    ] = await Promise.all([
      import('./aiService.js'),
      import('./notificationService.js'),
    ]);

    await sendSensorAnalysisLifecycleNotifications({
      farmId,
      sensorId,
      deviceId,
      insertedCount,
      latestReadingTimestamp,
      runAnalysis: () => runComprehensiveAnalysis(farmId),
    });
  } catch (error) {
    logger.warn(
      `Failed to trigger AI analysis lifecycle for farm ${farmId}:`,
      error?.message || error
    );
  }
};

const LATEST_READING_FIELDS = [
  'soil_moisture',
  'soil_temperature',
  'air_temperature',
  'humidity',
  'nitrogen',
  'phosphorus',
  'potassium',
  'ph_level',
  'light_intensity',
  'rainfall_mm',
];

const INPUT_READING_FIELDS = [
  'soilMoisture',
  'soilTemperature',
  'airTemperature',
  'humidity',
  'nitrogen',
  'phosphorus',
  'potassium',
  'phLevel',
  'lightIntensity',
  'rainfallMm',
];

const INPUT_FIELD_ALIASES = [
  ['soil_moisture', 'soilMoisture'],
  ['soil_temperature', 'soilTemperature'],
  ['air_temperature', 'airTemperature'],
  ['ph_level', 'phLevel'],
  ['light_intensity', 'lightIntensity'],
  ['rainfall_mm', 'rainfallMm'],
];

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

const parseSensorTimestamp = (timestampCandidate) => {
  if (timestampCandidate === null || timestampCandidate === undefined || timestampCandidate === '') {
    return null;
  }

  if (typeof timestampCandidate === 'number' && Number.isFinite(timestampCandidate)) {
    return timestampCandidate < 1e12 ? timestampCandidate * 1000 : timestampCandidate;
  }

  if (typeof timestampCandidate === 'string') {
    const trimmedValue = timestampCandidate.trim();
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

const FROZEN_SENSOR_FIELDS = [
  ['soilMoisture', 'soil_moisture'],
  ['airTemperature', 'air_temperature'],
  ['humidity', 'humidity'],
];

const buildLatestReadingsSnapshot = (readings = []) => {
  if (!Array.isArray(readings) || readings.length === 0) {
    return null;
  }

  const sortedReadings = [...readings].sort(
    (left, right) => (right?.reading_timestamp || 0) - (left?.reading_timestamp || 0)
  );

  const latestOverallReading = sortedReadings[0];
  const snapshot = {
    farm_id: latestOverallReading?.farm_id,
    reading_timestamp: latestOverallReading?.reading_timestamp || Date.now(),
    last_updated: latestOverallReading?.reading_timestamp || Date.now(),
    sensor_count: 0,
    contributing_sensor_ids: [],
  };

  const contributingSensorIds = new Set();

  for (const reading of sortedReadings) {
    let contributed = false;

    for (const field of LATEST_READING_FIELDS) {
      if (
        snapshot[field] === undefined &&
        reading?.[field] !== undefined &&
        reading?.[field] !== null
      ) {
        snapshot[field] = reading[field];
        contributed = true;
      }
    }

    if (contributed && reading?.sensor_id) {
      contributingSensorIds.add(reading.sensor_id);
    }

    const hasAllFields = LATEST_READING_FIELDS.every((field) => snapshot[field] !== undefined);
    if (hasAllFields) {
      break;
    }
  }

  snapshot.contributing_sensor_ids = Array.from(contributingSensorIds);
  snapshot.sensor_count = snapshot.contributing_sensor_ids.length;

  return snapshot;
};

const normalizeReadingTimestamp = (reading, fallbackTimestamp = Date.now()) => {
  const timestampCandidate =
    reading?.timestamp ??
    reading?.readingTimestamp ??
    reading?.reading_timestamp;

  if (timestampCandidate === null || timestampCandidate === undefined) {
    return fallbackTimestamp;
  }

  const parsedTimestamp = parseSensorTimestamp(timestampCandidate);
  return parsedTimestamp ?? fallbackTimestamp;
};

const normalizeReadingValues = (reading = {}) => {
  const normalized = { ...reading };
  const sensorType = String(
    normalized.sensorType ??
      normalized.sensor_type ??
      ''
  )
    .trim()
    .toLowerCase();

  for (const [inputField, canonicalField] of INPUT_FIELD_ALIASES) {
    if (normalized[canonicalField] === undefined && normalized[inputField] !== undefined) {
      normalized[canonicalField] = normalized[inputField];
    }
  }

  if (sensorType && normalized.value !== undefined) {
    const mappedFields = LEGACY_SENSOR_TYPE_FIELD_MAP[sensorType] || [];

    if (sensorType === 'npk' && normalized.value && typeof normalized.value === 'object') {
      if (normalized.nitrogen === undefined) {
        normalized.nitrogen = normalized.value.nitrogen ?? normalized.value.n;
      }
      if (normalized.phosphorus === undefined) {
        normalized.phosphorus = normalized.value.phosphorus ?? normalized.value.p;
      }
      if (normalized.potassium === undefined) {
        normalized.potassium = normalized.value.potassium ?? normalized.value.k;
      }
    } else if (mappedFields.length === 1 && normalized[mappedFields[0]] === undefined) {
      normalized[mappedFields[0]] = normalized.value;
    }
  }

  for (const field of INPUT_READING_FIELDS) {
    if (normalized[field] === null || normalized[field] === undefined || normalized[field] === '') {
      delete normalized[field];
      continue;
    }

    const parsedValue = Number(normalized[field]);
    if (!Number.isNaN(parsedValue)) {
      normalized[field] = parsedValue;
    }
  }

  return normalized;
};

const hasAtLeastOneMeasurement = (reading = {}) =>
  INPUT_READING_FIELDS.some((field) => reading[field] !== undefined && reading[field] !== null);

const hasMatchingMeasurements = (left = {}, right = {}) =>
  INPUT_READING_FIELDS.every((field) => {
    const leftValue = left[field];
    const rightValue = right[field];

    if (leftValue === undefined && rightValue === undefined) {
      return true;
    }

    return leftValue === rightValue;
  });

const isDuplicateReading = (reading, previousReading) => {
  if (!previousReading) {
    return false;
  }

  const currentTimestamp = reading?.readingTimestamp ?? reading?.reading_timestamp;
  const previousTimestamp = previousReading?.reading_timestamp ?? previousReading?.readingTimestamp;

  if (currentTimestamp === undefined || previousTimestamp === undefined) {
    return false;
  }

  if (currentTimestamp !== previousTimestamp) {
    return false;
  }

  const previousComparableReading = {
    soilMoisture: previousReading?.soilMoisture ?? previousReading?.soil_moisture,
    soilTemperature: previousReading?.soilTemperature ?? previousReading?.soil_temperature,
    airTemperature: previousReading?.airTemperature ?? previousReading?.air_temperature,
    humidity: previousReading?.humidity,
    nitrogen: previousReading?.nitrogen,
    phosphorus: previousReading?.phosphorus,
    potassium: previousReading?.potassium,
    phLevel: previousReading?.phLevel ?? previousReading?.ph_level,
    lightIntensity: previousReading?.lightIntensity ?? previousReading?.light_intensity,
    rainfallMm: previousReading?.rainfallMm ?? previousReading?.rainfall_mm,
  };

  return hasMatchingMeasurements(reading, previousComparableReading);
};

/**
 * Get sensor by ID
 * @param {string} sensorId - Sensor UUID
 * @returns {Promise<Object>} Sensor object
 */
export const getSensorById = async (sensorId) => {
  const data = await db.sensors.getById(sensorId);

  if (!data) {
    throw new NotFoundError('Sensor not found');
  }

  // Resolve farm relation
  if (data.farm_id) {
    const farm = await db.farms.getById(data.farm_id);
    data.farm = farm ? { id: farm._id, name: farm.name, user_id: farm.user_id } : null;
  }

  return data;
};

/**
 * Get sensor by device ID
 * @param {string} deviceId - Device identifier
 * @returns {Promise<Object>} Sensor object
 */
export const getSensorByDeviceId = async (deviceId) => {
  const data = await db.sensors.getByDeviceId(deviceId);

  if (!data) {
    throw new NotFoundError('Sensor not found');
  }

  // Resolve farm relation
  if (data.farm_id) {
    const farm = await db.farms.getById(data.farm_id);
    data.farm = farm ? { id: farm._id, name: farm.name, user_id: farm.user_id } : null;
  }

  return data;
};

/**
 * Get sensors for a farm
 * @param {string} farmId - Farm UUID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} List of sensors
 */
export const getFarmSensors = async (farmId, options = {}) => {
  const { status, sensorType } = options;

  const data = await db.sensors.getByFarm(farmId, { status, sensorType });

  return data || [];
};

/**
 * Register a new sensor
 * @param {Object} sensorData - Sensor registration data
 * @returns {Promise<Object>} Created sensor
 */
export const registerSensor = async (sensorData) => {
  const {
    deviceId,
    farmId,
    sensorType,
    name,
    locationDescription,
    latitude,
    longitude,
    firmwareVersion,
    metadata = {}
  } = sensorData;

  try {
    const data = await db.sensors.create({
      device_id: deviceId,
      farm_id: farmId,
      sensor_type: sensorType,
      name: name || `${sensorType}_${deviceId.slice(-6)}`,
      location_description: locationDescription,
      latitude,
      longitude,
      firmware_version: firmwareVersion,
      metadata
    });

    await logSensorAuditEvent({
      action: 'CREATE_SENSOR',
      entity_type: 'sensors',
      entity_id: data._id,
      new_values: pickDefinedFields(data, [
        'device_id',
        'farm_id',
        'sensor_type',
        'name',
        'location_description',
        'latitude',
        'longitude',
        'firmware_version',
        'metadata',
        'status',
      ]),
    });

    logger.info(`Sensor registered: ${data._id} (${deviceId})`);
    return data;
  } catch (error) {
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      throw new BadRequestError('Device ID already registered');
    }
    throw error;
  }
};

/**
 * Update sensor
 * @param {string} sensorId - Sensor UUID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated sensor
 */
export const updateSensor = async (sensorId, updateData) => {
  const existingSensor = await db.sensors.getById(sensorId);

  const allowedFields = [
    'name',
    'location_description',
    'status',
    'battery_level',
    'firmware_version',
    'calibration_date',
    'metadata'
  ];

  const fieldMapping = {
    locationDescription: 'location_description',
    batteryLevel: 'battery_level',
    firmwareVersion: 'firmware_version',
    calibrationDate: 'calibration_date'
  };

  const updates = {};
  Object.entries(updateData).forEach(([key, value]) => {
    const dbField = fieldMapping[key] || key;
    if (allowedFields.includes(dbField) && value !== undefined) {
      updates[dbField] = value;
    }
  });

  if (updateData.latitude !== undefined) {
    updates.latitude = updateData.latitude;
  }

  if (updateData.longitude !== undefined) {
    updates.longitude = updateData.longitude;
  }

  const data = await db.sensors.update(sensorId, updates);

  if (!data) {
    throw new NotFoundError('Sensor not found');
  }

  await logSensorAuditEvent({
    action: 'UPDATE_SENSOR',
    entity_type: 'sensors',
    entity_id: sensorId,
    old_values: pickDefinedFields(existingSensor, Object.keys(updates)),
    new_values: updates,
  });

  return data;
};

/**
 * Validate sensor reading values
 * @param {Object} reading - Sensor reading
 * @param {Object} previousReading - Previous reading for rate-of-change validation
 * @returns {Object} Validation result with flags
 */
const validateReading = (reading, previousReading = null) => {
  const flags = {};
  let isValid = true;

  const { sensorValidation } = config;

  // Check soil moisture range
  if (reading.soilMoisture !== undefined) {
    if (reading.soilMoisture < sensorValidation.soilMoisture.min || 
        reading.soilMoisture > sensorValidation.soilMoisture.max) {
      flags.soilMoisture = 'out_of_range';
      isValid = false;
    }
  }

  // Check temperature range
  ['soilTemperature', 'airTemperature'].forEach(field => {
    if (reading[field] !== undefined) {
      if (reading[field] < sensorValidation.temperature.min || 
          reading[field] > sensorValidation.temperature.max) {
        flags[field] = 'out_of_range';
        isValid = false;
      }
    }
  });

  // Check humidity range
  if (reading.humidity !== undefined) {
    if (reading.humidity < sensorValidation.humidity.min || 
        reading.humidity > sensorValidation.humidity.max) {
      flags.humidity = 'out_of_range';
      isValid = false;
    }
  }

  // Check NPK ranges
  ['nitrogen', 'phosphorus', 'potassium'].forEach(nutrient => {
    if (reading[nutrient] !== undefined) {
      const range = sensorValidation[nutrient];
      if (reading[nutrient] < range.min || reading[nutrient] > range.max) {
        flags[nutrient] = 'out_of_range';
        isValid = false;
      }
    }
  });

  if (!hasAtLeastOneMeasurement(reading)) {
    flags.missingMeasurements = true;
    isValid = false;
  }

  // Rate of change validation (if previous reading available)
  if (previousReading) {
    const readingTimestamp =
      reading.readingTimestamp ?? normalizeReadingTimestamp(reading);
    const timeDiffHours =
      (readingTimestamp - previousReading.reading_timestamp) / (1000 * 60 * 60);
    
    if (timeDiffHours > 0 && timeDiffHours < 24) {
      // Check soil moisture rate of change
      if (reading.soilMoisture !== undefined && previousReading.soil_moisture !== undefined) {
        const rateOfChange = Math.abs(reading.soilMoisture - previousReading.soil_moisture) / timeDiffHours;
        if (rateOfChange > sensorValidation.maxRateOfChange.soilMoisture) {
          flags.soilMoistureRateOfChange = 'excessive';
        }
      }

      // Check temperature rate of change
      if (reading.airTemperature !== undefined && previousReading.air_temperature !== undefined) {
        const rateOfChange = Math.abs(reading.airTemperature - previousReading.air_temperature) / timeDiffHours;
        if (rateOfChange > sensorValidation.maxRateOfChange.temperature) {
          flags.temperatureRateOfChange = 'excessive';
        }
      }
    }
  }

  // Check for frozen sensor (identical consecutive readings)
  if (previousReading) {
    const comparableFields = FROZEN_SENSOR_FIELDS.filter(([currentField, previousField]) =>
      reading[currentField] !== undefined &&
      previousReading[previousField] !== undefined
    );

    const isFrozen =
      comparableFields.length > 0 &&
      comparableFields.every(([currentField, previousField]) =>
        reading[currentField] === previousReading[previousField]
      );
    
    if (isFrozen) {
      flags.frozenSensor = true;
    }
  }

  return { isValid, flags };
};

const buildInsertedRecord = (sensorId, farmId, reading, validation) => ({
  sensor_id: sensorId,
  farm_id: farmId,
  reading_timestamp: reading.readingTimestamp,
  soil_moisture: reading.soilMoisture,
  soil_temperature: reading.soilTemperature,
  air_temperature: reading.airTemperature,
  humidity: reading.humidity,
  nitrogen: reading.nitrogen,
  phosphorus: reading.phosphorus,
  potassium: reading.potassium,
  ph_level: reading.phLevel,
  light_intensity: reading.lightIntensity,
  rainfall_mm: reading.rainfallMm,
  is_valid: validation.isValid,
  validation_flags: validation.flags,
  raw_payload: reading
});

/**
 * Ingest sensor data
 * @param {string} deviceId - Device identifier
 * @param {Array} readings - Array of sensor readings
 * @returns {Promise<Object>} Ingestion result
 */
export const ingestSensorData = async (deviceId, readings) => {
  const deviceContext =
    deviceId && typeof deviceId === 'object'
      ? deviceId
      : { id: deviceId };

  const resolvedDeviceId = deviceContext.id;
  const resolvedSensorId = deviceContext.sensorId;
  const resolvedFarmId = deviceContext.farmId;

  if (!resolvedDeviceId) {
    throw new BadRequestError('Device identifier is required');
  }

  let sensor = null;
  if (!resolvedSensorId || !resolvedFarmId) {
    sensor = await getSensorByDeviceId(resolvedDeviceId);
  }

  const sensorId = resolvedSensorId || sensor?._id || sensor?.id;
  const farmId = resolvedFarmId || sensor?.farm_id;

  if (!sensorId || !farmId) {
    throw new NotFoundError('Sensor not found');
  }

  // Get last reading for validation
  const lastReading = await db.sensorData.getLatestBySensor(sensorId);

  const results = {
    total: readings.length,
    received: readings.length,
    valid: 0,
    processed: 0,
    invalid: 0,
    failed: 0,
    duplicates: 0,
    inserted: []
  };

  // Process each reading
  const dataToInsert = [];
  const fallbackBaseTimestamp = Date.now();
  const normalizedReadings = readings
    .map((reading, index) => {
      const normalizedReading = normalizeReadingValues(reading);
      return {
        ...normalizedReading,
        readingTimestamp: normalizeReadingTimestamp(normalizedReading, fallbackBaseTimestamp + index),
      };
    })
    .sort((left, right) => left.readingTimestamp - right.readingTimestamp);
  let previousReading = lastReading;
  let latestReadingTimestamp = lastReading?.reading_timestamp ?? 0;

  for (const reading of normalizedReadings) {
    const validation = validateReading(reading, previousReading);

    if (validation.isValid) {
      results.valid++;
      results.processed++;
    } else {
      results.invalid++;
      results.failed++;
    }

    if (!hasAtLeastOneMeasurement(reading)) {
      continue;
    }

    if (isDuplicateReading(reading, previousReading)) {
      results.duplicates += 1;
      continue;
    }

    const record = buildInsertedRecord(sensorId, farmId, reading, validation);
    dataToInsert.push(record);
    latestReadingTimestamp = Math.max(latestReadingTimestamp, record.reading_timestamp);

    // Update previous reading for next iteration
    previousReading = {
      ...record,
      reading_timestamp: record.reading_timestamp
    };
  }

  // Batch insert
  const insertedData = dataToInsert.length > 0
    ? await db.sensorData.insertBatch(dataToInsert)
    : [];

  results.inserted = Array.isArray(insertedData)
    ? insertedData.map(d => d._id || d)
    : [];
  const persistedInsertCount = results.inserted.length;

  // Update sensor last reading timestamp
  if (persistedInsertCount > 0) {
    try {
      await db.sensors.update(sensorId, {
        last_reading_at: latestReadingTimestamp || Date.now(),
      });
    } catch (error) {
      logger.warn(
        `Failed to update last reading timestamp for sensor ${sensorId}:`,
        error?.message || error
      );
    }

    await logSensorAuditEvent({
      action: 'INGEST_SENSOR_DATA',
      entity_type: 'sensor_data',
      entity_id: sensorId,
      new_values: {
        device_id: resolvedDeviceId,
        sensor_id: sensorId,
        farm_id: farmId,
        received: results.received,
        processed: results.processed,
        invalid: results.invalid,
        duplicates: results.duplicates,
        inserted: persistedInsertCount,
        last_reading_at: latestReadingTimestamp || Date.now(),
      },
    });

    Promise.resolve()
      .then(() =>
        triggerFarmAnalysisLifecycle({
          farmId,
          sensorId,
          deviceId: resolvedDeviceId,
          insertedCount: persistedInsertCount,
          latestReadingTimestamp: latestReadingTimestamp || Date.now(),
        })
      )
      .catch((error) => {
        logger.warn(
          `Failed to queue AI analysis lifecycle for farm ${farmId}:`,
          error?.message || error
        );
      });
  }

  logger.info(`Sensor data ingested: ${results.valid} valid, ${results.invalid} invalid readings from ${resolvedDeviceId}`);

  return results;
};

/**
 * Get sensor data for a farm
 * @param {string} farmId - Farm UUID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Sensor data with pagination
 */
export const getSensorData = async (farmId, options = {}) => {
  const {
    page = 1,
    limit = 100,
    startDate,
    endDate,
    sensorId,
    validOnly = true
  } = options;

  const result = await db.sensorData.getByFarm(farmId, {
    page,
    limit,
    startDate: startDate ? new Date(startDate).getTime() : undefined,
    endDate: endDate ? new Date(endDate).getTime() : undefined,
    sensorId,
    validOnly
  });

  const data = result?.data || result || [];
  const total = result?.total ?? result?.count ?? data.length;

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};

/**
 * Get latest sensor readings for a farm
 * @param {string} farmId - Farm UUID
 * @returns {Promise<Object>} Latest readings by sensor type
 */
export const getLatestReadings = async (farmId) => {
  const recentReadings = await db.sensorData.getLatestReadings(farmId, 50);
  return buildLatestReadingsSnapshot(recentReadings);
};

/**
 * Get daily aggregated sensor data
 * @param {string} farmId - Farm UUID
 * @param {number} days - Number of days to aggregate
 * @returns {Promise<Array>} Daily aggregates
 */
export const getDailyAggregates = async (farmId, days = 7) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const data = await db.sensorData.getDailyAggregates(farmId, startDate.getTime());

  return (data || []).map((item) => ({
    farmId: String(item?.farm_id || farmId),
    date: item?.reading_date || item?.date || new Date().toISOString().split('T')[0],
    avgSoilMoisture: item?.avg_soil_moisture ?? item?.avgSoilMoisture ?? null,
    minSoilMoisture: item?.min_soil_moisture ?? item?.minSoilMoisture ?? null,
    maxSoilMoisture: item?.max_soil_moisture ?? item?.maxSoilMoisture ?? null,
    avgSoilTemperature: item?.avg_soil_temperature ?? item?.avgSoilTemperature ?? null,
    avgTemperature: item?.avg_temperature ?? item?.avgTemperature ?? null,
    avgHumidity: item?.avg_humidity ?? item?.avgHumidity ?? null,
    avgNitrogen: item?.avg_nitrogen ?? item?.avgNitrogen ?? null,
    avgPhosphorus: item?.avg_phosphorus ?? item?.avgPhosphorus ?? null,
    avgPotassium: item?.avg_potassium ?? item?.avgPotassium ?? null,
    readingsCount: item?.reading_count ?? item?.readingsCount ?? 0,
  }));
};

/**
 * Get sensor health status
 * @param {string} farmId - Farm UUID (optional)
 * @returns {Promise<Array>} Sensor health status
 */
export const getSensorHealth = async (farmId = null) => {
  let sensors;

  if (farmId) {
    sensors = await db.sensors.getByFarm(farmId);
    // Resolve farm data once for all sensors
    const farm = await db.farms.getById(farmId);
    sensors = (sensors || []).map(s => ({
      ...s,
      farm: farm ? { id: farm._id, name: farm.name } : null
    }));
  } else {
    sensors = await db.sensors.listActiveWithFarm();
  }

  // Calculate health status
  const now = new Date();
  return (sensors || []).map(sensor => {
    const lastReading = sensor.last_reading_at ? new Date(sensor.last_reading_at) : null;
    const hoursSinceReading = lastReading 
      ? (now - lastReading) / (1000 * 60 * 60) 
      : null;

    let healthStatus = 'healthy';
    if (sensor.status !== 'active') {
      healthStatus = sensor.status;
    } else if (!lastReading || hoursSinceReading > 24) {
      healthStatus = 'offline';
    } else if (hoursSinceReading > 6) {
      healthStatus = 'delayed';
    } else if (sensor.battery_level && sensor.battery_level < 20) {
      healthStatus = 'low_battery';
    }

    return {
      ...sensor,
      healthStatus,
      hoursSinceReading: hoursSinceReading ? Math.round(hoursSinceReading * 10) / 10 : null
    };
  });
};

export default {
  getSensorById,
  getSensorByDeviceId,
  getFarmSensors,
  registerSensor,
  updateSensor,
  ingestSensorData,
  getSensorData,
  getLatestReadings,
  getDailyAggregates,
  getSensorHealth
};
