/**
 * Convex Client Configuration
 * 
 * Provides configured Convex client instance for server-side operations.
 * Replaces the previous Supabase client module.
 * 
 * @module database/convex
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Convex HTTP client for server-side operations
 */
const client = new ConvexHttpClient(config.convex.url);

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
export const testConnection = async () => {
  try {
    await client.query(api.systemConfig.healthCheck);
    logger.info('Convex connection established successfully');
    return true;
  } catch (error) {
    logger.error('Convex connection failed:', error);
    return false;
  }
};

/**
 * Convex database client with typed methods for each table
 */
export const db = {
  // ============ USERS ============
  users: {
    getById: (id) => client.query(api.users.getById, { id }),
    getByClerkId: (clerkId) => client.query(api.users.getByClerkId, { clerkId }),
    getByPhone: (phone) => client.query(api.users.getByPhone, { phone }),
    getByEmail: (email) => client.query(api.users.getByEmail, { email }),
    list: (opts = {}) => client.query(api.users.list, opts),
    listAll: () => client.query(api.users.listAll),
    listActive: (role) => client.query(api.users.listActive, { role }),
    create: (data) => client.mutation(api.users.create, data),
    update: (id, updates) => client.mutation(api.users.update, { id, updates }),
    updateByClerkId: (clerkId, updates) => client.mutation(api.users.updateByClerkId, { clerkId, updates }),
    getStats: () => client.query(api.users.getStats),
  },

  // ============ FARMS ============
  farms: {
    getById: (id) => client.query(api.farms.getById, { id }),
    getByUser: (userId, opts = {}) => client.query(api.farms.getByUser, { userId, ...opts }),
    list: (opts = {}) => client.query(api.farms.list, opts),
    listActive: () => client.query(api.farms.listActive),
    getUserId: (farmId) => client.query(api.farms.getUserId, { farmId }),
    create: (data) => client.mutation(api.farms.create, data),
    update: (id, updates) => client.mutation(api.farms.update, { id, updates }),
    softDelete: (id) => client.mutation(api.farms.softDelete, { id }),
    getStats: () => client.query(api.farms.getStats),
  },

  // ============ SENSORS ============
  sensors: {
    getById: (id) => client.query(api.sensors.getById, { id }),
    getByDeviceId: (deviceId) => client.query(api.sensors.getByDeviceId, { deviceId }),
    getByFarm: (farmId, opts = {}) => client.query(api.sensors.getByFarm, { farmId, ...opts }),
    listActive: () => client.query(api.sensors.listActive),
    listActiveWithFarm: () => client.query(api.sensors.listActiveWithFarm),
    getHealth: () => client.query(api.sensors.getHealth),
    getDeviceInfo: (deviceId) => client.query(api.sensors.getDeviceInfo, { deviceId }),
    listAllStats: () => client.query(api.sensors.listAllStats),
    create: (data) => client.mutation(api.sensors.create, data),
    update: (id, updates) => client.mutation(api.sensors.update, { id, updates }),
  },

  // ============ SENSOR DATA ============
  sensorData: {
    getLatestBySensor: (sensorId) => client.query(api.sensorData.getLatestBySensor, { sensorId }),
    getLatestByFarm: (farmId, validOnly = true) => client.query(api.sensorData.getLatestByFarm, { farmId, validOnly }),
    getByFarm: (farmId, opts = {}) => client.query(api.sensorData.getByFarm, { farmId, ...opts }),
    getLatestReadings: (farmId, limit) => client.query(api.sensorData.getLatestReadings, { farmId, limit }),
    getDailyAggregates: (farmId, startDate) => client.query(api.sensorData.getDailyAggregates, { farmId, startDate }),
    insertBatch: (records) => client.mutation(api.sensorData.insertBatch, { records }),
    deleteOlderThan: (timestamp) => client.mutation(api.sensorData.deleteOlderThan, { timestamp }),
    countSince: (since) => client.query(api.sensorData.countSince, { since }),
    getLatestOne: () => client.query(api.sensorData.getLatestOne),
  },

  // ============ WEATHER DATA ============
  weatherData: {
    upsert: (records) => client.mutation(api.weatherData.upsert, { records }),
    getByDistrict: (districtId, opts = {}) => client.query(api.weatherData.getByDistrict, { districtId, ...opts }),
    deleteOlderThan: (date) => client.mutation(api.weatherData.deleteOlderThan, { date }),
  },

  // ============ PEST DETECTIONS ============
  pestDetections: {
    getById: (id) => client.query(api.pestDetections.getById, { id }),
    getByFarm: (farmId, opts = {}) => client.query(api.pestDetections.getByFarm, { farmId, ...opts }),
    getRecent: (farmId, limit) => client.query(api.pestDetections.getRecent, { farmId, limit }),
    getUnreviewed: (opts = {}) => client.query(api.pestDetections.getUnreviewed, opts),
    getStats: (opts = {}) => client.query(api.pestDetections.getStats, opts),
    getOldImages: (before) => client.query(api.pestDetections.getOldImages, { before }),
    getOutbreakMap: (opts = {}) => client.query(api.pestDetections.getOutbreakMap, opts),
    create: (data) => client.mutation(api.pestDetections.create, { data }),
    update: (id, updates) => client.mutation(api.pestDetections.update, { id, updates }),
    remove: (id) => client.mutation(api.pestDetections.remove, { id }),
  },

  // ============ IRRIGATION SCHEDULES ============
  irrigationSchedules: {
    getByFarm: (farmId, opts = {}) => client.query(api.irrigationSchedules.getByFarm, { farmId, ...opts }),
    getUpcoming: (farmId, afterDate, limit) => client.query(api.irrigationSchedules.getUpcoming, { farmId, afterDate, limit }),
    create: (data) => client.mutation(api.irrigationSchedules.create, { data }),
    update: (id, updates) => client.mutation(api.irrigationSchedules.update, { id, updates }),
  },

  // ============ FERTILIZATION SCHEDULES ============
  fertilizationSchedules: {
    getByFarm: (farmId, opts = {}) => client.query(api.fertilizationSchedules.getByFarm, { farmId, ...opts }),
    getLastExecuted: (farmId) => client.query(api.fertilizationSchedules.getLastExecuted, { farmId }),
    getHistory: (farmId, since) => client.query(api.fertilizationSchedules.getHistory, { farmId, since }),
    create: (data) => client.mutation(api.fertilizationSchedules.create, { data }),
    update: (id, updates) => client.mutation(api.fertilizationSchedules.update, { id, updates }),
  },

  // ============ RECOMMENDATIONS ============
  recommendations: {
    getById: (id) => client.query(api.recommendations.getById, { id }),
    getByUser: (userId, opts = {}) => client.query(api.recommendations.getByUser, { userId, ...opts }),
    getPending: (opts = {}) => client.query(api.recommendations.getPending, opts),
    getPendingCount: (opts = {}) => client.query(api.recommendations.getPendingCount, opts),
    getByFarm: (farmId, opts = {}) => client.query(api.recommendations.getByFarm, { farmId, ...opts }),
    getStats: (opts = {}) => client.query(api.recommendations.getStats, opts),
    countSince: (since) => client.query(api.recommendations.countSince, { since }),
    create: (data) => client.mutation(api.recommendations.create, { data }),
    update: (id, updates) => client.mutation(api.recommendations.update, { id, updates }),
    expirePending: (now, maxAgeMs) => client.mutation(api.recommendations.expirePending, { now, maxAgeMs }),
  },

  // ============ MESSAGES ============
  messages: {
    create: (data) => client.mutation(api.messages.create, { data }),
    createBatch: (messages) => client.mutation(api.messages.createBatch, { messages }),
    update: (id, updates) => client.mutation(api.messages.update, { id, updates }),
    getFailed: (opts = {}) => client.query(api.messages.getFailed, opts),
    getStats: (opts = {}) => client.query(api.messages.getStats, opts),
    countSince: (since) => client.query(api.messages.countSince, { since }),
  },

  // ============ AUDIT LOGS ============
  auditLogs: {
    create: (data) => client.mutation(api.auditLogs.create, { data }),
    list: (opts = {}) => client.query(api.auditLogs.list, opts),
    deleteOlderThan: (timestamp) => client.mutation(api.auditLogs.deleteOlderThan, { timestamp }),
    countErrors: (since) => client.query(api.auditLogs.countErrors, { since }),
  },

  // ============ DISTRICTS ============
  districts: {
    list: () => client.query(api.districts.list),
    getById: (id) => client.query(api.districts.getById, { id }),
    getByName: (name) => client.query(api.districts.getByName, { name }),
    listWithCoordinates: () => client.query(api.districts.listWithCoordinates),
    seed: (districts) => client.mutation(api.districts.seed, { districts }),
  },

  // ============ IOT DEVICE TOKENS ============
  iotDeviceTokens: {
    create: (data) => client.mutation(api.iotDeviceTokens.create, data),
    verify: (deviceId, tokenHash) => client.query(api.iotDeviceTokens.verify, { deviceId, tokenHash, now: Date.now() }),
    updateLastUsed: (id) => client.mutation(api.iotDeviceTokens.updateLastUsed, { id }),
    revoke: (deviceId, tokenHash) => client.mutation(api.iotDeviceTokens.revoke, { deviceId, tokenHash }),
    list: (opts = {}) => client.query(api.iotDeviceTokens.list, opts),
  },

  // ============ SYSTEM CONFIG ============
  systemConfig: {
    list: () => client.query(api.systemConfig.list),
    getByKey: (key) => client.query(api.systemConfig.getByKey, { key }),
    upsert: (data) => client.mutation(api.systemConfig.upsert, data),
    healthCheck: () => client.query(api.systemConfig.healthCheck),
  },
};

// Export raw client for advanced usage
export const convexClient = client;

export default { db, client, testConnection };
