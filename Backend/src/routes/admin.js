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

const MAX_REPORT_ROWS = 5000;
const REPORT_TYPES = new Set([
  'summary',
  'users',
  'farms',
  'sensors',
  'recommendations',
  'farm-issues',
  'pest-detections',
  'pest-control',
]);

const toArrayPayload = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const toTimestamp = (value, fallback) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toOptionalTimestamp = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const normalizeActiveStatus = (value) =>
  value === 'active'
    ? true
    : value === 'inactive'
      ? false
      : undefined;

const BROADCAST_CHANNELS = new Set(['sms', 'push', 'email', 'all']);

const resolveUserDistrictId = (user) => {
  if (!user || typeof user !== 'object') return null;

  const metadata = user.metadata && typeof user.metadata === 'object' ? user.metadata : {};

  return (
    user.district_id
    || user.districtId
    || metadata.districtId
    || metadata.district_id
    || metadata.coverageDistrictId
    || metadata.coverage_district_id
    || null
  );
};

const getBroadcastRecipientAddress = (user, channel) => {
  if (channel === 'sms' && user?.phone_number) return user.phone_number;
  if (channel === 'email' && user?.email) return user.email;
  return user?.phone_number || user?.email || `user:${user?._id || user?.id || 'unknown'}`;
};

const resolveBroadcastChannelForUser = (user, requestedChannel) => {
  if (requestedChannel === 'push' || requestedChannel === 'all') {
    return 'push';
  }

  if (requestedChannel === 'sms') {
    return user?.phone_number ? 'sms' : 'push';
  }

  if (requestedChannel === 'email') {
    return user?.email ? 'email' : 'push';
  }

  return 'push';
};

const filterBroadcastRecipientsByDistrict = (users, targetDistrict) => {
  if (!targetDistrict) return users;

  return (users || []).filter((user) => {
    const districtId = resolveUserDistrictId(user);
    return districtId && String(districtId) === String(targetDistrict);
  });
};

