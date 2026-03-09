import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const mockDb = {
  farms: {
    getById: jest.fn(),
  },
  users: {
    getById: jest.fn(),
  },
  sensorData: {
    getLatestReadings: jest.fn(),
  },
  fertilizationSchedules: {
    getHistory: jest.fn(),
    create: jest.fn(),
  },
  recommendations: {
    create: jest.fn(),
  },
};

const mockNotificationService = {
  sendRecommendationNotification: jest.fn(),
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

await jest.unstable_mockModule('../src/config/index.js', () => ({
  default: {
    maize: {},
    ai: {
      recommendationGenerationConcurrency: 4,
    },
  },
}));

await jest.unstable_mockModule('../src/services/notificationService.js', () => mockNotificationService);

const { analyzeSoilNutrients } = await import('../src/services/fertilizerService.js');
const { createFertilizationRecommendation } = await import('../src/services/recommendationService.js');

describe('fertilization management performance fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts farm, sensor, and history fetches in parallel for soil analysis', async () => {
    const farmDeferred = deferred();
    const readingsDeferred = deferred();
    const historyDeferred = deferred();

    mockDb.farms.getById.mockReturnValue(farmDeferred.promise);
    mockDb.sensorData.getLatestReadings.mockReturnValue(readingsDeferred.promise);
    mockDb.fertilizationSchedules.getHistory.mockReturnValue(historyDeferred.promise);

    const analysisPromise = analyzeSoilNutrients('farm-1');

    expect(mockDb.farms.getById).toHaveBeenCalledWith('farm-1');
    expect(mockDb.sensorData.getLatestReadings).toHaveBeenCalledWith('farm-1', 20);
    expect(mockDb.fertilizationSchedules.getHistory).toHaveBeenCalledWith(
      'farm-1',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      30
    );

    farmDeferred.resolve({
      _id: 'farm-1',
      name: 'North Plot',
      current_growth_stage: 'vegetative',
      size_hectares: 2,
      planting_date: '2026-02-20',
    });
    readingsDeferred.resolve([
      {
        is_valid: true,
        nitrogen: 110,
        phosphorus: 24,
        potassium: 120,
        ph_level: 6.1,
        reading_timestamp: 1700000000000,
      },
      {
        is_valid: true,
        nitrogen: 120,
        phosphorus: 26,
        potassium: 130,
        ph_level: 6.3,
        reading_timestamp: 1700001000000,
      },
    ]);
    historyDeferred.resolve([
      {
        _id: 'schedule-1',
        is_executed: true,
        total_quantity_kg: 50,
      },
    ]);

    const analysis = await analysisPromise;

    expect(analysis).toEqual(
      expect.objectContaining({
        farmId: 'farm-1',
        readingCount: 2,
        recentApplications: [{ _id: 'schedule-1', is_executed: true, total_quantity_kg: 50 }],
      })
    );
  });

  it('avoids a duplicate farm lookup when creating fertilization recommendations', async () => {
    mockDb.fertilizationSchedules.create.mockResolvedValue({ _id: 'schedule-1' });
    mockDb.recommendations.create.mockResolvedValue({
      _id: 'recommendation-1',
      farm_id: 'farm-1',
      user_id: 'user-1',
      title: 'Fertilization Needed - Nitrogen',
      title_rw: 'Ifumbire Ikenewe - Nitrogen',
      description: 'desc',
      description_rw: 'desc rw',
    });
    mockDb.users.getById.mockResolvedValue({
      _id: 'user-1',
      phone_number: '+250700000000',
      preferred_language: 'en',
    });
    mockNotificationService.sendRecommendationNotification.mockResolvedValue(null);

    const recommendation = await createFertilizationRecommendation('farm-1', {
      currentNutrients: { nitrogen: 10, phosphorus: 8, potassium: 35 },
      targetNutrients: { nitrogen: 40 },
      deficiencies: [{ nutrient: 'Nitrogen', level: 'severe' }],
      fertilizerType: 'UREA',
      quantities: { nitrogen: 20, phosphorus: 0, potassium: 0, total: 45 },
      growthStage: 'vegetative',
      resolvedFarm: {
        _id: 'farm-1',
        name: 'North Plot',
        user_id: 'user-1',
      },
    });

    expect(mockDb.farms.getById).not.toHaveBeenCalled();
    expect(mockDb.users.getById).toHaveBeenCalledTimes(1);
    expect(mockDb.fertilizationSchedules.create).toHaveBeenCalledWith(
      expect.objectContaining({
        farm_id: 'farm-1',
        fertilizer_type: 'UREA',
        total_quantity_kg: 45,
      })
    );
    expect(recommendation).toEqual(
      expect.objectContaining({
        _id: 'recommendation-1',
        farm_id: 'farm-1',
      })
    );
  });
});
