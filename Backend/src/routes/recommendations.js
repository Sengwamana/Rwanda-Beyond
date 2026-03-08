/**
 * Recommendation Routes
 * 
 * API endpoints for recommendation management and responses.
 * 
 * @module routes/recommendations
 */

import { Router } from 'express';
import { authenticate, authorize, ROLES, requireOwnership, requireMinimumRole } from '../middleware/auth.js';
import { validateRecommendationResponse, validatePagination, validateUUID, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { successResponse, paginatedResponse } from '../utils/response.js';
import { db } from '../database/convex.js';
import * as recommendationService from '../services/recommendationService.js';

const router = Router();

/**
 * Get farm user ID for ownership check
 */
const getFarmUserId = async (req) => {
  const farmId = req.params.farmId || req.query.farmId;
  if (!farmId) return null;
  
  return await db.farms.getUserId(farmId);
};

/**
 * Get recommendation's farm user ID
 */
const getRecommendationUserId = async (req) => {
  const rec = await db.recommendations.getById(req.params.recommendationId);
  if (!rec) return null;
  return await db.farms.getUserId(rec.farm_id);
};

// =====================================================
// FARMER RECOMMENDATION ROUTES
// =====================================================

/**
 * @route GET /api/v1/recommendations/farm/:farmId
 * @desc Get recommendations for a farm
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId',
  authenticate,
  ...validateUUID('farmId'),
  validatePagination,
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const { page, limit, status, type, priority } = req.query;

    const recommendations = await recommendationService.getFarmRecommendations(
      req.params.farmId,
      {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status,
        type,
        priority
      }
    );

    return paginatedResponse(
      res,
      recommendations.data,
      recommendations.page,
      recommendations.limit,
      recommendations.total,
      'Recommendations retrieved successfully'
    );
  })
);

/**
 * @route GET /api/v1/recommendations/farm/:farmId/active
 * @desc Get active recommendations for a farm
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId/active',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const recommendations = await recommendationService.getActiveRecommendations(
      req.params.farmId
    );
    return successResponse(res, recommendations, 'Active recommendations retrieved successfully');
  })
);

/**
 * @route POST /api/v1/recommendations/farm/:farmId/generate
 * @desc Generate recommendations for a single farm
 * @access Owner, Admin, Expert
 */
router.post('/farm/:farmId/generate',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const { type } = req.body || {};

    const result = await recommendationService.bulkGenerateRecommendations({
      farmIds: [req.params.farmId],
      type,
    });

    return successResponse(res, result, 'Recommendations generated successfully');
  })
);

// =====================================================
// UNSCOPED RECOMMENDATION ROUTES (admin/expert)
// Must be defined BEFORE /:recommendationId param routes
// =====================================================

/**
 * @route GET /api/v1/recommendations
 * @desc List all recommendations (unscoped, for admin/expert)
 * @access Admin, Expert
 */
router.get('/',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  validatePagination,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page, limit, status, type, priority } = req.query;

    const opts = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status: status || undefined,
      type: type || undefined,
      priority: priority || undefined
    };

    const result = await db.recommendations.list(opts);
    const data = result.data || result;
    const count = result.count ?? result.total ?? data.length;

    return paginatedResponse(
      res,
      data,
      opts.page,
      opts.limit,
      count,
      'Recommendations retrieved successfully'
    );
  })
);

/**
 * @route GET /api/v1/recommendations/active
 * @desc List active recommendations (unscoped)
 * @access Admin, Expert
 */
router.get('/active',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const { farmId } = req.query;

    let recommendations;
    if (farmId) {
      recommendations = await db.recommendations.getByFarm(farmId, { statuses: ['pending', 'accepted'] });
    } else {
      const result = await db.recommendations.list({ statuses: ['pending', 'accepted'], page: 1, limit: 200 });
      recommendations = result.data || result;
    }

    return successResponse(res, recommendations, 'Active recommendations retrieved successfully');
  })
);

/**
 * @route GET /api/v1/recommendations/statistics
 * @desc Get recommendation statistics (alias for /stats)
 * @access Admin, Expert
 */
router.get('/statistics',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const stats = await recommendationService.getRecommendationStats(req.query);
    return successResponse(res, stats, 'Recommendation statistics retrieved successfully');
  })
);

/**
 * @route GET /api/v1/recommendations/history
 * @desc Get recommendation history
 * @access Admin, Expert
 */
router.get('/history',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  validatePagination,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { farmId, page, limit, startDate, endDate } = req.query;
    const startTs = startDate ? new Date(startDate).getTime() : undefined;
    const endTs = endDate ? new Date(endDate).getTime() : undefined;

    const opts = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    };

    if (Number.isFinite(startTs)) {
      opts.since = startTs;
    }
    if (Number.isFinite(endTs)) {
      opts.until = endTs;
    }

    let data;
    if (farmId) {
      data = await db.recommendations.getByFarm(farmId, opts);
    } else {
      data = await db.recommendations.list(opts);
    }

    const result = Array.isArray(data) ? data : (data.data || []);
    const count = data.count ?? data.total ?? result.length;

    return paginatedResponse(
      res,
      result,
      opts.page,
      opts.limit,
      count,
      'Recommendation history retrieved successfully'
    );
  })
);

