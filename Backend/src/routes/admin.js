/**
 * Admin Routes
 * 
 * API endpoints for system administration and configuration.
 * 
 * @module routes/admin
 */

import { Router } from 'express';
import { authenticate, authorize, ROLES } from '../middleware/auth.js';
import { validatePagination, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { successResponse, paginatedResponse } from '../utils/response.js';
import { db } from '../database/convex.js';
import logger from '../utils/logger.js';

const router = Router();

// All admin routes require admin role
router.use(authenticate, authorize(ROLES.ADMIN));

// =====================================================
// SYSTEM CONFIGURATION
// =====================================================

/**
 * @route GET /api/v1/admin/config
 * @desc Get system configuration
 * @access Admin only
 */
router.get('/config',
  asyncHandler(async (req, res) => {
    const data = await db.systemConfig.list();

    // Group by category
    const config = data.reduce((acc, item) => {
      const category = item.key.split('.')[0];
      if (!acc[category]) acc[category] = {};
      acc[category][item.key] = {
        value: item.value,
        description: item.description,
        updatedAt: item.updated_at
      };
      return acc;
    }, {});

    return successResponse(res, config, 'Configuration retrieved successfully');
  })
);

/**
 * @route PUT /api/v1/admin/config/:key
 * @desc Update system configuration
 * @access Admin only
 */
router.put('/config/:key',
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const { value, description } = req.body;

    const data = await db.systemConfig.upsert({
      key,
      value,
      description,
      updated_at: new Date().toISOString(),
      updated_by: req.user._id
    });

    // Log configuration change
    await logAuditEvent(req.user._id, 'CONFIG_UPDATE', {
      key,
      newValue: value
    });

    return successResponse(res, data, 'Configuration updated successfully');
  })
);

// =====================================================
// USER MANAGEMENT
// =====================================================

/**
 * @route GET /api/v1/admin/users
 * @desc Get all users with filters
 * @access Admin only
 */
router.get('/users',
  validatePagination,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, role, status, search } = req.query;

    const opts = {
      page: parseInt(page),
      limit: parseInt(limit),
      role: role || undefined,
      status: status || undefined,
      search: search || undefined
    };

    const result = await db.users.list(opts);
    const data = result.data || result;
    const count = result.total || data.length;

    return paginatedResponse(res, data, parseInt(page), parseInt(limit), count, 'Users retrieved successfully');
  })
);

/**
 * @route PUT /api/v1/admin/users/:userId/role
 * @desc Update user role
 * @access Admin only
 */
router.put('/users/:userId/role',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role',
        code: 'VALIDATION_ERROR'
      });
    }

    const user = await db.users.update(userId, { role, updated_at: new Date().toISOString() });

    await logAuditEvent(req.user._id, 'ROLE_CHANGE', {
      targetUserId: userId,
      newRole: role
    });

    return successResponse(res, user, 'User role updated successfully');
  })
);

/**
 * @route POST /api/v1/admin/users/:userId/deactivate
 * @desc Deactivate a user
 * @access Admin only
 */
router.post('/users/:userId/deactivate',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await db.users.update(userId, { 
      status: 'inactive', 
      deactivation_reason: reason,
      updated_at: new Date().toISOString() 
    });

    await logAuditEvent(req.user._id, 'USER_DEACTIVATED', {
      targetUserId: userId,
      reason
    });

    return successResponse(res, user, 'User deactivated successfully');
  })
);

// =====================================================
// IOT DEVICE MANAGEMENT
// =====================================================

/**
 * @route GET /api/v1/admin/devices
 * @desc Get all IoT devices
 * @access Admin only
 */
router.get('/devices',
  validatePagination,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;

    const opts = {
      page: parseInt(page),
      limit: parseInt(limit),
      status: status || undefined
    };

    const result = await db.iotDeviceTokens.list(opts);
    const data = result.data || result;
    const count = result.total || data.length;

    return paginatedResponse(res, data, parseInt(page), parseInt(limit), count, 'Devices retrieved successfully');
  })
);

/**
 * @route POST /api/v1/admin/devices/:deviceId/revoke
 * @desc Revoke device token
 * @access Admin only
 */
