/**
 * Pest Detection Routes
 * 
 * API endpoints for pest detection, image analysis, and expert review.
 * 
 * @module routes/pest-detection
 */

import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize, ROLES, requireOwnership, requireMinimumRole } from '../middleware/auth.js';
import { validatePagination, validateUUID, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { successResponse, createdResponse, paginatedResponse } from '../utils/response.js';
import { db } from '../database/convex.js';
import * as imageService from '../services/imageService.js';
import * as aiService from '../services/aiService.js';
import * as recommendationService from '../services/recommendationService.js';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  }
});

/**
 * Get farm user ID for ownership check
 */
const getFarmUserId = async (req) => {
  const farmId = req.params.farmId || req.body.farmId;
  if (!farmId) return null;
  
  return await db.farms.getUserId(farmId);
};

/**
 * Get detection's farm user ID
 */
const getDetectionUserId = async (req) => {
  const detection = await db.pestDetections.getById(req.params.detectionId);
  if (!detection) return null;
  return await db.farms.getUserId(detection.farm_id);
};

// =====================================================
// IMAGE UPLOAD & ANALYSIS ROUTES
// =====================================================

/**
 * @route POST /api/v1/pest-detection/upload/:farmId
 * @desc Upload pest image for analysis
 * @access Owner, Admin, Expert
 */
router.post('/upload/:farmId',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  upload.array('images', 5),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const { location, notes, severity } = req.body;
    const farmId = req.params.farmId;

    // Upload images to Cloudinary
    const uploadPromises = req.files.map(file =>
      imageService.uploadPestImage(file.buffer, farmId, {
        description: notes
      })
    );

    const uploadResults = await Promise.all(uploadPromises);
    const imageUrls = uploadResults.map(r => r.url);

    // Run AI analysis on first image
    const analysisResult = await aiService.analyzePestImage(
      imageUrls[0],
      { farmId, location, notes }
    );

    // Create pest detection record
    const detection = await db.pestDetections.create({
      farm_id: farmId,
      image_url: imageUrls[0],
      additional_images: imageUrls.slice(1),
      location: location ? JSON.parse(location) : null,
      detected_pest: analysisResult.detectedPest,
      confidence: analysisResult.confidence,
      severity: severity || analysisResult.severity || 'unknown',
      ai_analysis: analysisResult,
      status: analysisResult.confidence >= 0.8 ? 'confirmed' : 'pending_review',
      reported_by: req.user._id,
      notes
    });

    // Create pest alert recommendation if detected
    if (analysisResult.detectedPest && analysisResult.confidence >= 0.6) {
      await recommendationService.createPestAlert(farmId, {
        pestName: analysisResult.detectedPest,
        severity: analysisResult.severity,
        detectionId: detection._id,
        recommendations: analysisResult.recommendations,
        affectedArea: analysisResult.estimatedArea
      });
    }

    return createdResponse(res, {
      detection,
      analysis: analysisResult,
      imageUrls
    }, 'Pest image uploaded and analyzed successfully');
  })
);

/**
 * @route POST /api/v1/pest-detection/:detectionId/reanalyze
 * @desc Re-run AI analysis on existing detection
 * @access Admin, Expert
 */
router.post('/:detectionId/reanalyze',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  ...validateUUID('detectionId'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    // Get existing detection
    const detection = await db.pestDetections.getById(req.params.detectionId);

    if (!detection) {
      return res.status(404).json({
        success: false,
        message: 'Detection not found',
        code: 'NOT_FOUND'
      });
    }

    // Run AI analysis again
    const analysisResult = await aiService.analyzePestImage(
      detection.image_url,
      { farmId: detection.farm_id, existingAnalysis: detection.ai_analysis }
    );

    // Update detection with new analysis
    const updated = await db.pestDetections.update(req.params.detectionId, {
      detected_pest: analysisResult.detectedPest,
      confidence: analysisResult.confidence,
      ai_analysis: {
        ...detection.ai_analysis,
        reanalysis: analysisResult,
        reanalyzedAt: new Date().toISOString(),
        reanalyzedBy: req.user._id
      }
    });

    return successResponse(res, {
      detection: updated,
      analysis: analysisResult
    }, 'Detection reanalyzed successfully');
  })
);

// =====================================================
// DETECTION MANAGEMENT ROUTES
// =====================================================

/**
 * @route GET /api/v1/pest-detection/farm/:farmId
 * @desc Get pest detections for a farm
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId',
  authenticate,
  ...validateUUID('farmId'),
  validatePagination,
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, severity, startDate, endDate } = req.query;

    const opts = {
      page: parseInt(page),
      limit: parseInt(limit),
      status: status || undefined,
      severity: severity || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    };

    const result = await db.pestDetections.getByFarm(req.params.farmId, opts);
    const data = result.data || result;
    const count = result.total || data.length;

    return paginatedResponse(res, data, parseInt(page), parseInt(limit), count, 'Pest detections retrieved successfully');
  })
);

// =====================================================
// UNSCOPED DETECTION ROUTES (admin/expert)
// Must be defined BEFORE /:detectionId param routes
// =====================================================

/**
 * @route GET /api/v1/pest-detection
 * @desc List all pest detections (unscoped, for admin/expert)
 * @access Admin, Expert
 */
