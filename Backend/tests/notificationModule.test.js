import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSmsSend = jest.fn();
const mockEmailSend = jest.fn();

const mockDb = {
  users: {
    getByPhone: jest.fn(),
    listActive: jest.fn(),
  },
  farms: {
    getById: jest.fn(),
  },
  messages: {
    create: jest.fn(),
    createBatch: jest.fn(),
    getQueued: jest.fn(),
    getFailed: jest.fn(),
    update: jest.fn(),
    getStats: jest.fn(),
  },
  recommendations: {
    update: jest.fn(),
  },
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

await jest.unstable_mockModule('africastalking', () => ({
  default: jest.fn(() => ({
    SMS: {
      send: mockSmsSend,
    },
  })),
}));

await jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: jest.fn(() => ({
      sendMail: mockEmailSend,
    })),
  },
}));

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/config/index.js', () => ({
  default: {
    africasTalking: {
      username: 'sandbox',
      apiKey: 'test-key',
      senderId: '',
    },
    email: {
      enabled: true,
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      user: 'smtp-user',
      pass: 'smtp-pass',
      from: 'no-reply@example.com',
      fromName: 'Smart Maize',
      replyTo: 'support@example.com',
      defaultSubject: 'Smart Maize Notification',
    },
    notifications: {
      criticalAlertDelayMs: 0,
      importantRecommendationDelayMs: 300000,
      routineUpdateBatchIntervalMs: 3600000,
      deliveryConcurrency: 2,
      retryConcurrency: 2,
    },
  },
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
}));

const {
  sendBulkSMS,
  sendEmail,
  sendRecommendationNotification,
  sendSensorAnalysisLifecycleNotifications,
  retryFailedMessages,
  processQueuedMessages,
} = await import('../src/services/notificationService.js');