router.post('/devices/:deviceId/revoke',
  asyncHandler(async (req, res) => {
    const { deviceId } = req.params;

    await db.iotDeviceTokens.revoke(deviceId, null);

    await logAuditEvent(req.user._id, 'DEVICE_REVOKED', { deviceId });

    return successResponse(res, { device_id: deviceId, is_active: false }, 'Device token revoked successfully');
  })
);

/**
 * @route POST /api/v1/admin/devices/generate
 * @desc Generate new device token
 * @access Admin only
 */
router.post('/devices/generate',
  asyncHandler(async (req, res) => {
    const { farmId, deviceName, expiresInDays = 365 } = req.body;

    // Generate secure token
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const deviceId = `device_${crypto.randomBytes(8).toString('hex')}`;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const data = await db.iotDeviceTokens.create({
      device_id: deviceId,
      farm_id: farmId,
      device_name: deviceName,
      token_hash: crypto.createHash('sha256').update(token).digest('hex'),
      expires_at: expiresAt.toISOString(),
      created_by: req.user._id
    });

    await logAuditEvent(req.user._id, 'DEVICE_CREATED', { deviceId, farmId });

    // Return token only once - it cannot be retrieved again
    return successResponse(res, {
      deviceId,
      token, // Only returned once!
      expiresAt: expiresAt.toISOString(),
      warning: 'Store this token securely. It cannot be retrieved again.'
    }, 'Device token generated successfully');
  })
);

// =====================================================
// AUDIT LOGS
// =====================================================

/**
 * @route GET /api/v1/admin/audit-logs
 * @desc Get audit logs
 * @access Admin only
 */
router.get('/audit-logs',
  validatePagination,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, action, userId, startDate, endDate } = req.query;

    const opts = {
      page: parseInt(page),
      limit: parseInt(limit),
      action: action || undefined,
      userId: userId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    };

    const result = await db.auditLogs.list(opts);
    const data = result.data || result;
    const count = result.total || data.length;

    return paginatedResponse(res, data, parseInt(page), parseInt(limit), count, 'Audit logs retrieved successfully');
  })
);

// =====================================================
// SYSTEM MONITORING
// =====================================================

/**
 * @route GET /api/v1/admin/health
 * @desc Get system health status
 * @access Admin only
 */
router.get('/health',
  asyncHandler(async (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Check database connection
    try {
      await db.systemConfig.healthCheck();
      health.checks.database = 'healthy';
    } catch (e) {
      health.checks.database = 'unhealthy';
      health.status = 'degraded';
    }

    // Check recent sensor data ingestion
    try {
      const latestReading = await db.sensorData.getLatestOne();

      if (latestReading) {
        const lastReading = new Date(latestReading.recorded_at);
        const minutesAgo = (Date.now() - lastReading.getTime()) / (1000 * 60);
        health.checks.sensorIngestion = minutesAgo < 60 ? 'healthy' : 'stale';
        health.checks.lastSensorReading = latestReading.recorded_at;
      }
    } catch (e) {
      health.checks.sensorIngestion = 'unknown';
    }

    // Memory usage (Node.js)
    const memUsage = process.memoryUsage();
    health.checks.memory = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      external: Math.round(memUsage.external / 1024 / 1024) + 'MB'
    };

    // Uptime
    health.checks.uptime = Math.round(process.uptime()) + ' seconds';

    return successResponse(res, health, 'Health check completed');
  })
);

/**
 * @route GET /api/v1/admin/metrics
 * @desc Get system metrics
 * @access Admin only
 */
router.get('/metrics',
  asyncHandler(async (req, res) => {
    const { period = '24h' } = req.query;
    
    let hours;
    switch (period) {
      case '1h': hours = 1; break;
      case '6h': hours = 6; break;
      case '24h': hours = 24; break;
      case '7d': hours = 168; break;
      default: hours = 24;
    }

    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const since = startTime.toISOString();

    const [sensorCount, recommendationCount, messageCount, errorCount] = await Promise.all([
      db.sensorData.countSince(since),
      db.recommendations.countSince(since),
      db.messages.countSince(since),
      db.auditLogs.countErrors(since)
    ]);

    return successResponse(res, {
      period,
      since: startTime.toISOString(),
      metrics: {
        sensorReadings: sensorCount || 0,
        recommendationsGenerated: recommendationCount || 0,
        messagesSent: messageCount || 0,
        errors: errorCount || 0
      }
    }, 'Metrics retrieved successfully');
  })
);