const getSensorReadingTimestamp = (reading) => {
  if (!reading || typeof reading !== 'object') {
    return undefined;
  }

  if (typeof reading.reading_timestamp === 'number' && Number.isFinite(reading.reading_timestamp)) {
    return reading.reading_timestamp;
  }

  if (typeof reading.recorded_at === 'number' && Number.isFinite(reading.recorded_at)) {
    return reading.recorded_at;
  }

  if (typeof reading.reading_timestamp === 'string') {
    const parsed = Date.parse(reading.reading_timestamp);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (typeof reading.recorded_at === 'string') {
    const parsed = Date.parse(reading.recorded_at);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const extractTimestamp = (row) => {
  if (!row || typeof row !== 'object') return undefined;
  const candidateKeys = ['created_at', 'updated_at', 'reading_timestamp', 'executed_at', 'responded_at'];
  for (const key of candidateKeys) {
    const raw = row[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const filterRowsByDate = (rows, startMs, endMs) =>
  rows.filter((row) => {
    const ts = extractTimestamp(row);
    if (ts === undefined) return true;
    return ts >= startMs && ts <= endMs;
  });

const countByField = (rows, field) =>
  rows.reduce((acc, row) => {
    const key = row?.[field] ?? 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

const summarizeRecommendationRows = (rows) => {
  const summary = {
    total: rows.length,
    byStatus: countByField(rows, 'status'),
    byPriority: countByField(rows, 'priority'),
    byType: countByField(rows, 'type'),
    byChannel: {},
    responseRate: 0,
    acceptanceRate: 0,
    avgResponseTimeHours: null,
  };

  let respondedCount = 0;
  let acceptedCount = 0;
  let totalResponseTimeMs = 0;

  for (const row of rows) {
    if (row?.response_channel) {
      summary.byChannel[row.response_channel] = (summary.byChannel[row.response_channel] || 0) + 1;
    }

    if (row?.status === 'accepted' || row?.status === 'executed') {
      acceptedCount += 1;
    }

    const createdAt = toOptionalTimestamp(row?.created_at);
    const respondedAt = toOptionalTimestamp(row?.responded_at);
    if (createdAt !== undefined && respondedAt !== undefined && respondedAt >= createdAt) {
      respondedCount += 1;
      totalResponseTimeMs += respondedAt - createdAt;
    }
  }

  if (summary.total > 0) {
    summary.responseRate = (respondedCount / summary.total) * 100;
    summary.acceptanceRate = (acceptedCount / summary.total) * 100;
  }

  if (respondedCount > 0) {
    summary.avgResponseTimeHours = Math.round(totalResponseTimeMs / respondedCount / (1000 * 60 * 60));
  }

  return summary;
};

const summarizeFarmIssueRows = (rows) => {
  const summary = {
    total: rows.length,
    byStatus: countByField(rows, 'status'),
    byCategory: countByField(rows, 'category'),
    bySeverity: countByField(rows, 'severity'),
    byChannel: countByField(rows, 'source_channel'),
    avgResolutionTimeHours: null,
  };

  let resolvedCount = 0;
  let totalResolutionTimeMs = 0;

  for (const row of rows) {
    const createdAt = toOptionalTimestamp(row?.created_at);
    const resolvedAt = toOptionalTimestamp(row?.resolved_at);
    if (createdAt !== undefined && resolvedAt !== undefined && resolvedAt >= createdAt) {
      resolvedCount += 1;
      totalResolutionTimeMs += resolvedAt - createdAt;
    }
  }

  if (resolvedCount > 0) {
    summary.avgResolutionTimeHours = Math.round(totalResolutionTimeMs / resolvedCount / (1000 * 60 * 60));
  }

  return summary;
};

const enrichRecommendationRows = (rows) =>
  rows.map((row) => {
    const createdAt = toOptionalTimestamp(row?.created_at);
    const respondedAt = toOptionalTimestamp(row?.responded_at);
    const responseTimeHours =
      createdAt !== undefined && respondedAt !== undefined && respondedAt >= createdAt
        ? Math.round((respondedAt - createdAt) / (1000 * 60 * 60))
        : null;

    return {
      ...row,
      response_recorded: respondedAt !== undefined,
      response_time_hours: responseTimeHours,
    };
  });

const enrichFarmIssueRows = (rows) =>
  rows.map((row) => {
    const createdAt = toOptionalTimestamp(row?.created_at);
    const resolvedAt = toOptionalTimestamp(row?.resolved_at);
    const resolutionTimeHours =
      createdAt !== undefined && resolvedAt !== undefined && resolvedAt >= createdAt
        ? Math.round((resolvedAt - createdAt) / (1000 * 60 * 60))
        : null;

    return {
      ...row,
      resolution_recorded: resolvedAt !== undefined,
      resolution_time_hours: resolutionTimeHours,
    };
  });

const enrichPestControlRows = (rows) =>
  rows.map((row) => {
    const createdAt = toOptionalTimestamp(row?.created_at);
    const executedAt = toOptionalTimestamp(row?.executed_at);
    const executionLeadTimeHours =
      createdAt !== undefined && executedAt !== undefined && executedAt >= createdAt
        ? Math.round((executedAt - createdAt) / (1000 * 60 * 60))
        : null;

    return {
      ...row,
      operational_status: row?.is_executed ? 'executed' : 'scheduled',
      execution_recorded: executedAt !== undefined,
      execution_lead_time_hours: executionLeadTimeHours,
    };
  });

const summarizePestControlRows = (rows) => {
  const summary = {
    total: rows.length,
    byStatus: countByField(rows, 'operational_status'),
    byMethod: countByField(rows, 'control_method'),
    byOutcome: countByField(rows.filter((row) => row?.actual_outcome), 'actual_outcome'),
    executionRate: 0,
    avgExecutionLeadTimeHours: null,
  };

  let executedCount = 0;
  let totalExecutionLeadTimeMs = 0;

  for (const row of rows) {
    const createdAt = toOptionalTimestamp(row?.created_at);
    const executedAt = toOptionalTimestamp(row?.executed_at);

    if (createdAt !== undefined && executedAt !== undefined && executedAt >= createdAt) {
      executedCount += 1;
      totalExecutionLeadTimeMs += executedAt - createdAt;
    }
  }

  if (summary.total > 0) {
    summary.executionRate = (executedCount / summary.total) * 100;
  }

  if (executedCount > 0) {
    summary.avgExecutionLeadTimeHours = Math.round(totalExecutionLeadTimeMs / executedCount / (1000 * 60 * 60));
  }

  return summary;
};

const getPestControlRows = async (farmRows, startMs, endMs) => {
  const sinceDate = new Date(startMs).toISOString().split('T')[0];
  const payloads = await Promise.all(
    farmRows.map((farm) =>
      db.pestControlSchedules.getByFarm(String(farm?._id || farm?.id || ''), {
        since: sinceDate,
        limit: MAX_REPORT_ROWS,
      })
    )
  );

  return enrichPestControlRows(
    filterRowsByDate(
      payloads.flatMap((payload) => toArrayPayload(payload)),
      startMs,
      endMs
    )
  );
};

const toCsv = (rows) => {
  if (!rows.length) {
    return 'message\n"No records found for selected filters"\n';
  }

  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))));
  const escape = (value) => {
    const normalized =
      value === null || value === undefined
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
    return `"${normalized.replace(/"/g, '""')}"`;
  };

  const header = keys.join(',');
  const body = rows
    .map((row) => keys.map((key) => escape(row?.[key])).join(','))
    .join('\n');
  return `${header}\n${body}\n`;
};

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
      const key = item.config_key;
      if (!key) return acc;
      const category = key.split('.')[0];
      if (!acc[category]) acc[category] = {};
      acc[category][key] = {
        value: item.config_value,
        description: item.description,
        updatedAt: item.updated_at,
        isActive: item.is_active,
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
      config_key: key,
      config_value: value,
      description,
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
    const normalizedStatus =
      status === 'active'
        ? true
        : status === 'inactive'
          ? false
          : undefined;

    const opts = {
      page: parseInt(page),
      limit: parseInt(limit),
      role: role || undefined,
      isActive: normalizedStatus,
      search: search || undefined
    };

    const result = await db.users.list(opts);
    const data = result.data || result;
    const count = result.count ?? result.total ?? data.length;

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

    const existingUser = await db.users.getById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'NOT_FOUND',
      });
    }

    const user = await db.users.update(userId, { role });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'NOT_FOUND',
      });
    }

    await logAuditEvent(req.user._id, 'ROLE_CHANGE', {
      entityType: 'users',
      entityId: userId,
      targetUserId: userId,
      oldValues: { role: existingUser?.role },
      newValues: { role },
      newRole: role
    });

    return successResponse(res, user, 'User role updated successfully');
  })
);

