/**
 * Scheduler Service
 * 
 * Manages scheduled tasks and cron jobs for the Smart Maize Farming System.
 * Handles weather updates, recommendation generation, sensor health checks,
 * and notification processing.
 * 
 * @module services/schedulerService
 */

import cron from 'node-cron';
import { db } from '../database/convex.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import * as sensorService from './sensorService.js';

// Track active cron jobs
const activeJobs = new Map();

const runWithConcurrency = async (items, concurrency, worker) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(concurrency || 1, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  const executeWorker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  };

  await Promise.all(Array.from({ length: limit }, () => executeWorker()));
  return results;
};

const resolveDistrictCoordinates = (district) => {
  if (typeof district?.latitude === 'number' && typeof district?.longitude === 'number') {
    return { lat: district.latitude, lon: district.longitude };
  }

  return getDistrictCoordinates(district?.name);
};

const logSchedulerAuditEvent = async (entry) => {
  try {
    await db.auditLogs.create({
      ...entry,
      created_at: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to write scheduler audit log:', error?.message || error);
  }
};

/**
 * Initialize all scheduled tasks
 */
export const initializeScheduledTasks = async () => {
  logger.info('Initializing scheduled tasks...');

  // Weather data update - every hour
  scheduleTask('weatherUpdate', '0 * * * *', updateWeatherData);

  // Generate daily recommendations - every day at 6 AM EAT (3 AM UTC)
  scheduleTask('dailyRecommendations', '0 3 * * *', generateDailyRecommendations);

  // Sensor health check - every 30 minutes
  scheduleTask('sensorHealthCheck', '*/30 * * * *', checkSensorHealth);

  // Process notification queue - every 5 minutes
  scheduleTask('notificationProcessing', '*/5 * * * *', processNotifications);

  // Expire old recommendations - every 6 hours
  scheduleTask('expireRecommendations', '0 */6 * * *', expireOldRecommendations);

  // Run irrigation analysis - every 4 hours
  scheduleTask('irrigationAnalysis', '0 */4 * * *', runIrrigationAnalysis);

  // Clean up old data - every day at midnight
  scheduleTask('dataCleanup', '0 0 * * *', performDataCleanup);

  // Generate daily summary reports - every day at 7 PM EAT (4 PM UTC)
  scheduleTask('dailySummary', '0 16 * * *', generateDailySummaries);

  logger.info(`Scheduled ${activeJobs.size} tasks successfully`);
  return Array.from(activeJobs.keys());
};

/**
 * Schedule a task with error handling and logging
 * @param {string} name - Task name
 * @param {string} cronExpression - Cron schedule expression
 * @param {Function} taskFunction - Function to execute
 */
const scheduleTask = (name, cronExpression, taskFunction) => {
  if (activeJobs.has(name)) {
    logger.warn(`Task ${name} already scheduled, skipping`);
    return;
  }

  const job = cron.schedule(cronExpression, async () => {
    const startTime = Date.now();
    logger.info(`Starting scheduled task: ${name}`);

    try {
      await taskFunction();
      const duration = Date.now() - startTime;
      logger.info(`Completed task ${name} in ${duration}ms`);

      // Log execution to database
      await logTaskExecution(name, 'success', duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Task ${name} failed after ${duration}ms:`, error.message);

      // Log failure to database
      await logTaskExecution(name, 'failed', duration, error.message);
    }
  });

  activeJobs.set(name, job);
  logger.debug(`Scheduled task: ${name} (${cronExpression})`);
};

/**
 * Log task execution to database
 * @param {string} taskName - Name of the task
 * @param {string} status - Execution status
 * @param {number} duration - Execution duration in ms
 * @param {string} error - Error message if failed
 */
const logTaskExecution = async (taskName, status, duration, error = null) => {
  try {
    await db.auditLogs.create({
      action: 'SCHEDULED_TASK',
      entity_type: 'system',
      old_values: { task_name: taskName },
      new_values: {
        status,
        duration_ms: duration,
        error: error,
        executed_at: Date.now()
      }
    });
  } catch (logError) {
    logger.error('Failed to log task execution:', logError);
  }
};

/**
 * Update weather data for all districts
 */
const updateWeatherData = async () => {
  const { default: weatherService } = await import('./weatherService.js');

  // Get all districts
  const districts = await db.districts.listWithCoordinates();

  if (!districts || districts.length === 0) {
    throw new Error('Failed to fetch districts or no districts found');
  }

  let updated = 0;
  let failed = 0;

  for (const district of districts) {
    try {
      const coords = resolveDistrictCoordinates(district);
      
      // Fetch and store weather data
      const forecast = await weatherService.fetchWeatherForecast(
        coords.lat,
        coords.lon,
        7
      );

      await weatherService.storeWeatherData(
        district._id,
        coords.lat,
        coords.lon,
        forecast
      );

      updated++;
    } catch (districtError) {
      logger.warn(`Failed to update weather for ${district.name}:`, districtError.message);
      failed++;
    }

    // Rate limit protection
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  logger.info(`Weather update complete: ${updated} updated, ${failed} failed`);
};

/**
 * Get default coordinates for Rwanda districts
 * @param {string} districtName - Name of the district
 * @returns {Object} Coordinates
 */
const getDistrictCoordinates = (districtName) => {
  const districtCoords = {
    'Gasabo': { lat: -1.8833, lon: 30.0833 },
    'Kicukiro': { lat: -1.9833, lon: 30.1 },
    'Nyarugenge': { lat: -1.95, lon: 30.05 },
    'Bugesera': { lat: -2.2, lon: 30.05 },
    'Gatsibo': { lat: -1.6, lon: 30.45 },
    'Kayonza': { lat: -1.85, lon: 30.65 },
    'Kirehe': { lat: -2.3, lon: 30.65 },
    'Ngoma': { lat: -2.2, lon: 30.45 },
    'Nyagatare': { lat: -1.3, lon: 30.35 },
    'Rwamagana': { lat: -1.95, lon: 30.45 },
    'Burera': { lat: -1.45, lon: 29.8 },
    'Gakenke': { lat: -1.7, lon: 29.75 },
    'Gicumbi': { lat: -1.6, lon: 30.0 },
    'Musanze': { lat: -1.5, lon: 29.6 },
    'Rulindo': { lat: -1.75, lon: 29.95 },
    // Add more as needed
  };

  return districtCoords[districtName] || { lat: -1.9403, lon: 29.8739 }; // Default: Kigali
};

/**
 * Generate daily recommendations for all farms
 */
const generateDailyRecommendations = async () => {
  const { default: aiService } = await import('./aiService.js');

  // Get all active farms
  const farms = await db.farms.listActive();

  if (!farms || farms.length === 0) {
    throw new Error('Failed to fetch farms or no active farms found');
  }

  let analyzed = 0;
  let recommendations = 0;
  let errors = 0;

  await runWithConcurrency(
    farms,
    config.ai.comprehensiveAnalysisConcurrency,
    async (farm) => {
      try {
        const result = await aiService.runComprehensiveAnalysis(farm._id);
        analyzed++;

        if (result.irrigation?.needsIrrigation) recommendations++;
        if (result.nutrients?.needsFertilization) recommendations++;
      } catch (farmError) {
        logger.warn(`Analysis failed for farm ${farm.name}:`, farmError.message);
        errors++;
      }
    }
  );

  logger.info(`Daily recommendations: ${analyzed} farms analyzed, ${recommendations} recommendations created, ${errors} errors`);
};

/**
 * Check sensor health and flag inactive sensors
 */
const checkSensorHealth = async () => {
  // Find sensors that haven't reported in the last hour
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  // Get all active sensors with farm data
  const sensors = await db.sensors.listActiveWithFarm();

  if (!sensors || sensors.length === 0) {
    logger.info('No active sensors to check');
    return;
  }

  let healthy = 0;
  let unhealthy = 0;
  const alertsToSend = [];

  for (const sensor of sensors) {
    const lastReading = sensor.last_reading_at;
    const isHealthy = lastReading && lastReading > oneHourAgo;

    if (isHealthy) {
      healthy++;
    } else {
      unhealthy++;

      // Check if it's been more than 2 hours - update status to maintenance
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      if (!lastReading || lastReading < twoHoursAgo) {
        const updatedSensor = await db.sensors.update(sensor._id, { status: 'maintenance' });
        if (!updatedSensor) {
          logger.warn(`Sensor ${sensor._id} disappeared before maintenance status persistence`);
          continue;
        }

        await logSchedulerAuditEvent({
          action: 'UPDATE_SENSOR_STATUS',
          entity_type: 'sensors',
          entity_id: sensor._id,
          old_values: {
            status: sensor.status,
            last_reading_at: lastReading || null,
          },
          new_values: {
            status: 'maintenance',
            last_reading_at: lastReading || null,
          },
        });

        // Queue alert for farm owner
        alertsToSend.push({
          userId: sensor.farm?.user_id,
          farmName: sensor.farm?.name,
          sensorName: sensor.name || sensor.device_id,
          lastReading: lastReading
        });
      }
    }
  }

  // Send alerts for unhealthy sensors
  if (alertsToSend.length > 0) {
    await sendSensorAlerts(alertsToSend);
  }

  logger.info(`Sensor health check: ${healthy} healthy, ${unhealthy} unhealthy`);
};

/**
 * Send alerts for unhealthy sensors
 * @param {Array} alerts - Array of alert data
 */
const sendSensorAlerts = async (alerts) => {
  const { default: notificationService } = await import('./notificationService.js');

  // Group alerts by user
  const alertsByUser = alerts.reduce((acc, alert) => {
    if (!acc[alert.userId]) acc[alert.userId] = [];
    acc[alert.userId].push(alert);
    return acc;
  }, {});

  for (const [userId, userAlerts] of Object.entries(alertsByUser)) {
    // Get user phone number
    const user = await db.users.getById(userId);

    if (user?.phone_number) {
      const sensorList = userAlerts.map(a => a.sensorName).join(', ');
      const message = user.preferred_language === 'rw'
        ? `⚠️ SMARTMAIZE: Ibikoresho bya sensor ntabwo bikora: ${sensorList}. Reba imiterere yabyo.`
        : `⚠️ SMARTMAIZE: Sensor alert - ${sensorList} not responding. Please check your equipment.`;

      try {
        await notificationService.sendSMS(user.phone_number, message, {
          userId,
          priority: 'high'
        });
      } catch (smsError) {
        logger.warn('Failed to send sensor alert SMS:', smsError.message);
      }
    }
  }
};

/**
 * Process notification queue
 */
const processNotifications = async () => {
  const { default: notificationService } = await import('./notificationService.js');
  await notificationService.processQueuedMessages();
};

/**
 * Expire old recommendations
 */
const expireOldRecommendations = async () => {
  const expired = await db.recommendations.expirePending(
    Date.now(),
    7 * 24 * 60 * 60 * 1000 // 7 days max age
  );

  if (expired && expired.length > 0) {
    logger.info(`Expired ${expired.length} recommendations past their deadline`);
  }
};

/**
 * Run irrigation analysis for all farms
 */
const runIrrigationAnalysis = async () => {
  const { default: aiService } = await import('./aiService.js');

  // Get farms with active sensors by finding active sensors and extracting unique farm IDs
  const activeSensors = await db.sensors.listActive();

  if (!activeSensors || activeSensors.length === 0) {
    logger.info('No farms with active sensors for irrigation analysis');
    return;
  }

  // Get unique farm IDs
  const uniqueFarmIds = [...new Set(activeSensors.map(s => s.farm_id).filter(Boolean))];
  let analyzed = 0;

  await runWithConcurrency(
    uniqueFarmIds,
    config.ai.irrigationAnalysisConcurrency,
    async (farmId) => {
      try {
        await aiService.analyzeIrrigationNeeds(farmId);
        analyzed++;
      } catch (error) {
        logger.warn(`Irrigation analysis failed for farm ${farmId}:`, error.message);
      }
    }
  );

  logger.info(`Irrigation analysis complete: ${analyzed} farms analyzed`);
};

/**
 * Perform data cleanup tasks
 */
const performDataCleanup = async () => {
  const ninetyDaysAgoMs = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const fourteenDaysAgoDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Delete sensor data older than 90 days (keep aggregates)
  const deletedSensorData = await db.sensorData.deleteOlderThan(ninetyDaysAgoMs);

  // Delete old audit logs
  const deletedAuditLogs = await db.auditLogs.deleteOlderThan(thirtyDaysAgoMs);

  // Clean up old weather data
  const deletedWeatherData = await db.weatherData.deleteOlderThan(fourteenDaysAgoDate);

  await logSchedulerAuditEvent({
    action: 'DATA_CLEANUP',
    entity_type: 'system',
    new_values: {
      sensor_retention_days: 90,
      audit_retention_days: 30,
      weather_retention_days: 14,
      deleted_sensor_records: deletedSensorData?.count ?? deletedSensorData ?? 0,
      deleted_audit_records: deletedAuditLogs?.count ?? deletedAuditLogs ?? 0,
      deleted_weather_records: deletedWeatherData?.count ?? deletedWeatherData ?? 0,
    },
  });

  logger.info(`Data cleanup complete: ${deletedSensorData || 0} sensor records, ${deletedAuditLogs || 0} audit logs, ${deletedWeatherData || 0} weather records deleted`);
};

/**
 * Generate daily summary notifications for farmers
 */
const generateDailySummaries = async () => {
  const { default: notificationService } = await import('./notificationService.js');

  // Get users who want daily summaries
  const users = await db.users.listActive('farmer');

  if (!users || users.length === 0) return;

  let sent = 0;

  await runWithConcurrency(
    users,
    config.notifications.summaryConcurrency,
    async (user) => {
      try {
        if (!user.phone_number) {
          return;
        }

        const farmResult = await db.farms.getByUser(user._id, { limit: 1, isActive: true });
        const farms = farmResult?.data || farmResult || [];

        if (!farms || farms.length === 0) {
          return;
        }

        const farm = farms[0];
        const farmId = farm._id || farm.id;

        const [pendingCount, latestReading] = await Promise.all([
          db.recommendations.getPendingCount({ farmId }),
          sensorService.getLatestReadings(farmId),
        ]);

        const lang = user.preferred_language || 'rw';
        let message;

        if (lang === 'rw') {
          message = `🌽 SMARTMAIZE Uyu munsi\n`;
          message += `${farm.name}\n`;
          if (latestReading) {
            message += `Ubuhehere: ${latestReading.soil_moisture?.toFixed(0)}%\n`;
            message += `Ubushyuhe: ${latestReading.air_temperature?.toFixed(0)}°C\n`;
          }
          if (pendingCount > 0) {
            message += `Inama ${pendingCount} zitegereje`;
          }
        } else {
          message = `🌽 SMARTMAIZE Daily Summary\n`;
          message += `${farm.name}\n`;
          if (latestReading) {
            message += `Moisture: ${latestReading.soil_moisture?.toFixed(0)}%\n`;
            message += `Temp: ${latestReading.air_temperature?.toFixed(0)}°C\n`;
          }
          if (pendingCount > 0) {
            message += `${pendingCount} pending recommendations`;
          }
        }

        await notificationService.sendSMS(user.phone_number, message, {
          userId: user._id,
          priority: 'low'
        });
        sent += 1;
      } catch (userError) {
        logger.warn(`Failed to generate summary for user ${user._id}:`, userError.message);
      }
    }
  );

  logger.info(`Daily summaries sent to ${sent} users`);
};

/**
 * Stop all scheduled tasks
 */
export const stopAllTasks = () => {
  for (const [name, job] of activeJobs) {
    job.stop();
    logger.info(`Stopped scheduled task: ${name}`);
  }
  activeJobs.clear();
};

/**
 * Get status of all scheduled tasks
 * @returns {Array} Array of task status objects
 */
export const getTaskStatus = () => {
  return Array.from(activeJobs.entries()).map(([name, job]) => ({
    name,
    running: job.running || false
  }));
};

/**
 * Run a specific task immediately
 * @param {string} taskName - Name of the task to run
 * @returns {Promise<boolean>} Success status
 */
export const runTaskNow = async (taskName) => {
  const taskMap = {
    'weatherUpdate': updateWeatherData,
    'dailyRecommendations': generateDailyRecommendations,
    'sensorHealthCheck': checkSensorHealth,
    'notificationProcessing': processNotifications,
    'expireRecommendations': expireOldRecommendations,
    'irrigationAnalysis': runIrrigationAnalysis,
    'dataCleanup': performDataCleanup,
    'dailySummary': generateDailySummaries
  };

  const taskFunction = taskMap[taskName];
  if (!taskFunction) {
    throw new Error(`Unknown task: ${taskName}`);
  }

  logger.info(`Manually triggering task: ${taskName}`);
  await taskFunction();
  return true;
};

export default {
  initializeScheduledTasks,
  stopAllTasks,
  getTaskStatus,
  runTaskNow
};