describe('notification and communication performance fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.messages.create.mockImplementation(async (_data) => ({ _id: `message-${Math.random()}` }));
    mockDb.messages.createBatch.mockResolvedValue({ count: 0, ids: [] });
    mockDb.messages.update.mockResolvedValue({ _id: 'updated-message' });
    mockDb.messages.getQueued.mockResolvedValue([]);
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      name: 'Demo Farm',
      user_id: 'user-1',
      district_id: 'district-1',
    });
    mockDb.users.listActive.mockResolvedValue([
      { _id: 'user-1', role: 'farmer', phone_number: '0788000001', preferred_language: 'en' },
      { _id: 'user-2', role: 'expert', phone_number: '0788000002', preferred_language: 'rw', metadata: { districtId: 'district-1' } },
      { _id: 'user-3', role: 'expert', phone_number: null, email: 'expert@example.com', preferred_language: 'en', metadata: { districtId: 'district-2' } },
      { _id: 'user-4', role: 'admin', phone_number: null, email: 'admin@example.com', preferred_language: 'en' },
    ]);
  });

  it('sends email through SMTP and logs the sent message', async () => {
    mockEmailSend.mockResolvedValue({
      messageId: 'email-1',
      accepted: ['farmer@example.com'],
      rejected: [],
    });

    const result = await sendEmail('farmer@example.com', 'Field update', 'Weather conditions changed.', {
      userId: 'user-1',
    });

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'farmer@example.com',
        subject: 'Field update',
        text: 'Weather conditions changed.',
      })
    );
    expect(mockDb.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        channel: 'email',
        recipient: 'farmer@example.com',
        subject: 'Field update',
        status: 'sent',
        external_message_id: 'email-1',
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        externalId: 'email-1',
      })
    );
  });

  it('sends bulk SMS with bounded concurrency', async () => {
    let active = 0;
    let maxActive = 0;

    mockSmsSend.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return {
        SMSMessageData: {
          Recipients: [{ status: 'Success', messageId: 'external-1', cost: 'KES 1.00' }],
        },
      };
    });

    const result = await sendBulkSMS([
      { userId: 'user-1', phoneNumber: '0788000001', message: 'A' },
      { userId: 'user-2', phoneNumber: '0788000002', message: 'B' },
      { userId: 'user-3', phoneNumber: '0788000003', message: 'C' },
      { userId: 'user-4', phoneNumber: '0788000004', message: 'D' },
      { userId: 'user-5', phoneNumber: '0788000005', message: 'E' },
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        total: 5,
        successful: 5,
        failed: 0,
      })
    );
    expect(mockSmsSend).toHaveBeenCalledTimes(5);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('retries failed messages with bounded concurrency', async () => {
    let active = 0;
    let maxActive = 0;

    mockDb.messages.getFailed.mockResolvedValue([
      { _id: 'msg-1', recipient: '+250788000001', content: 'A', channel: 'sms', user_id: 'user-1', retry_count: 0 },
      { _id: 'msg-2', recipient: '+250788000002', content: 'B', channel: 'sms', user_id: 'user-2', retry_count: 1 },
      { _id: 'msg-3', recipient: '+250788000003', content: 'C', channel: 'sms', user_id: 'user-3', retry_count: 0 },
      { _id: 'msg-4', recipient: '+250788000004', content: 'D', channel: 'sms', user_id: 'user-4', retry_count: 2 },
    ]);

    mockSmsSend.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return {
        SMSMessageData: {
          Recipients: [{ status: 'Success', messageId: 'external-retry', cost: 'KES 1.00' }],
        },
      };
    });

    const result = await retryFailedMessages(3);

    expect(result).toEqual({ retried: 4 });
    expect(mockDb.messages.getFailed).toHaveBeenCalledWith({ maxRetries: 3, limit: 50 });
    expect(mockDb.messages.update).toHaveBeenCalledTimes(4);
    expect(mockDb.messages.create).not.toHaveBeenCalled();
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('delivers persisted queued messages through the processor', async () => {
    mockDb.messages.getQueued.mockResolvedValue([
      { _id: 'queued-1', recipient: '+250788000001', content: 'Queued A', channel: 'sms', retry_count: 0 },
      {
        _id: 'queued-2',
        recipient: 'farmer@example.com',
        subject: 'Queued Email',
        content: 'Queued B',
        channel: 'email',
        retry_count: 0,
      },
    ]);
    mockDb.messages.getFailed.mockResolvedValue([]);

    let active = 0;
    let maxActive = 0;
    mockSmsSend.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return {
        SMSMessageData: {
          Recipients: [{ status: 'Success', messageId: 'external-queued', cost: 'KES 1.00' }],
        },
      };
    });
    mockEmailSend.mockResolvedValue({
      messageId: 'queued-email-1',
      accepted: ['farmer@example.com'],
      rejected: [],
    });

    const result = await processQueuedMessages();

    expect(result).toEqual(
      expect.objectContaining({
        processed: 2,
        sent: 2,
        failed: 0,
        retried: 0,
      })
    );
    expect(mockDb.messages.getQueued).toHaveBeenCalledWith({ limit: 100 });
    expect(mockDb.messages.update).toHaveBeenCalledTimes(2);
    expect(mockDb.messages.create).not.toHaveBeenCalled();
    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('broadcasts recommendation notifications to all active users with phone numbers', async () => {
    mockSmsSend.mockResolvedValue({
      SMSMessageData: {
        Recipients: [{ status: 'Success', messageId: 'external-rec', cost: 'KES 1.00' }],
      },
    });

    const result = await sendRecommendationNotification('user-target', 'rec-1', {
      priority: 'critical',
      type: 'general',
      title: 'Check your maize field',
      titleRw: 'Sura umurima wawe w ibigori',
      description: 'Inspect crops this afternoon.',
      descriptionRw: 'Suzuma imyaka yawe uyu mugoroba.',
      farmName: 'Demo Farm',
    });

    expect(mockDb.users.listActive).toHaveBeenCalledWith();
    expect(mockSmsSend).toHaveBeenCalledTimes(2);
    expect(mockDb.messages.create).toHaveBeenCalledTimes(2);
    expect(mockDb.recommendations.update).toHaveBeenCalledWith(
      'rec-1',
      expect.objectContaining({
        notification_sent: true,
        notification_channel: 'sms',
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        targetedUsers: 4,
        deliverableUsers: 2,
        sent: 2,
        queued: 0,
      })
    );
  });

  it('creates AI sensor analysis notifications for the farm owner, same-district expert, and admins', async () => {
    mockDb.messages.createBatch
      .mockResolvedValueOnce({ count: 3, ids: ['msg-start-1', 'msg-start-2', 'msg-start-3'] })
      .mockResolvedValueOnce({ count: 3, ids: ['msg-done-1', 'msg-done-2', 'msg-done-3'] });

    const result = await sendSensorAnalysisLifecycleNotifications({
      farmId: 'farm-1',
      sensorId: 'sensor-1',
      deviceId: 'device-1',
      insertedCount: 2,
      latestReadingTimestamp: Date.parse('2026-03-15T08:30:00.000Z'),
      runAnalysis: async () => ({
        irrigation: {
          needsIrrigation: true,
          urgency: 'high',
          currentReadings: {
            soilMoisture: 27,
            temperature: 28,
            humidity: 64,
          },
        },
        nutrients: {
          needsFertilization: false,
        },
      }),
    });

    expect(mockDb.farms.getById).toHaveBeenCalledWith('farm-1');
    expect(mockDb.users.listActive).toHaveBeenCalledWith();
    expect(mockDb.messages.createBatch).toHaveBeenCalledTimes(2);

    const startMessages = mockDb.messages.createBatch.mock.calls[0][0];
    const summaryMessages = mockDb.messages.createBatch.mock.calls[1][0];

    expect(startMessages).toHaveLength(3);
    expect(summaryMessages).toHaveLength(3);
    expect(startMessages.map((message) => message.user_id).sort()).toEqual(['user-1', 'user-2', 'user-4']);
    expect(summaryMessages.map((message) => message.user_id).sort()).toEqual(['user-1', 'user-2', 'user-4']);
    expect(summaryMessages[0].metadata).toEqual(
      expect.objectContaining({
        type: 'sensor_ai_analysis',
        stage: 'completed',
        farm_id: 'farm-1',
        sensor_id: 'sensor-1',
      })
    );
    expect(summaryMessages.some((message) => message.content.includes('AI analysis for Demo Farm'))).toBe(true);
    expect(summaryMessages.some((message) => message.content.includes('Irrigation: recommended'))).toBe(true);

    expect(result).toEqual({
      targetedUsers: 3,
      started: 3,
      completed: 3,
      failed: 0,
    });
  });
});
