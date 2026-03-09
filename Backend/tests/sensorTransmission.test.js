import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import crypto from 'crypto';

const mockDb = {
  sensors: {
    getDeviceInfo: jest.fn(),
    getByDeviceId: jest.fn(),
    update: jest.fn(),
  },
  iotDeviceTokens: {
    create: jest.fn(),
    verify: jest.fn(),
    updateLastUsed: jest.fn(),
    revoke: jest.fn(),
  },
  sensorData: {
    getLatestBySensor: jest.fn(),
    insertBatch: jest.fn(),
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
    iot: {
      deviceSecret: 'test-secret',
      tokenLastUsedWriteIntervalMs: 300000,
      maxBatchReadings: 500,
    },
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
  authenticateDevice,
  generateDeviceToken,
  revokeDeviceToken,
} = await import('../src/middleware/deviceAuth.js');
const { validateSensorData } = await import('../src/middleware/validation.js');
const { ingestSensorData } = await import('../src/services/sensorService.js');

const runMiddlewareStack = async (middlewares, req) => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  for (const middleware of middlewares.slice(0, -1)) {
    await middleware(req, res, () => {});
  }

  await middlewares[middlewares.length - 1](req, res, () => {});

  return res;
};

describe('sensor transmission module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects malformed HMAC signatures without throwing', async () => {
    const req = {
      headers: {
        'x-device-id': 'device-1',
        'x-hmac-signature': 'bad',
        'x-timestamp': String(Math.floor(Date.now() / 1000)),
      },
      body: { readings: [{ soilMoisture: 42 }] },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await authenticateDevice(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockDb.sensors.getDeviceInfo).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'DEVICE_AUTH_ERROR',
      })
    );
  });

  it('accepts valid HMAC signatures with millisecond timestamps', async () => {
    mockDb.sensors.getDeviceInfo.mockResolvedValue({
      id: 'sensor-1',
      farm_id: 'farm-1',
      status: 'active',
    });

    const timestamp = String(Date.now());
    const body = { readings: [{ soilMoisture: 42 }] };
    const payload = JSON.stringify(body);
    const signature = crypto
      .createHmac('sha256', 'test-secret')
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    const req = {
      headers: {
        'x-device-id': 'device-1',
        'x-hmac-signature': signature,
        'x-timestamp': timestamp,
      },
      body,
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await authenticateDevice(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.device).toEqual({
      id: 'device-1',
      sensorId: 'sensor-1',
      farmId: 'farm-1',
    });
  });

  it('rejects invalid tokens without loading device info', async () => {
    mockDb.iotDeviceTokens.verify.mockResolvedValue(null);

    const req = {
      headers: {
        'x-device-id': 'device-1',
        'x-device-token': 'token-abc',
      },
      body: { readings: [{ soilMoisture: 41 }] },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await authenticateDevice(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockDb.sensors.getDeviceInfo).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('avoids token last-used writes on every transmission request', async () => {
    mockDb.sensors.getDeviceInfo.mockResolvedValue({
      id: 'sensor-1',
      farm_id: 'farm-1',
      status: 'active',
    });
    mockDb.iotDeviceTokens.verify.mockResolvedValue({
      _id: 'token-1',
      last_used_at: Date.now(),
    });

    const req = {
      headers: {
        'x-device-id': 'device-1',
        'x-device-token': 'token-abc',
      },
      body: { readings: [{ soilMoisture: 44 }] },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await authenticateDevice(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockDb.iotDeviceTokens.updateLastUsed).not.toHaveBeenCalled();
    expect(req.device).toEqual({
      id: 'device-1',
      sensorId: 'sensor-1',
      farmId: 'farm-1',
    });
  });

  it('does not fail transmission auth when token last-used bookkeeping fails', async () => {
    mockDb.sensors.getDeviceInfo.mockResolvedValue({
      id: 'sensor-1',
      farm_id: 'farm-1',
      status: 'active',
    });
    mockDb.iotDeviceTokens.verify.mockResolvedValue({
      _id: 'token-1',
      last_used_at: 0,
    });
    mockDb.iotDeviceTokens.updateLastUsed.mockRejectedValue(new Error('write failed'));

    const req = {
      headers: {
        'x-device-id': 'device-1',
        'x-device-token': 'token-abc',
      },
      body: { readings: [{ soilMoisture: 44 }] },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await authenticateDevice(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(mockDb.sensors.getDeviceInfo).toHaveBeenCalledWith('device-1');
  });

  it('accepts device tokens from the Authorization bearer header', async () => {
    mockDb.sensors.getDeviceInfo.mockResolvedValue({
      id: 'sensor-1',
      farm_id: 'farm-1',
      status: 'active',
    });
    mockDb.iotDeviceTokens.verify.mockResolvedValue({
      _id: 'token-1',
      last_used_at: Date.now(),
    });

    const req = {
      headers: {
        'x-device-id': 'device-1',
        authorization: 'Bearer token-abc',
      },
      body: { readings: [{ soilMoisture: 44 }] },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await authenticateDevice(req, res, next);

    expect(mockDb.iotDeviceTokens.verify).toHaveBeenCalledWith('device-1', expect.any(String));
    expect(next).toHaveBeenCalled();
    expect(req.device).toEqual({
      id: 'device-1',
      sensorId: 'sensor-1',
      farmId: 'farm-1',
    });
  });

  it('accepts lowercase bearer authorization headers for device tokens', async () => {
    mockDb.sensors.getDeviceInfo.mockResolvedValue({
      id: 'sensor-1',
      farm_id: 'farm-1',
      status: 'active',
    });
    mockDb.iotDeviceTokens.verify.mockResolvedValue({
      _id: 'token-1',
      last_used_at: Date.now(),
    });

    const req = {
      headers: {
        'x-device-id': 'device-1',
        authorization: 'bearer token-abc',
      },
      body: { readings: [{ soilMoisture: 44 }] },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await authenticateDevice(req, res, next);

    expect(mockDb.iotDeviceTokens.verify).toHaveBeenCalledWith('device-1', expect.any(String));
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('reuses device auth context during ingest to skip a duplicate sensor lookup', async () => {
    mockDb.sensorData.getLatestBySensor.mockResolvedValue(null);
    mockDb.sensorData.insertBatch.mockResolvedValue(['reading-1']);
    mockDb.sensors.update.mockResolvedValue({ id: 'sensor-1' });

    const result = await ingestSensorData(
      {
        id: 'device-1',
        sensorId: 'sensor-1',
        farmId: 'farm-1',
      },
      [
        {
          soilMoisture: 51,
          airTemperature: 24,
          humidity: 78,
          timestamp: '2026-03-08T10:00:00.000Z',
        },
      ]
    );

    expect(mockDb.sensors.getByDeviceId).not.toHaveBeenCalled();
    expect(mockDb.sensorData.getLatestBySensor).toHaveBeenCalledWith('sensor-1');
    expect(mockDb.sensorData.insertBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          sensor_id: 'sensor-1',
          farm_id: 'farm-1',
        }),
      ])
    );
    expect(result).toEqual(
      expect.objectContaining({
        received: 1,
        total: 1,
        processed: 1,
        valid: 1,
        failed: 0,
        invalid: 0,
      })
    );
  });

  it('sorts recovery batches by reading timestamp and updates the sensor with the newest transmitted reading time', async () => {
    mockDb.sensorData.getLatestBySensor.mockResolvedValue({
      reading_timestamp: Date.parse('2026-03-08T08:00:00.000Z'),
      soil_moisture: 45,
      air_temperature: 22,
      humidity: 70,
    });
    mockDb.sensorData.insertBatch.mockResolvedValue(['reading-1', 'reading-2']);
    mockDb.sensors.update.mockResolvedValue({ id: 'sensor-1' });

    await ingestSensorData(
      {
        id: 'device-1',
        sensorId: 'sensor-1',
        farmId: 'farm-1',
      },
      [
        {
          soilMoisture: 54,
          airTemperature: 25,
          humidity: 80,
          timestamp: '2026-03-08T10:30:00.000Z',
        },
        {
          soilMoisture: 50,
          airTemperature: 23,
          humidity: 75,
          timestamp: '2026-03-08T09:00:00.000Z',
        },
      ]
    );

    expect(mockDb.sensorData.insertBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        reading_timestamp: Date.parse('2026-03-08T09:00:00.000Z'),
        soil_moisture: 50,
      }),
      expect.objectContaining({
        reading_timestamp: Date.parse('2026-03-08T10:30:00.000Z'),
        soil_moisture: 54,
      }),
    ]);
    expect(mockDb.sensors.update).toHaveBeenCalledWith('sensor-1', {
      last_reading_at: Date.parse('2026-03-08T10:30:00.000Z'),
    });
  });

  it('skips retransmitted readings that exactly match the latest stored device reading', async () => {
    mockDb.sensorData.getLatestBySensor.mockResolvedValue({
      reading_timestamp: Date.parse('2026-03-08T10:00:00.000Z'),
      soil_moisture: 54,
      air_temperature: 25,
      humidity: 80,
    });
    mockDb.sensorData.insertBatch.mockResolvedValue([]);

    const result = await ingestSensorData(
      {
        id: 'device-1',
        sensorId: 'sensor-1',
        farmId: 'farm-1',
      },
      [
        {
          soilMoisture: 54,
          airTemperature: 25,
          humidity: 80,
          timestamp: '2026-03-08T10:00:00.000Z',
        },
      ]
    );

    expect(mockDb.sensorData.insertBatch).not.toHaveBeenCalled();
    expect(mockDb.sensors.update).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        received: 1,
        total: 1,
        processed: 1,
        valid: 1,
        failed: 0,
        invalid: 0,
        duplicates: 1,
      })
    );
  });

  it('skips duplicate readings repeated inside the same recovery batch', async () => {
    mockDb.sensorData.getLatestBySensor.mockResolvedValue(null);
    mockDb.sensorData.insertBatch.mockResolvedValue(['reading-1']);
    mockDb.sensors.update.mockResolvedValue({ id: 'sensor-1' });

    const result = await ingestSensorData(
      {
        id: 'device-1',
        sensorId: 'sensor-1',
        farmId: 'farm-1',
      },
      [
        {
          soilMoisture: 50,
          airTemperature: 23,
          humidity: 75,
          timestamp: '2026-03-08T09:00:00.000Z',
        },
        {
          soilMoisture: 50,
          airTemperature: 23,
          humidity: 75,
          timestamp: '2026-03-08T09:00:00.000Z',
        },
      ]
    );

    expect(mockDb.sensorData.insertBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        reading_timestamp: Date.parse('2026-03-08T09:00:00.000Z'),
        soil_moisture: 50,
      }),
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        received: 2,
        total: 2,
        processed: 2,
        valid: 2,
        failed: 0,
        invalid: 0,
        duplicates: 1,
      })
    );
  });

  it('does not fail data transmission when sensor heartbeat update fails after insert', async () => {
    mockDb.sensorData.getLatestBySensor.mockResolvedValue(null);
    mockDb.sensorData.insertBatch.mockResolvedValue(['reading-1']);
    mockDb.sensors.update.mockRejectedValue(new Error('update failed'));

    const result = await ingestSensorData(
      {
        id: 'device-1',
        sensorId: 'sensor-1',
        farmId: 'farm-1',
      },
      [
        {
          soilMoisture: 51,
          airTemperature: 24,
          humidity: 78,
          timestamp: '2026-03-08T10:00:00.000Z',
        },
      ]
    );

    expect(mockDb.sensorData.insertBatch).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        received: 1,
        total: 1,
        processed: 1,
        valid: 1,
        failed: 0,
        invalid: 0,
        duplicates: 0,
        inserted: ['reading-1'],
      })
    );
  });

  it('stores generated token expiry as a timestamp', async () => {
    await generateDeviceToken('device-1');

    expect(mockDb.iotDeviceTokens.create).toHaveBeenCalledWith(
      expect.objectContaining({
        device_id: 'device-1',
        token_hash: expect.any(String),
        expires_at: expect.any(Number),
      })
    );
  });

  it('reuses hashed token revocation without extra lookups', async () => {
    await revokeDeviceToken('device-1', 'token-abc');

    expect(mockDb.iotDeviceTokens.revoke).toHaveBeenCalledWith(
      'device-1',
      expect.any(String)
    );
  });

  it('accepts numeric reading timestamps at the request validation layer', async () => {
    const res = await runMiddlewareStack(validateSensorData, {
      body: {
        readings: [
          {
            soilMoisture: 42,
            humidity: 71,
            timestamp: Date.parse('2026-03-09T10:00:00.000Z'),
          },
        ],
      },
    });

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('accepts string epoch timestamps at the request validation layer', async () => {
    const res = await runMiddlewareStack(validateSensorData, {
      body: {
        readings: [
          {
            soilMoisture: 42,
            timestamp: '1741514400',
          },
          {
            humidity: 71,
            readingTimestamp: '1741514700000',
          },
        ],
      },
    });

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('accepts legacy sensorType/value payloads at the request validation layer', async () => {
    const res = await runMiddlewareStack(validateSensorData, {
      body: {
        readings: [
          {
            sensorType: 'soil_moisture',
            value: 42,
            timestamp: '2026-03-09T10:00:00.000Z',
          },
          {
            sensor_type: 'npk',
            value: {
              nitrogen: 120,
              p: 30,
              potassium: 180,
            },
            timestamp: Date.parse('2026-03-09T10:05:00.000Z'),
          },
        ],
      },
    });

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('accepts snake_case sensor readings at the request validation layer', async () => {
    const res = await runMiddlewareStack(validateSensorData, {
      body: {
        readings: [
          {
            soil_moisture: 46,
            air_temperature: 23,
            humidity: 70,
            reading_timestamp: '2026-03-09T10:00:00.000Z',
          },
        ],
      },
    });

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('rejects invalid reading_timestamp aliases at the request validation layer', async () => {
    const res = await runMiddlewareStack(validateSensorData, {
      body: {
        readings: [
          {
            soil_moisture: 46,
            reading_timestamp: 'not-a-date',
          },
        ],
      },
    });

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: 'readings[0]',
            message: 'Timestamp must be a valid reading timestamp',
          }),
        ]),
      })
    );
  });

  it('rejects readings that omit all environmental measurements at the request validation layer', async () => {
    const res = await runMiddlewareStack(validateSensorData, {
      body: {
        readings: [
          {
            timestamp: '2026-03-09T10:00:00.000Z',
          },
        ],
      },
    });

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'VALIDATION_ERROR',
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: 'readings[0]',
            message: 'Each reading must include at least one environmental measurement',
          }),
        ]),
      })
    );
  });
});
