import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  users: {
    getById: jest.fn(),
    list: jest.fn(),
    listAll: jest.fn(),
    listActive: jest.fn(),
    update: jest.fn(),
  },
  messages: {
    createBatch: jest.fn(),
  },
  systemConfig: {
    list: jest.fn(),
    upsert: jest.fn(),
    healthCheck: jest.fn(),
  },
  iotDeviceTokens: {
    list: jest.fn(),
    revoke: jest.fn(),
    create: jest.fn(),
  },
  auditLogs: {
    create: jest.fn(),
    list: jest.fn(),
    countErrors: jest.fn(),
  },
  sensorData: {
    getLatestOne: jest.fn(),
    countSince: jest.fn(),
  },
  pestDetections: {
    getStats: jest.fn(),
  },
  pestControlSchedules: {
    getByFarm: jest.fn(),
  },
  recommendations: {
    countSince: jest.fn(),
    list: jest.fn(),
  },
  farmIssues: {
    list: jest.fn(),
  },
  farms: {
    list: jest.fn(),
  },
  sensors: {
    listAllStats: jest.fn(),
  },
  districts: {
    list: jest.fn(),
  },
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  ROLES: {
    FARMER: 'farmer',
    EXPERT: 'expert',
    ADMIN: 'admin',
  },
  authenticate: (req, _res, next) => {
    req.user = { _id: 'admin-1', id: 'admin-1', role: 'admin' };
    next();
  },
  authorize: () => (_req, _res, next) => next(),
}));

await jest.unstable_mockModule('../src/middleware/validation.js', () => ({
  validatePagination: (_req, _res, next) => next(),
  handleValidationErrors: (_req, _res, next) => next(),
}));

await jest.unstable_mockModule('../src/middleware/errorHandler.js', () => ({
  asyncHandler: (handler) => async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  },
}));

await jest.unstable_mockModule('../src/utils/response.js', () => ({
  successResponse: (res, data, message) => res.status(200).json({ success: true, data, message }),
  paginatedResponse: (res, data, page, limit, total, message) =>
    res.status(200).json({ success: true, data, page, limit, total, message }),
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { default: adminRouter } = await import('../src/routes/admin.js');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/admin', adminRouter);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ success: false, message: err.message });
  });
  return app;
};

