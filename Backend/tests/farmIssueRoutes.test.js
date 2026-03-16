import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  users: {
    getById: jest.fn(),
  },
  farms: {
    getById: jest.fn(),
    getUserId: jest.fn(),
  },
  farmIssues: {
    create: jest.fn(),
    getById: jest.fn(),
    getByFarm: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
  },
  auditLogs: {
    create: jest.fn(),
  },
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  ROLES: {
    FARMER: 'farmer',
    EXPERT: 'expert',
    ADMIN: 'admin',
  },
  authenticate: (req, _res, next) => {
    const role = req.headers['x-test-role'] || 'farmer';
    req.user = { id: `${role}-1`, _id: `${role}-1`, role };
    next();
  },
  requireOwnership: () => (_req, _res, next) => next(),
  requireMinimumRole: () => (req, res, next) => {
    if (req.user?.role === 'expert' || req.user?.role === 'admin') {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Forbidden' });
  },
}));

await jest.unstable_mockModule('../src/middleware/validation.js', () => ({
  validatePagination: (_req, _res, next) => next(),
  validateUUID: () => [],
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
  createdResponse: (res, data, message) => res.status(201).json({ success: true, data, message }),
  paginatedResponse: (res, data, page, limit, total, message) =>
    res.status(200).json({ success: true, data, pagination: { page, limit, total }, message }),
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { default: farmIssueRouter } = await import('../src/routes/farm-issues.js');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/farm-issues', farmIssueRouter);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ success: false, message: err.message });
  });
  return app;
};

