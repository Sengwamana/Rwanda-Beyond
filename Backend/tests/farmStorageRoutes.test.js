import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  farms: {
    getById: jest.fn(),
    getUserId: jest.fn(),
    update: jest.fn(),
  },
  auditLogs: {
    create: jest.fn(),
  },
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
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

await jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  ROLES: {
    FARMER: 'farmer',
    EXPERT: 'expert',
    ADMIN: 'admin',
  },
  authenticate: (req, _res, next) => {
    req.user = { id: 'user-1', _id: 'user-1', role: 'farmer' };
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

describe('farm storage routes audit coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.auditLogs.create.mockResolvedValue(null);
  });

  it('writes an audit log when updating persisted farm growth stage', async () => {
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      current_growth_stage: 'germination',
      metadata: {},
    });
    mockDb.farms.update.mockResolvedValue({
      _id: 'farm-1',
      current_growth_stage: 'vegetative',
    });

    const app = createApp();

    await request(app)
      .put('/farms/farm-1/growth-stage')
      .send({ growthStage: 'vegetative' })
      .expect(200);

    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        action: 'UPDATE_FARM_GROWTH_STAGE',
        entity_type: 'farms',
        entity_id: 'farm-1',
        old_values: { current_growth_stage: 'germination' },
        new_values: { current_growth_stage: 'vegetative' },
      })
    );
  });

  it('writes an audit log when storing farm image metadata', async () => {
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      metadata: {
        latest_image_url: 'https://example.com/old.jpg',
        images: [{ url: 'https://example.com/old.jpg' }],
      },
    });
    mockDb.farms.update.mockResolvedValue({
      _id: 'farm-1',
      metadata: {
        latest_image_url: 'https://example.com/new.jpg',
        images: [
          { url: 'https://example.com/old.jpg' },
          { url: 'https://example.com/new.jpg' },
        ],
      },
    });

    const app = createApp();

    await request(app)
      .post('/farms/farm-1/image')
      .send({ imageUrl: 'https://example.com/new.jpg' })
      .expect(200);

    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        action: 'ADD_FARM_IMAGE',
        entity_type: 'farms',
        entity_id: 'farm-1',
        old_values: {
          latest_image_url: 'https://example.com/old.jpg',
          image_count: 1,
        },
        new_values: {
          latest_image_url: 'https://example.com/new.jpg',
          image_count: 2,
        },
      })
    );
  });

  it('still returns success when farm route audit logging fails after persistence', async () => {
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      current_growth_stage: 'germination',
      metadata: {},
    });
    mockDb.farms.update.mockResolvedValue({
      _id: 'farm-1',
      current_growth_stage: 'vegetative',
    });
    mockDb.auditLogs.create.mockRejectedValue(new Error('audit offline'));

    const app = createApp();

    const response = await request(app)
      .put('/farms/farm-1/growth-stage')
      .send({ growthStage: 'vegetative' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(mockDb.farms.update).toHaveBeenCalledWith('farm-1', {
      current_growth_stage: 'vegetative',
    });
    expect(mockLogger.warn).toHaveBeenCalledWith('Failed to write farm route audit log:', 'audit offline');
  });

  it('returns not found when updating growth stage for a missing farm', async () => {
    mockDb.farms.getById.mockResolvedValue(null);

    const app = createApp();

    await request(app)
      .put('/farms/missing-farm/growth-stage')
      .send({ growthStage: 'vegetative' })
      .expect(404);

    expect(mockDb.farms.update).not.toHaveBeenCalled();
    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('returns not found when a farm disappears before growth-stage persistence', async () => {
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      current_growth_stage: 'germination',
      metadata: {},
    });
    mockDb.farms.update.mockResolvedValue(null);

    const app = createApp();

    await request(app)
      .put('/farms/farm-1/growth-stage')
      .send({ growthStage: 'vegetative' })
      .expect(404);

    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('returns not found when storing image metadata for a missing farm', async () => {
    mockDb.farms.getById.mockResolvedValue(null);

    const app = createApp();

    await request(app)
      .post('/farms/missing-farm/image')
      .send({ imageUrl: 'https://example.com/new.jpg' })
      .expect(404);

    expect(mockDb.farms.update).not.toHaveBeenCalled();
    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('returns not found when a farm disappears before image metadata persistence', async () => {
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      metadata: {
        latest_image_url: 'https://example.com/old.jpg',
        images: [{ url: 'https://example.com/old.jpg' }],
      },
    });
    mockDb.farms.update.mockResolvedValue(null);

    const app = createApp();

    await request(app)
      .post('/farms/farm-1/image')
      .send({ imageUrl: 'https://example.com/new.jpg' })
      .expect(404);

    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });
});