/**
 * @route GET /api/v1/recommendations/pending
 * @desc Get all pending recommendations
 * @access Admin, Expert
 */
router.get('/pending',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  validatePagination,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page, limit, priority, type, district } = req.query;

    const opts = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status: 'pending',
      priority: priority || undefined,
      type: type || undefined,
      district: district || undefined
    };

    const result = await db.recommendations.list(opts);
    const data = result.data || result;
    const count = result.count ?? result.total ?? data.length;

    return paginatedResponse(
      res,
      data,
      parseInt(page) || 1,
      parseInt(limit) || 20,
      count,
      'Pending recommendations retrieved successfully'
    );
  })
);

// =====================================================
// PARAMETERIZED RECOMMENDATION ROUTES
// Must be defined AFTER all named routes above
// =====================================================

/**
 * @route GET /api/v1/recommendations/:recommendationId
 * @desc Get recommendation by ID
 * @access Owner, Admin, Expert
 */
router.get('/:recommendationId',
  authenticate,
  ...validateUUID('recommendationId'),
  handleValidationErrors,
  requireOwnership(getRecommendationUserId),
  asyncHandler(async (req, res) => {
    const recommendation = await recommendationService.getRecommendationById(
      req.params.recommendationId
    );
    return successResponse(res, recommendation, 'Recommendation retrieved successfully');
  })
);

/**
 * @route POST /api/v1/recommendations/:recommendationId/respond
 * @desc Respond to a recommendation (accept/reject/defer)
 * @access Owner only
 */
router.post('/:recommendationId/respond',
  authenticate,
  ...validateUUID('recommendationId'),
  validateRecommendationResponse,
  handleValidationErrors,
  requireOwnership(getRecommendationUserId),
  asyncHandler(async (req, res) => {
    const action =
      req.body?.action
      || (req.body?.status === 'accepted'
        ? 'accept'
        : req.body?.status === 'rejected'
          ? 'reject'
          : req.body?.status === 'deferred'
            ? 'defer'
            : undefined);
    const reason = req.body?.reason || req.body?.responseNotes;
    const deferUntil = req.body?.deferUntil || req.body?.deferredUntil;

    const result = await recommendationService.respondToRecommendation(
      req.params.recommendationId,
      action,
      {
        reason,
        deferUntil,
        respondedBy: req.user.id
      }
    );

    return successResponse(res, result, `Recommendation ${action}ed successfully`);
  })
);

/**
 * @route POST /api/v1/recommendations/:recommendationId/complete
 * @desc Mark recommendation as completed
 * @access Owner only
 */
router.post('/:recommendationId/complete',
  authenticate,
  ...validateUUID('recommendationId'),
  handleValidationErrors,
  requireOwnership(getRecommendationUserId),
  asyncHandler(async (req, res) => {
    const { notes, outcome } = req.body;

    const result = await recommendationService.markCompleted(
      req.params.recommendationId,
      {
        notes,
        outcome,
        completedBy: req.user.id
      }
    );

    return successResponse(res, result, 'Recommendation marked as completed');
  })
);

// =====================================================
// EXPERT/ADMIN ROUTES
// =====================================================

/**
 * @route GET /api/v1/recommendations/stats
 * @desc Get recommendation statistics
 * @access Admin, Expert
 */
router.get('/stats',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const { farmId, startDate, endDate } = req.query;

    const stats = await recommendationService.getRecommendationStats({
      farmId,
      startDate,
      endDate
    });

    return successResponse(res, stats, 'Recommendation statistics retrieved successfully');
  })
);

/**
 * @route POST /api/v1/recommendations/manual
 * @desc Create a manual recommendation (expert)
 * @access Admin, Expert
 */
router.post('/manual',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const { farmId, type, priority, title, description, actionRequired, validUntil } = req.body;

    const recommendation = await recommendationService.createManualRecommendation({
      farmId,
      type,
      priority,
      title,
      description,
      actionRequired,
      validUntil,
      createdBy: req.user.id
    });

    return successResponse(res, recommendation, 'Manual recommendation created successfully');
  })
);

/**
 * @route POST /api/v1/recommendations/bulk-generate
 * @desc Trigger bulk recommendation generation
 * @access Admin only
 */
router.post('/bulk-generate',
  authenticate,
  authorize(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const { district, type, farmIds } = req.body;

    const result = await recommendationService.bulkGenerateRecommendations({
      district,
      type,
      farmIds
    });

    return successResponse(res, result, `Bulk recommendations generated: ${result.generated} created`);
  })
);

export default router;
