/**
 * Analytics Routes
 * 
 * API endpoints for dashboard analytics and reporting.
 * 
 * @module routes/analytics
 */

import { Router } from 'express';
import { authenticate, ROLES, requireOwnership, requireMinimumRole } from '../middleware/auth.js';
import { validateUUID, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';
import { db } from '../database/convex.js';
import * as sensorService from '../services/sensorService.js';

const router = Router();

const toTimestamp = (value, fallback) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const extractCount = (result) => {
  if (typeof result?.count === 'number') return result.count;
  if (typeof result?.total === 'number') return result.total;
  if (Array.isArray(result?.data)) return result.data.length;
  if (Array.isArray(result)) return result.length;
  return 0;
};

const toArrayPayload = (result) => {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  return [];
};

const formatLabel = (value) => String(value || '')
  .split('_')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const toIsoTimestamp = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === 'string') {
    if (value.includes('T')) {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        return new Date(parsed).toISOString();
      }
    }

    const parsed = Date.parse(`${value}T00:00:00.000Z`);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return new Date(0).toISOString();
};

/**
 * Get farm user ID for ownership check
 */
const getFarmUserId = async (req) => {
  const farmId = req.params.farmId || req.query.farmId;
  if (!farmId) return null;
  
  return await db.farms.getUserId(farmId);
};

const getFarmDashboardPayload = async (farmId, recentSince) => {
  const [
    farm,
    latestReadings,
    activeRecommendations,
    recentAlerts,
    irrigationSchedule,
    recentPestDetections
  ] = await Promise.all([
    db.farms.getById(farmId),
    sensorService.getLatestReadings(farmId),
    db.recommendations.getByFarm(farmId, { statuses: ['pending', 'accepted'], limit: 5 }),
    db.recommendations.getByFarm(farmId, {
      priorities: ['critical', 'high'],
      since: recentSince,
      limit: 5
    }),
    db.irrigationSchedules.getUpcoming(farmId, new Date().toISOString().split('T')[0], 7),
    db.pestDetections.getRecent(farmId, 5)
  ]);

  return {
    farm,
    latestReadings: latestReadings || null,
    latestSensorData: latestReadings ? [latestReadings] : [],
    activeRecommendations: activeRecommendations || [],
    recentAlerts: recentAlerts || [],
    irrigationSchedule: irrigationSchedule || [],
    recentPestDetections: recentPestDetections || []
  };
};

const buildRecommendationHistoryPayload = (farmId, days, data) => {
  const stats = {
    total: data.length,
    byStatus: {},
    byType: {},
    byPriority: {},
    byChannel: {},
    responseRate: 0,
    averageResponseTime: null
  };

  let totalResponseTime = 0;
  let respondedCount = 0;

  data.forEach((rec) => {
    stats.byStatus[rec.status] = (stats.byStatus[rec.status] || 0) + 1;
    stats.byType[rec.type] = (stats.byType[rec.type] || 0) + 1;
    stats.byPriority[rec.priority] = (stats.byPriority[rec.priority] || 0) + 1;

    if (rec.response_channel) {
      stats.byChannel[rec.response_channel] = (stats.byChannel[rec.response_channel] || 0) + 1;
    }

    if (rec.responded_at) {
      respondedCount += 1;
      totalResponseTime += new Date(rec.responded_at) - new Date(rec.created_at);
    }
  });

  if (respondedCount > 0) {
    stats.responseRate = (respondedCount / data.length) * 100;
    stats.averageResponseTime = Math.round(totalResponseTime / respondedCount / (1000 * 60 * 60));
  }

  return {
    farmId,
    period: { days: parseInt(days) },
    history: data,
    stats
  };
};

