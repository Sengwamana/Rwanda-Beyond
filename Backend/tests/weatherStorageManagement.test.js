import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockAxiosGet = jest.fn();

const mockDb = {
  auditLogs: {
    create: jest.fn(),
  },
  weatherData: {
    upsert: jest.fn(),
  },
  farms: {
    getById: jest.fn(),
  },
  districts: {
    listWithCoordinates: jest.fn(),
  },
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

await jest.unstable_mockModule('axios', () => ({
  default: {
    get: mockAxiosGet,
  },
}));

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/config/index.js', () => ({
  default: {
    weather: {
      baseUrl: 'https://weather.example.test',
      apiKey: 'test-weather-key',
      cacheTtl: 1800,
    },
  },
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
}));

const weatherService = await import('../src/services/weatherService.js');

describe('weather storage management fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    weatherService.clearWeatherCache();
  });

  it('stores historical weather records using latitude and longitude fields', async () => {
    mockDb.weatherData.upsert.mockResolvedValue(null);
    mockDb.auditLogs.create.mockResolvedValue(null);

    await weatherService.storeWeatherData('district-1', -1.95, 30.06, [
      {
        date: '2026-03-09',
        temperatureAvg: 24,
        humidityAvg: 71,
        precipitationProbability: 60,
        rainMm: 3.5,
        condition: 'Rain',
        windSpeedAvg: 4.2,
      },
    ]);

    expect(mockDb.weatherData.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        district_id: 'district-1',
        latitude: -1.95,
        longitude: 30.06,
        forecast_date: '2026-03-09',
      }),
    ]);
    expect(mockDb.weatherData.upsert.mock.calls[0][0][0]).not.toHaveProperty('coordinates');
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPSERT_WEATHER_DATA',
        entity_type: 'weather_data',
        entity_id: 'district-1',
        new_values: expect.objectContaining({
          district_id: 'district-1',
          latitude: -1.95,
          longitude: 30.06,
          record_count: 1,
          forecast_dates: ['2026-03-09'],
          source: 'openweathermap',
        }),
        created_at: expect.any(Number),
      })
    );
  });

  it('uses stored farm latitude and longitude when fetching and storing farm weather', async () => {
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      district_id: 'district-1',
      latitude: -2.10,
      longitude: 30.55,
    });
    mockDb.weatherData.upsert.mockResolvedValue(null);
    mockAxiosGet
      .mockResolvedValueOnce({
        data: {
          main: {
            temp: 25,
            feels_like: 26,
            humidity: 70,
            pressure: 1012,
          },
          wind: { speed: 4, deg: 180 },
          weather: [{ main: 'Clouds', description: 'scattered clouds' }],
          clouds: { all: 40 },
          visibility: 10000,
        },
      })
      .mockResolvedValueOnce({
        data: {
          list: [
            {
              dt_txt: '2026-03-09 09:00:00',
              main: { temp: 24, humidity: 68 },
              pop: 0.2,
              weather: [{ main: 'Clouds' }],
              wind: { speed: 3.5 },
              rain: { '3h': 0.8 },
            },
            {
              dt_txt: '2026-03-09 12:00:00',
              main: { temp: 26, humidity: 72 },
              pop: 0.5,
              weather: [{ main: 'Rain' }],
              wind: { speed: 4.5 },
              rain: { '3h': 1.2 },
            },
          ],
        },
      });

    const result = await weatherService.getWeatherForFarm('farm-1', 1);

    expect(mockAxiosGet).toHaveBeenNthCalledWith(
      1,
      'https://weather.example.test/weather',
      expect.objectContaining({
        params: expect.objectContaining({
          lat: -2.10,
          lon: 30.55,
        }),
      })
    );
    expect(mockAxiosGet).toHaveBeenNthCalledWith(
      2,
      'https://weather.example.test/forecast',
      expect.objectContaining({
        params: expect.objectContaining({
          lat: -2.10,
          lon: 30.55,
        }),
      })
    );
    expect(mockDb.weatherData.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        district_id: 'district-1',
        latitude: -2.10,
        longitude: 30.55,
      }),
    ]);
    expect(result.location).toEqual({ lat: -2.10, lon: 30.55 });
  });
});