describe('farm issue routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.users.getById.mockResolvedValue({
      _id: 'expert-1',
      role: 'expert',
      is_active: true,
      metadata: { districtId: 'district-1' },
    });
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      name: 'North Farm',
      user_id: 'farmer-1',
      district_id: 'district-1',
    });
    mockDb.farms.getUserId.mockResolvedValue('farmer-1');
    mockDb.auditLogs.create.mockResolvedValue(null);
  });

  it('creates a farm issue for a farm owner', async () => {
    const app = createApp();
    mockDb.farmIssues.create.mockResolvedValue({
      _id: 'issue-1',
      farm_id: 'farm-1',
      reported_by: 'farmer-1',
      title: 'Water pump failure',
      description: 'The pump stopped running during irrigation.',
      category: 'irrigation',
      severity: 'high',
      status: 'open',
      source_channel: 'web',
    });
    mockDb.farmIssues.getById.mockResolvedValue({
      _id: 'issue-1',
      farm_id: 'farm-1',
      reported_by: 'farmer-1',
      title: 'Water pump failure',
      description: 'The pump stopped running during irrigation.',
      category: 'irrigation',
      severity: 'high',
      status: 'open',
      source_channel: 'web',
      farm: { id: 'farm-1', name: 'North Farm' },
    });

    const response = await request(app)
      .post('/farm-issues/farm/farm-1')
      .send({
        title: 'Water pump failure',
        description: 'The pump stopped running during irrigation.',
        category: 'irrigation',
        severity: 'high',
      })
      .expect(201);

    expect(mockDb.farmIssues.create).toHaveBeenCalledWith(
      expect.objectContaining({
        farm_id: 'farm-1',
        reported_by: 'farmer-1',
        title: 'Water pump failure',
        category: 'irrigation',
        severity: 'high',
        status: 'open',
        source_channel: 'web',
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE_FARM_ISSUE',
        entity_type: 'farm_issues',
        entity_id: 'issue-1',
      })
    );
    expect(response.body.data.title).toBe('Water pump failure');
  });

  it('lists issues for a farm using the persisted count field', async () => {
    const app = createApp();
    mockDb.farmIssues.getByFarm.mockResolvedValue({
      data: [{ _id: 'issue-1', title: 'Water pump failure', status: 'open' }],
      count: 4,
    });

    const response = await request(app)
      .get('/farm-issues/farm/farm-1?page=2&limit=2&status=open')
      .expect(200);

    expect(mockDb.farmIssues.getByFarm).toHaveBeenCalledWith(
      'farm-1',
      expect.objectContaining({
        page: 2,
        limit: 2,
        status: 'open',
      })
    );
    expect(response.body.pagination.total).toBe(4);
  });

  it('allows an expert to update a farm issue status and notes', async () => {
    const app = createApp();
    mockDb.farmIssues.getById
      .mockResolvedValueOnce({
        _id: 'issue-1',
        status: 'open',
        severity: 'high',
      })
      .mockResolvedValueOnce({
        _id: 'issue-1',
        farm_id: 'farm-1',
        title: 'Water pump failure',
        status: 'resolved',
        severity: 'medium',
        expert_notes: 'Advised sensor reset and pump inspection.',
        resolution_notes: 'Issue resolved after pump reset.',
        resolved_at: 1741600000000,
      });
    mockDb.farmIssues.update.mockResolvedValue({
      _id: 'issue-1',
      status: 'resolved',
      severity: 'medium',
      expert_notes: 'Advised sensor reset and pump inspection.',
      resolution_notes: 'Issue resolved after pump reset.',
      resolved_at: 1741600000000,
    });

    const response = await request(app)
      .put('/farm-issues/issue-1')
      .set('x-test-role', 'expert')
      .send({
        status: 'resolved',
        severity: 'medium',
        expertNotes: 'Advised sensor reset and pump inspection.',
        resolutionNotes: 'Issue resolved after pump reset.',
      })
      .expect(200);

    expect(mockDb.farmIssues.update).toHaveBeenCalledWith(
      'issue-1',
      expect.objectContaining({
        status: 'resolved',
        severity: 'medium',
        expert_notes: 'Advised sensor reset and pump inspection.',
        resolution_notes: 'Issue resolved after pump reset.',
        resolved_at: expect.any(Number),
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'expert-1',
        action: 'UPDATE_FARM_ISSUE',
        entity_type: 'farm_issues',
        entity_id: 'issue-1',
      })
    );
    expect(response.body.data.status).toBe('resolved');
  });

  it('allows an admin to assign a farm issue to an active expert', async () => {
    const app = createApp();
    mockDb.farmIssues.getById
      .mockResolvedValueOnce({
        _id: 'issue-2',
        status: 'open',
        severity: 'medium',
      })
      .mockResolvedValueOnce({
        _id: 'issue-2',
        farm_id: 'farm-1',
        title: 'Leaf discoloration',
        status: 'in_progress',
        severity: 'medium',
        assigned_to: 'expert-1',
        expert_notes: 'Assigned for pest triage.',
      });
    mockDb.farmIssues.update.mockResolvedValue({
      _id: 'issue-2',
      status: 'in_progress',
      severity: 'medium',
      assigned_to: 'expert-1',
      expert_notes: 'Assigned for pest triage.',
    });

    const response = await request(app)
      .put('/farm-issues/issue-2')
      .set('x-test-role', 'admin')
      .send({
        status: 'in_progress',
        assignedTo: 'expert-1',
        expertNotes: 'Assigned for pest triage.',
      })
      .expect(200);

    expect(mockDb.users.getById).toHaveBeenCalledWith('expert-1');
    expect(mockDb.farmIssues.update).toHaveBeenCalledWith(
      'issue-2',
      expect.objectContaining({
        status: 'in_progress',
        assigned_to: 'expert-1',
        expert_notes: 'Assigned for pest triage.',
      })
    );
    expect(response.body.data.assigned_to).toBe('expert-1');
  });

  it('rejects assigning an expert agronomist to a farmer in a different district', async () => {
    const app = createApp();
    mockDb.users.getById.mockResolvedValue({
      _id: 'expert-2',
      role: 'expert',
      is_active: true,
      metadata: { districtId: 'district-2' },
    });
    mockDb.farmIssues.getById.mockResolvedValue({
      _id: 'issue-3',
      farm_id: 'farm-1',
      status: 'open',
      severity: 'medium',
    });

    const response = await request(app)
      .put('/farm-issues/issue-3')
      .set('x-test-role', 'admin')
      .send({
        assignedTo: 'expert-2',
        expertNotes: 'Attempted assignment.',
      })
      .expect(500);

    expect(mockDb.farmIssues.update).not.toHaveBeenCalled();
    expect(response.body.message).toContain('same district');
  });
});