const buildFarmActivityPayload = async (farmId, { days = 30, limit = 20, type } = {}) => {
  const now = Date.now();
  const parsedDays = Math.max(1, parseInt(days, 10) || 30);
  const parsedLimit = Math.max(1, parseInt(limit, 10) || 20);
  const requestedType = type && String(type).toLowerCase() !== 'all'
    ? String(type).toLowerCase()
    : undefined;
  const since = now - parsedDays * 24 * 60 * 60 * 1000;
  const sinceDate = new Date(since).toISOString().split('T')[0];

  const [
    recommendations,
    irrigationSchedules,
    fertilizationSchedules,
    pestControlSchedules,
    pestDetections,
    farmIssues,
  ] = await Promise.all([
    db.recommendations.getByFarm(farmId, { since, limit: 50 }),
    db.irrigationSchedules.getByFarm(farmId, { afterDate: sinceDate, limit: 50 }),
    db.fertilizationSchedules.getHistory(farmId, sinceDate, 50),
    db.pestControlSchedules.getByFarm(farmId, { since: sinceDate, limit: 50 }),
    db.pestDetections.getByFarm(farmId, { page: 1, limit: 25, since }),
    db.farmIssues.getByFarm(farmId, { page: 1, limit: 25, since }),
  ]);

  const events = [];

  toArrayPayload(recommendations).forEach((recommendation) => {
    const title = recommendation.title || `${formatLabel(recommendation.type)} Recommendation`;

    events.push({
      id: `recommendation-created-${recommendation._id || recommendation.id}`,
      type: 'recommendation',
      action: 'created',
      title,
      description: `${formatLabel(recommendation.type)} recommendation generated with ${recommendation.priority} priority.`,
      timestamp: toIsoTimestamp(recommendation.created_at),
      status: recommendation.status,
      metadata: {
        recommendationId: recommendation._id || recommendation.id,
        priority: recommendation.priority,
      },
    });

    if (recommendation.responded_at) {
      events.push({
        id: `recommendation-responded-${recommendation._id || recommendation.id}`,
        type: 'recommendation',
        action: 'responded',
        title,
        description: `Recommendation ${recommendation.status} via ${formatLabel(recommendation.response_channel || 'web')}.`,
        timestamp: toIsoTimestamp(recommendation.responded_at),
        status: recommendation.status,
        metadata: {
          recommendationId: recommendation._id || recommendation.id,
          responseChannel: recommendation.response_channel || undefined,
        },
      });
    }

    if (recommendation.completed_at) {
      events.push({
        id: `recommendation-completed-${recommendation._id || recommendation.id}`,
        type: 'recommendation',
        action: 'completed',
        title,
        description: 'Recommendation marked as completed.',
        timestamp: toIsoTimestamp(recommendation.completed_at),
        status: recommendation.status,
        metadata: {
          recommendationId: recommendation._id || recommendation.id,
        },
      });
    } else if (recommendation.status === 'executed') {
      events.push({
        id: `recommendation-executed-${recommendation._id || recommendation.id}`,
        type: 'recommendation',
        action: 'executed',
        title,
        description: 'Recommendation executed successfully.',
        timestamp: toIsoTimestamp(recommendation.updated_at || recommendation.responded_at || recommendation.created_at),
        status: recommendation.status,
        metadata: {
          recommendationId: recommendation._id || recommendation.id,
        },
      });
    }
  });

  toArrayPayload(irrigationSchedules).forEach((schedule) => {
    events.push({
      id: `irrigation-scheduled-${schedule._id || schedule.id}`,
      type: 'irrigation',
      action: 'scheduled',
      title: 'Irrigation Schedule',
      description: `Irrigation scheduled for ${schedule.scheduled_date}.`,
      timestamp: toIsoTimestamp(schedule.created_at || schedule.scheduled_date),
      status: schedule.is_executed ? 'executed' : 'scheduled',
      metadata: {
        scheduleId: schedule._id || schedule.id,
        scheduledDate: schedule.scheduled_date,
      },
    });

    if (schedule.is_executed && schedule.executed_at) {
      events.push({
        id: `irrigation-executed-${schedule._id || schedule.id}`,
        type: 'irrigation',
        action: 'executed',
        title: 'Irrigation Executed',
        description: 'Irrigation schedule marked as executed.',
        timestamp: toIsoTimestamp(schedule.executed_at),
        status: 'executed',
        metadata: {
          scheduleId: schedule._id || schedule.id,
          scheduledDate: schedule.scheduled_date,
        },
      });
    }

    if (schedule.postponed_at && schedule.previous_scheduled_date) {
      const previousTime = schedule.previous_scheduled_time ? ` at ${schedule.previous_scheduled_time}` : '';
      const nextTime = schedule.scheduled_time ? ` at ${schedule.scheduled_time}` : '';
      events.push({
        id: `irrigation-postponed-${schedule._id || schedule.id}`,
        type: 'irrigation',
        action: 'postponed',
        title: 'Irrigation Postponed',
        description: `Irrigation moved from ${schedule.previous_scheduled_date}${previousTime} to ${schedule.scheduled_date}${nextTime}.`,
        timestamp: toIsoTimestamp(schedule.postponed_at),
        status: schedule.is_executed ? 'executed' : 'scheduled',
        metadata: {
          scheduleId: schedule._id || schedule.id,
          previousScheduledDate: schedule.previous_scheduled_date,
          previousScheduledTime: schedule.previous_scheduled_time,
          scheduledDate: schedule.scheduled_date,
          scheduledTime: schedule.scheduled_time,
        },
      });
    }
  });

  toArrayPayload(fertilizationSchedules).forEach((schedule) => {
    events.push({
      id: `fertilization-scheduled-${schedule._id || schedule.id}`,
      type: 'fertilization',
      action: 'scheduled',
      title: 'Fertilization Schedule',
      description: `Fertilization scheduled for ${schedule.scheduled_date}.`,
      timestamp: toIsoTimestamp(schedule.created_at || schedule.scheduled_date),
      status: schedule.is_executed ? 'executed' : 'scheduled',
      metadata: {
        scheduleId: schedule._id || schedule.id,
        scheduledDate: schedule.scheduled_date,
      },
    });

    if (schedule.is_executed && schedule.executed_at) {
      events.push({
        id: `fertilization-executed-${schedule._id || schedule.id}`,
        type: 'fertilization',
        action: 'executed',
        title: 'Fertilization Executed',
        description: 'Fertilization schedule marked as executed.',
        timestamp: toIsoTimestamp(schedule.executed_at),
        status: 'executed',
        metadata: {
          scheduleId: schedule._id || schedule.id,
          scheduledDate: schedule.scheduled_date,
        },
      });
    }
  });

  toArrayPayload(pestControlSchedules).forEach((schedule) => {
    const methodLabel = schedule.control_method || 'Pest control action';

    events.push({
      id: `pest-control-scheduled-${schedule._id || schedule.id}`,
      type: 'pest_control',
      action: 'scheduled',
      title: 'Pest Control Scheduled',
      description: `${methodLabel} scheduled for ${schedule.scheduled_date}.`,
      timestamp: toIsoTimestamp(schedule.created_at || schedule.scheduled_date),
      status: schedule.is_executed ? 'executed' : 'scheduled',
      metadata: {
        scheduleId: schedule._id || schedule.id,
        detectionId: schedule.detection_id,
        scheduledDate: schedule.scheduled_date,
        controlMethod: schedule.control_method,
      },
    });

    if (schedule.is_executed && schedule.executed_at) {
      events.push({
        id: `pest-control-executed-${schedule._id || schedule.id}`,
        type: 'pest_control',
        action: 'executed',
        title: 'Pest Control Executed',
        description: schedule.actual_outcome
          ? `Pest control completed with outcome: ${schedule.actual_outcome}.`
          : 'Pest control action marked as executed.',
        timestamp: toIsoTimestamp(schedule.executed_at),
        status: 'executed',
        metadata: {
          scheduleId: schedule._id || schedule.id,
          detectionId: schedule.detection_id,
          controlMethod: schedule.control_method,
        },
      });
    }
  });

  toArrayPayload(pestDetections).forEach((detection) => {
    const pestLabel = detection.pest_type ? formatLabel(detection.pest_type) : 'Pest Scan';

    events.push({
      id: `pest-detection-created-${detection._id || detection.id}`,
      type: 'pest_detection',
      action: 'reported',
      title: pestLabel,
      description: detection.pest_detected
        ? `${pestLabel} detected with ${detection.severity} severity.`
        : 'Pest scan recorded with no confirmed pest detected.',
      timestamp: toIsoTimestamp(detection.created_at),
      status: detection.is_confirmed === true ? 'confirmed' : detection.severity,
      metadata: {
        detectionId: detection._id || detection.id,
        pestDetected: detection.pest_detected,
      },
    });

    if (detection.reviewed_at) {
      events.push({
        id: `pest-detection-reviewed-${detection._id || detection.id}`,
        type: 'pest_detection',
        action: 'reviewed',
        title: pestLabel,
        description: detection.is_confirmed === true
          ? 'Expert confirmed the pest detection result.'
          : 'Expert reviewed the pest detection result.',
        timestamp: toIsoTimestamp(detection.reviewed_at),
        status: detection.is_confirmed === true ? 'confirmed' : 'reviewed',
        metadata: {
          detectionId: detection._id || detection.id,
          isConfirmed: detection.is_confirmed,
        },
      });
    }
  });

  toArrayPayload(farmIssues).forEach((issue) => {
    events.push({
      id: `farm-issue-reported-${issue._id || issue.id}`,
      type: 'farm_issue',
      action: 'reported',
      title: issue.title || 'Farm Issue',
      description: `${formatLabel(issue.severity)} ${formatLabel(issue.category)} issue reported.`,
      timestamp: toIsoTimestamp(issue.created_at),
      status: issue.status,
      metadata: {
        issueId: issue._id || issue.id,
        category: issue.category,
      },
    });

    if (issue.assigned_to && issue.updated_at && issue.updated_at !== issue.created_at) {
      events.push({
        id: `farm-issue-assigned-${issue._id || issue.id}`,
        type: 'farm_issue',
        action: 'assigned',
        title: issue.title || 'Farm Issue',
        description: 'Issue assigned for expert follow-up.',
        timestamp: toIsoTimestamp(issue.updated_at),
        status: issue.status,
        metadata: {
          issueId: issue._id || issue.id,
          assignedTo: issue.assigned_to,
        },
      });
    }

    if (issue.status !== 'open') {
      events.push({
        id: `farm-issue-updated-${issue._id || issue.id}`,
        type: 'farm_issue',
        action: issue.status === 'resolved' || issue.status === 'closed' ? 'completed' : 'updated',
        title: issue.title || 'Farm Issue',
        description: `Issue marked ${formatLabel(issue.status).toLowerCase()}.`,
        timestamp: toIsoTimestamp(issue.resolved_at || issue.updated_at),
        status: issue.status,
        metadata: {
          issueId: issue._id || issue.id,
        },
      });
    }
  });

  const filteredEvents = events
    .filter((event) => Date.parse(event.timestamp) >= since)
    .filter((event) => !requestedType || event.type === requestedType)
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));

  const summary = filteredEvents.reduce(
    (acc, event) => {
      acc.total += 1;
      acc.byType[event.type] = (acc.byType[event.type] || 0) + 1;
      acc.byAction[event.action] = (acc.byAction[event.action] || 0) + 1;
      return acc;
    },
    {
      total: 0,
      byType: {},
      byAction: {},
    }
  );

  return {
    farmId,
    period: {
      days: parsedDays,
      since: new Date(since).toISOString(),
      until: new Date(now).toISOString(),
    },
    filters: {
      type: requestedType || 'all',
      limit: parsedLimit,
    },
    summary,
    activity: filteredEvents.slice(0, parsedLimit),
  };
};

