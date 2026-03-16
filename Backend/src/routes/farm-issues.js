import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireMinimumRole, requireOwnership, ROLES } from '../middleware/auth.js';
import { validatePagination, validateUUID, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createdResponse, paginatedResponse, successResponse } from '../utils/response.js';
import { db } from '../database/convex.js';
import * as farmIssueService from '../services/farmIssueService.js';

const router = Router();

const ISSUE_CATEGORIES = ['general', 'irrigation', 'fertilization', 'pest', 'sensor', 'weather'];
const ISSUE_SEVERITIES = ['low', 'medium', 'high', 'urgent'];
const ISSUE_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

const getFarmUserId = async (req) => {
  const farmId = req.params.farmId || req.query.farmId;
  if (!farmId) return null;
  return db.farms.getUserId(farmId);
};

const getIssueUserId = async (req) => {
  const issue = await db.farmIssues.getById(req.params.issueId);
  if (!issue?.farm_id) return null;
  return db.farms.getUserId(issue.farm_id);
};

const validateIssueCreation = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 160 })
    .withMessage('Title must be between 3 and 160 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  body('category')
    .optional()
    .isIn(ISSUE_CATEGORIES)
    .withMessage(`Category must be one of: ${ISSUE_CATEGORIES.join(', ')}`),
  body('severity')
    .optional()
    .isIn(ISSUE_SEVERITIES)
    .withMessage(`Severity must be one of: ${ISSUE_SEVERITIES.join(', ')}`),
  body('locationDescription')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('Location description must be 255 characters or fewer'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
];

const validateIssueUpdate = [
  body()
    .custom((value) => {
      const allowed = ['status', 'severity', 'assignedTo', 'expertNotes', 'resolutionNotes', 'metadata'];
      return allowed.some((key) => value?.[key] !== undefined);
    })
    .withMessage('At least one update field is required'),
  body('status')
    .optional()
    .isIn(ISSUE_STATUSES)
    .withMessage(`Status must be one of: ${ISSUE_STATUSES.join(', ')}`),
  body('severity')
    .optional()
    .isIn(ISSUE_SEVERITIES)
    .withMessage(`Severity must be one of: ${ISSUE_SEVERITIES.join(', ')}`),
  body('assignedTo')
    .optional()
    .isString()
    .notEmpty()
    .withMessage('assignedTo must be a valid resource ID'),
  body('expertNotes')
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage('Expert notes must be 2000 characters or fewer'),
  body('resolutionNotes')
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage('Resolution notes must be 2000 characters or fewer'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
];

router.get('/farm/:farmId',
  authenticate,
  ...validateUUID('farmId'),
  validatePagination,
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, category, severity, startDate, endDate } = req.query;
    const startMs = startDate ? new Date(startDate).getTime() : undefined;
    const endMs = endDate ? new Date(endDate).getTime() : undefined;

    const result = await farmIssueService.getFarmIssues(req.params.farmId, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      status: status || undefined,
      category: category || undefined,
      severity: severity || undefined,
      ...(Number.isFinite(startMs) ? { since: startMs } : {}),
      ...(Number.isFinite(endMs) ? { until: endMs } : {}),
    });

    return paginatedResponse(
      res,
      result.data,
      result.page,
      result.limit,
      result.total,
      'Farm issues retrieved successfully'
    );
  })
);

router.post('/farm/:farmId',
  authenticate,
  ...validateUUID('farmId'),
  validateIssueCreation,
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const issue = await farmIssueService.createFarmIssue(req.user.id, req.params.farmId, req.body);
    return createdResponse(res, issue, 'Farm issue reported successfully');
  })
);

router.get('/',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  validatePagination,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, farmId, reportedBy, status, category, severity, sourceChannel, startDate, endDate } = req.query;
    const startMs = startDate ? new Date(startDate).getTime() : undefined;
    const endMs = endDate ? new Date(endDate).getTime() : undefined;

    const result = await farmIssueService.listFarmIssues({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      farmId: farmId || undefined,
      reportedBy: reportedBy || undefined,
      status: status || undefined,
      category: category || undefined,
      severity: severity || undefined,
      sourceChannel: sourceChannel || undefined,
      ...(Number.isFinite(startMs) ? { since: startMs } : {}),
      ...(Number.isFinite(endMs) ? { until: endMs } : {}),
    });

    return paginatedResponse(
      res,
      result.data,
      result.page,
      result.limit,
      result.total,
      'Farm issues retrieved successfully'
    );
  })
);

router.get('/:issueId',
  authenticate,
  ...validateUUID('issueId'),
  handleValidationErrors,
  requireOwnership(getIssueUserId),
  asyncHandler(async (req, res) => {
    const issue = await farmIssueService.getFarmIssueById(req.params.issueId);
    return successResponse(res, issue, 'Farm issue retrieved successfully');
  })
);

router.put('/:issueId',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  ...validateUUID('issueId'),
  validateIssueUpdate,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const issue = await farmIssueService.updateFarmIssue(req.params.issueId, req.user.id, req.body);
    return successResponse(res, issue, 'Farm issue updated successfully');
  })
);

export default router;
