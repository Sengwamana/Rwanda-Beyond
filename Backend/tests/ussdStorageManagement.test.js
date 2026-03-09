import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  users: {
    getByPhone: jest.fn(),
    update: jest.fn(),
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

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
}));

const { handleUssdRequest } = await import('../src/services/ussdService.js');

describe('ussd storage management audit coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes an audit log when a user updates profile language through USSD', async () => {
    mockDb.users.getByPhone.mockResolvedValue({
      _id: 'user-1',
      first_name: 'Aline',
      preferred_language: 'rw',
    });
    mockDb.users.update.mockResolvedValue({
      _id: 'user-1',
      preferred_language: 'en',
    });
    mockDb.auditLogs.create.mockResolvedValue(null);

    const response = await handleUssdRequest({
      sessionId: 'session-1',
      phoneNumber: '+250788000001',
      text: '5*1*1',
      language: 'rw',
    });

    expect(response).toContain('Language updated to English');
    expect(mockDb.users.update).toHaveBeenCalledWith('user-1', { preferred_language: 'en' });
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        action: 'UPDATE_USER_LANGUAGE',
        entity_type: 'users',
        entity_id: 'user-1',
        old_values: { preferred_language: 'rw' },
        new_values: { preferred_language: 'en', channel: 'ussd' },
      })
    );
  });

  it('returns the USSD error response when the user disappears before language persistence', async () => {
    mockDb.users.getByPhone.mockResolvedValue({
      _id: 'user-1',
      first_name: 'Aline',
      preferred_language: 'rw',
    });
    mockDb.users.update.mockResolvedValue(null);

    const response = await handleUssdRequest({
      sessionId: 'session-1',
      phoneNumber: '+250788000001',
      text: '5*1*1',
      language: 'rw',
    });

    expect(response).toMatch(/^END /);
    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });
});