const serializeFarmActivityCsv = (payload) => {
  const headers = ['timestamp', 'type', 'action', 'title', 'description', 'status'];
  const rows = (payload?.activity || []).map((item) => [
    item.timestamp,
    item.type,
    item.action,
    item.title,
    item.description,
    item.status || '',
  ]);

  return [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');
};

const buildSystemActivityPayload = async ({ hours = 24, limit = 20, type } = {}) => {
  const parsedHours = Math.max(1, parseInt(hours, 10) || 24);
  const parsedLimit = Math.max(1, parseInt(limit, 10) || 20);
  const requestedType = type && String(type).toLowerCase() !== 'all'
    ? String(type).toLowerCase()
    : undefined;
  const since = Date.now() - parsedHours * 60 * 60 * 1000;
  const startTime = new Date(since);

  const [
    newUsers,
    newFarms,
    activeFarms,
    sensorReadingsCount,
    recommendations,
    pestDetections,
  ] = await Promise.all([
    db.users.list({ since }),
    db.farms.list({ since }),
    db.farms.listActive(),
    db.sensorData.countSince(since),
    db.recommendations.list({ page: 1, limit: 50, since }),
    db.pestDetections.getStats({ since }),
  ]);

  const usersList = toArrayPayload(newUsers);
  const farmsList = toArrayPayload(newFarms);
  const activeFarmList = toArrayPayload(activeFarms);
  const recommendationRows = toArrayPayload(recommendations);
  const pestRows = toArrayPayload(pestDetections);
  const pestControlPayloads = await Promise.all(
    activeFarmList.map((farm) =>
      db.pestControlSchedules.getByFarm(String(farm._id || farm.id), {
        since: startTime.toISOString().split('T')[0],
        limit: 25,
      })
    )
  );
  const pestControlRows = pestControlPayloads.flatMap((payload) => toArrayPayload(payload));

  const activities = [];

  usersList.forEach((user) => {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || user.phone_number || 'New user';
    activities.push({
      id: `user-${user._id || user.id}`,
      type: 'user',
      title: fullName,
      description: `${formatLabel(user.role || 'user')} account created.`,
      timestamp: toIsoTimestamp(user.created_at),
      status: user.is_active === false ? 'inactive' : 'active',
      metadata: {
        userId: user._id || user.id,
      },
    });
  });

  farmsList.forEach((farm) => {
    activities.push({
      id: `farm-${farm._id || farm.id}`,
      type: 'farm',
      title: farm.name || 'New farm',
      description: 'Farm record created and added to the system.',
      timestamp: toIsoTimestamp(farm.created_at),
      status: farm.is_active === false ? 'inactive' : 'active',
      metadata: {
        farmId: farm._id || farm.id,
        district: farm.district?.name || farm.district || undefined,
      },
    });
  });

  recommendationRows.forEach((recommendation, index) => {
    activities.push({
      id: `recommendation-${recommendation._id || recommendation.id || index}`,
      type: 'recommendation',
      title: recommendation.title || `${formatLabel(recommendation.type)} recommendation`,
      description: `${formatLabel(recommendation.type)} recommendation generated with ${recommendation.priority} priority.`,
      timestamp: toIsoTimestamp(recommendation.created_at),
      status: recommendation.status,
      metadata: {
        recommendationId: recommendation._id || recommendation.id,
      },
    });
  });

  pestRows.forEach((detection, index) => {
    const pestLabel = detection.pest_type ? formatLabel(detection.pest_type) : 'Pest detection';
    activities.push({
      id: `pest-${detection._id || detection.id || index}`,
      type: 'pest_detection',
      title: pestLabel,
      description: detection.pest_detected
        ? `${pestLabel} recorded with ${detection.severity} severity.`
        : 'Pest scan recorded without a confirmed pest detection.',
      timestamp: toIsoTimestamp(detection.created_at),
      status: detection.severity,
      metadata: {
        pestDetected: detection.pest_detected,
      },
    });
  });

  pestControlRows.forEach((schedule, index) => {
    const scheduleId = schedule._id || schedule.id || index;
    const controlMethod = schedule.control_method || 'Pest control action';
    const createdTimestamp = toIsoTimestamp(schedule.created_at || schedule.scheduled_date);
    const executedTimestamp = schedule.executed_at ? toIsoTimestamp(schedule.executed_at) : null;

    activities.push({
      id: `pest-control-${scheduleId}`,
      type: 'pest_control',
      title: 'Pest Control Scheduled',
      description: `${controlMethod} scheduled for ${schedule.scheduled_date}.`,
      timestamp: createdTimestamp,
      status: schedule.is_executed ? 'executed' : 'scheduled',
      metadata: {
        scheduleId,
        farmId: schedule.farm_id,
        detectionId: schedule.detection_id,
      },
    });

    if (executedTimestamp) {
      activities.push({
        id: `pest-control-executed-${scheduleId}`,
        type: 'pest_control',
        title: 'Pest Control Executed',
        description: schedule.actual_outcome
          ? `Pest control completed with outcome: ${schedule.actual_outcome}.`
          : `${controlMethod} marked as executed.`,
        timestamp: executedTimestamp,
        status: 'executed',
        metadata: {
          scheduleId,
          farmId: schedule.farm_id,
          detectionId: schedule.detection_id,
        },
      });
    }
  });

  if (sensorReadingsCount > 0) {
    activities.push({
      id: `sensor-summary-${since}`,
      type: 'sensor_reading',
      title: 'Sensor transmission activity',
      description: `${sensorReadingsCount} sensor reading${sensorReadingsCount === 1 ? '' : 's'} recorded in this window.`,
      timestamp: new Date().toISOString(),
      status: 'healthy',
      metadata: {
        sensorReadings: sensorReadingsCount,
      },
    });
  }

  const sortedActivities = activities
    .filter((item) => !requestedType || item.type === requestedType)
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, parsedLimit);

  return {
    period: { hours: parsedHours, since: startTime.toISOString() },
    filters: {
      type: requestedType || 'all',
      limit: parsedLimit,
    },
    summary: {
      newUsers: usersList.length,
      newFarms: farmsList.length,
      sensorReadings: sensorReadingsCount || 0,
      recommendations: recommendationRows.length,
      pestDetections: pestRows.length,
      pestControlActions: pestControlRows.length,
    },
    activities: sortedActivities,
  };
};