// =====================================================
// BULK OPERATIONS
// =====================================================

/**
 * @route POST /api/v1/admin/broadcast
 * @desc Send broadcast message to users
 * @access Admin only
 */
router.post('/broadcast',
  asyncHandler(async (req, res) => {
    const { message, messageKinyarwanda, targetRole, targetDistrict, channel = 'sms' } = req.body;

    // Get target users
    const users = await db.users.listActive(targetRole || undefined);

    // Queue messages (actual sending handled by notification service)
    const messageDocs = users.map(user => ({
      user_id: user._id,
      recipient: user.phone,
      channel,
      message: user.preferred_language === 'rw' ? (messageKinyarwanda || message) : message,
      status: 'queued',
      priority: 'routine',
      metadata: { broadcast: true, initiatedBy: req.user._id }
    }));

    const inserted = await db.messages.createBatch(messageDocs);

    await logAuditEvent(req.user._id, 'BROADCAST_SENT', {
      recipientCount: users.length,
      targetRole,
      targetDistrict
    });

    return successResponse(res, {
      queued: inserted.length,
      targetedUsers: users.length
    }, 'Broadcast queued successfully');
  })
);

// =====================================================
// ADDITIONAL ADMIN ROUTES
// =====================================================

/**
 * @route GET /api/v1/admin/users/statistics
 * @desc Get user statistics
 * @access Admin only
 */
router.get('/users/statistics',
  asyncHandler(async (req, res) => {
    const stats = await db.users.getStats();
    return successResponse(res, stats, 'User statistics retrieved successfully');
  })
);

/**
 * @route GET /api/v1/admin/users/:userId
 * @desc Get single user by ID
 * @access Admin only
 */
router.get('/users/:userId',
  asyncHandler(async (req, res) => {
    const user = await db.users.getById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'NOT_FOUND'
      });
    }
    return successResponse(res, user, 'User retrieved successfully');
  })
);

/**
 * @route GET /api/v1/admin/farms/statistics
 * @desc Get farm statistics
 * @access Admin only
 */
router.get('/farms/statistics',
  asyncHandler(async (req, res) => {
    const stats = await db.farms.getStats();
    return successResponse(res, stats, 'Farm statistics retrieved successfully');
  })
);

/**
 * @route GET /api/v1/admin/farms
 * @desc Get all farms with filters
 * @access Admin only
 */
router.get('/farms',
  validatePagination,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, district, search } = req.query;

    const opts = {
      page: parseInt(page),
      limit: parseInt(limit),
      status: status || undefined,
      district: district || undefined,
      search: search || undefined
    };

    const result = await db.farms.list(opts);
    const data = result.data || result;
    const count = result.total || data.length;

    return paginatedResponse(res, data, parseInt(page), parseInt(limit), count, 'Farms retrieved successfully');
  })
);

/**
 * @route GET /api/v1/admin/overview
 * @desc Get system overview (proxy to analytics)
 * @access Admin only
 */
router.get('/overview',
  asyncHandler(async (req, res) => {
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
      db.recommendations.getStats({
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      }),
      db.pestDetections.getStats({
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      })
    ]);

    const countBy = (arr, key) => {
      if (!Array.isArray(arr)) return {};
      return arr.reduce((acc, item) => {
        const val = item[key] || 'unknown';
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {});
    };

    const overview = {
      users: {
        total: Array.isArray(userStats) ? userStats.length : (userStats?.count || 0),
        byRole: countBy(userStats, 'role')
      },
      farms: {
        total: Array.isArray(farmStats) ? farmStats.length : 0,
        byDistrict: countBy(farmStats, 'district'),
        byStatus: countBy(farmStats, 'status')
      },
      sensors: {
        total: Array.isArray(sensorStats) ? sensorStats.length : 0,
        byType: countBy(sensorStats, 'sensor_type'),
        byStatus: countBy(sensorStats, 'status')
      },
      recommendations: {
        total: Array.isArray(recommendationStats) ? recommendationStats.length : 0,
        byStatus: countBy(recommendationStats, 'status'),
        byPriority: countBy(recommendationStats, 'priority')
      },
      pestDetections: {
        total: Array.isArray(pestStats) ? pestStats.length : 0,
        bySeverity: countBy(pestStats, 'severity')
      }
    };

    return successResponse(res, overview, 'System overview retrieved successfully');
  })
);