/**
 * @route PUT /api/v1/admin/users/:userId/profile
 * @desc Update admin-managed user profile metadata
 * @access Admin only
 */
router.put('/users/:userId/profile',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { metadata = {}, districtId } = req.body || {};

    const existingUser = await db.users.getById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'NOT_FOUND',
      });
    }

    const existingMetadata =
      existingUser.metadata && typeof existingUser.metadata === 'object'
        ? existingUser.metadata
        : {};
    const nextMetadata = {
      ...existingMetadata,
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
    };

    if (districtId !== undefined) {
      if (districtId) {
        nextMetadata.districtId = districtId;
      } else {
        delete nextMetadata.districtId;
      }
    }

    const user = await db.users.update(userId, { metadata: nextMetadata });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'NOT_FOUND',
      });
    }

    await logAuditEvent(req.user._id, 'USER_PROFILE_UPDATED', {
      entityType: 'users',
      entityId: userId,
      targetUserId: userId,
      oldValues: { metadata: existingMetadata },
      newValues: { metadata: nextMetadata },
    });

    return successResponse(res, user, 'User profile updated successfully');
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

    const existingUser = await db.users.getById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'NOT_FOUND',
      });
    }

    const user = await db.users.update(userId, { 
      is_active: false,
      deactivation_reason: reason,
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'NOT_FOUND',
      });
    }

    await logAuditEvent(req.user._id, 'USER_DEACTIVATED', {
      entityType: 'users',
      entityId: userId,
      targetUserId: userId,
      oldValues: {
        is_active: existingUser?.is_active,
        deactivation_reason: existingUser?.deactivation_reason,
      },
      newValues: {
        is_active: false,
        deactivation_reason: reason,
      },
      reason
    });

    return successResponse(res, user, 'User deactivated successfully');
  })
);