const serializeSystemActivityCsv = (payload) => {
  const headers = ['timestamp', 'type', 'title', 'description', 'status'];
  const rows = (payload?.activities || []).map((item) => [
    item.timestamp,
    item.type,
    item.title,
    item.description,
    item.status || '',
  ]);

  return [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');
};

// =====================================================
// FARMER DASHBOARD ANALYTICS
// =====================================================

/**
 * @route GET /api/v1/analytics/farm/:farmId/dashboard
 * @desc Get farmer dashboard data
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId/dashboard',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const farmId = req.params.farmId;
    const recentSince = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const payload = await getFarmDashboardPayload(farmId, recentSince);

    return successResponse(res, payload, 'Dashboard data retrieved successfully');
  })
);

/**
 * @route GET /api/v1/analytics/farm/:farmId/sensor-trends
 * @desc Get sensor data trends
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId/sensor-trends',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const { days = 7, sensorType } = req.query;
    const farmId = req.params.farmId;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get daily aggregates
    try {
      const data = await db.sensorData.getDailyAggregates(farmId, startDate.getTime());

      return successResponse(res, {
        farmId,
        period: { days: parseInt(days), startDate: startDate.toISOString() },
        trends: data || []
      }, 'Sensor trends retrieved successfully');
    } catch (e) {
      // Fallback to latest readings if aggregates not available
      const rawData = await db.sensorData.getLatestReadings(farmId, 100);

      return successResponse(res, {
        farmId,
        period: { days: parseInt(days), startDate: startDate.toISOString() },
        trends: rawData || []
      }, 'Sensor trends retrieved successfully');
    }
  })
);

/**
 * @route GET /api/v1/analytics/farm/:farmId/recommendation-history
 * @desc Get recommendation response history
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId/recommendation-history',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const farmId = req.params.farmId;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const data = await db.recommendations.getByFarm(farmId, {
      since: startDate.getTime()
    });

    return successResponse(
      res,
      buildRecommendationHistoryPayload(farmId, days, data),
      'Recommendation history retrieved successfully'
    );
  })
);

/**
 * @route GET /api/v1/analytics/farm/:farmId/activity
 * @desc Get recent farm activity and operation history
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId/activity',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const { days = 30, limit = 20, type } = req.query;
    const farmId = req.params.farmId;

    const payload = await buildFarmActivityPayload(farmId, {
      days,
      limit,
      type,
    });

    return successResponse(res, payload, 'Farm activity retrieved successfully');
  })
);

/**
 * @route GET /api/v1/analytics/farm/:farmId/activity/export
 * @desc Export recent farm activity and operation history
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId/activity/export',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const { days = 30, limit = 100, format = 'csv', type } = req.query;
    const exportFormat = String(format).toLowerCase();

    if (!['csv', 'json'].includes(exportFormat)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export format. Use csv or json',
        code: 'VALIDATION_ERROR',
      });
    }

    const payload = await buildFarmActivityPayload(req.params.farmId, { days, limit, type });
    const fileBase = `farm-activity-${req.params.farmId}-${new Date().toISOString().slice(0, 10)}`;

    if (exportFormat === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.json"`);
      return res.status(200).send(JSON.stringify(payload, null, 2));
    }

    const csv = serializeFarmActivityCsv(payload);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.csv"`);
    return res.status(200).send(csv);
  })
);

// =====================================================
// ADMIN/EXPERT ANALYTICS
// =====================================================

/**
 * @route GET /api/v1/analytics/system/overview
 * @desc Get system-wide overview
 * @access Admin, Expert
 */
router.get('/system/overview',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const [
      userStats,
      farmStats,
      sensorStats,
      recommendationStats,
      pestStats
    ] = await Promise.all([
      // User statistics
      db.users.listAll(),
      
      // Farm statistics
      db.farms.listActive(),
      
      // Active sensors
      db.sensors.listAllStats(),
      
      // Recent recommendations
      db.recommendations.getStats({
        since
      }),
      
      // Pest detections
      db.pestDetections.getStats({
        since
      })
    ]);

    // Process statistics
    const overview = {
      users: processStats(userStats, 'role'),
      farms: {
        total: farmStats?.length || 0,
        byDistrict: processStats(farmStats, 'district'),
        byStatus: processStats(farmStats, 'status')
      },
      sensors: {
        total: sensorStats?.length || 0,
        byType: processStats(sensorStats, 'sensor_type'),
        byStatus: processStats(sensorStats, 'status')
      },
      recommendations: {
        total: recommendationStats?.length || 0,
        byStatus: processStats(recommendationStats, 'status'),
        byType: processStats(recommendationStats, 'type'),
        byPriority: processStats(recommendationStats, 'priority')
      },
      pestDetections: {
        total: pestStats?.length || 0,
        byStatus: processStats(pestStats, 'status'),
        bySeverity: processStats(pestStats, 'severity')
      }
    };

    return successResponse(res, overview, 'System overview retrieved successfully');
  })
);

