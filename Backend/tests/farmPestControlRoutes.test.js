import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  farms: {
    getUserId: jest.fn(),
  },
  pestDetections: {
    getById: jest.fn(),
  },
  pestControlSchedules: {
    getById: jest.fn(),
    getByFarm: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  recommendations: {
    getByFarm: jest.fn(),
    getById: jest.fn(),
  },
  auditLogs: {
    create: jest.fn(),
  },
};

const mockRecommendationService = {
  updateRecommendationStatus: jest.fn(),
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

describe('farm pest control routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.farms.getUserId.mockResolvedValue('farmer-1');
    mockDb.recommendations.getByFarm.mockResolvedValue([]);
    mockDb.recommendations.getById.mockResolvedValue(null);
    mockDb.auditLogs.create.mockResolvedValue(null);
    mockRecommendationService.updateRecommendationStatus.mockResolvedValue({ _id: 'rec-1', status: 'accepted' });
    mockRecommendationService.markCompleted.mockResolvedValue({ _id: 'rec-1', status: 'executed' });
  });

  it('creates a pest control schedule and links a pending pest alert recommendation', async () => {
    const app = createApp();
    mockDb.pestDetections.getById.mockResolvedValue({
      _id: 'detection-1',
      farm_id: 'farm-1',
      pest_type: 'fall_armyworm',
      treatment_recommendations: ['Spray affected rows at dusk'],
    });
    mockDb.recommendations.getByFarm.mockResolvedValue([
      {
        _id: 'rec-pest-1',
        farm_id: 'farm-1',
        type: 'pest_alert',
        status: 'pending',
        pest_detection_id: 'detection-1',
      },
    ]);
    mockDb.pestControlSchedules.create.mockResolvedValue({
      _id: 'pcs-1',
      farm_id: 'farm-1',
      detection_id: 'detection-1',
      recommendation_id: 'rec-pest-1',
      scheduled_date: '2026-03-16',
      scheduled_time: '06:30',
      control_method: 'Targeted spray application',
      is_executed: false,
    });

    const response = await request(app)
      .post('/farms/farm-1/pest-control')
      .send({
        detectionId: 'detection-1',
        scheduledDate: '2026-03-16',
        scheduledTime: '06:30',
        controlMethod: 'Targeted spray application',
      })
      .expect(201);

    expect(mockDb.pestControlSchedules.create).toHaveBeenCalledWith(
      expect.objectContaining({
        farm_id: 'farm-1',
        detection_id: 'detection-1',
        recommendation_id: 'rec-pest-1',
        scheduled_date: '2026-03-16',
        scheduled_time: '06:30',
        control_method: 'Targeted spray application',
        treatment_steps: ['Spray affected rows at dusk'],
        trigger_source: 'recommendation',
      })
    );
    expect(mockRecommendationService.updateRecommendationStatus).toHaveBeenCalledWith(
      'rec-pest-1',
      'accepted',
      expect.objectContaining({
        respondedBy: 'farmer-1',
        channel: 'web',
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'farmer-1',
        action: 'CREATE_PEST_CONTROL_SCHEDULE',
        entity_type: 'pest_control_schedules',
        entity_id: 'pcs-1',
      })
    );
    expect(response.body.data.recommendation_id).toBe('rec-pest-1');
  });

  it('returns not found when the pest detection does not belong to the selected farm', async () => {
    const app = createApp();
    mockDb.pestDetections.getById.mockResolvedValue({
      _id: 'detection-2',
      farm_id: 'farm-2',
    });

    await request(app)
      .post('/farms/farm-1/pest-control')
      .send({
        detectionId: 'detection-2',
        scheduledDate: '2026-03-16',
      })
      .expect(404);

    expect(mockDb.pestControlSchedules.create).not.toHaveBeenCalled();
    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('executes a pest control schedule and completes the linked recommendation', async () => {
    const app = createApp();
    mockDb.pestControlSchedules.getById.mockResolvedValue({
      _id: 'pcs-2',
      farm_id: 'farm-1',
      detection_id: 'detection-3',
      recommendation_id: 'rec-pest-2',
      is_executed: false,
      executed_at: undefined,
    });
    mockDb.recommendations.getById.mockResolvedValue({
      _id: 'rec-pest-2',
      status: 'accepted',
    });
    mockDb.pestControlSchedules.update.mockResolvedValue({
      _id: 'pcs-2',
      farm_id: 'farm-1',
      detection_id: 'detection-3',
      recommendation_id: 'rec-pest-2',
      is_executed: true,
      executed_at: 1742100000000,
      actual_outcome: 'completed',
      actual_notes: 'Applied treatment to the infested area.',
    });

    const response = await request(app)
      .put('/farms/farm-1/pest-control/pcs-2/execute')
      .send({
        actualOutcome: 'completed',
        notes: 'Applied treatment to the infested area.',
      })
      .expect(200);

    expect(mockDb.pestControlSchedules.update).toHaveBeenCalledWith(
      'pcs-2',
      expect.objectContaining({
        is_executed: true,
        executed_at: expect.any(Number),
        actual_outcome: 'completed',
        actual_notes: 'Applied treatment to the infested area.',
      })
    );
    expect(mockRecommendationService.markCompleted).toHaveBeenCalledWith(
      'rec-pest-2',
      expect.objectContaining({
        completedBy: 'farmer-1',
        outcome: 'completed',
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXECUTE_PEST_CONTROL_ACTION',
        entity_id: 'pcs-2',
      })
    );
    expect(response.body.data.is_executed).toBe(true);
  });
});
