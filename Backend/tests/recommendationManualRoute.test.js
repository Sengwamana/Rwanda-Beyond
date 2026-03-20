import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  recommendations: {
    getById: jest.fn(),
  },
  farms: {
    getUserId: jest.fn(),
  },
};

const mockRecommendationService = {
  createManualRecommendation: jest.fn(),
  getFarmRecommendations: jest.fn(),
  getActiveRecommendations: jest.fn(),
  bulkGenerateRecommendations: jest.fn(),
  getRecommendationStats: jest.fn(),
  getRecommendationById: jest.fn(),
  respondToRecommendation: jest.fn(),
  markCompleted: jest.fn(),
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/services/recommendationService.js', () => mockRecommendationService);

await jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  ROLES: {
    FARMER: 'farmer',
    EXPERT: 'expert',
    ADMIN: 'admin',
  },
  authenticate: (req, _res, next) => {
    const role = req.headers['x-test-role'] || 'expert';
    req.user = { id: `${role}-1`, _id: `${role}-1`, role };
    next();
  },
  authorize: () => (_req, _res, next) => next(),
  requireOwnership: () => (_req, _res, next) => next(),
  requireMinimumRole: () => (req, res, next) => {
    if (req.user?.role === 'expert' || req.user?.role === 'admin') {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Forbidden' });
  },
}));

await jest.unstable_mockModule('../src/middleware/validation.js', () => ({
  validateRecommendationResponse: (_req, _res, next) => next(),
  validatePagination: (_req, _res, next) => next(),
  validateUUID: () => [],
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
    res.status(200).json({ success: true, data, pagination: { page, limit, total }, message }),
}));

const { default: recommendationsRouter } = await import('../src/routes/recommendations.js');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/recommendations', recommendationsRouter);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ success: false, message: err.message });
  });
  return app;
};

describe('manual recommendation route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows an expert to create a manual recommendation for a farm', async () => {
    const app = createApp();
    mockRecommendationService.createManualRecommendation.mockResolvedValue({
      _id: 'rec-manual-1',
      farm_id: 'farm-1',
      user_id: 'farmer-1',
      type: 'general',
      status: 'pending',
      title: 'Scout for nutrient stress',
    });

    const response = await request(app)
      .post('/recommendations/manual')
      .set('x-test-role', 'expert')
      .send({
        farmId: 'farm-1',
        type: 'general',
        priority: 'high',
        title: 'Scout for nutrient stress',
        description: 'Check yellowing leaves on the east side.',
        actionRequired: 'Inspect 10 plants and report back before tomorrow.',
        validUntil: '2026-03-15T06:00:00.000Z',
      })
      .expect(200);

    expect(mockRecommendationService.createManualRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        farmId: 'farm-1',
        type: 'general',
        priority: 'high',
        title: 'Scout for nutrient stress',
        description: 'Check yellowing leaves on the east side.',
        actionRequired: 'Inspect 10 plants and report back before tomorrow.',
        validUntil: '2026-03-15T06:00:00.000Z',
        createdBy: 'expert-1',
      })
    );
    expect(response.body.data.title).toBe('Scout for nutrient stress');
  });

  it('rejects manual recommendation creation for farmer users', async () => {
    const app = createApp();

    await request(app)
      .post('/recommendations/manual')
      .set('x-test-role', 'farmer')
      .send({
        farmId: 'farm-1',
        type: 'general',
        priority: 'medium',
        title: 'Advice',
        description: 'Description',
        actionRequired: 'Action',
      })
      .expect(403);

    expect(mockRecommendationService.createManualRecommendation).not.toHaveBeenCalled();
  });

  it('routes /recommendations/stats to statistics instead of recommendation ID lookup', async () => {
    const app = createApp();
    mockRecommendationService.getRecommendationStats.mockResolvedValue({
      total: 3,
      byType: { irrigation: 2, general: 1 },
    });

    const response = await request(app)
      .get('/recommendations/stats')
      .set('x-test-role', 'expert')
      .query({
        farmId: 'farm-1',
        startDate: '2026-03-01T00:00:00.000Z',
      })
      .expect(200);

    expect(mockRecommendationService.getRecommendationStats).toHaveBeenCalledWith({
      farmId: 'farm-1',
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: undefined,
    });
    expect(mockRecommendationService.getRecommendationById).not.toHaveBeenCalled();
    expect(mockDb.recommendations.getById).not.toHaveBeenCalled();
    expect(response.body.data.total).toBe(3);
  });

  it('uses paginated farm recommendation history without passing page to raw Convex farm queries', async () => {
    const app = createApp();
    mockRecommendationService.getFarmRecommendations.mockResolvedValue({
      data: [
        { _id: 'rec-1', title: 'Inspect leaves', farm_id: 'farm-1', status: 'pending' },
      ],
      total: 1,
      page: 1,
      limit: 6,
    });

    const response = await request(app)
      .get('/recommendations/history')
      .set('x-test-role', 'expert')
      .query({
        farmId: 'farm-1',
        page: 1,
        limit: 6,
      })
      .expect(200);

    expect(mockRecommendationService.getFarmRecommendations).toHaveBeenCalledWith(
      'farm-1',
      expect.objectContaining({
        page: 1,
        limit: 6,
      })
    );
    expect(response.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 6,
        total: 1,
      })
    );
  });
});
