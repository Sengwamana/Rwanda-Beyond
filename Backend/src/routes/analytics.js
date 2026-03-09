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

    // Calculate statistics
    const stats = {
      total: data.length,
      byStatus: {},
      byType: {},
      byPriority: {},
      responseRate: 0,
      averageResponseTime: null
    };

    let totalResponseTime = 0;
    let respondedCount = 0;

    data.forEach(rec => {
      stats.byStatus[rec.status] = (stats.byStatus[rec.status] || 0) + 1;
      stats.byType[rec.type] = (stats.byType[rec.type] || 0) + 1;
      stats.byPriority[rec.priority] = (stats.byPriority[rec.priority] || 0) + 1;

      if (rec.responded_at) {
        respondedCount++;
        totalResponseTime += new Date(rec.responded_at) - new Date(rec.created_at);
      }
    });

    if (respondedCount > 0) {
      stats.responseRate = (respondedCount / data.length) * 100;
      stats.averageResponseTime = Math.round(totalResponseTime / respondedCount / (1000 * 60 * 60)); // hours
    }

    return successResponse(res, {
      farmId,
      period: { days: parseInt(days) },
      history: data,
      stats
    }, 'Recommendation history retrieved successfully');
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
    const { hours = 24 } = req.query;
    const startTime = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
    const since = startTime.getTime();

    const [
      newUsers,
      newFarms,
      sensorReadingsCount,
      recommendations,
      pestDetections
    ] = await Promise.all([
      db.users.list({ since }),
      db.farms.list({ since }),
      db.sensorData.countSince(since),
      db.recommendations.getStats({ since }),
      db.pestDetections.getStats({ since })
    ]);

    const usersList = newUsers?.data || newUsers || [];
    const farmsList = newFarms?.data || newFarms || [];

    return successResponse(res, {
      period: { hours: parseInt(hours), since: startTime.toISOString() },
      activity: {
        newUsers: usersList.length,
        newFarms: farmsList.length,
        sensorReadings: sensorReadingsCount || 0,
        recommendations: recommendations?.length || 0,
        pestDetections: pestDetections?.length || 0
      },
      details: {
        users: usersList,
        farms: farmsList,
        recommendations: recommendations || [],
        pestDetections: pestDetections || []
      }
    }, 'System activity retrieved successfully');
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
    const { hours = 24 } = req.query;
    const startTime = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
    const since = startTime.getTime();

    const [
      newUsers,
      newFarms,
      sensorReadingsCount,
      recommendations,
      pestDetections
    ] = await Promise.all([
      db.users.list({ since }),
      db.farms.list({ since }),
      db.sensorData.countSince(since),
      db.recommendations.getStats({ since }),
      db.pestDetections.getStats({ since })
    ]);

    const usersList = newUsers?.data || newUsers || [];
    const farmsList = newFarms?.data || newFarms || [];

    return successResponse(res, {
      period: { hours: parseInt(hours), since: startTime.toISOString() },
      activity: {
        newUsers: usersList.length,
        newFarms: farmsList.length,
        sensorReadings: sensorReadingsCount || 0,
        recommendations: recommendations?.length || 0,
        pestDetections: pestDetections?.length || 0
      },
      details: {
        users: usersList,
        farms: farmsList,
        recommendations: recommendations || [],
        pestDetections: pestDetections || []
      }
    }, 'System activity retrieved successfully');
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

    const stats = {
      total: data.length,
      byStatus: {},
      byType: {},
      byPriority: {},
      responseRate: 0,
      averageResponseTime: null
    };

    let totalResponseTime = 0;
    let respondedCount = 0;

    data.forEach(rec => {
      stats.byStatus[rec.status] = (stats.byStatus[rec.status] || 0) + 1;
      stats.byType[rec.type] = (stats.byType[rec.type] || 0) + 1;
      stats.byPriority[rec.priority] = (stats.byPriority[rec.priority] || 0) + 1;

      if (rec.responded_at) {
        respondedCount++;
        totalResponseTime += new Date(rec.responded_at) - new Date(rec.created_at);
      }
    });

    if (respondedCount > 0) {
      stats.responseRate = (respondedCount / data.length) * 100;
      stats.averageResponseTime = Math.round(totalResponseTime / respondedCount / (1000 * 60 * 60));
    }

    return successResponse(res, {
      farmId,
      period: { days: parseInt(days) },
      history: data,
      stats
    }, 'Recommendation history retrieved successfully');
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