/**
 * @route POST /api/v1/admin/users/:userId/reactivate
 * @desc Reactivate a user
 * @access Admin only
 */
router.post('/users/:userId/reactivate',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const existingUser = await db.users.getById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'NOT_FOUND',
      });
    }

    const user = await db.users.update(userId, {
      is_active: true,
      deactivation_reason: null,
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'NOT_FOUND',
      });
    }

    await logAuditEvent(req.user._id, 'USER_REACTIVATED', {
      entityType: 'users',
      entityId: userId,
      targetUserId: userId,
      oldValues: {
        is_active: existingUser?.is_active,
        deactivation_reason: existingUser?.deactivation_reason,
      },
      newValues: {
        is_active: true,
        deactivation_reason: null,
      },
    });

    return successResponse(res, user, 'User reactivated successfully');
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
    const normalizedStatus = normalizeActiveStatus(status);

    const opts = {
      page: parseInt(page),
      limit: parseInt(limit),
      isActive: normalizedStatus
    };

    const result = await db.iotDeviceTokens.list(opts);
    const data = result.data || result;
    const count = result.count ?? result.total ?? data.length;

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
      token_hash: crypto.createHash('sha256').update(token).digest('hex'),
      expires_at: expiresAt.getTime(),
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
    const since = startDate ? Date.parse(String(startDate)) : undefined;
    const until = endDate ? Date.parse(String(endDate)) : undefined;

    const opts = {
      page: parseInt(page),
      limit: parseInt(limit),
      action: action || undefined,
      userId: userId || undefined,
      since: Number.isFinite(since) ? since : undefined,
      until: Number.isFinite(until) ? until : undefined,
    };

    const result = await db.auditLogs.list(opts);
    const data = result.data || result;
    const count = result.count ?? result.total ?? data.length;

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
        const lastReadingTimestamp = getSensorReadingTimestamp(latestReading);

        if (lastReadingTimestamp !== undefined) {
          const minutesAgo = (Date.now() - lastReadingTimestamp) / (1000 * 60);
          health.checks.sensorIngestion = minutesAgo < 60 ? 'healthy' : 'stale';
          health.checks.lastSensorReading = new Date(lastReadingTimestamp).toISOString();
        } else {
          health.checks.sensorIngestion = 'unknown';
        }
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
    const since = startTime.getTime();

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

    const normalizedTargetRole =
      targetRole && ['farmer', 'expert', 'admin'].includes(String(targetRole))
        ? String(targetRole)
        : 'all';
    const normalizedChannel = BROADCAST_CHANNELS.has(String(channel)) ? String(channel) : 'sms';

    const activeUsers = await db.users.listActive(
      normalizedTargetRole === 'all' ? undefined : normalizedTargetRole
    );
    const targetedUsers = filterBroadcastRecipientsByDistrict(activeUsers || [], targetDistrict);

    const messageDocs = targetedUsers.map((user) => {
      const resolvedChannel = resolveBroadcastChannelForUser(user, normalizedChannel);
      const prefersKinyarwanda = (user?.preferred_language || 'en') === 'rw';
      const userId = user?._id || user?.id;

      return {
        user_id: userId,
        recipient: getBroadcastRecipientAddress(user, resolvedChannel),
        channel: resolvedChannel,
        content: prefersKinyarwanda ? (messageKinyarwanda || message) : message,
        content_rw: messageKinyarwanda || undefined,
        status: resolvedChannel === 'push' ? 'sent' : 'queued',
        sent_at: resolvedChannel === 'push' ? Date.now() : undefined,
        metadata: {
          broadcast: true,
          scope: normalizedTargetRole === 'all' ? 'all_users' : `role:${normalizedTargetRole}`,
          initiatedBy: req.user._id,
          requestedTargetRole: normalizedTargetRole,
          requestedChannel: normalizedChannel,
          resolvedChannel,
          ...(resolvedChannel !== normalizedChannel ? { fallbackChannel: resolvedChannel } : {}),
          ...(targetDistrict ? { targetDistrict } : {}),
        }
      };
    });

    const inserted = await db.messages.createBatch(messageDocs);
    const storedCount = inserted?.count ?? inserted?.length ?? messageDocs.length;
    const queuedCount = messageDocs.filter((doc) => doc.status === 'queued').length;
    const inAppCount = messageDocs.filter((doc) => doc.channel === 'push').length;

    await logAuditEvent(req.user._id, 'BROADCAST_SENT', {
      recipientCount: targetedUsers.length,
      storedRecipients: storedCount,
      queuedRecipients: queuedCount,
      inAppRecipients: inAppCount,
      targetRole: normalizedTargetRole,
      channel: normalizedChannel,
      targetDistrict
    });

    return successResponse(res, {
      queued: queuedCount,
      targetedUsers: targetedUsers.length,
      stored: storedCount,
      inApp: inAppCount,
    }, 'Broadcast queued successfully');
  })
);

