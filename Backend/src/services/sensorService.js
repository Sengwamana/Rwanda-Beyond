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

  // Build coordinates point if lat/lng provided
  let coordinates = null;
  if (latitude !== undefined && longitude !== undefined) {
    coordinates = `POINT(${longitude} ${latitude})`;
  }

  try {
    const data = await db.sensors.create({
      device_id: deviceId,
      farm_id: farmId,
      sensor_type: sensorType,
      name: name || `${sensorType}_${deviceId.slice(-6)}`,
      location_description: locationDescription,
      coordinates,
      firmware_version: firmwareVersion,
      status: 'active',
      metadata
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

  // Handle coordinates update
  if (updateData.latitude !== undefined && updateData.longitude !== undefined) {
    updates.coordinates = `POINT(${updateData.longitude} ${updateData.latitude})`;
  }

  const data = await db.sensors.update(sensorId, updates);

  if (!data) {
    throw new NotFoundError('Sensor not found');
  }

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

  // Rate of change validation (if previous reading available)
  if (previousReading) {
    const timeDiffHours = (new Date(reading.timestamp) - new Date(previousReading.reading_timestamp)) / (1000 * 60 * 60);
    
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
    const isFrozen = ['soil_moisture', 'air_temperature', 'humidity'].every(field => {
      const currentField = field.replace(/_([a-z])/g, (m, c) => c.toUpperCase());
      return reading[currentField] === previousReading[field];
    });
    
    if (isFrozen) {
      flags.frozenSensor = true;
    }
  }

  return { isValid, flags };
};

/**
 * Ingest sensor data
 * @param {string} deviceId - Device identifier
 * @param {Array} readings - Array of sensor readings
 * @returns {Promise<Object>} Ingestion result
 */
export const ingestSensorData = async (deviceId, readings) => {
  // Get sensor info
  const sensor = await getSensorByDeviceId(deviceId);

  // Get last reading for validation
  const lastReading = await db.sensorData.getLatestBySensor(sensor._id);

  const results = {
    total: readings.length,
    valid: 0,
    invalid: 0,
    inserted: []
  };

  // Process each reading
  const dataToInsert = [];
  let previousReading = lastReading;

  for (const reading of readings) {
    const validation = validateReading(reading, previousReading);

    const record = {
      sensor_id: sensor._id,
      farm_id: sensor.farm_id,
      reading_timestamp: reading.timestamp ? new Date(reading.timestamp).getTime() : Date.now(),
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
    };

    dataToInsert.push(record);

    if (validation.isValid) {
      results.valid++;
    } else {
      results.invalid++;
    }

    // Update previous reading for next iteration
    previousReading = {
      ...record,
      reading_timestamp: record.reading_timestamp
    };
  }

  // Batch insert
  const insertedData = await db.sensorData.insertBatch(dataToInsert);

  results.inserted = Array.isArray(insertedData)
    ? insertedData.map(d => d._id || d)
    : [];

  // Update sensor last reading timestamp
  await db.sensors.update(sensor._id, { last_reading_at: Date.now() });

  logger.info(`Sensor data ingested: ${results.valid} valid, ${results.invalid} invalid readings from ${deviceId}`);

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
  const total = result?.total ?? data.length;

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
  const data = await db.sensorData.getLatestByFarm(farmId, true);

  return data || null;
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

  return data || [];
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
