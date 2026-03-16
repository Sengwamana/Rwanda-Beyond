import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  farms: {
    getUserId: jest.fn(),
  },
  recommendations: {
    getById: jest.fn(),
  },
  irrigationSchedules: {
    getById: jest.fn(),
    update: jest.fn(),
  },
  auditLogs: {
    create: jest.fn(),
  },
};

const mockRecommendationService = {
  markCompleted: jest.fn(),
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/services/farmService.js', () => ({
  getUserFarms: jest.fn(),
  getAllFarms: jest.fn(),
  getDistricts: jest.fn(),
  getFarmStats: jest.fn(),
  createFarm: jest.fn(),
  getFarmById: jest.fn(),
  getFarmSummary: jest.fn(),
  updateFarm: jest.fn(),
  deleteFarm: jest.fn(),
}));

await jest.unstable_mockModule('../src/services/recommendationService.js', () => mockRecommendationService);

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

await jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  ROLES: {
    FARMER: 'farmer',
    EXPERT: 'expert',
    ADMIN: 'admin',
  },
  authenticate: (req, _res, next) => {
    req.user = { id: 'farmer-1', _id: 'farmer-1', role: 'farmer' };
    next();
  },
  authorize: () => (_req, _res, next) => next(),
  requireOwnership: () => (_req, _res, next) => next(),
  requireMinimumRole: () => (_req, _res, next) => next(),
}));

await jest.unstable_mockModule('../src/middleware/validation.js', () => ({
  validateFarmCreation: (_req, _res, next) => next(),
  validateFarmUpdate: (_req, _res, next) => next(),
  validatePagination: (_req, _res, next) => next(),
  validateUUID: () => [(_req, _res, next) => next()],
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
  createdResponse: (res, data, message) => res.status(201).json({ success: true, data, message }),
  paginatedResponse: (res, data, page, limit, total, message) =>
    res.status(200).json({ success: true, data, page, limit, total, message }),
  noContentResponse: (res) => res.status(204).send(),
}));

const { default: farmsRouter } = await import('../src/routes/farms.js');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/farms', farmsRouter);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ success: false, message: err.message });
  });
  return app;
};

describe('farm irrigation routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.farms.getUserId.mockResolvedValue('farmer-1');
    mockDb.auditLogs.create.mockResolvedValue(null);
    mockDb.recommendations.getById.mockResolvedValue(null);
    mockRecommendationService.markCompleted.mockResolvedValue({ _id: 'rec-1', status: 'executed' });
  });

  it('postpones an irrigation schedule and writes an audit log', async () => {
    const app = createApp();
    mockDb.irrigationSchedules.getById.mockResolvedValue({
      _id: 'schedule-1',
      farm_id: 'farm-1',
      scheduled_date: '2026-03-14T06:00:00.000Z',
      scheduled_time: '06:00',
      duration_minutes: 30,
      water_volume_liters: 180,
      is_executed: false,
      notes: 'Original plan',
    });
    mockDb.irrigationSchedules.update.mockResolvedValue({
      _id: 'schedule-1',
      farm_id: 'farm-1',
      scheduled_date: '2026-03-15T06:00:00.000Z',
      scheduled_time: '06:00',
      previous_scheduled_date: '2026-03-14T06:00:00.000Z',
      previous_scheduled_time: '06:00',
      postponed_at: 1742018400000,
      duration_minutes: 30,
      water_volume_liters: 180,
      is_executed: false,
      notes: 'Original plan',
    });

    const response = await request(app)
      .put('/farms/farm-1/irrigation/schedule-1')
      .send({
        scheduledDate: '2026-03-15T06:00:00.000Z',
        scheduledTime: '06:00',
      })
      .expect(200);

    expect(mockDb.irrigationSchedules.update).toHaveBeenCalledWith(
      'schedule-1',
      expect.objectContaining({
        scheduled_date: '2026-03-15T06:00:00.000Z',
        previous_scheduled_date: '2026-03-14T06:00:00.000Z',
        previous_scheduled_time: '06:00',
        postponed_at: expect.any(Number),
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'farmer-1',
        action: 'POSTPONE_IRRIGATION_SCHEDULE',
        entity_type: 'irrigation_schedules',
        entity_id: 'schedule-1',
      })
    );
    expect(response.body.data.previous_scheduled_date).toBe('2026-03-14T06:00:00.000Z');
  });

  it('returns not found when the irrigation schedule does not belong to the selected farm', async () => {
    const app = createApp();
    mockDb.irrigationSchedules.getById.mockResolvedValue({
      _id: 'schedule-1',
      farm_id: 'farm-2',
      is_executed: false,
    });

    await request(app)
      .put('/farms/farm-1/irrigation/schedule-1')
      .send({ scheduledDate: '2026-03-15T06:00:00.000Z' })
      .expect(404);

    expect(mockDb.irrigationSchedules.update).not.toHaveBeenCalled();
    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('executes an irrigation schedule only when it belongs to the selected farm', async () => {
    const app = createApp();
    mockDb.irrigationSchedules.getById.mockResolvedValue({
      _id: 'schedule-2',
      farm_id: 'farm-1',
      recommendation_id: 'rec-2',
      is_executed: false,
      executed_at: undefined,
    });
    mockDb.recommendations.getById.mockResolvedValue({
      _id: 'rec-2',
      status: 'accepted',
    });
    mockDb.irrigationSchedules.update.mockResolvedValue({
      _id: 'schedule-2',
      farm_id: 'farm-1',
      is_executed: true,
      executed_at: 1742018400000,
      actual_duration_minutes: 28,
      actual_water_volume: 160,
    });

    const response = await request(app)
      .put('/farms/farm-1/irrigation/schedule-2/execute')
      .send({
        actualDurationMinutes: 28,
        actualWaterVolume: 160,
      })
      .expect(200);

    expect(mockDb.irrigationSchedules.update).toHaveBeenCalledWith(
      'schedule-2',
      expect.objectContaining({
        is_executed: true,
        executed_at: expect.any(Number),
        actual_duration_minutes: 28,
        actual_water_volume: 160,
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXECUTE_IRRIGATION_SCHEDULE',
        entity_id: 'schedule-2',
      })
    );
    expect(mockRecommendationService.markCompleted).toHaveBeenCalledWith(
      'rec-2',
      expect.objectContaining({
        completedBy: 'farmer-1',
        outcome: 'executed',
      })
    );
    expect(response.body.data.is_executed).toBe(true);
  });
});
