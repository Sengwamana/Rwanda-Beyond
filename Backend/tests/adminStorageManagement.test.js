import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  users: {
    getById: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
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
  recommendations: {
    countSince: jest.fn(),
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
    mockDb.users.update.mockResolvedValue({ _id: 'user-1' });
    mockDb.auditLogs.create.mockResolvedValue(null);
    mockDb.systemConfig.list.mockResolvedValue([]);
    mockDb.auditLogs.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.iotDeviceTokens.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.farms.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.sensors.listAllStats.mockResolvedValue([]);
    mockDb.recommendations.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.pestDetections.getStats.mockResolvedValue([]);
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
});
