import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  messages: {
    listByUser: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  },
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 'user-1', _id: 'user-1', role: 'farmer' };
    next();
  },
}));

await jest.unstable_mockModule('../src/middleware/validation.js', () => ({
  validatePagination: (_req, _res, next) => next(),
  handleValidationErrors: (_req, _res, next) => next(),
}));

await jest.unstable_mockModule('../src/middleware/errorHandler.js', () => ({
  asyncHandler: (handler) => async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  },
}));

await jest.unstable_mockModule('../src/utils/response.js', () => ({
  successResponse: (res, data, message) => res.status(200).json({ success: true, data, message }),
}));

const { default: messageRouter } = await import('../src/routes/messages.js');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/messages', messageRouter);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ success: false, message: err.message });
  });
  return app;
};

describe('message routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.messages.listByUser.mockResolvedValue({
      data: [],
      count: 0,
      unreadCount: 0,
      page: 1,
      limit: 20,
    });
    mockDb.messages.markRead.mockResolvedValue(null);
    mockDb.messages.markAllRead.mockResolvedValue({ updatedCount: 0 });
  });

  it('lists the current user notifications with unread count', async () => {
    const app = createApp();
    mockDb.messages.listByUser.mockResolvedValue({
      data: [{ _id: 'msg-1', user_id: 'user-1', status: 'sent', content: 'Hello' }],
      count: 1,
      unreadCount: 1,
      page: 1,
      limit: 10,
    });

    const response = await request(app)
      .get('/messages/me?page=1&limit=10&unreadOnly=true')
      .expect(200);

    expect(mockDb.messages.listByUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        page: 1,
        limit: 10,
        unreadOnly: true,
      })
    );
    expect(response.body.data).toEqual(
      expect.objectContaining({
        unreadCount: 1,
        total: 1,
        totalPages: 1,
      })
    );
  });

  it('marks one notification as read for the current user', async () => {
    const app = createApp();
    mockDb.messages.markRead.mockResolvedValue({
      _id: 'msg-1',
      user_id: 'user-1',
      status: 'read',
      read_at: Date.now(),
    });

    const response = await request(app)
      .post('/messages/msg-1/read')
      .send({})
      .expect(200);

    expect(mockDb.messages.markRead).toHaveBeenCalledWith('msg-1', 'user-1');
    expect(response.body.data).toEqual(expect.objectContaining({ _id: 'msg-1' }));
  });

  it('marks all notifications as read for the current user', async () => {
    const app = createApp();
    mockDb.messages.markAllRead.mockResolvedValue({ updatedCount: 4 });

    const response = await request(app)
      .post('/messages/read-all')
      .send({})
      .expect(200);

    expect(mockDb.messages.markAllRead).toHaveBeenCalledWith('user-1');
    expect(response.body.data).toEqual({ updatedCount: 4 });
  });
});
