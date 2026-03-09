import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  farms: {
    getUserId: jest.fn(),
    getById: jest.fn(),
    list: jest.fn(),
    listActive: jest.fn(),
  },
  sensorData: {
    list: jest.fn(),
    getDailyAggregates: jest.fn(),
    getLatestReadings: jest.fn(),
    countSince: jest.fn(),
  },
  recommendations: {
    getByFarm: jest.fn(),
    list: jest.fn(),
    getStats: jest.fn(),
  },
  irrigationSchedules: {
    getUpcoming: jest.fn(),
  },
  pestDetections: {
    getRecent: jest.fn(),
    getStats: jest.fn(),
    getOutbreakMap: jest.fn(),
  },
  users: {
    list: jest.fn(),
    listAll: jest.fn(),
  },
  sensors: {
    listAllStats: jest.fn(),
  },
  districts: {
    list: jest.fn(),
  },
};

const mockSensorService = {
  getLatestReadings: jest.fn(),
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  authenticate: (_req, _res, next) => next(),
  ROLES: { FARMER: 'farmer', EXPERT: 'expert', ADMIN: 'admin' },
  requireOwnership: () => (_req, _res, next) => next(),
  requireMinimumRole: () => (_req, _res, next) => next(),
}));

await jest.unstable_mockModule('../src/middleware/validation.js', () => ({
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
}));

await jest.unstable_mockModule('../src/services/sensorService.js', () => mockSensorService);

const { default: router } = await import('../src/routes/analytics.js');

const getRouteHandler = (path, method = 'get') => {
  const layer = router.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods?.[method]
  );

  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }

  return layer.route.stack[layer.route.stack.length - 1].handle;
};

describe('analytics sensor trend route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.farms.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.farms.listActive.mockResolvedValue([]);
    mockDb.users.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.users.listAll.mockResolvedValue([]);
    mockDb.sensorData.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.sensorData.countSince.mockResolvedValue(0);
    mockDb.recommendations.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.recommendations.getStats.mockResolvedValue([]);
    mockDb.pestDetections.getStats.mockResolvedValue([]);
    mockDb.pestDetections.getOutbreakMap.mockResolvedValue([]);
    mockDb.sensors.listAllStats.mockResolvedValue([]);
    mockDb.districts.list.mockResolvedValue([]);
  });

  it('returns daily aggregates with soil temperature and NPK trend fields preserved', async () => {
    const route = getRouteHandler('/farm/:farmId/sensor-trends');
    mockDb.sensorData.getDailyAggregates.mockResolvedValue([
      {
        farm_id: 'farm-1',
        reading_date: '2026-03-09',
        avg_soil_moisture: 45,
        avg_soil_temperature: 21.5,
        avg_temperature: 24,
        avg_humidity: 72,
        avg_nitrogen: 118,
        avg_phosphorus: 31,
        avg_potassium: 165,
        reading_count: 8,
      },
    ]);

    const req = {
      params: { farmId: 'farm-1' },
      query: { days: '7' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await route(req, res, jest.fn());

    expect(mockDb.sensorData.getDailyAggregates).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          farmId: 'farm-1',
          trends: [
            expect.objectContaining({
              avg_soil_temperature: 21.5,
              avg_nitrogen: 118,
              avg_phosphorus: 31,
              avg_potassium: 165,
            }),
          ],
        }),
      })
    );
  });

  it('returns a merged latest sensor snapshot for dashboard analytics', async () => {
    const route = getRouteHandler('/farm/:farmId/dashboard');
    mockDb.farms.getById.mockResolvedValue({ _id: 'farm-1', name: 'North field' });
    mockSensorService.getLatestReadings.mockResolvedValue({
      farm_id: 'farm-1',
      soil_moisture: 48,
      soil_temperature: 22,
      air_temperature: 25,
      humidity: 74,
      nitrogen: 120,
      phosphorus: 33,
      potassium: 170,
      reading_timestamp: 1741514700000,
    });
    mockDb.recommendations.getByFarm.mockResolvedValue([]);
    mockDb.irrigationSchedules.getUpcoming.mockResolvedValue([]);
    mockDb.pestDetections.getRecent.mockResolvedValue([]);

    const req = {
      params: { farmId: 'farm-1' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await route(req, res, jest.fn());

    expect(mockSensorService.getLatestReadings).toHaveBeenCalledWith('farm-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          latestReadings: expect.objectContaining({
            soil_moisture: 48,
            soil_temperature: 22,
            humidity: 74,
            nitrogen: 120,
            phosphorus: 33,
            potassium: 170,
          }),
          latestSensorData: [
            expect.objectContaining({
              soil_moisture: 48,
              soil_temperature: 22,
              humidity: 74,
              nitrogen: 120,
              phosphorus: 33,
              potassium: 170,
            }),
          ],
        }),
      })
    );
  });

  it('exports analytics summary using persisted count fields and the global sensor-data list query', async () => {
    const route = getRouteHandler('/export');
    mockDb.farms.list.mockResolvedValue({ data: [{ _id: 'farm-1' }], count: 25 });
    mockDb.users.list.mockResolvedValue({ data: [{ _id: 'user-1' }], count: 40 });
    mockDb.sensorData.list.mockResolvedValue({ data: [{ _id: 'reading-1' }], count: 320 });
    mockDb.recommendations.list.mockResolvedValue({ data: [{ _id: 'rec-1' }], count: 18 });

    const req = {
      query: {
        format: 'json',
        startDate: '2026-03-01',
        endDate: '2026-03-09',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    await route(req, res, jest.fn());

    expect(mockDb.sensorData.list).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 1,
        since: Date.parse('2026-03-01'),
        until: Date.parse('2026-03-09'),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          summary: expect.objectContaining({
            totalFarms: 25,
            totalUsers: 40,
            totalSensorReadings: 320,
            totalRecommendations: 18,
          }),
        }),
      })
    );
  });
});