/**
 * @route GET /api/v1/admin/sensors/health
 * @desc Get sensor health
 * @access Admin only
 */
router.get('/sensors/health',
  asyncHandler(async (req, res) => {
    const health = await db.sensors.getHealth();
    return successResponse(res, health, 'Sensor health retrieved successfully');
  })
);

/**
 * @route GET /api/v1/admin/analytics
 * @desc Get analytics data
 * @access Admin only
 */
router.get('/analytics',
  asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    let days;
    switch (period) {
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      case '90d': days = 90; break;
      default: days = 30;
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [sensorCount, recommendationCount, messageCount, errorCount] = await Promise.all([
      db.sensorData.countSince(since),
      db.recommendations.countSince(since),
      db.messages.countSince(since),
      db.auditLogs.countErrors(since)
    ]);

    return successResponse(res, {
      period,
      since,
      metrics: {
        sensorReadings: sensorCount || 0,
        recommendationsGenerated: recommendationCount || 0,
        messagesSent: messageCount || 0,
        errors: errorCount || 0
      }
    }, 'Analytics data retrieved successfully');
  })
);

/**
 * @route GET /api/v1/admin/alerts/statistics
 * @desc Get alert statistics
 * @access Admin only
 */
router.get('/alerts/statistics',
  asyncHandler(async (req, res) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [pestStats, recommendationStats] = await Promise.all([
      db.pestDetections.getStats({ since }),
      db.recommendations.getStats({ since })
    ]);

    const countBy = (arr, key) => {
      if (!Array.isArray(arr)) return {};
      return arr.reduce((acc, item) => {
        const val = item[key] || 'unknown';
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {});
    };

    const stats = {
      pestAlerts: {
        total: Array.isArray(pestStats) ? pestStats.length : 0,
        bySeverity: countBy(pestStats, 'severity'),
        byStatus: countBy(pestStats, 'status')
      },
      recommendations: {
        total: Array.isArray(recommendationStats) ? recommendationStats.length : 0,
        byPriority: countBy(recommendationStats, 'priority'),
        byStatus: countBy(recommendationStats, 'status')
      }
    };

    return successResponse(res, stats, 'Alert statistics retrieved successfully');
  })
);

/**
 * @route POST /api/v1/admin/reports/generate
 * @desc Generate a report (placeholder)
 * @access Admin only
 */
router.post('/reports/generate',
  asyncHandler(async (req, res) => {
    const { type = 'summary', startDate, endDate, format = 'json' } = req.body;

    await logAuditEvent(req.user._id, 'REPORT_GENERATED', {
      type,
      startDate,
      endDate,
      format
    });

    return successResponse(res, {
      reportId: `report_${Date.now()}`,
      type,
      startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: endDate || new Date().toISOString(),
      format,
      status: 'generated',
      message: 'Report generation placeholder - full implementation pending'
    }, 'Report generated successfully');
  })
);

/**
 * @route POST /api/v1/admin/devices/token
 * @desc Alias for devices/generate (frontend calls /token not /generate)
 * @access Admin only
 */
router.post('/devices/token',
  asyncHandler(async (req, res) => {
    const { farmId, deviceName, expiresInDays = 365 } = req.body;

    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const deviceId = `device_${crypto.randomBytes(8).toString('hex')}`;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const data = await db.iotDeviceTokens.create({
      device_id: deviceId,
      farm_id: farmId,
      device_name: deviceName,
      token_hash: crypto.createHash('sha256').update(token).digest('hex'),
      expires_at: expiresAt.toISOString(),
      created_by: req.user._id
    });

    await logAuditEvent(req.user._id, 'DEVICE_CREATED', { deviceId, farmId });

    return successResponse(res, {
      deviceId,
      token,
      expiresAt: expiresAt.toISOString(),
      warning: 'Store this token securely. It cannot be retrieved again.'
    }, 'Device token generated successfully');
  })
);

/**
 * Helper function to log audit events
 */
async function logAuditEvent(userId, action, details) {
  try {
    await db.auditLogs.create({
      user_id: userId,
      action,
      details,
      ip_address: null, // Would be extracted from request in production
      created_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to log audit event', { action, error: error.message });
  }
}

export default router;
