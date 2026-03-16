import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  auditLogs: {
    create: jest.fn(),
  },
  recommendations: {
    create: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
  },
  irrigationSchedules: {
    update: jest.fn(),
  },
  fertilizationSchedules: {
    update: jest.fn(),
  },
  farms: {
    getById: jest.fn(),
    list: jest.fn(),
    listActive: jest.fn(),
  },
  users: {
    getById: jest.fn(),
  },
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockNotificationService = {
  sendRecommendationNotification: jest.fn(),
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
}));

await jest.unstable_mockModule('../src/config/index.js', () => ({
  default: {
    ai: {
      recommendationGenerationConcurrency: 2,
    },
  },
}));

await jest.unstable_mockModule('../src/services/notificationService.js', () => mockNotificationService);

const recommendationService = await import('../src/services/recommendationService.js');

describe('recommendation action logging implementation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes an audit log when creating a recommendation', async () => {
    mockDb.recommendations.create.mockResolvedValue({
      _id: 'rec-1',
      farm_id: 'farm-1',
      user_id: 'user-1',
      type: 'irrigation',
      priority: 'high',
      status: 'pending',
      title: 'Irrigation Needed',
      recommended_action: 'Irrigate in the evening',
    });

    const result = await recommendationService.createRecommendation({
      farmId: 'farm-1',
      userId: 'user-1',
      type: 'irrigation',
      priority: 'high',
      title: 'Irrigation Needed',
      description: 'Soil moisture is low',
      recommendedAction: 'Irrigate in the evening',
      resolvedFarm: { _id: 'farm-1', name: 'Demo Farm' },
      resolvedUser: { _id: 'user-1', phone_number: '+250788000001', preferred_language: 'en' },
    });

    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        action: 'CREATE_RECOMMENDATION',
        entity_type: 'recommendations',
        entity_id: 'rec-1',
        new_values: expect.objectContaining({
          farm_id: 'farm-1',
          user_id: 'user-1',
          type: 'irrigation',
          status: 'pending',
          title: 'Irrigation Needed',
        }),
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        _id: 'rec-1',
        farm: { id: 'farm-1', name: 'Demo Farm' },
      })
    );
  });

  it('still creates a recommendation when audit logging fails', async () => {
    mockDb.recommendations.create.mockResolvedValue({
      _id: 'rec-2',
      farm_id: 'farm-2',
      user_id: 'user-2',
      type: 'pest_alert',
      priority: 'critical',
      status: 'pending',
      title: 'Pest Alert',
    });
    mockDb.auditLogs.create.mockRejectedValue(new Error('audit unavailable'));

    const result = await recommendationService.createRecommendation({
      farmId: 'farm-2',
      userId: 'user-2',
      type: 'pest_alert',
      title: 'Pest Alert',
      description: 'Preliminary AI screening detected FAW',
      recommendedAction: 'Check the field immediately',
      resolvedFarm: { _id: 'farm-2', name: 'North Plot' },
      resolvedUser: { _id: 'user-2', phone_number: null, preferred_language: 'rw' },
    });

    expect(result).toEqual(expect.objectContaining({ _id: 'rec-2' }));
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Failed to write recommendation audit log:',
      'audit unavailable'
    );
  });

  it('logs farmer responses and returns the final executed status for auto-executing recommendation types', async () => {
    mockDb.recommendations.getById.mockResolvedValue({
      _id: 'rec-3',
      user_id: 'user-3',
      type: 'general',
      status: 'pending',
    });
    mockDb.recommendations.update
      .mockResolvedValueOnce({
        _id: 'rec-3',
        user_id: 'user-3',
        type: 'general',
        status: 'accepted',
        responded_at: 1700000000000,
        response_notes: 'Proceed now',
      })
      .mockResolvedValueOnce({
        _id: 'rec-3',
        user_id: 'user-3',
        type: 'general',
        status: 'executed',
        responded_at: 1700000000000,
        response_notes: 'Proceed now',
      });

    const result = await recommendationService.respondToRecommendation('rec-3', 'accept', {
      respondedBy: 'farmer-3',
      reason: 'Proceed now',
      channel: 'ussd',
    });

    expect(mockDb.recommendations.update).toHaveBeenNthCalledWith(
      1,
      'rec-3',
      expect.objectContaining({
        status: 'accepted',
        responded_by: 'farmer-3',
        response_channel: 'ussd',
        response_notes: 'Proceed now',
        responded_at: expect.any(Number),
      })
    );
    expect(mockDb.recommendations.update).toHaveBeenNthCalledWith(
      2,
      'rec-3',
      { status: 'executed' }
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: 'executed',
      })
    );

    const auditActions = mockDb.auditLogs.create.mock.calls.map(([entry]) => entry.action);
    expect(auditActions).toContain('RESPOND_RECOMMENDATION');
    expect(auditActions).toContain('EXECUTE_RECOMMENDATION');
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'farmer-3',
        action: 'RESPOND_RECOMMENDATION',
        entity_type: 'recommendations',
        entity_id: 'rec-3',
        new_values: expect.objectContaining({
          status: 'executed',
          requested_status: 'accepted',
          responded_by: 'farmer-3',
          channel: 'ussd',
          response_channel: 'ussd',
        }),
      })
    );
  });

  it('keeps irrigation recommendations in accepted state until the schedule is executed', async () => {
    mockDb.recommendations.getById.mockResolvedValue({
      _id: 'rec-5',
      user_id: 'user-5',
      type: 'irrigation',
      status: 'pending',
      irrigation_schedule_id: 'irr-5',
    });
    mockDb.recommendations.update.mockResolvedValue({
      _id: 'rec-5',
      user_id: 'user-5',
      type: 'irrigation',
      status: 'accepted',
      irrigation_schedule_id: 'irr-5',
      responded_at: 1700000000000,
      response_channel: 'web',
    });

    const result = await recommendationService.respondToRecommendation('rec-5', 'accept', {
      respondedBy: 'farmer-5',
      channel: 'web',
    });

    expect(mockDb.recommendations.update).toHaveBeenCalledTimes(1);
    expect(mockDb.recommendations.update).toHaveBeenCalledWith(
      'rec-5',
      expect.objectContaining({
        status: 'accepted',
        responded_by: 'farmer-5',
        response_channel: 'web',
      })
    );
    expect(mockDb.irrigationSchedules.update).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        status: 'accepted',
        irrigation_schedule_id: 'irr-5',
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RESPOND_RECOMMENDATION',
        entity_id: 'rec-5',
        new_values: expect.objectContaining({
          status: 'accepted',
          requested_status: 'accepted',
          responded_by: 'farmer-5',
          response_channel: 'web',
        }),
      })
    );
  });

  it('keeps pest alert recommendations in accepted state until the control action is executed', async () => {
    mockDb.recommendations.getById.mockResolvedValue({
      _id: 'rec-6',
      user_id: 'user-6',
      type: 'pest_alert',
      status: 'pending',
      pest_detection_id: 'detection-6',
    });
    mockDb.recommendations.update.mockResolvedValue({
      _id: 'rec-6',
      user_id: 'user-6',
      type: 'pest_alert',
      status: 'accepted',
      pest_detection_id: 'detection-6',
      responded_at: 1700000001000,
      response_channel: 'web',
    });

    const result = await recommendationService.respondToRecommendation('rec-6', 'accept', {
      respondedBy: 'farmer-6',
      channel: 'web',
    });

    expect(mockDb.recommendations.update).toHaveBeenCalledTimes(1);
    expect(mockDb.recommendations.update).toHaveBeenCalledWith(
      'rec-6',
      expect.objectContaining({
        status: 'accepted',
        responded_by: 'farmer-6',
        response_channel: 'web',
      })
    );
    expect(mockDb.irrigationSchedules.update).not.toHaveBeenCalled();
    expect(mockDb.fertilizationSchedules.update).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        status: 'accepted',
        pest_detection_id: 'detection-6',
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RESPOND_RECOMMENDATION',
        entity_id: 'rec-6',
        new_values: expect.objectContaining({
          status: 'accepted',
          requested_status: 'accepted',
          responded_by: 'farmer-6',
          response_channel: 'web',
        }),
      })
    );
  });

  it('creates a manual expert recommendation for the farm owner and logs the expert actor', async () => {
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-9',
      user_id: 'farmer-9',
      name: 'West Block',
    });
    mockDb.users.getById
      .mockResolvedValueOnce({
        _id: 'farmer-9',
        phone_number: '+250788000009',
        preferred_language: 'en',
      })
      .mockResolvedValueOnce({
        _id: 'expert-9',
        first_name: 'Alice',
        last_name: 'Uwase',
        role: 'expert',
      });
    mockDb.recommendations.create.mockResolvedValue({
      _id: 'rec-manual-1',
      farm_id: 'farm-9',
      user_id: 'farmer-9',
      type: 'general',
      priority: 'high',
      status: 'pending',
      title: 'Scout the western rows',
      description: 'Inspect the western side for nutrient stress.',
      recommended_action: 'Walk the western rows and record stressed plants.',
      supporting_data: {
        source: 'expert_manual',
        createdBy: 'expert-9',
      },
    });

    const result = await recommendationService.createManualRecommendation({
      farmId: 'farm-9',
      type: 'general',
      priority: 'high',
      title: 'Scout the western rows',
      description: 'Inspect the western side for nutrient stress.',
      actionRequired: 'Walk the western rows and record stressed plants.',
      createdBy: 'expert-9',
    });

    expect(mockDb.recommendations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        farm_id: 'farm-9',
        user_id: 'farmer-9',
        type: 'general',
        priority: 'high',
        title: 'Scout the western rows',
        description: 'Inspect the western side for nutrient stress.',
        recommended_action: 'Walk the western rows and record stressed plants.',
        supporting_data: expect.objectContaining({
          source: 'expert_manual',
          createdBy: 'expert-9',
          creatorRole: 'expert',
        }),
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'expert-9',
        action: 'CREATE_MANUAL_RECOMMENDATION',
        entity_type: 'recommendations',
        entity_id: 'rec-manual-1',
        new_values: expect.objectContaining({
          title: 'Scout the western rows',
          created_by: 'expert-9',
        }),
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        _id: 'rec-manual-1',
        user_id: 'farmer-9',
      })
    );
  });

  it('logs recommendation completion details', async () => {
    mockDb.recommendations.getById.mockResolvedValue({
      _id: 'rec-4',
      user_id: 'user-4',
      status: 'accepted',
      response_notes: 'Will apply later',
    });
    mockDb.recommendations.update.mockResolvedValue({
      _id: 'rec-4',
      user_id: 'user-4',
      status: 'executed',
      response_notes: 'Applied successfully',
      completed_at: 1700000001000,
      completed_by: 'farmer-4',
      outcome: 'completed',
    });

    const result = await recommendationService.markCompleted('rec-4', {
      notes: 'Applied successfully',
      outcome: 'completed',
      completedBy: 'farmer-4',
    });

    expect(result).toEqual(expect.objectContaining({ status: 'executed' }));
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'farmer-4',
        action: 'COMPLETE_RECOMMENDATION',
        entity_type: 'recommendations',
        entity_id: 'rec-4',
        old_values: expect.objectContaining({
          status: 'accepted',
          response_notes: 'Will apply later',
        }),
        new_values: expect.objectContaining({
          status: 'executed',
          response_notes: 'Applied successfully',
          completed_by: 'farmer-4',
          outcome: 'completed',
        }),
      })
    );
  });
});