/**
 * @route GET /api/v1/analytics/system/activity
 * @desc Get recent system activity
 * @access Admin, Expert
 */
router.get('/system/activity',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const { hours = 24, limit = 20, type } = req.query;
    const payload = await buildSystemActivityPayload({ hours, limit, type });
    return successResponse(res, payload, 'System activity retrieved successfully');
  })
);

/**
 * @route GET /api/v1/analytics/system/activity/export
 * @desc Export recent system activity
 * @access Admin, Expert
 */
router.get('/system/activity/export',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const { hours = 24, limit = 100, type, format = 'csv' } = req.query;
    const exportFormat = String(format).toLowerCase();

    if (!['csv', 'json'].includes(exportFormat)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export format. Use csv or json',
        code: 'VALIDATION_ERROR',
      });
    }

    const payload = await buildSystemActivityPayload({ hours, limit, type });
    const fileBase = `system-activity-${new Date().toISOString().slice(0, 10)}`;

    if (exportFormat === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.json"`);
      return res.status(200).send(JSON.stringify(payload, null, 2));
    }

    const csv = serializeSystemActivityCsv(payload);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.csv"`);
    return res.status(200).send(csv);
  })
);

/**
 * @route GET /api/v1/analytics/district/:district
 * @desc Get district-level analytics
 * @access Admin, Expert
 */
