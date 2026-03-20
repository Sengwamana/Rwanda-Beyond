import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  users: {
    getByPhone: jest.fn(),
  },
  farms: {
    getByUser: jest.fn(),
  },
  auditLogs: {
    create: jest.fn(),
  },
};

const mockRecommendationService = {
  getPendingRecommendations: jest.fn(),
  respondToRecommendation: jest.fn(),
};

const mockSensorService = {
  getLatestReadings: jest.fn(),
};

const mockWeatherService = {
  getWeatherForFarm: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/services/recommendationService.js', () => ({
  default: mockRecommendationService,
  ...mockRecommendationService,
}));

await jest.unstable_mockModule('../src/services/sensorService.js', () => ({
  default: mockSensorService,
  ...mockSensorService,
}));

await jest.unstable_mockModule('../src/services/weatherService.js', () => ({
  default: mockWeatherService,
  ...mockWeatherService,
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
}));

const { handleUssdRequest } = await import('../src/services/ussdService.js');

describe('ussd live weather integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses live weather data for the weather menu', async () => {
    mockDb.users.getByPhone.mockResolvedValue({
      _id: 'user-1',
      first_name: 'Aline',
      preferred_language: 'en',
    });
    mockDb.farms.getByUser.mockResolvedValue({
      data: [
        {
          _id: 'farm-1',
          name: 'Nyagatare Demo Farm',
          location_name: 'Nyagatare',
        },
      ],
    });
    mockWeatherService.getWeatherForFarm.mockResolvedValue({
      current: {
        temperature: 24.2,
        humidity: 71,
        condition: 'Clouds',
      },
      forecast: [
        {
          temperatureMin: 18.4,
          temperatureMax: 27.6,
          precipitationProbability: 62,
          condition: 'Rain',
        },
      ],
    });

    const response = await handleUssdRequest({
      sessionId: 'session-weather-1',
      phoneNumber: '+250788000001',
      text: '3',
      language: 'en',
    });

    expect(mockWeatherService.getWeatherForFarm).toHaveBeenCalledWith('farm-1', 2);
    expect(response).toMatch(/^CON /);
    expect(response).toContain('Weather for Nyagatare');
    expect(response).toContain('Now: 24C Clouds');
    expect(response).toContain('Humidity: 71%');
    expect(response).toContain('Tomorrow: 18C-28C Rain');
    expect(response).toContain('Rain Chance: 62%');
  });

  it('falls back gracefully when live weather fetch fails', async () => {
    mockDb.users.getByPhone.mockResolvedValue({
      _id: 'user-1',
      first_name: 'Aline',
      preferred_language: 'en',
    });
    mockDb.farms.getByUser.mockResolvedValue({
      data: [
        {
          _id: 'farm-1',
          name: 'Nyagatare Demo Farm',
          location_name: 'Nyagatare',
        },
      ],
    });
    mockWeatherService.getWeatherForFarm.mockRejectedValue(new Error('Weather service unavailable'));

    const response = await handleUssdRequest({
      sessionId: 'session-weather-2',
      phoneNumber: '+250788000001',
      text: '3',
      language: 'en',
    });

    expect(response).toMatch(/^CON /);
    expect(response).toContain('Weather for Nyagatare');
    expect(response).toContain('Unavailable right now');
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
