import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSensorService = {
  ingestSensorData: jest.fn(),
};

const mockDb = {
  farms: { getUserId: jest.fn(), getById: jest.fn() },
  sensors: { getById: jest.fn(), remove: jest.fn() },
  auditLogs: { create: jest.fn() },
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

await jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  authenticate: (_req, _res, next) => next(),
  authorize: () => (_req, _res, next) => next(),
  ROLES: { FARMER: 'farmer', EXPERT: 'expert', ADMIN: 'admin' },
  requireOwnership: () => (_req, _res, next) => next(),
  requireMinimumRole: () => (_req, _res, next) => next(),
}));

await jest.unstable_mockModule('../src/middleware/deviceAuth.js', () => ({
  authenticateDevice: (req, _res, next) => {
    req.device = { id: 'device-1', sensorId: 'sensor-1', farmId: 'farm-1' };
    next();
  },
}));

await jest.unstable_mockModule('../src/middleware/validation.js', () => ({
  validateSensorCreation: [],
  validateSensorData: [(_req, _res, next) => next()],
  validatePagination: [],
  validateDateRange: [],
  validateUUID: () => [],
  handleValidationErrors: (_req, _res, next) => next(),
}));

await jest.unstable_mockModule('../src/middleware/rateLimiter.js', () => ({
  iotLimiter: (_req, _res, next) => next(),
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
  createdResponse: (res, data, message) => res.status(201).json({ success: true, data, message }),
  paginatedResponse: (res, data, page, limit, total, message) =>
    res.status(200).json({ success: true, data, page, limit, total, message }),
}));

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/services/sensorService.js', () => ({
  ...mockSensorService,
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
}));

const { default: router } = await import('../src/routes/sensors.js');

const getRouteHandler = (path, method = 'post') => {
  const layer = router.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods?.[method]
  );

  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }

  return layer.route.stack.map((entry) => entry.handle);
};

const runRouteStack = async (handlers, req, res) => {
  for (const handler of handlers) {
    await handler(req, res, () => {});
  }
};

describe('sensor routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports processed, failed, and duplicate counts in batch ingest acknowledgements', async () => {
    const route = getRouteHandler('/data/batch');
    mockSensorService.ingestSensorData.mockResolvedValue({
      received: 5,
      processed: 4,
      failed: 1,
      duplicates: 2,
      valid: 4,
      invalid: 1,
      inserted: ['reading-1', 'reading-2'],
    });

    const req = {
      body: {
        readings: [{ soilMoisture: 40 }],
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await runRouteStack(route, req, res);

    expect(mockSensorService.ingestSensorData).toHaveBeenCalledWith(
      { id: 'device-1', sensorId: 'sensor-1', farmId: 'farm-1' },
      req.body.readings
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Batch data ingested: 4 processed, 1 failed, 2 duplicates skipped',
        data: expect.objectContaining({
          received: 5,
          processed: 4,
          failed: 1,
          duplicates: 2,
        }),
      })
    );
  });

  it('writes an audit log when deleting a stored sensor record', async () => {
    const route = getRouteHandler('/:sensorId', 'delete');
    mockDb.sensors.getById.mockResolvedValue({
      _id: 'sensor-1',
      device_id: 'device-1',
      farm_id: 'farm-1',
      sensor_type: 'soil_moisture',
      status: 'active',
    });
    mockDb.sensors.remove.mockResolvedValue(null);
    mockDb.auditLogs.create.mockResolvedValue(null);

    const req = {
      params: { sensorId: 'sensor-1' },
      user: { id: 'user-1' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await runRouteStack(route, req, res);

    expect(mockDb.sensors.remove).toHaveBeenCalledWith('sensor-1');
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        action: 'DELETE_SENSOR',
        entity_type: 'sensors',
        entity_id: 'sensor-1',
        old_values: {
          device_id: 'device-1',
          farm_id: 'farm-1',
          sensor_type: 'soil_moisture',
          status: 'active',
        },
        new_values: { deleted: true },
        created_at: expect.any(Number),
      })
    );
  });

  it('returns not found when deleting a sensor record that does not exist', async () => {
    const route = getRouteHandler('/:sensorId', 'delete');
    mockDb.sensors.getById.mockResolvedValue(null);

    const req = {
      params: { sensorId: 'missing-sensor' },
      user: { id: 'user-1' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await runRouteStack(route, req, res);

    expect(mockDb.sensors.remove).not.toHaveBeenCalled();
    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Sensor not found',
      code: 'NOT_FOUND',
    });
  });
});
