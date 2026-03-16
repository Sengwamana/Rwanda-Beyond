/**
 * Message Routes
 *
 * Authenticated endpoints for reading delivered notifications/messages.
 *
 * @module routes/messages
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validatePagination, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';
import { db } from '../database/convex.js';

const router = Router();

router.use(authenticate);

router.get('/me',
  validatePagination,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, channel, unreadOnly } = req.query;

    const result = await db.messages.listByUser({
      userId: req.user._id,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      status: status || undefined,
      channel: channel || undefined,
      unreadOnly: unreadOnly === 'true',
    });

    const data = result?.data || [];
    const count = result?.count ?? data.length;

    return successResponse(res, {
      messages: data,
      unreadCount: result?.unreadCount ?? 0,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      total: count,
      totalPages: Math.ceil(count / (parseInt(limit, 10) || 20)),
    }, 'Messages retrieved successfully');
  })
);

router.post('/:messageId/read',
  asyncHandler(async (req, res) => {
    const message = await db.messages.markRead(req.params.messageId, req.user._id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
        code: 'NOT_FOUND',
      });
    }

    return successResponse(res, message, 'Message marked as read');
  })
);

router.post('/read-all',
  asyncHandler(async (req, res) => {
    const result = await db.messages.markAllRead(req.user._id);
    return successResponse(res, result, 'All messages marked as read');
  })
);

export default router;
