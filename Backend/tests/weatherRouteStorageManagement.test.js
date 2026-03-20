import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  farms: {
    getById: jest.fn(),
    getUserId: jest.fn(),
  },
  weatherData: {
    getByDistrict: jest.fn(),
  },
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  authenticate: (_req, _res, next) => next(),
  ROLES: { FARMER: 'farmer', EXPERT: 'expert', ADMIN: 'admin' },
  requireOwnership: () => (_req, _res, next) => next(),
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

await jest.unstable_mockModule('../src/services/weatherService.js', () => ({
  getCurrentWeather: jest.fn(),
  getForecast: jest.fn(),
  getWeatherByCoordinates: jest.fn(),
}));

const { default: router } = await import('../src/routes/weather.js');

const getRouteHandler = (path, method = 'get') => {
  const layer = router.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods?.[method]
  );

  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }

  return layer.route.stack[layer.route.stack.length - 1].handle;
};

describe('weather route storage management fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests stored historical weather using forecast-date strings', async () => {
    const historyRoute = getRouteHandler('/farm/:farmId/history');
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      district_id: 'district-1',
    });
    mockDb.weatherData.getByDistrict.mockResolvedValue([{ forecast_date: '2026-03-01' }]);

    const req = {
      params: { farmId: 'farm-1' },
      query: {
        startDate: '2026-03-01',
        endDate: '2026-03-05',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await historyRoute(req, res, next);

    expect(mockDb.weatherData.getByDistrict).toHaveBeenCalledWith('district-1', {
      startDate: '2026-03-01',
      endDate: '2026-03-05',
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns empty historical weather when the farm has no district mapping', async () => {
    const historyRoute = getRouteHandler('/farm/:farmId/history');
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      district_id: null,
    });

    const req = {
      params: { farmId: 'farm-1' },
      query: {
        startDate: '2026-03-01',
        endDate: '2026-03-05',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await historyRoute(req, res, next);

    expect(mockDb.weatherData.getByDistrict).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          farmId: 'farm-1',
          data: [],
        }),
      })
    );
  });
});