router.get('/district/:district',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const { district } = req.params;
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const [farms, pestDetections, recommendations] = await Promise.all([
      db.farms.list({ page: 1, limit: 1000 }),
      db.pestDetections.getOutbreakMap({ since, statuses: ['detected'] }),
      db.recommendations.list({ page: 1, limit: 1000, since })
    ]);

    const farmsList = (farms?.data || farms || []).filter((farm) => {
      const districtName = farm?.district?.name || farm?.district || '';
      return districtName === district;
    });
    const districtFarmIds = new Set(farmsList.map((farm) => String(farm.id || farm._id)));
    const pestList = (pestDetections || []).filter((item) => districtFarmIds.has(String(item?.farm?.id || item?.farm_id)));
    const recList = (recommendations?.data || recommendations || []).filter((item) =>
      districtFarmIds.has(String(item?.farm?.id || item?.farm_id))
    );

    return successResponse(res, {
      district,
      farms: {
        total: farmsList.length,
        list: farmsList
      },
      pestDetections: {
        total: pestList.length,
        bySeverity: processStats(pestList, 'severity'),
        byPest: processStats(pestList, 'pest_type')
      },
      recommendations: {
        total: recList.length,
        byType: processStats(recList, 'type'),
        byStatus: processStats(recList, 'status')
      }
    }, 'District analytics retrieved successfully');
  })
);

