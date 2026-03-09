import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  auditLogs: {
    create: jest.fn(),
    deleteOlderThan: jest.fn(),
  },
  sensors: {
    listActive: jest.fn(),
    listActiveWithFarm: jest.fn(),
    update: jest.fn(),
  },
  farms: {
    listActive: jest.fn(),
    list: jest.fn(),
    getByUser: jest.fn(),
  },
  users: {
    listActive: jest.fn(),
    getById: jest.fn(),
  },
  recommendations: {
    getPendingCount: jest.fn(),
  },
  sensorData: {
    deleteOlderThan: jest.fn(),
    getLatestByFarm: jest.fn(),
  },
  weatherData: {
    deleteOlderThan: jest.fn(),
  },
  districts: {
    listWithCoordinates: jest.fn(),
  },
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockAiService = {
  analyzeIrrigationNeeds: jest.fn(),
  analyzeNutrientNeeds: jest.fn(),
  runComprehensiveAnalysis: jest.fn(),
};

const mockSensorService = {
  getLatestReadings: jest.fn(),
};

const mockWeatherService = {
  fetchWeatherForecast: jest.fn(),
  storeWeatherData: jest.fn(),
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/config/index.js', () => ({
  default: {
    ai: {
      comprehensiveAnalysisConcurrency: 2,
      irrigationAnalysisConcurrency: 2,
      recommendationGenerationConcurrency: 3,
    },
    notifications: {
      summaryConcurrency: 2,
    },
  },
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
}));

const mockNotificationService = {
  sendRecommendationNotification: jest.fn(),
  sendSMS: jest.fn(),
};

await jest.unstable_mockModule('../src/services/notificationService.js', () => ({
  default: mockNotificationService,
  ...mockNotificationService,
}));

await jest.unstable_mockModule('../src/services/aiService.js', () => ({
  default: mockAiService,
  ...mockAiService,
}));

await jest.unstable_mockModule('../src/services/sensorService.js', () => ({
  default: mockSensorService,
  ...mockSensorService,
}));

await jest.unstable_mockModule('../src/services/weatherService.js', () => ({
  default: mockWeatherService,
  ...mockWeatherService,
}));

await jest.unstable_mockModule('node-cron', () => ({
  default: {
    schedule: jest.fn(() => ({
      stop: jest.fn(),
    })),
  },
}));

const { bulkGenerateRecommendations } = await import('../src/services/recommendationService.js');
const { runTaskNow } = await import('../src/services/schedulerService.js');