describe('admin storage management routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.users.getById.mockResolvedValue({
      _id: 'user-1',
      role: 'farmer',
      is_active: true,
      deactivation_reason: null,
    });
    mockDb.users.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.users.listAll.mockResolvedValue([]);
    mockDb.users.listActive.mockResolvedValue([]);
    mockDb.users.update.mockResolvedValue({ _id: 'user-1' });
    mockDb.messages.createBatch.mockResolvedValue({ count: 0, ids: [] });
    mockDb.auditLogs.create.mockResolvedValue(null);
    mockDb.systemConfig.list.mockResolvedValue([]);
    mockDb.auditLogs.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.iotDeviceTokens.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.farms.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.sensors.listAllStats.mockResolvedValue([]);
    mockDb.recommendations.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.farmIssues.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.pestDetections.getStats.mockResolvedValue([]);
    mockDb.pestControlSchedules.getByFarm.mockResolvedValue([]);
    mockDb.districts.list.mockResolvedValue([]);
    mockDb.systemConfig.healthCheck.mockResolvedValue(true);
    mockDb.sensorData.getLatestOne.mockResolvedValue(null);
    mockDb.sensorData.countSince.mockResolvedValue(0);
    mockDb.recommendations.countSince.mockResolvedValue(0);
    mockDb.auditLogs.countErrors.mockResolvedValue(0);
  });

  it('maps admin user status filter to the persisted isActive query field', async () => {
    const app = createApp();

    await request(app)
      .get('/admin/users?status=inactive&page=1&limit=20')
      .expect(200);

    expect(mockDb.users.list).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: false,
      })
    );
  });

  it('uses the backend count field for admin user pagination totals', async () => {
    const app = createApp();
    mockDb.users.list.mockResolvedValue({
      data: [{ _id: 'user-1' }],
      count: 27,
    });

    const response = await request(app)
      .get('/admin/users?page=2&limit=10')
      .expect(200);

    expect(response.body.total).toBe(27);
  });

  it('deactivates a user through the persisted is_active field', async () => {
    const app = createApp();

    await request(app)
      .post('/admin/users/user-1/deactivate')
      .send({ reason: 'Violation' })
      .expect(200);

    expect(mockDb.users.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        is_active: false,
        deactivation_reason: 'Violation',
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'admin-1',
        action: 'USER_DEACTIVATED',
        entity_type: 'users',
        entity_id: 'user-1',
        old_values: {
          is_active: true,
          deactivation_reason: null,
        },
        new_values: {
          is_active: false,
          deactivation_reason: 'Violation',
        },
      })
    );
  });

  it('reactivates a user through the persisted is_active field', async () => {
    const app = createApp();
    mockDb.users.getById.mockResolvedValue({
      _id: 'user-1',
      role: 'farmer',
      is_active: false,
      deactivation_reason: 'Violation',
    });

    await request(app)
      .post('/admin/users/user-1/reactivate')
      .send({})
      .expect(200);

    expect(mockDb.users.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        is_active: true,
        deactivation_reason: null,
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'admin-1',
        action: 'USER_REACTIVATED',
        entity_type: 'users',
        entity_id: 'user-1',
        old_values: {
          is_active: false,
          deactivation_reason: 'Violation',
        },
        new_values: {
          is_active: true,
          deactivation_reason: null,
        },
      })
    );
  });

  it('logs role changes against the user entity with old and new role values', async () => {
    const app = createApp();

    await request(app)
      .put('/admin/users/user-1/role')
      .send({ role: 'expert' })
      .expect(200);

    expect(mockDb.users.update).toHaveBeenCalledWith('user-1', { role: 'expert' });
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'admin-1',
        action: 'ROLE_CHANGE',
        entity_type: 'users',
        entity_id: 'user-1',
        old_values: { role: 'farmer' },
        new_values: { role: 'expert' },
      })
    );
  });

  it('updates expert coverage district in user metadata', async () => {
    const app = createApp();
    mockDb.users.getById.mockResolvedValue({
      _id: 'user-1',
      role: 'expert',
      is_active: true,
      metadata: { districtId: 'district-1' },
    });
    mockDb.users.update.mockResolvedValue({
      _id: 'user-1',
      role: 'expert',
      is_active: true,
      metadata: { districtId: 'district-2' },
    });

    await request(app)
      .put('/admin/users/user-1/profile')
      .send({ districtId: 'district-2' })
      .expect(200);

    expect(mockDb.users.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        metadata: { districtId: 'district-2' },
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'admin-1',
        action: 'USER_PROFILE_UPDATED',
        entity_type: 'users',
        entity_id: 'user-1',
      })
    );
  });

  it('broadcasts admin messages to a particular role when requested', async () => {
    const app = createApp();
    mockDb.users.listActive.mockResolvedValue([
      { _id: 'expert-1', phone_number: '+250788000002', preferred_language: 'rw' },
      { _id: 'admin-2', phone_number: null, preferred_language: 'en' },
    ]);
    mockDb.messages.createBatch.mockResolvedValue({ count: 1, ids: ['msg-1'] });

    const response = await request(app)
      .post('/admin/broadcast')
      .send({
        message: 'System maintenance tonight.',
        messageKinyarwanda: 'Hari maintenance iri nijoro.',
        targetRole: 'expert',
        channel: 'sms',
      })
      .expect(200);

    expect(mockDb.users.listActive).toHaveBeenCalledWith('expert');
    expect(mockDb.messages.createBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: 'expert-1',
          recipient: '+250788000002',
          metadata: expect.objectContaining({
            broadcast: true,
            scope: 'role:expert',
            requestedTargetRole: 'expert',
          }),
        }),
      ])
    );
    expect(response.body.data).toEqual(
      expect.objectContaining({
        queued: 1,
        targetedUsers: 2,
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'BROADCAST_SENT',
        new_values: expect.objectContaining({
          targetRole: 'expert',
        }),
      })
    );
  });

  it('broadcasts admin messages to all roles when requested', async () => {
    const app = createApp();
    mockDb.users.listActive.mockResolvedValue([
      { _id: 'farmer-1', phone_number: '+250788000001', preferred_language: 'en' },
      { _id: 'expert-1', phone_number: '+250788000002', preferred_language: 'rw' },
      { _id: 'admin-2', phone_number: null, preferred_language: 'en' },
    ]);
    mockDb.messages.createBatch.mockResolvedValue({ count: 2, ids: ['msg-1', 'msg-2'] });

    const response = await request(app)
      .post('/admin/broadcast')
      .send({
        message: 'System-wide notice.',
        targetRole: 'all',
        channel: 'sms',
      })
      .expect(200);

    expect(mockDb.users.listActive).toHaveBeenCalledWith(undefined);
    expect(mockDb.messages.createBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: 'farmer-1',
          metadata: expect.objectContaining({
            scope: 'all_users',
            requestedTargetRole: 'all',
          }),
        }),
        expect.objectContaining({
          user_id: 'expert-1',
        }),
      ])
    );
    expect(response.body.data).toEqual(
      expect.objectContaining({
        queued: 2,
        targetedUsers: 3,
      })
    );
  });

  it('returns not found when updating the role of a missing user profile', async () => {
    const app = createApp();
    mockDb.users.getById.mockResolvedValue(null);

    await request(app)
      .put('/admin/users/missing-user/role')
      .send({ role: 'expert' })
      .expect(404);

    expect(mockDb.users.update).not.toHaveBeenCalled();
    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('returns not found when the user profile disappears before role persistence', async () => {
    const app = createApp();
    mockDb.users.getById.mockResolvedValue({
      _id: 'user-1',
      role: 'farmer',
      is_active: true,
      deactivation_reason: null,
    });
    mockDb.users.update.mockResolvedValue(null);

    await request(app)
      .put('/admin/users/user-1/role')
      .send({ role: 'expert' })
      .expect(404);

    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('returns not found when deactivating a missing user profile', async () => {
    const app = createApp();
    mockDb.users.getById.mockResolvedValue(null);

    await request(app)
      .post('/admin/users/missing-user/deactivate')
      .send({ reason: 'Violation' })
      .expect(404);

    expect(mockDb.users.update).not.toHaveBeenCalled();
    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('returns not found when the user profile disappears before deactivate persistence', async () => {
    const app = createApp();
    mockDb.users.getById.mockResolvedValue({
      _id: 'user-1',
      role: 'farmer',
      is_active: true,
      deactivation_reason: null,
    });
    mockDb.users.update.mockResolvedValue(null);

    await request(app)
      .post('/admin/users/user-1/deactivate')
      .send({ reason: 'Violation' })
      .expect(404);

    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('returns not found when reactivating a missing user profile', async () => {
    const app = createApp();
    mockDb.users.getById.mockResolvedValue(null);

    await request(app)
      .post('/admin/users/missing-user/reactivate')
      .send({})
      .expect(404);

    expect(mockDb.users.update).not.toHaveBeenCalled();
    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('returns not found when the user profile disappears before reactivate persistence', async () => {
    const app = createApp();
    mockDb.users.getById.mockResolvedValue({
      _id: 'user-1',
      role: 'farmer',
      is_active: false,
      deactivation_reason: 'Violation',
    });
    mockDb.users.update.mockResolvedValue(null);

    await request(app)
      .post('/admin/users/user-1/reactivate')
      .send({})
      .expect(404);

    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('stores generated device tokens using the schema-supported payload shape', async () => {
    const app = createApp();
    mockDb.iotDeviceTokens.create.mockResolvedValue({ _id: 'token-1' });

    await request(app)
      .post('/admin/devices/generate')
      .send({ farmId: 'farm-1', deviceName: 'Field Sensor', expiresInDays: 30 })
      .expect(200);

    expect(mockDb.iotDeviceTokens.create).toHaveBeenCalledWith(
      expect.objectContaining({
        device_id: expect.stringMatching(/^device_/),
        token_hash: expect.any(String),
        expires_at: expect.any(Number),
      })
    );
    expect(mockDb.iotDeviceTokens.create.mock.calls[0][0]).not.toHaveProperty('farm_id');
    expect(mockDb.iotDeviceTokens.create.mock.calls[0][0]).not.toHaveProperty('device_name');
    expect(mockDb.iotDeviceTokens.create.mock.calls[0][0]).not.toHaveProperty('created_by');
  });

  it('stores alias device tokens using the schema-supported payload shape', async () => {
    const app = createApp();
    mockDb.iotDeviceTokens.create.mockResolvedValue({ _id: 'token-2' });

    await request(app)
      .post('/admin/devices/token')
      .send({ farmId: 'farm-1', deviceName: 'Field Sensor', expiresInDays: 30 })
      .expect(200);

    expect(mockDb.iotDeviceTokens.create).toHaveBeenCalledWith(
      expect.objectContaining({
        device_id: expect.stringMatching(/^device_/),
        token_hash: expect.any(String),
        expires_at: expect.any(Number),
      })
    );
    expect(mockDb.iotDeviceTokens.create.mock.calls[0][0]).not.toHaveProperty('farm_id');
    expect(mockDb.iotDeviceTokens.create.mock.calls[0][0]).not.toHaveProperty('device_name');
    expect(mockDb.iotDeviceTokens.create.mock.calls[0][0]).not.toHaveProperty('created_by');
  });

  it('maps admin farm filters to the persisted storage query fields', async () => {
    const app = createApp();

    await request(app)
      .get('/admin/farms?status=active&district=district-1&page=1&limit=20')
      .expect(200);

    expect(mockDb.farms.list).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: true,
        districtId: 'district-1',
      })
    );
  });

  it('uses the backend count field for admin farm pagination totals', async () => {
    const app = createApp();
    mockDb.farms.list.mockResolvedValue({
      data: [{ _id: 'farm-1' }],
      count: 14,
    });

    const response = await request(app)
      .get('/admin/farms?page=1&limit=10')
      .expect(200);

    expect(response.body.total).toBe(14);
  });

  it('maps audit log date filters to persisted since/until timestamps and uses count', async () => {
    const app = createApp();
    mockDb.auditLogs.list.mockResolvedValue({
      data: [{ _id: 'log-1' }],
      count: 8,
    });

    const response = await request(app)
      .get('/admin/audit-logs?startDate=2026-03-01&endDate=2026-03-09&page=1&limit=5')
      .expect(200);

    expect(mockDb.auditLogs.list).toHaveBeenCalledWith(
      expect.objectContaining({
        since: Date.parse('2026-03-01'),
        until: Date.parse('2026-03-09'),
      })
    );
    expect(response.body.total).toBe(8);
  });

  it('maps device status filter to the persisted isActive token query field', async () => {
    const app = createApp();

    await request(app)
      .get('/admin/devices?status=inactive&page=1&limit=20')
      .expect(200);

    expect(mockDb.iotDeviceTokens.list).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: false,
      })
    );
  });

  it('uses the stored reading_timestamp field for admin sensor ingestion health', async () => {
    const app = createApp();
    const recentTimestamp = Date.now() - 10 * 60 * 1000;
    mockDb.sensorData.getLatestOne.mockResolvedValue({
      reading_timestamp: recentTimestamp,
    });

    const response = await request(app)
      .get('/admin/health')
      .expect(200);

    expect(response.body.data.checks.sensorIngestion).toBe('healthy');
    expect(response.body.data.checks.lastSensorReading).toBe(new Date(recentTimestamp).toISOString());
  });

  it('includes recommendation response metrics in summary reports', async () => {
    const app = createApp();
    mockDb.users.listAll.mockResolvedValue([
      { _id: 'user-1', role: 'farmer', created_at: Date.parse('2026-03-02T00:00:00.000Z') },
    ]);
    mockDb.farms.list.mockResolvedValue({
      data: [
        {
          _id: 'farm-1',
          name: 'West Block',
          created_at: Date.parse('2026-03-01T00:00:00.000Z'),
        },
      ],
      count: 1,
    });
    mockDb.recommendations.list.mockResolvedValue({
      data: [
        {
          _id: 'rec-1',
          type: 'irrigation',
          status: 'executed',
          priority: 'high',
          response_channel: 'web',
          created_at: Date.parse('2026-03-02T08:00:00.000Z'),
          responded_at: Date.parse('2026-03-02T10:00:00.000Z'),
        },
        {
          _id: 'rec-2',
          type: 'pest_alert',
          status: 'rejected',
          priority: 'critical',
          response_channel: 'ussd',
          created_at: Date.parse('2026-03-03T08:00:00.000Z'),
          responded_at: Date.parse('2026-03-03T09:00:00.000Z'),
        },
        {
          _id: 'rec-3',
          type: 'fertilization',
          status: 'pending',
          priority: 'medium',
          created_at: Date.parse('2026-03-04T08:00:00.000Z'),
        },
      ],
      count: 3,
    });
    mockDb.farmIssues.list.mockResolvedValue({
      data: [
        {
          _id: 'issue-1',
          title: 'Sensor offline',
          category: 'sensor',
          severity: 'high',
          status: 'resolved',
          source_channel: 'web',
          created_at: Date.parse('2026-03-02T08:00:00.000Z'),
          resolved_at: Date.parse('2026-03-02T12:00:00.000Z'),
        },
      ],
      count: 1,
    });
    mockDb.pestControlSchedules.getByFarm.mockResolvedValue([
      {
        _id: 'pcs-1',
        farm_id: 'farm-1',
        control_method: 'Targeted spray application',
        is_executed: true,
        actual_outcome: 'completed',
        created_at: Date.parse('2026-03-04T08:00:00.000Z'),
        executed_at: Date.parse('2026-03-04T14:00:00.000Z'),
      },
      {
        _id: 'pcs-2',
        farm_id: 'farm-1',
        control_method: 'Follow-up scouting',
        is_executed: false,
        created_at: Date.parse('2026-03-05T08:00:00.000Z'),
      },
    ]);

    const response = await request(app)
      .post('/admin/reports/generate')
      .send({
        type: 'summary',
        format: 'json',
        startDate: '2026-03-01T00:00:00.000Z',
        endDate: '2026-03-09T00:00:00.000Z',
      })
      .expect(200);

    expect(response.body.data.summary.recommendations).toEqual(
      expect.objectContaining({
        total: 3,
        byChannel: {
          web: 1,
          ussd: 1,
        },
        avgResponseTimeHours: 2,
      })
    );
    expect(response.body.data.summary.recommendations.responseRate).toBeCloseTo(66.666, 2);
    expect(response.body.data.summary.recommendations.acceptanceRate).toBeCloseTo(33.333, 2);
    expect(response.body.data.summary.farmIssues).toEqual(
      expect.objectContaining({
        total: 1,
        byCategory: {
          sensor: 1,
        },
        byStatus: {
          resolved: 1,
        },
        byChannel: {
          web: 1,
        },
        avgResolutionTimeHours: 4,
      })
    );
    expect(response.body.data.summary.pestControl).toEqual(
      expect.objectContaining({
        total: 2,
        byStatus: {
          executed: 1,
          scheduled: 1,
        },
        byMethod: {
          'Targeted spray application': 1,
          'Follow-up scouting': 1,
        },
        byOutcome: {
          completed: 1,
        },
        avgExecutionLeadTimeHours: 6,
      })
    );
    expect(response.body.data.summary.pestControl.executionRate).toBeCloseTo(50, 2);
    expect(response.body.data.data[0]).toEqual(
      expect.objectContaining({
        recommendations_response_rate: expect.any(Number),
        recommendations_acceptance_rate: expect.any(Number),
        recommendations_avg_response_time_hours: 2,
        farm_issues_total: 1,
        farm_issues_avg_resolution_time_hours: 4,
        pest_control_total: 2,
        pest_control_execution_rate: 50,
        pest_control_avg_execution_lead_time_hours: 6,
      })
    );
  });

  it('enriches recommendation reports with response timing fields and summary metrics', async () => {
    const app = createApp();
    mockDb.recommendations.list.mockResolvedValue({
      data: [
        {
          _id: 'rec-10',
          title: 'Irrigate today',
          type: 'irrigation',
          status: 'executed',
          priority: 'high',
          response_channel: 'web',
          created_at: Date.parse('2026-03-02T08:00:00.000Z'),
          responded_at: Date.parse('2026-03-02T12:00:00.000Z'),
        },
      ],
      count: 1,
    });

    const response = await request(app)
      .post('/admin/reports/generate')
      .send({
        type: 'recommendations',
        format: 'json',
        startDate: '2026-03-01T00:00:00.000Z',
        endDate: '2026-03-09T00:00:00.000Z',
      })
      .expect(200);

    expect(response.body.data.summary).toEqual(
      expect.objectContaining({
        total: 1,
        byChannel: {
          web: 1,
        },
        responseRate: 100,
        acceptanceRate: 100,
        avgResponseTimeHours: 4,
      })
    );
    expect(response.body.data.data[0]).toEqual(
      expect.objectContaining({
        response_channel: 'web',
        response_recorded: true,
        response_time_hours: 4,
      })
    );
  });

  it('generates farm issue reports with resolution timing metrics', async () => {
    const app = createApp();
    mockDb.farmIssues.list.mockResolvedValue({
      data: [
        {
          _id: 'issue-10',
          title: 'Pump blocked',
          category: 'irrigation',
          severity: 'urgent',
          status: 'resolved',
          source_channel: 'web',
          created_at: Date.parse('2026-03-02T08:00:00.000Z'),
          resolved_at: Date.parse('2026-03-02T14:00:00.000Z'),
        },
      ],
      count: 1,
    });

    const response = await request(app)
      .post('/admin/reports/generate')
      .send({
        type: 'farm-issues',
        format: 'json',
        startDate: '2026-03-01T00:00:00.000Z',
        endDate: '2026-03-09T00:00:00.000Z',
      })
      .expect(200);

    expect(response.body.data.summary).toEqual(
      expect.objectContaining({
        total: 1,
        byCategory: {
          irrigation: 1,
        },
        bySeverity: {
          urgent: 1,
        },
        byStatus: {
          resolved: 1,
        },
        byChannel: {
          web: 1,
        },
        avgResolutionTimeHours: 6,
      })
    );
    expect(response.body.data.data[0]).toEqual(
      expect.objectContaining({
        title: 'Pump blocked',
        resolution_recorded: true,
        resolution_time_hours: 6,
      })
    );
  });

  it('generates pest control reports with execution timing metrics', async () => {
    const app = createApp();
    mockDb.farms.list.mockResolvedValue({
      data: [
        {
          _id: 'farm-20',
          name: 'North Ridge',
          created_at: Date.parse('2026-03-01T00:00:00.000Z'),
        },
      ],
      count: 1,
    });
    mockDb.pestControlSchedules.getByFarm.mockResolvedValue([
      {
        _id: 'pcs-20',
        farm_id: 'farm-20',
        detection_id: 'detection-20',
        control_method: 'Targeted spray application',
        is_executed: true,
        actual_outcome: 'completed',
        created_at: Date.parse('2026-03-02T08:00:00.000Z'),
        executed_at: Date.parse('2026-03-02T12:00:00.000Z'),
      },
    ]);

    const response = await request(app)
      .post('/admin/reports/generate')
      .send({
        type: 'pest-control',
        format: 'json',
        startDate: '2026-03-01T00:00:00.000Z',
        endDate: '2026-03-09T00:00:00.000Z',
      })
      .expect(200);

    expect(response.body.data.summary).toEqual(
      expect.objectContaining({
        total: 1,
        byStatus: {
          executed: 1,
        },
        byMethod: {
          'Targeted spray application': 1,
        },
        byOutcome: {
          completed: 1,
        },
        executionRate: 100,
        avgExecutionLeadTimeHours: 4,
      })
    );
    expect(response.body.data.data[0]).toEqual(
      expect.objectContaining({
        control_method: 'Targeted spray application',
        operational_status: 'executed',
        execution_recorded: true,
        execution_lead_time_hours: 4,
      })
    );
  });
});