// =====================================================
// ALIAS & ADDITIONAL ANALYTICS ROUTES
// =====================================================

/**
 * @route GET /api/v1/analytics/overview
 * @desc Get system overview (alias for /system/overview)
 * @access Admin, Expert
 */
router.get('/overview',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const [
      userStats,
      farmStats,
      sensorStats,
      recommendationStats,
      pestStats
    ] = await Promise.all([
      db.users.listAll(),
      db.farms.listActive(),
      db.sensors.listAllStats(),
      db.recommendations.getStats({ since }),
      db.pestDetections.getStats({ since })
    ]);

    const overview = {
      users: processStats(userStats, 'role'),
      farms: {
        total: farmStats?.length || 0,
        byDistrict: processStats(farmStats, 'district'),
        byStatus: processStats(farmStats, 'status')
      },
      sensors: {
        total: sensorStats?.length || 0,
        byType: processStats(sensorStats, 'sensor_type'),
        byStatus: processStats(sensorStats, 'status')
      },
      recommendations: {
        total: recommendationStats?.length || 0,
        byStatus: processStats(recommendationStats, 'status'),
        byType: processStats(recommendationStats, 'type'),
        byPriority: processStats(recommendationStats, 'priority')
      },
      pestDetections: {
        total: pestStats?.length || 0,
        byStatus: processStats(pestStats, 'status'),
        bySeverity: processStats(pestStats, 'severity')
      }
    };

    return successResponse(res, overview, 'System overview retrieved successfully');
  })
);

/**
 * @route GET /api/v1/analytics/activity
 * @desc Get recent system activity (alias for /system/activity)
 * @access Admin, Expert
 */
router.get('/activity',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const { hours = 24, limit = 20, type } = req.query;
    const payload = await buildSystemActivityPayload({ hours, limit, type });
    return successResponse(res, payload, 'System activity retrieved successfully');
  })
);

/**
 * @route GET /api/v1/analytics/activity/export
 * @desc Export recent system activity (alias)
 * @access Admin, Expert
 */
router.get('/activity/export',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const { hours = 24, limit = 100, type, format = 'csv' } = req.query;
    const exportFormat = String(format).toLowerCase();

    if (!['csv', 'json'].includes(exportFormat)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export format. Use csv or json',
        code: 'VALIDATION_ERROR',
      });
    }

    const payload = await buildSystemActivityPayload({ hours, limit, type });
    const fileBase = `system-activity-${new Date().toISOString().slice(0, 10)}`;

    if (exportFormat === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.json"`);
      return res.status(200).send(JSON.stringify(payload, null, 2));
    }

    const csv = serializeSystemActivityCsv(payload);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.csv"`);
    return res.status(200).send(csv);
  })
);