router.get('/',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  validatePagination,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, severity, farmId } = req.query;

    const opts = {
      page: parseInt(page),
      limit: parseInt(limit),
      status: status || undefined,
      severity: severity || undefined,
      farmId: farmId || undefined
    };

    let result;
    if (farmId) {
      result = await db.pestDetections.getByFarm(farmId, opts);
    } else {
      result = await db.pestDetections.getStats(opts);
    }

    const data = result?.data || result || [];
    const count = result?.total || data.length;

    return paginatedResponse(res, data, parseInt(page), parseInt(limit), count, 'Pest detections retrieved successfully');
  })
);

/**
 * @route GET /api/v1/pest-detection/statistics
 * @desc Get pest detection statistics (alias for /stats)
 * @access Admin, Expert
 */
router.get('/statistics',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const { district, startDate, endDate } = req.query;

    const opts = {
      district: district || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    };

    const detections = await db.pestDetections.getStats(opts);

    const severityCounts = detections?.reduce((acc, d) => {
      acc[d.severity] = (acc[d.severity] || 0) + 1;
      return acc;
    }, {}) || {};

    const pestCounts = detections?.reduce((acc, d) => {
      if (d.detected_pest) {
        acc[d.detected_pest] = (acc[d.detected_pest] || 0) + 1;
      }
      return acc;
    }, {}) || {};

    return successResponse(res, {
      byPest: Object.entries(pestCounts).map(([pest, count]) => ({ pest, count })),
      bySeverity: severityCounts,
      totalDetections: detections?.length || 0
    }, 'Pest detection statistics retrieved successfully');
  })
);

/**
 * @route GET /api/v1/pest-detection/scans
 * @desc List pest detection scans (alias for pest-detection list)
 * @access Authenticated
 */
router.get('/scans',
  authenticate,
  validatePagination,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { farmId, page = 1, limit = 20 } = req.query;

    let result;
    if (farmId) {
      result = await db.pestDetections.getByFarm(farmId, {
        page: parseInt(page),
        limit: parseInt(limit)
      });
    } else {
      result = await db.pestDetections.getStats({
        page: parseInt(page),
        limit: parseInt(limit)
      });
    }

    const data = result?.data || result || [];
    const count = result?.total || data.length;

    return paginatedResponse(res, data, parseInt(page), parseInt(limit), count, 'Pest detection scans retrieved successfully');
  })
);

/**
 * @route GET /api/v1/pest-detection/scans/:scanId
 * @desc Get pest detection scan by ID (alias for /:detectionId)
 * @access Authenticated
 */
router.get('/scans/:scanId',
  authenticate,
  asyncHandler(async (req, res) => {
    const detection = await db.pestDetections.getById(req.params.scanId);

    if (!detection) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found',
        code: 'NOT_FOUND'
      });
    }

    if (req.user.role === ROLES.FARMER) {
      const farmUserId = await db.farms.getUserId(detection.farm_id);
      if (farmUserId !== req.user._id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
          code: 'FORBIDDEN'
        });
      }
    }

    return successResponse(res, detection, 'Scan retrieved successfully');
  })
);

/**
 * @route GET /api/v1/pest-detection/:detectionId
 * @desc Get pest detection by ID
 * @access Owner, Admin, Expert
 */
router.get('/:detectionId',
  authenticate,
  ...validateUUID('detectionId'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const detection = await db.pestDetections.getById(req.params.detectionId);

    if (!detection) {
      return res.status(404).json({
        success: false,
        message: 'Detection not found',
        code: 'NOT_FOUND'
      });
    }

    // Check ownership for farmers
    if (req.user.role === ROLES.FARMER) {
      const farmUserId = await db.farms.getUserId(detection.farm_id);
      if (farmUserId !== req.user._id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
          code: 'FORBIDDEN'
        });
      }
    }

    return successResponse(res, detection, 'Detection retrieved successfully');
  })
);

// =====================================================
// EXPERT REVIEW ROUTES
// =====================================================

/**
 * @route GET /api/v1/pest-detection/pending-review
 * @desc Get detections pending expert review
 * @access Admin, Expert
 */
router.get('/pending-review',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  validatePagination,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, district, severity } = req.query;

    const opts = {
      page: parseInt(page),
      limit: parseInt(limit),
      district: district || undefined,
      severity: severity || undefined
    };

    const result = await db.pestDetections.getUnreviewed(opts);
    const data = result.data || result;
    const count = result.total || data.length;

    return paginatedResponse(res, data, parseInt(page), parseInt(limit), count, 'Pending reviews retrieved successfully');
  })
);

/**
 * @route POST /api/v1/pest-detection/:detectionId/review
 * @desc Submit expert review for a detection
 * @access Admin, Expert
 */
