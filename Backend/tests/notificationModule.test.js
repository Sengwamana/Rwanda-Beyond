import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSmsSend = jest.fn();

const mockDb = {
  messages: {
    create: jest.fn(),
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
  retryFailedMessages,
  processQueuedMessages,
} = await import('../src/services/notificationService.js');

describe('notification and communication performance fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.messages.create.mockImplementation(async (_data) => ({ _id: `message-${Math.random()}` }));
    mockDb.messages.update.mockResolvedValue({ _id: 'updated-message' });
    mockDb.messages.getQueued.mockResolvedValue([]);
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
      { _id: 'msg-1', recipient: '+250788000001', content: 'A', user_id: 'user-1', retry_count: 0 },
      { _id: 'msg-2', recipient: '+250788000002', content: 'B', user_id: 'user-2', retry_count: 1 },
      { _id: 'msg-3', recipient: '+250788000003', content: 'C', user_id: 'user-3', retry_count: 0 },
      { _id: 'msg-4', recipient: '+250788000004', content: 'D', user_id: 'user-4', retry_count: 2 },
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
      { _id: 'queued-1', recipient: '+250788000001', content: 'Queued A', retry_count: 0 },
      { _id: 'queued-2', recipient: '+250788000002', content: 'Queued B', retry_count: 0 },
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
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
