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
  irrigationSchedules: {
    create: jest.fn(),
    getUpcoming: jest.fn(),
  },
  recommendations: {
    create: jest.fn(),
    getPendingCount: jest.fn(),
  },
  pestDetections: {
    getRecent: jest.fn(),
  },
};

const mockSensorService = {
  getLatestReadings: jest.fn(),
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

await jest.unstable_mockModule('../src/services/sensorService.js', () => mockSensorService);

await jest.unstable_mockModule('../src/services/notificationService.js', () => mockNotificationService);

const { createIrrigationRecommendation } = await import('../src/services/recommendationService.js');
const { getFarmSummary } = await import('../src/services/farmService.js');

describe('irrigation management performance fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('avoids a duplicate farm lookup when creating irrigation recommendations', async () => {
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      name: 'North Plot',
      user_id: 'user-1',
    });
    mockDb.irrigationSchedules.create.mockResolvedValue({ _id: 'schedule-1' });
    mockDb.recommendations.create.mockResolvedValue({
      _id: 'recommendation-1',
      farm_id: 'farm-1',
      user_id: 'user-1',
      title: 'Irrigation Needed - North Plot',
      title_rw: 'Kuhira Bikenewe - North Plot',
      description: 'desc',
      description_rw: 'desc rw',
    });
    mockDb.users.getById.mockResolvedValue({
      _id: 'user-1',
      phone_number: '+250700000000',
      preferred_language: 'en',
    });
    mockNotificationService.sendRecommendationNotification.mockResolvedValue(null);

    await createIrrigationRecommendation('farm-1', {
      currentSoilMoisture: 18,
      targetSoilMoisture: 50,
      waterVolume: 2000,
      duration: 20,
      scheduledDate: '2026-03-09',
      scheduledTime: '06:00',
      weatherImpact: { irrigationRecommendation: 'proceed' },
      confidence: 0.85,
    });

    expect(mockDb.farms.getById).toHaveBeenCalledTimes(1);
    expect(mockDb.users.getById).toHaveBeenCalledTimes(1);
    expect(mockDb.irrigationSchedules.create).toHaveBeenCalledWith(
      expect.objectContaining({
        farm_id: 'farm-1',
        duration_minutes: 20,
        water_volume_liters: 2000,
      })
    );
  });

  it('does not block irrigation recommendation creation on notification delivery', async () => {
    const notificationDeferred = deferred();

    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      name: 'North Plot',
      user_id: 'user-1',
    });
    mockDb.irrigationSchedules.create.mockResolvedValue({ _id: 'schedule-1' });
    mockDb.recommendations.create.mockResolvedValue({
      _id: 'recommendation-1',
      farm_id: 'farm-1',
      user_id: 'user-1',
      title: 'Irrigation Needed - North Plot',
      title_rw: 'Kuhira Bikenewe - North Plot',
      description: 'desc',
      description_rw: 'desc rw',
    });
    mockDb.users.getById.mockResolvedValue({
      _id: 'user-1',
      phone_number: '+250700000000',
      preferred_language: 'en',
    });
    mockNotificationService.sendRecommendationNotification.mockReturnValue(notificationDeferred.promise);

    const recommendation = await createIrrigationRecommendation('farm-1', {
      currentSoilMoisture: 22,
      targetSoilMoisture: 50,
      waterVolume: 1800,
      duration: 18,
      scheduledDate: '2026-03-09',
      scheduledTime: '06:00',
      weatherImpact: { irrigationRecommendation: 'proceed' },
      confidence: 0.8,
    });

    expect(recommendation).toEqual(
      expect.objectContaining({
        _id: 'recommendation-1',
        farm_id: 'farm-1',
      })
    );
    expect(mockNotificationService.sendRecommendationNotification).toHaveBeenCalledTimes(1);

    notificationDeferred.resolve(null);
    await Promise.resolve();
  });

  it('starts farm summary dependency fetches in parallel', async () => {
    const farmDeferred = deferred();
    const readingsDeferred = deferred();
    const pendingDeferred = deferred();
    const pestsDeferred = deferred();
    const irrigationDeferred = deferred();

    mockDb.farms.getById.mockReturnValue(farmDeferred.promise);
    mockSensorService.getLatestReadings.mockReturnValue(readingsDeferred.promise);
    mockDb.recommendations.getPendingCount.mockReturnValue(pendingDeferred.promise);
    mockDb.pestDetections.getRecent.mockReturnValue(pestsDeferred.promise);
    mockDb.irrigationSchedules.getUpcoming.mockReturnValue(irrigationDeferred.promise);

    const summaryPromise = getFarmSummary('farm-1');

    expect(mockDb.farms.getById).toHaveBeenCalledWith('farm-1');
    expect(mockSensorService.getLatestReadings).toHaveBeenCalledWith('farm-1');
    expect(mockDb.recommendations.getPendingCount).toHaveBeenCalledWith({ farmId: 'farm-1' });
    expect(mockDb.pestDetections.getRecent).toHaveBeenCalledWith('farm-1', 5);
    expect(mockDb.irrigationSchedules.getUpcoming).toHaveBeenCalledWith(
      'farm-1',
      expect.any(String),
      3
    );

    farmDeferred.resolve({ _id: 'farm-1', name: 'North Plot' });
    readingsDeferred.resolve({ soil_moisture: 42 });
    pendingDeferred.resolve(2);
    pestsDeferred.resolve([{ _id: 'pest-1' }]);
    irrigationDeferred.resolve([{ _id: 'schedule-1' }]);

    const summary = await summaryPromise;

    expect(summary).toEqual({
      farm: { _id: 'farm-1', name: 'North Plot' },
      latestReadings: { soil_moisture: 42 },
      pendingRecommendations: 2,
      recentPests: [{ _id: 'pest-1' }],
      upcomingIrrigation: [{ _id: 'schedule-1' }],
    });
  });
});