/**
 * @route GET /api/v1/analytics/farm/:farmId/recommendations
 * @desc Get farm recommendation history (alias for /farm/:farmId/recommendation-history)
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId/recommendations',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const farmId = req.params.farmId;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const data = await db.recommendations.getByFarm(farmId, {
      since: startDate.getTime()
    });

    return successResponse(
      res,
      buildRecommendationHistoryPayload(farmId, days, data),
      'Recommendation history retrieved successfully'
    );
  })
);

/**
 * @route GET /api/v1/analytics/districts
 * @desc Get analytics for all districts
 * @access Admin, Expert
 */
router.get('/districts',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const [districts, farms, pestDetections, recommendations] = await Promise.all([
      db.districts.list(),
      db.farms.list({ page: 1, limit: 1000 }),
      db.pestDetections.getOutbreakMap({ since, statuses: ['detected'] }),
      db.recommendations.list({ page: 1, limit: 1000, since })
    ]);

    const farmsList = farms?.data || farms || [];
    const pestList = pestDetections || [];
    const recList = recommendations?.data || recommendations || [];

    const districtAnalytics = (districts || []).map(district => {
      const districtName = district.name || district;
      const districtFarms = farmsList.filter((f) => (f?.district?.name || f?.district) === districtName);
      const districtFarmIds = new Set(districtFarms.map((f) => String(f.id || f._id)));
      const districtPests = pestList.filter((p) => districtFarmIds.has(String(p?.farm?.id || p?.farm_id)));
      const districtRecs = recList.filter((r) => districtFarmIds.has(String(r?.farm?.id || r?.farm_id)));

      return {
        district: districtName,
        farms: districtFarms.length,
        pestDetections: districtPests.length,
        recommendations: districtRecs.length,
        pestsBySeverity: processStats(districtPests, 'severity'),
        recsByStatus: processStats(districtRecs, 'status')
      };
    });

    return successResponse(res, districtAnalytics, 'District analytics retrieved successfully');
  })
);

/**
 * @route GET /api/v1/analytics/export
 * @desc Export analytics data
 * @access Admin
 */
router.get('/export',
  authenticate,
  requireMinimumRole(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const { format = 'json', startDate, endDate } = req.query;
    const now = Date.now();
    const startMs = toTimestamp(startDate, 0);
    const endMs = toTimestamp(endDate, now);

    // Gather analytics data
    const [farms, users, sensors, recommendations] = await Promise.all([
      db.farms.list({ page: 1, limit: 1, since: startMs }),
      db.users.list({ page: 1, limit: 1, since: startMs }),
      db.sensorData.list({ page: 1, limit: 1, since: startMs, until: endMs }),
      db.recommendations.list({ page: 1, limit: 1, since: startMs }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      period: { startDate: startDate || null, endDate: endDate || null },
      summary: {
        totalFarms: extractCount(farms),
        totalUsers: extractCount(users),
        totalSensorReadings: extractCount(sensors),
        totalRecommendations: extractCount(recommendations),
      },
    };

    if (format === 'csv') {
      const header = 'metric,value\n';
      const rows = Object.entries(exportData.summary)
        .map(([k, v]) => `${k},${v}`)
        .join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.csv');
      return res.send(header + rows);
    }

    return successResponse(res, exportData, 'Analytics exported successfully');
  })
);

/**
 * @route GET /api/v1/analytics/dashboard
 * @desc Dashboard analytics
 * @access Authenticated
 */
router.get('/dashboard',
  authenticate,
  asyncHandler(async (req, res) => {
    const { farmId } = req.query;

    if (farmId) {
      const recentSince = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const payload = await getFarmDashboardPayload(farmId, recentSince);

      return successResponse(res, payload, 'Dashboard data retrieved successfully');
    }

    // If no farmId, return system-level summary for admin/expert
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const [
      userStats,
      farmStats,
      recommendationStats,
      pestStats
    ] = await Promise.all([
      db.users.listAll(),
      db.farms.listActive(),
      db.recommendations.getStats({ since }),
      db.pestDetections.getStats({ since })
    ]);

    return successResponse(res, {
      users: { total: userStats?.length || 0 },
      farms: { total: farmStats?.length || 0 },
      recommendations: { total: recommendationStats?.length || 0 },
      pestDetections: { total: pestStats?.length || 0 }
    }, 'Dashboard data retrieved successfully');
  })
);

/**
 * Helper function to process statistics
 */
function processStats(data, field) {
  if (!data) return {};
  return data.reduce((acc, item) => {
    const key = item[field] || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export default router;