router.post('/:detectionId/review',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  ...validateUUID('detectionId'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { detectionId } = req.params;
    const { 
      confirmedPest, 
      confirmedSeverity, 
      status, 
      expertNotes, 
      treatmentRecommendations 
    } = req.body;

    const detection = await db.pestDetections.update(detectionId, {
      detected_pest: confirmedPest,
      severity: confirmedSeverity,
      status: status || 'confirmed',
      expert_notes: expertNotes,
      treatment_recommendations: treatmentRecommendations,
      reviewed_by: req.user._id,
      reviewed_at: new Date().toISOString()
    });

    // Create or update recommendation based on expert review
    if (confirmedPest && status === 'confirmed') {
      await recommendationService.createPestAlert(detection.farm_id, {
        pestName: confirmedPest,
        severity: confirmedSeverity,
        detectionId: detection._id,
        recommendations: treatmentRecommendations,
        expertVerified: true,
        expertId: req.user.id
      });
    }

    return successResponse(res, detection, 'Detection reviewed successfully');
  })
);

// =====================================================
// STATISTICS & REPORTING
// =====================================================

/**
 * @route GET /api/v1/pest-detection/stats
 * @desc Get pest detection statistics
 * @access Admin, Expert
 */
router.get('/stats',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const { district, startDate, endDate } = req.query;

    const opts = {
      district: district || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    };

    // Get detection stats
    const detections = await db.pestDetections.getStats(opts);

    // Calculate severity counts
    const severityCounts = detections?.reduce((acc, d) => {
      acc[d.severity] = (acc[d.severity] || 0) + 1;
      return acc;
    }, {}) || {};

    // Calculate pest type counts
    const pestCounts = detections?.reduce((acc, d) => {
      if (d.detected_pest) {
        acc[d.detected_pest] = (acc[d.detected_pest] || 0) + 1;
      }
      return acc;
    }, {}) || {};

    return successResponse(res, {
      byPest: Object.entries(pestCounts).map(([pest, count]) => ({ pest, count })),
      bySeverity: severityCounts,
      totalDetections: detections?.length || 0
    }, 'Pest detection statistics retrieved successfully');
  })
);

/**
 * @route GET /api/v1/pest-detection/outbreak-map
 * @desc Get pest outbreak map data
 * @access Admin, Expert
 */
router.get('/outbreak-map',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const opts = {
      since: startDate.toISOString(),
      status: ['confirmed', 'pending_review']
    };

    const data = await db.pestDetections.getOutbreakMap(opts);

    // Group by district for outbreak analysis
    const byDistrict = data?.reduce((acc, d) => {
      const district = d.farm?.district || d.district || 'Unknown';
      if (!acc[district]) {
        acc[district] = { count: 0, detections: [], severity: { low: 0, medium: 0, high: 0, critical: 0 } };
      }
      acc[district].count++;
      acc[district].detections.push(d);
      if (d.severity) acc[district].severity[d.severity]++;
      return acc;
    }, {}) || {};

    return successResponse(res, {
      detections: data,
      byDistrict,
      period: { days: parseInt(days), startDate: startDate.toISOString() }
    }, 'Outbreak map data retrieved successfully');
  })
);

// =====================================================
// ADDITIONAL DETECTION PARAM ROUTES
// =====================================================

/**
 * @route DELETE /api/v1/pest-detection/:detectionId
 * @desc Delete (soft-delete) a pest detection
 * @access Admin, Expert
 */
router.delete('/:detectionId',
  authenticate,
  requireMinimumRole(ROLES.EXPERT),
  ...validateUUID('detectionId'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const detection = await db.pestDetections.getById(req.params.detectionId);

    if (!detection) {
      return res.status(404).json({
        success: false,
        message: 'Detection not found',
        code: 'NOT_FOUND'
      });
    }

    await db.pestDetections.update(req.params.detectionId, {
      status: 'deleted',
      deleted_at: new Date().toISOString(),
      deleted_by: req.user._id
    });

    return successResponse(res, { id: req.params.detectionId }, 'Pest detection deleted successfully');
  })
);

/**
 * @route GET /api/v1/pest-detection/:detectionId/treatments
 * @desc Get treatment recommendations for a detection
 * @access Authenticated
 */
router.get('/:detectionId/treatments',
  authenticate,
  ...validateUUID('detectionId'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const detection = await db.pestDetections.getById(req.params.detectionId);

    if (!detection) {
      return res.status(404).json({
        success: false,
        message: 'Detection not found',
        code: 'NOT_FOUND'
      });
    }

    // Check ownership for farmers
    if (req.user.role === ROLES.FARMER) {
      const farmUserId = await db.farms.getUserId(detection.farm_id);
      if (farmUserId !== req.user._id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
          code: 'FORBIDDEN'
        });
      }
    }

    const treatments = {
      detectionId: req.params.detectionId,
      detectedPest: detection.detected_pest,
      severity: detection.severity,
      treatments: detection.treatment_recommendations || [],
      aiRecommendations: detection.ai_analysis?.recommendations || [],
      expertNotes: detection.expert_notes || null
    };

    return successResponse(res, treatments, 'Treatment recommendations retrieved successfully');
  })
);

export default router;