describe('irrigation job performance fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.auditLogs.create.mockResolvedValue(null);
    mockDb.sensorData.deleteOlderThan.mockResolvedValue({ count: 10 });
    mockDb.auditLogs.deleteOlderThan.mockResolvedValue({ count: 3 });
    mockDb.weatherData.deleteOlderThan.mockResolvedValue({ count: 7 });
  });

  it('stores historical weather using saved district coordinates when available', async () => {
    mockDb.districts.listWithCoordinates.mockResolvedValue([
      {
        _id: 'district-1',
        name: 'Custom District',
        latitude: -2.1,
        longitude: 30.8,
      },
    ]);
    mockWeatherService.fetchWeatherForecast.mockResolvedValue([
      { date: '2026-03-09', temperatureAvg: 24, humidityAvg: 70, precipitationProbability: 30, rainMm: 0, condition: 'Clouds', windSpeedAvg: 3 },
    ]);
    mockWeatherService.storeWeatherData.mockResolvedValue(undefined);

    await runTaskNow('weatherUpdate');

    expect(mockWeatherService.fetchWeatherForecast).toHaveBeenCalledWith(-2.1, 30.8, 7);
    expect(mockWeatherService.storeWeatherData).toHaveBeenCalledWith(
      'district-1',
      -2.1,
      30.8,
      expect.any(Array)
    );
  });

  it('runs scheduled irrigation analysis with bounded concurrency and deduplicated farm ids', async () => {
    mockDb.sensors.listActive.mockResolvedValue([
      { farm_id: 'farm-1' },
      { farm_id: 'farm-1' },
      { farm_id: 'farm-2' },
      { farm_id: 'farm-3' },
      { farm_id: 'farm-4' },
    ]);

    let active = 0;
    let maxActive = 0;
    mockAiService.analyzeIrrigationNeeds.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
    });

    await runTaskNow('irrigationAnalysis');

    expect(mockAiService.analyzeIrrigationNeeds).toHaveBeenCalledTimes(4);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('runs bulk irrigation generation with bounded concurrency', async () => {
    let active = 0;
    let maxActive = 0;
    mockAiService.analyzeIrrigationNeeds.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
    });

    const result = await bulkGenerateRecommendations({
      type: 'irrigation',
      farmIds: ['farm-1', 'farm-2', 'farm-3', 'farm-4', 'farm-5'],
    });

    expect(result.generated).toBe(5);
    expect(result.errors).toEqual([]);
    expect(mockAiService.analyzeIrrigationNeeds).toHaveBeenCalledTimes(5);
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('runs daily comprehensive analysis with bounded concurrency', async () => {
    mockDb.farms.listActive.mockResolvedValue([
      { _id: 'farm-1', name: 'Farm 1' },
      { _id: 'farm-2', name: 'Farm 2' },
      { _id: 'farm-3', name: 'Farm 3' },
      { _id: 'farm-4', name: 'Farm 4' },
    ]);

    let active = 0;
    let maxActive = 0;
    mockAiService.runComprehensiveAnalysis.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return {
        irrigation: { needsIrrigation: false },
        nutrients: { needsFertilization: true },
      };
    });

    await runTaskNow('dailyRecommendations');

    expect(mockAiService.runComprehensiveAnalysis).toHaveBeenCalledTimes(4);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('runs daily summaries with bounded concurrency and normalized farm results', async () => {
    const notificationService = await import('../src/services/notificationService.js');

    mockDb.users.listActive.mockResolvedValue([
      { _id: 'user-1', phone_number: '+250700000001', preferred_language: 'en' },
      { _id: 'user-2', phone_number: '+250700000002', preferred_language: 'rw' },
      { _id: 'user-3', phone_number: '+250700000003', preferred_language: 'en' },
      { _id: 'user-4', phone_number: '+250700000004', preferred_language: 'rw' },
    ]);
    mockDb.farms.getByUser.mockImplementation(async (userId) => ({
      data: [{ _id: `farm-${userId}`, name: `Farm ${userId}` }],
      count: 1,
    }));
    mockDb.recommendations.getPendingCount.mockResolvedValue(2);
    mockSensorService.getLatestReadings.mockResolvedValue({
      soil_moisture: 43,
      soil_temperature: 20,
      air_temperature: 24,
      humidity: 71,
      nitrogen: 118,
      phosphorus: 31,
      potassium: 166,
    });

    let active = 0;
    let maxActive = 0;
    notificationService.sendSMS.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
    });

    await runTaskNow('dailySummary');

    expect(mockDb.users.listActive).toHaveBeenCalledWith('farmer');
    expect(mockDb.farms.getByUser).toHaveBeenCalledTimes(4);
    expect(mockSensorService.getLatestReadings).toHaveBeenCalledTimes(4);
    expect(notificationService.sendSMS).toHaveBeenCalledTimes(4);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('runs historical data cleanup with the correct retention key types', async () => {
    await runTaskNow('dataCleanup');

    expect(mockDb.sensorData.deleteOlderThan).toHaveBeenCalledWith(expect.any(Number));
    expect(mockDb.auditLogs.deleteOlderThan).toHaveBeenCalledWith(expect.any(Number));
    expect(mockDb.weatherData.deleteOlderThan).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DATA_CLEANUP',
        entity_type: 'system',
        new_values: {
          sensor_retention_days: 90,
          audit_retention_days: 30,
          weather_retention_days: 14,
          deleted_sensor_records: 10,
          deleted_audit_records: 3,
          deleted_weather_records: 7,
        },
        created_at: expect.any(Number),
      })
    );
  });

  it('writes an audit log when sensor health checks persist maintenance status changes', async () => {
    const staleTimestamp = Date.now() - 3 * 60 * 60 * 1000;

    mockDb.sensors.listActiveWithFarm.mockResolvedValue([
      {
        _id: 'sensor-1',
        name: 'Moisture Sensor 1',
        status: 'active',
        last_reading_at: staleTimestamp,
        farm: {
          user_id: 'user-1',
          name: 'North Field',
        },
      },
    ]);
    mockDb.sensors.update.mockResolvedValue({ _id: 'sensor-1', status: 'maintenance' });
    mockDb.users.getById.mockResolvedValue(null);

    await runTaskNow('sensorHealthCheck');

    expect(mockDb.sensors.update).toHaveBeenCalledWith('sensor-1', { status: 'maintenance' });
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_SENSOR_STATUS',
        entity_type: 'sensors',
        entity_id: 'sensor-1',
        old_values: {
          status: 'active',
          last_reading_at: staleTimestamp,
        },
        new_values: {
          status: 'maintenance',
          last_reading_at: staleTimestamp,
        },
        created_at: expect.any(Number),
      })
    );
  });

  it('skips audit logging when a sensor disappears before maintenance persistence', async () => {
    const staleTimestamp = Date.now() - 3 * 60 * 60 * 1000;

    mockDb.sensors.listActiveWithFarm.mockResolvedValue([
      {
        _id: 'sensor-1',
        name: 'Moisture Sensor 1',
        status: 'active',
        last_reading_at: staleTimestamp,
        farm: {
          user_id: 'user-1',
          name: 'North Field',
        },
      },
    ]);
    mockDb.sensors.update.mockResolvedValue(null);

    await runTaskNow('sensorHealthCheck');

    expect(mockDb.auditLogs.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_SENSOR_STATUS',
        entity_id: 'sensor-1',
      })
    );
  });
});