/**
 * @route POST /api/v1/admin/notifications/process
 * @desc Process queued notifications immediately
 * @access Admin only
 */
router.post('/notifications/process',
  asyncHandler(async (req, res) => {
    const { processQueuedMessages } = await import('../services/notificationService.js');
    const results = await processQueuedMessages();

    await logAuditEvent(req.user._id, 'NOTIFICATION_QUEUE_PROCESSED', {
      processed: results?.processed ?? 0,
      sent: results?.sent ?? 0,
      failed: results?.failed ?? 0,
      retried: results?.retried ?? 0,
      triggeredBy: 'admin_manual',
    });

    return successResponse(res, {
      processed: results?.processed ?? 0,
      sent: results?.sent ?? 0,
      failed: results?.failed ?? 0,
      retried: results?.retried ?? 0,
    }, 'Notification queue processed successfully');
  })
);

/**
 * @route GET /api/v1/admin/notifications/queue
 * @desc Inspect queued and failed outbound notifications
 * @access Admin only
 */
router.get('/notifications/queue',
  asyncHandler(async (req, res) => {
    const requestedLimit = Number.parseInt(String(req.query.limit || '8'), 10);
    const requestedMaxRetries = Number.parseInt(String(req.query.maxRetries || '3'), 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 8;
    const maxRetries = Number.isFinite(requestedMaxRetries) ? Math.max(requestedMaxRetries, 0) : 3;

    const [queuedRows, failedRows] = await Promise.all([
      db.messages.getQueued({ limit }),
      db.messages.getFailed({ limit, maxRetries }),
    ]);

    const queued = Array.isArray(queuedRows) ? queuedRows : [];
    const failed = Array.isArray(failedRows) ? failedRows : [];

    const countByChannel = (rows) =>
      rows.reduce((acc, row) => {
        const channel = row?.channel || 'unknown';
        acc[channel] = (acc[channel] || 0) + 1;
        return acc;
      }, {});

    return successResponse(res, {
      queued,
      failed,
      counts: {
        queued: queued.length,
        failed: failed.length,
        queuedByChannel: countByChannel(queued),
        failedByChannel: countByChannel(failed),
      },
      filters: {
        limit,
        maxRetries,
      },
    }, 'Notification queue snapshot retrieved successfully');
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
    const normalizedStatus = normalizeActiveStatus(status);

    const opts = {
      page: parseInt(page),
      limit: parseInt(limit),
      isActive: normalizedStatus,
      districtId: district || undefined,
      search: search || undefined
    };

    const result = await db.farms.list(opts);
    const data = result.data || result;
    const count = result.count ?? result.total ?? data.length;

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
        since: Date.now() - 30 * 24 * 60 * 60 * 1000
      }),
      db.pestDetections.getStats({
        since: Date.now() - 30 * 24 * 60 * 60 * 1000
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

    const since = Date.now() - days * 24 * 60 * 60 * 1000;

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
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;

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
 * @desc Generate a dynamic report
 * @access Admin only
 */
router.post('/reports/generate',
  asyncHandler(async (req, res) => {
    const { type = 'summary', startDate, endDate, format = 'json' } = req.body || {};
    const reportType = String(type).toLowerCase();
    const reportFormat = String(format).toLowerCase();

    if (!REPORT_TYPES.has(reportType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report type',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!['json', 'csv'].includes(reportFormat)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report format. Use json or csv',
        code: 'VALIDATION_ERROR',
      });
    }

    const now = Date.now();
    const startMs = toTimestamp(startDate, now - 30 * 24 * 60 * 60 * 1000);
    const endMs = toTimestamp(endDate, now);

    if (startMs > endMs) {
      return res.status(400).json({
        success: false,
        message: 'startDate must be before endDate',
        code: 'VALIDATION_ERROR',
      });
    }

    let rows = [];
    let summary = {};

    if (reportType === 'summary') {
      const [users, farms, sensors, recommendations, farmIssues, pestDetections] = await Promise.all([
        db.users.listAll(),
        db.farms.list({ page: 1, limit: MAX_REPORT_ROWS }),
        db.sensors.listAllStats(),
        db.recommendations.list({ page: 1, limit: MAX_REPORT_ROWS }),
        db.farmIssues.list({ page: 1, limit: MAX_REPORT_ROWS }),
        db.pestDetections.getStats({ since: startMs, until: endMs }),
      ]);

      const allFarmRows = toArrayPayload(farms);
      const usersRows = filterRowsByDate(toArrayPayload(users), startMs, endMs);
      const farmsRows = filterRowsByDate(allFarmRows, startMs, endMs);
      const sensorsRows = filterRowsByDate(toArrayPayload(sensors), startMs, endMs);
      const recommendationRows = enrichRecommendationRows(
        filterRowsByDate(toArrayPayload(recommendations), startMs, endMs)
      );
      const farmIssueRows = enrichFarmIssueRows(
        filterRowsByDate(toArrayPayload(farmIssues), startMs, endMs)
      );
      const pestRows = filterRowsByDate(toArrayPayload(pestDetections), startMs, endMs);
      const pestControlRows = await getPestControlRows(allFarmRows, startMs, endMs);
      const recommendationSummary = summarizeRecommendationRows(recommendationRows);
      const farmIssueSummary = summarizeFarmIssueRows(farmIssueRows);
      const pestControlSummary = summarizePestControlRows(pestControlRows);

      summary = {
        users: {
          total: usersRows.length,
          byRole: countByField(usersRows, 'role'),
        },
        farms: {
          total: farmsRows.length,
          byDistrict: countByField(farmsRows, 'district_id'),
          byActiveStatus: countByField(farmsRows, 'is_active'),
        },
        sensors: {
          total: sensorsRows.length,
          byType: countByField(sensorsRows, 'sensor_type'),
          byStatus: countByField(sensorsRows, 'status'),
        },
        recommendations: {
          ...recommendationSummary,
        },
        farmIssues: {
          ...farmIssueSummary,
        },
        pestDetections: {
          total: pestRows.length,
          bySeverity: countByField(pestRows, 'severity'),
          withDetectedPest: pestRows.filter((row) => row?.pest_detected).length,
        },
        pestControl: {
          ...pestControlSummary,
        },
      };

      rows = [{
        users_total: summary.users.total,
        farms_total: summary.farms.total,
        sensors_total: summary.sensors.total,
        recommendations_total: summary.recommendations.total,
        recommendations_response_rate: summary.recommendations.responseRate,
        recommendations_acceptance_rate: summary.recommendations.acceptanceRate,
        recommendations_avg_response_time_hours: summary.recommendations.avgResponseTimeHours,
        farm_issues_total: summary.farmIssues.total,
        farm_issues_avg_resolution_time_hours: summary.farmIssues.avgResolutionTimeHours,
        pest_detections_total: summary.pestDetections.total,
        pest_control_total: summary.pestControl.total,
        pest_control_execution_rate: summary.pestControl.executionRate,
        pest_control_avg_execution_lead_time_hours: summary.pestControl.avgExecutionLeadTimeHours,
      }];
    } else if (reportType === 'users') {
      rows = filterRowsByDate(toArrayPayload(await db.users.listAll()), startMs, endMs);
    } else if (reportType === 'farms') {
      rows = filterRowsByDate(toArrayPayload(await db.farms.list({ page: 1, limit: MAX_REPORT_ROWS })), startMs, endMs);
    } else if (reportType === 'sensors') {
      rows = filterRowsByDate(toArrayPayload(await db.sensors.listAllStats()), startMs, endMs);
    } else if (reportType === 'recommendations') {
      rows = enrichRecommendationRows(
        filterRowsByDate(
          toArrayPayload(await db.recommendations.list({ page: 1, limit: MAX_REPORT_ROWS })),
          startMs,
          endMs
        )
      );
      summary = summarizeRecommendationRows(rows);
    } else if (reportType === 'farm-issues') {
      rows = enrichFarmIssueRows(
        filterRowsByDate(
          toArrayPayload(await db.farmIssues.list({ page: 1, limit: MAX_REPORT_ROWS })),
          startMs,
          endMs
        )
      );
      summary = summarizeFarmIssueRows(rows);
    } else if (reportType === 'pest-detections') {
      rows = filterRowsByDate(
        toArrayPayload(await db.pestDetections.getStats({ since: startMs, until: endMs })),
        startMs,
        endMs
      );
    } else if (reportType === 'pest-control') {
      const farmRows = toArrayPayload(await db.farms.list({ page: 1, limit: MAX_REPORT_ROWS }));
      rows = await getPestControlRows(farmRows, startMs, endMs);
      summary = summarizePestControlRows(rows);
    }

    await logAuditEvent(req.user.id, 'REPORT_GENERATED', {
      entityType: 'report',
      type: reportType,
      format: reportFormat,
      startDate: new Date(startMs).toISOString(),
      endDate: new Date(endMs).toISOString(),
      recordCount: rows.length,
    });

    const reportId = `report_${Date.now()}`;
    const baseReport = {
      reportId,
      type: reportType,
      format: reportFormat,
      generatedAt: new Date().toISOString(),
      startDate: new Date(startMs).toISOString(),
      endDate: new Date(endMs).toISOString(),
      totalRecords: rows.length,
      summary,
      data: rows,
    };

    if (reportFormat === 'csv') {
      const csv = toCsv(rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${reportId}.csv"`);
      return res.status(200).send(csv);
    }

    return successResponse(res, baseReport, 'Report generated successfully');
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
      token_hash: crypto.createHash('sha256').update(token).digest('hex'),
      expires_at: expiresAt.getTime(),
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
    const {
      entityType,
      entityId,
      oldValues,
      newValues,
      ...metadata
    } = details || {};

    await db.auditLogs.create({
      user_id: userId || undefined,
      action,
      entity_type: entityType || 'system',
      entity_id: entityId ? String(entityId) : undefined,
      old_values: oldValues,
      new_values:
        newValues || (Object.keys(metadata).length > 0 ? metadata : undefined),
      ip_address: null,
      user_agent: null,
      created_at: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to log audit event', { action, error: error.message });
  }
}

export default router;
