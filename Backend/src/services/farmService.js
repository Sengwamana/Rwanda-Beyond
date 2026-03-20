/**
 * Farm Service
 * 
 * Handles farm management operations including CRUD operations,
 * farm configurations, and farm-related queries.
 * 
 * @module services/farmService
 */

import { db } from '../database/convex.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import * as sensorService from './sensorService.js';

const withDefinedFields = (fields) =>
  Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));

const pickFields = (source, fields) =>
  Object.fromEntries(
    fields
      .filter((field) => source[field] !== undefined)
      .map((field) => [field, source[field]])
  );

const logFarmAuditEvent = async (entry) => {
  try {
    await db.auditLogs.create(entry);
  } catch (error) {
    logger.warn('Failed to write farm audit log:', error?.message || error);
  }
};

/**
 * Get farm by ID
 * @param {string} farmId - Farm ID
 * @returns {Promise<Object>} Farm object with related data
 */
export const getFarmById = async (farmId) => {
  const data = await db.farms.getById(farmId);

  if (!data) {
    throw new NotFoundError('Farm not found');
  }

  return data;
};

/**
 * Get farms for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Farms list with pagination
 */
export const getUserFarms = async (userId, options = {}) => {
  const { page = 1, limit = 20, isActive } = options;

  const { data, count } = await db.farms.getByUser(userId, { page, limit, isActive });

  return {
    farms: data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit)
  };
};

/**
 * Get all farms (for admin/expert)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Farms list with pagination
 */
export const getAllFarms = async (options = {}) => {
  const {
    page = 1,
    limit = 20,
    districtId,
    isActive,
    search,
    userId
  } = options;

  const { data, count } = await db.farms.list({ page, limit, districtId, isActive, search, userId });

  return {
    farms: data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit)
  };
};

/**
 * Create a new farm
 * @param {string} userId - Owner user ID
 * @param {Object} farmData - Farm data
 * @returns {Promise<Object>} Created farm
 */
export const createFarm = async (userId, farmData) => {
  const {
    name,
    districtId,
    locationName,
    latitude,
    longitude,
    sizeHectares,
    soilType,
    cropVariety,
    plantingDate,
    expectedHarvestDate,
    metadata = {}
  } = farmData;

  const payload = withDefinedFields({
    user_id: userId,
    name,
    district_id: districtId,
    location_name: locationName,
    latitude,
    longitude,
    size_hectares: sizeHectares,
    soil_type: soilType,
    crop_variety: cropVariety,
    planting_date: plantingDate,
    expected_harvest_date: expectedHarvestDate,
    current_growth_stage: plantingDate ? 'germination' : undefined,
    metadata,
  });

  const data = await db.farms.create(payload);

  await logFarmAuditEvent({
    user_id: userId,
    action: 'CREATE_FARM',
    entity_type: 'farms',
    entity_id: data._id,
    new_values: pickFields(data, Object.keys(payload)),
  });

  logger.info(`Farm created: ${data._id} for user ${userId}`);
  return data;
};

/**
 * Update farm
 * @param {string} farmId - Farm ID
 * @param {Object} updateData - Data to update
 * @param {string} userId - User making the update
 * @returns {Promise<Object>} Updated farm
 */
export const updateFarm = async (farmId, updateData, userId) => {
  // Verify farm exists and user has access
  const farm = await getFarmById(farmId);
  
  const allowedFields = [
    'name',
    'district_id',
    'location_name',
    'size_hectares',
    'soil_type',
    'crop_variety',
    'planting_date',
    'expected_harvest_date',
    'current_growth_stage',
    'is_active',
    'metadata'
  ];

  const fieldMapping = {
    districtId: 'district_id',
    locationName: 'location_name',
    sizeHectares: 'size_hectares',
    soilType: 'soil_type',
    cropVariety: 'crop_variety',
    plantingDate: 'planting_date',
    expectedHarvestDate: 'expected_harvest_date',
    currentGrowthStage: 'current_growth_stage',
    isActive: 'is_active'
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

  if (Object.keys(updates).length === 0) {
    throw new BadRequestError('No valid fields to update');
  }

  const data = await db.farms.update(farmId, updates);
  if (!data) {
    throw new NotFoundError('Farm not found');
  }

  await logFarmAuditEvent({
    user_id: userId,
    action: 'UPDATE_FARM',
    entity_type: 'farms',
    entity_id: farmId,
    old_values: pickFields(farm, Object.keys(updates)),
    new_values: updates,
  });

  logger.info(`Farm updated: ${farmId}`);
  return data;
};

/**
 * Delete farm (soft delete)
 * @param {string} farmId - Farm ID
 * @param {string} userId - User making the deletion
 * @returns {Promise<void>}
 */
export const deleteFarm = async (farmId, userId) => {
  const farm = await getFarmById(farmId);
  const deleted = await db.farms.softDelete(farmId);
  if (!deleted) {
    throw new NotFoundError('Farm not found');
  }

  // Create audit log
  await logFarmAuditEvent({
    user_id: userId,
    action: 'DELETE_FARM',
    entity_type: 'farms',
    entity_id: farmId,
    old_values: pickFields(farm, [
      'name',
      'district_id',
      'location_name',
      'latitude',
      'longitude',
      'size_hectares',
      'soil_type',
      'crop_variety',
      'current_growth_stage',
      'is_active',
    ]),
    new_values: { is_active: false },
  });

  logger.info(`Farm deleted: ${farmId} by ${userId}`);
};

/**
 * Get farm summary with latest sensor data
 * @param {string} farmId - Farm ID
 * @returns {Promise<Object>} Farm summary
 */
export const getFarmSummary = async (farmId) => {
  const today = new Date().toISOString().split('T')[0];
  const [
    farm,
    latestReadings,
    pendingRecommendations,
    recentPests,
    upcomingIrrigation,
  ] = await Promise.all([
    getFarmById(farmId),
    sensorService.getLatestReadings(farmId),
    db.recommendations.getPendingCount({ farmId }),
    db.pestDetections.getRecent(farmId, 5),
    db.irrigationSchedules.getUpcoming(farmId, today, 3),
  ]);

  return {
    farm,
    latestReadings: latestReadings || null,
    pendingRecommendations,
    recentPests: recentPests || [],
    upcomingIrrigation: upcomingIrrigation || []
  };
};

/**
 * Get all districts
 * @returns {Promise<Array>} List of districts
 */
export const getDistricts = async () => {
  const data = await db.districts.list();
  return data;
};

/**
 * Get farm statistics
 * @param {string} userId - Optional user ID for filtering
 * @returns {Promise<Object>} Farm statistics
 */
export const getFarmStats = async (userId = null) => {
  const data = await db.farms.getStats();

  const stats = {
    total: data.length,
    active: data.filter(f => f.is_active).length,
    totalArea: data.reduce((sum, f) => sum + (parseFloat(f.size_hectares) || 0), 0),
    byGrowthStage: {},
    byDistrict: {}
  };

  // Count by growth stage
  data.forEach(farm => {
    if (farm.current_growth_stage) {
      stats.byGrowthStage[farm.current_growth_stage] = 
        (stats.byGrowthStage[farm.current_growth_stage] || 0) + 1;
    }
    if (farm.district_id) {
      stats.byDistrict[farm.district_id] = 
        (stats.byDistrict[farm.district_id] || 0) + 1;
    }
  });

  return stats;
};

export default {
  getFarmById,
  getUserFarms,
  getAllFarms,
  createFarm,
  updateFarm,
  deleteFarm,
  getFarmSummary,
  getDistricts,
  getFarmStats
};
