import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  recommendations: {
    getStats: jest.fn(),
  },
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

await jest.unstable_mockModule('../src/config/index.js', () => ({
  default: {
    ai: {
      recommendationGenerationConcurrency: 2,
    },
  },
}));

await jest.unstable_mockModule('../src/services/notificationService.js', () => ({
  sendRecommendationNotification: jest.fn(),
}));

const recommendationService = await import('../src/services/recommendationService.js');

describe('recommendation statistics aggregation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns aggregated recommendation response stats including channels', async () => {
    mockDb.recommendations.getStats.mockResolvedValue([
      {
        type: 'irrigation',
        status: 'executed',
        priority: 'high',
        created_at: 1741478400000,
        responded_at: 1741482000000,
        response_channel: 'web',
      },
      {
        type: 'pest_alert',
        status: 'rejected',
        priority: 'critical',
        created_at: 1741564800000,
        responded_at: 1741572000000,
        response_channel: 'ussd',
      },
      {
        type: 'fertilization',
        status: 'pending',
        priority: 'medium',
        created_at: 1741651200000,
        responded_at: undefined,
        response_channel: undefined,
      },
    ]);

    const result = await recommendationService.getRecommendationStats({
      farmId: 'farm-1',
      startDate: '2025-03-09T00:00:00.000Z',
      endDate: '2025-03-11T00:00:00.000Z',
    });

    expect(mockDb.recommendations.getStats).toHaveBeenCalledWith({
      farmId: 'farm-1',
      since: Date.parse('2025-03-09T00:00:00.000Z'),
      until: Date.parse('2025-03-11T00:00:00.000Z'),
    });

    expect(result).toEqual(
      expect.objectContaining({
        total: 3,
        byType: {
          irrigation: 1,
          pest_alert: 1,
          fertilization: 1,
        },
        byStatus: {
          executed: 1,
          rejected: 1,
          pending: 1,
        },
        byPriority: {
          high: 1,
          critical: 1,
          medium: 1,
        },
        byChannel: {
          web: 1,
          ussd: 1,
        },
        avgResponseTime: 2,
        averageResponseTime: 2,
      })
    );

    expect(result.responseRate).toBeCloseTo(66.666, 2);
    expect(result.acceptanceRate).toBeCloseTo(33.333, 2);
  });
});
