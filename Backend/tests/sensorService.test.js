import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  auditLogs: {
    create: jest.fn(),
  },
  sensors: {
    getById: jest.fn(),
    getByDeviceId: jest.fn(),
    getByFarm: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    listActiveWithFarm: jest.fn(),
  },
  sensorData: {
    getLatestBySensor: jest.fn(),
    insertBatch: jest.fn(),
    getByFarm: jest.fn(),
    getLatestReadings: jest.fn(),
    getDailyAggregates: jest.fn(),
  },
  farms: {
    getById: jest.fn(),
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

await jest.unstable_mockModule('../src/config/index.js', () => ({
  default: {
    sensorValidation: {
      soilMoisture: { min: 0, max: 100 },
      temperature: { min: -10, max: 60 },
      humidity: { min: 0, max: 100 },
      nitrogen: { min: 0, max: 500 },
      phosphorus: { min: 0, max: 500 },
      potassium: { min: 0, max: 500 },
      maxRateOfChange: {
        soilMoisture: 20,
        temperature: 10,
      },
    },
  },
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
}));

const {
  ingestSensorData,
  getDailyAggregates,
  getLatestReadings,
  getSensorData,
  registerSensor,
  updateSensor,
} = await import('../src/services/sensorService.js');

describe('sensorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the backend count field for sensor data pagination totals', async () => {
    mockDb.sensorData.getByFarm.mockResolvedValue({
      data: [{ _id: 'reading-1' }],
      count: 42,
    });

    const result = await getSensorData('farm-1', { page: 2, limit: 10 });

    expect(result.total).toBe(42);
    expect(result.totalPages).toBe(5);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it('stores latitude and longitude directly when updating a sensor location', async () => {
    mockDb.sensors.getById.mockResolvedValue({
      _id: 'sensor-1',
      name: 'Old sensor',
      location_description: 'Old corner',
      latitude: -1.94,
      longitude: 30.05,
    });
    mockDb.sensors.update.mockResolvedValue({ _id: 'sensor-1' });

    await updateSensor('sensor-1', {
      name: 'North plot sensor',
      locationDescription: 'North corner',
      latitude: -1.95,
      longitude: 30.06,
    });

    expect(mockDb.sensors.update).toHaveBeenCalledWith(
      'sensor-1',
      expect.objectContaining({
        name: 'North plot sensor',
        location_description: 'North corner',
        latitude: -1.95,
        longitude: 30.06,
      })
    );
    expect(mockDb.sensors.update.mock.calls[0][1]).not.toHaveProperty('coordinates');
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_SENSOR',
        entity_type: 'sensors',
        entity_id: 'sensor-1',
        old_values: expect.objectContaining({
          name: 'Old sensor',
          location_description: 'Old corner',
          latitude: -1.94,
          longitude: 30.05,
        }),
        new_values: expect.objectContaining({
          name: 'North plot sensor',
          location_description: 'North corner',
          latitude: -1.95,
          longitude: 30.06,
        }),
      })
    );
  });

  it('writes an audit log when registering a stored sensor record', async () => {
    mockDb.sensors.create.mockResolvedValue({
      _id: 'sensor-2',
      device_id: 'device-123456',
      farm_id: 'farm-1',
      sensor_type: 'soil_moisture',
      name: 'soil_moisture_123456',
      location_description: 'North field',
      latitude: -1.95,
      longitude: 30.06,
      firmware_version: '1.0.0',
      metadata: { vendor: 'Acme' },
      status: 'active',
    });

    await registerSensor({
      deviceId: 'device-123456',
      farmId: 'farm-1',
      sensorType: 'soil_moisture',
      locationDescription: 'North field',
      latitude: -1.95,
      longitude: 30.06,
      firmwareVersion: '1.0.0',
      metadata: { vendor: 'Acme' },
    });

    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE_SENSOR',
        entity_type: 'sensors',
        entity_id: 'sensor-2',
        new_values: expect.objectContaining({
          device_id: 'device-123456',
          farm_id: 'farm-1',
          sensor_type: 'soil_moisture',
          latitude: -1.95,
          longitude: 30.06,
        }),
      })
    );
  });

  it('normalizes daily aggregates to the camelCase API shape used by the dashboard', async () => {
    mockDb.sensorData.getDailyAggregates.mockResolvedValue([
      {
        farm_id: 'farm-1',
        reading_date: '2026-03-08',
        avg_soil_moisture: 47.5,
        min_soil_moisture: 40,
        max_soil_moisture: 55,
        avg_soil_temperature: 21.8,
        avg_temperature: 24.2,
        avg_humidity: 78,
        avg_nitrogen: 120,
        avg_phosphorus: 34,
        avg_potassium: 150,
        reading_count: 6,
      },
    ]);

    const result = await getDailyAggregates('farm-1', 7);

    expect(result).toEqual([
      {
        farmId: 'farm-1',
        date: '2026-03-08',
        avgSoilMoisture: 47.5,
        minSoilMoisture: 40,
        maxSoilMoisture: 55,
        avgSoilTemperature: 21.8,
        avgTemperature: 24.2,
        avgHumidity: 78,
        avgNitrogen: 120,
        avgPhosphorus: 34,
        avgPotassium: 150,
        readingsCount: 6,
      },
    ]);
  });

  it('builds a merged latest-readings snapshot from recent farm sensor records', async () => {
    mockDb.sensorData.getLatestReadings.mockResolvedValue([
      {
        farm_id: 'farm-1',
        sensor_id: 'sensor-temp',
        reading_timestamp: 3000,
        air_temperature: 25.4,
      },
      {
        farm_id: 'farm-1',
        sensor_id: 'sensor-moisture',
        reading_timestamp: 2500,
        soil_moisture: 53,
      },
      {
        farm_id: 'farm-1',
        sensor_id: 'sensor-humidity',
        reading_timestamp: 2000,
        humidity: 82,
      },
      {
        farm_id: 'farm-1',
        sensor_id: 'sensor-npk',
        reading_timestamp: 1500,
        nitrogen: 110,
        phosphorus: 32,
        potassium: 146,
      },
    ]);

    const result = await getLatestReadings('farm-1');

    expect(mockDb.sensorData.getLatestReadings).toHaveBeenCalledWith('farm-1', 50);
    expect(result).toEqual(
      expect.objectContaining({
        farm_id: 'farm-1',
        reading_timestamp: 3000,
        air_temperature: 25.4,
        soil_moisture: 53,
        humidity: 82,
        nitrogen: 110,
        phosphorus: 32,
        potassium: 146,
        sensor_count: 4,
        contributing_sensor_ids: ['sensor-temp', 'sensor-moisture', 'sensor-humidity', 'sensor-npk'],
      })
    );
  });

  it('skips insertion for readings that contain no environmental measurements', async () => {
    mockDb.sensors.getByDeviceId.mockResolvedValue({
      _id: 'sensor-1',
      farm_id: 'farm-1',
    });
    mockDb.sensorData.getLatestBySensor.mockResolvedValue(null);

    const result = await ingestSensorData('device-1', [
      { timestamp: '2026-03-09T10:00:00.000Z' },
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        total: 1,
        valid: 0,
        invalid: 1,
      })
    );
    expect(mockDb.sensorData.insertBatch).not.toHaveBeenCalled();
    expect(mockDb.sensors.update).not.toHaveBeenCalled();
  });

  it('coerces numeric sensor payload values before insertion and avoids false frozen flags on partial readings', async () => {
    mockDb.sensors.getByDeviceId.mockResolvedValue({
      _id: 'sensor-1',
      farm_id: 'farm-1',
    });
    mockDb.sensorData.getLatestBySensor.mockResolvedValue({
      reading_timestamp: Date.parse('2026-03-09T09:00:00.000Z'),
      nitrogen: 120,
      phosphorus: 30,
      potassium: 140,
    });
    mockDb.sensorData.insertBatch.mockResolvedValue(['reading-1']);
    mockDb.sensors.update.mockResolvedValue({ _id: 'sensor-1' });

    await ingestSensorData('device-1', [
      {
        nitrogen: '120',
        phosphorus: '30',
        potassium: '140',
        timestamp: '2026-03-09T10:00:00.000Z',
      },
    ]);

    expect(mockDb.sensorData.insertBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        nitrogen: 120,
        phosphorus: 30,
        potassium: 140,
        validation_flags: {},
      }),
    ]);
  });

  it('normalizes legacy sensorType payloads and snake_case readings before insertion', async () => {
    mockDb.sensors.getByDeviceId.mockResolvedValue({
      _id: 'sensor-1',
      farm_id: 'farm-1',
    });
    mockDb.sensorData.getLatestBySensor.mockResolvedValue(null);
    mockDb.sensorData.insertBatch.mockResolvedValue(['reading-1', 'reading-2', 'reading-3']);
    mockDb.sensors.update.mockResolvedValue({ _id: 'sensor-1' });

    const result = await ingestSensorData('device-legacy', [
      {
        sensorType: 'soil_moisture',
        value: '47.5',
        timestamp: '2026-03-09T10:00:00.000Z',
      },
      {
        air_temperature: '23.4',
        humidity: '69',
        reading_timestamp: '2026-03-09T10:05:00.000Z',
      },
      {
        sensor_type: 'npk',
        value: {
          n: '120',
          phosphorus: '35',
          k: 210,
        },
        timestamp: '2026-03-09T10:10:00.000Z',
      },
    ]);

    expect(mockDb.sensorData.insertBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        soil_moisture: 47.5,
        reading_timestamp: Date.parse('2026-03-09T10:00:00.000Z'),
      }),
      expect.objectContaining({
        air_temperature: 23.4,
        humidity: 69,
        reading_timestamp: Date.parse('2026-03-09T10:05:00.000Z'),
      }),
      expect.objectContaining({
        nitrogen: 120,
        phosphorus: 35,
        potassium: 210,
        reading_timestamp: Date.parse('2026-03-09T10:10:00.000Z'),
      }),
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        total: 3,
        valid: 3,
        invalid: 0,
      })
    );
  });

  it('normalizes string epoch timestamps from devices before insertion', async () => {
    mockDb.sensors.getByDeviceId.mockResolvedValue({
      _id: 'sensor-1',
      farm_id: 'farm-1',
    });
    mockDb.sensorData.getLatestBySensor.mockResolvedValue(null);
    mockDb.sensorData.insertBatch.mockResolvedValue(['reading-1', 'reading-2']);
    mockDb.sensors.update.mockResolvedValue({ _id: 'sensor-1' });

    await ingestSensorData('device-epoch', [
      {
        soilMoisture: 48,
        timestamp: '1741514400',
      },
      {
        humidity: 72,
        readingTimestamp: '1741514700000',
      },
    ]);

    expect(mockDb.sensorData.insertBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        soil_moisture: 48,
        reading_timestamp: 1741514400 * 1000,
      }),
      expect.objectContaining({
        humidity: 72,
        reading_timestamp: 1741514700000,
      }),
    ]);
    expect(mockDb.sensors.update).toHaveBeenCalledWith('sensor-1', {
      last_reading_at: 1741514700000,
    });
  });

  it('writes an audit log when sensor readings are stored in the database', async () => {
    mockDb.sensors.getByDeviceId.mockResolvedValue({
      _id: 'sensor-1',
      farm_id: 'farm-1',
    });
    mockDb.sensorData.getLatestBySensor.mockResolvedValue(null);
    mockDb.sensorData.insertBatch.mockResolvedValue(['reading-1', 'reading-2']);
    mockDb.sensors.update.mockResolvedValue({ _id: 'sensor-1' });

    await ingestSensorData('device-audit', [
      {
        soilMoisture: 48,
        timestamp: '2026-03-09T10:00:00.000Z',
      },
      {
        humidity: 72,
        timestamp: '2026-03-09T10:05:00.000Z',
      },
    ]);

    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INGEST_SENSOR_DATA',
        entity_type: 'sensor_data',
        entity_id: 'sensor-1',
        new_values: expect.objectContaining({
          device_id: 'device-audit',
          sensor_id: 'sensor-1',
          farm_id: 'farm-1',
          received: 2,
          processed: 2,
          invalid: 0,
          duplicates: 0,
          inserted: 2,
          last_reading_at: Date.parse('2026-03-09T10:05:00.000Z'),
        }),
        created_at: expect.any(Number),
      })
    );
  });

  it('does not update sensor storage metadata when the batch write persists no readings', async () => {
    mockDb.sensors.getByDeviceId.mockResolvedValue({
      _id: 'sensor-1',
      farm_id: 'farm-1',
    });
    mockDb.sensorData.getLatestBySensor.mockResolvedValue(null);
    mockDb.sensorData.insertBatch.mockResolvedValue([]);

    const result = await ingestSensorData('device-audit', [
      {
        soilMoisture: 48,
        timestamp: '2026-03-09T10:00:00.000Z',
      },
    ]);

    expect(result.inserted).toEqual([]);
    expect(mockDb.sensors.update).not.toHaveBeenCalled();
    expect(mockDb.auditLogs.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INGEST_SENSOR_DATA',
        entity_id: 'sensor-1',
      })
    );
  });
});
