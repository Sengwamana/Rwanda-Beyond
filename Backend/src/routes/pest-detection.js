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
import logger from '../utils/logger.js';
import * as imageService from '../services/imageService.js';
import * as aiService from '../services/aiService.js';
import * as recommendationService from '../services/recommendationService.js';

const router = Router();

const logPestAuditEvent = async (entry) => {
  try {
    await db.auditLogs.create({
      ...entry,
      created_at: Date.now(),
    });
  } catch (error) {
    logger.warn('Failed to write pest audit log:', error?.message || error);
  }
};

const parseLocationPayload = (location) => {
  if (!location) {
    return null;
  }

  if (typeof location === 'object') {
    return location;
  }

  if (typeof location === 'string') {
    try {
      return JSON.parse(location);
    } catch {
      throw new Error('Location must be valid JSON');
    }
  }

  throw new Error('Location must be a JSON object or JSON string');
};

const normalizeCapturedAt = (capturedAt) => {
  if (!capturedAt) {
    return null;
  }

  const parsedTimestamp = Date.parse(capturedAt);
  if (!Number.isFinite(parsedTimestamp)) {
    throw new Error('capturedAt must be a valid timestamp');
  }

  return new Date(parsedTimestamp).toISOString();
};

const normalizePestDetectedFilter = (value) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (['detected', 'positive', 'true'].includes(normalized)) {
    return true;
  }
  if (['clear', 'negative', 'false', 'none'].includes(normalized)) {
    return false;
  }

  return undefined;
};

const parseOptionalTimestamp = (value) => {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
};

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

    for (const file of req.files) {
      const qualityCheck = imageService.validatePestImageFile(file);
      if (!qualityCheck.valid) {
        return res.status(400).json({
          success: false,
          message: qualityCheck.message,
          code: 'LOW_QUALITY_IMAGE'
        });
      }
    }

    const { location, notes, severity, capturedAt, captured_at } = req.body;
    const farmId = req.params.farmId;
    const farm = await db.farms.getById(farmId);

    if (!farm || farm.is_active === false) {
      return res.status(404).json({
        success: false,
        message: 'Farm not found',
        code: 'NOT_FOUND'
      });
    }

    let parsedLocation = null;
    try {
      parsedLocation = parseLocationPayload(location);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'VALIDATION_ERROR'
      });
    }

    const primaryFile = req.files[0];
    const primaryUpload = await imageService.uploadImage(primaryFile.buffer, {
      farmId,
      folder: 'pest_detections'
    });
    const primaryQualityCheck = imageService.validateUploadedPestImage(primaryUpload);

    if (!primaryQualityCheck.valid) {
      await imageService.deleteUploadedImages([primaryUpload]);
      return res.status(400).json({
        success: false,
        message: primaryQualityCheck.message,
        code: 'LOW_QUALITY_IMAGE'
      });
    }
    let imageCapturedAt = null;
    try {
      imageCapturedAt = normalizeCapturedAt(capturedAt || captured_at);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'VALIDATION_ERROR'
      });
    }

    // Run AI analysis on first image
    const analysisResult = await aiService.analyzePestImage(
      primaryUpload.url,
      { farmId, location: parsedLocation, notes }
    );

    const additionalUploads = req.files.length > 1
      ? await Promise.all(
          req.files.slice(1).map((file) =>
            imageService.uploadImage(file.buffer, {
              farmId,
              folder: 'pest_detections'
            })
          )
        )
      : [];

    const uploadResults = [primaryUpload, ...additionalUploads];
    const lowQualityUpload = additionalUploads
      .map((result) => imageService.validateUploadedPestImage(result))
      .find((check) => !check.valid);

    if (lowQualityUpload) {
      await imageService.deleteUploadedImages(uploadResults);
      return res.status(400).json({
        success: false,
        message: lowQualityUpload.message,
        code: 'LOW_QUALITY_IMAGE'
      });
    }

    const imageUrls = uploadResults.map(r => r.url);

    // Create pest detection record
    const detection = await db.pestDetections.create({
      farm_id: farmId,
      reported_by: req.user.id,
      image_url: imageUrls[0],
      cloudinary_public_id: primaryUpload.publicId,
      thumbnail_url: primaryUpload.publicId
        ? imageService.getThumbnailUrl(primaryUpload.publicId)
        : imageUrls[0],
      pest_detected: analysisResult.pestDetected,
      pest_type: analysisResult.pestType,
      severity: severity || analysisResult.severity || 'none',
      confidence_score: analysisResult.confidenceScore,
      affected_area_percentage: analysisResult.affectedAreaPercentage,
      model_version: analysisResult.modelVersion,
      detection_metadata: {
        analysis: analysisResult,
        additional_image_urls: imageUrls.slice(1),
        location: parsedLocation,
        notes,
        ...(imageCapturedAt ? { captured_at: imageCapturedAt } : {}),
      },
      location_description: notes,
      latitude: parsedLocation?.lat,
      longitude: parsedLocation?.lng,
    });

    await logPestAuditEvent({
      user_id: req.user.id,
      action: 'CREATE_PEST_DETECTION',
      entity_type: 'pest_detections',
      entity_id: detection._id,
      new_values: {
        farm_id: farmId,
        image_url: imageUrls[0],
        pest_detected: detection.pest_detected,
        pest_type: detection.pest_type,
        severity: detection.severity,
        confidence_score: detection.confidence_score,
      },
    });

    // Create pest alert recommendation if detected
    if (aiService.shouldCreatePestAlertRecommendation(analysisResult)) {
      Promise.resolve()
        .then(() =>
          recommendationService.createPestAlertRecommendation(farmId, {
            pestDetectionId: detection._id,
            pestType: analysisResult.pestType,
            severity: analysisResult.severity,
            confidence: analysisResult.confidenceScore,
            affectedArea: analysisResult.affectedAreaPercentage,
            imageUrl: imageUrls[0],
            recommendations: analysisResult.recommendations,
            expertVerified: false,
          })
        )
        .catch((error) => {
          logger.warn('Failed to create pest alert recommendation:', error?.message || error);
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
      { farmId: detection.farm_id, existingAnalysis: detection.detection_metadata?.analysis }
    );

    // Update detection with new analysis
    const updated = await db.pestDetections.update(req.params.detectionId, {
      pest_detected: analysisResult.pestDetected,
      pest_type: analysisResult.pestType,
      severity: analysisResult.severity || detection.severity || 'none',
      confidence_score: analysisResult.confidenceScore,
      affected_area_percentage: analysisResult.affectedAreaPercentage ?? detection.affected_area_percentage,
      model_version: analysisResult.modelVersion || detection.model_version,
      detection_metadata: {
        ...(detection.detection_metadata || {}),
        analysis: analysisResult,
        reanalysis: analysisResult,
        reanalyzedAt: new Date().toISOString(),
        reanalyzedBy: req.user._id
      }
    });
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Detection not found',
        code: 'NOT_FOUND'
      });
    }

    await logPestAuditEvent({
      user_id: req.user.id,
      action: 'REANALYZE_PEST_DETECTION',
      entity_type: 'pest_detections',
      entity_id: req.params.detectionId,
      old_values: {
        pest_detected: detection.pest_detected,
        pest_type: detection.pest_type,
        severity: detection.severity,
        confidence_score: detection.confidence_score,
      },
      new_values: {
        pest_detected: analysisResult.pestDetected,
        pest_type: analysisResult.pestType,
        severity: analysisResult.severity || detection.severity || 'none',
        confidence_score: analysisResult.confidenceScore,
      },
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
      pestDetected: normalizePestDetectedFilter(status),
      severity: severity || undefined,
      since: parseOptionalTimestamp(startDate),
      until: parseOptionalTimestamp(endDate),
    };

    const result = await db.pestDetections.getByFarm(req.params.farmId, opts);
    const data = result.data || result;
    const count = result.count ?? result.total ?? data.length;

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
    const { page = 1, limit = 20, status, severity, farmId, startDate, endDate } = req.query;

    const opts = {
      page: parseInt(page),
      limit: parseInt(limit),
      pestDetected: normalizePestDetectedFilter(status),
      severity: severity || undefined,
      since: parseOptionalTimestamp(startDate),
      until: parseOptionalTimestamp(endDate),
    };

    let result;
    if (farmId) {
      result = await db.pestDetections.getByFarm(farmId, opts);
    } else {
      result = await db.pestDetections.list(opts);
    }

    const data = result?.data || result || [];
    const count = result?.count ?? result?.total ?? data.length;

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
    const since = parseOptionalTimestamp(startDate);
    const until = parseOptionalTimestamp(endDate);
    let detections = await db.pestDetections.getStats({ since, until });

    if (district) {
      const farms = await db.farms.list({ page: 1, limit: 1000, districtId: district });
      const farmIds = new Set((farms?.data || farms || []).map((farm) => String(farm?._id || farm?.id)));
      detections = (detections || []).filter((d) => farmIds.has(String(d?.farm_id)));
    }

    const severityCounts = detections?.reduce((acc, d) => {
      acc[d.severity] = (acc[d.severity] || 0) + 1;
      return acc;
    }, {}) || {};

    const pestCounts = detections?.reduce((acc, d) => {
      if (d.pest_type) {
        acc[d.pest_type] = (acc[d.pest_type] || 0) + 1;
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
      return res.status(400).json({
        success: false,
        message: 'farmId is required for scan listing',
        code: 'VALIDATION_ERROR'
      });
    }

    const data = result?.data || result || [];
    const count = result?.count ?? result?.total ?? data.length;

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
      severity: severity || undefined
    };

    const result = await db.pestDetections.getUnreviewed(opts);
    const data = result.data || result;
    const count = result.count ?? result.total ?? data.length;

    return paginatedResponse(res, data, parseInt(page), parseInt(limit), count, 'Pending reviews retrieved successfully');
  })
);

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
    const since = parseOptionalTimestamp(startDate);
    const until = parseOptionalTimestamp(endDate);
    let detections = await db.pestDetections.getStats({ since, until });

    if (district) {
      const farms = await db.farms.list({ page: 1, limit: 1000, districtId: district });
      const farmIds = new Set((farms?.data || farms || []).map((farm) => String(farm?._id || farm?.id)));
      detections = (detections || []).filter((d) => farmIds.has(String(d?.farm_id)));
    }

    // Calculate severity counts
    const severityCounts = detections?.reduce((acc, d) => {
      acc[d.severity] = (acc[d.severity] || 0) + 1;
      return acc;
    }, {}) || {};

    // Calculate pest type counts
    const pestCounts = detections?.reduce((acc, d) => {
      if (d.pest_type) {
        acc[d.pest_type] = (acc[d.pest_type] || 0) + 1;
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
      since: startDate.getTime(),
      statuses: ['detected']
    };

    const data = await db.pestDetections.getOutbreakMap(opts);

    // Group by district for outbreak analysis
    const byDistrict = data?.reduce((acc, d) => {
      const district = d.farm?.district?.name || d.farm?.district_id || d.district || 'Unknown';
      if (!acc[district]) {
        acc[district] = {
          count: 0,
          detections: [],
          severity: { none: 0, low: 0, moderate: 0, high: 0, severe: 0 },
        };
      }
      acc[district].count++;
      acc[district].detections.push(d);
      if (d.severity && Object.prototype.hasOwnProperty.call(acc[district].severity, d.severity)) {
        acc[district].severity[d.severity]++;
      }
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
// PARAMETERIZED DETECTION ROUTES
// Must be defined AFTER all named routes above
// =====================================================

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
// EXPERT REVIEW ROUTES (param-based, must be after named routes)
// =====================================================

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
      pestType,
      confirmedSeverity,
      severity,
      isConfirmed,
      expertNotes, 
      treatmentRecommendations 
    } = req.body;

    const existingDetection = await db.pestDetections.getById(detectionId);

    if (!existingDetection) {
      return res.status(404).json({
        success: false,
        message: 'Detection not found',
        code: 'NOT_FOUND'
      });
    }

    const resolvedPestType = confirmedPest || pestType || (isConfirmed ? existingDetection.pest_type : 'none');
    const resolvedSeverity = confirmedSeverity || severity || (isConfirmed ? existingDetection.severity : 'none');
    const reviewConfirmed = typeof isConfirmed === 'boolean' ? isConfirmed : Boolean(confirmedPest || pestType);

    const detection = await db.pestDetections.update(detectionId, {
      pest_type: reviewConfirmed ? resolvedPestType : 'none',
      severity: reviewConfirmed ? resolvedSeverity : 'none',
      pest_detected: reviewConfirmed,
      is_confirmed: reviewConfirmed,
      expert_notes: expertNotes,
      reviewed_by: req.user._id,
      reviewed_at: Date.now(),
      detection_metadata: {
        ...(existingDetection.detection_metadata || {}),
        expertReview: {
          isConfirmed: reviewConfirmed,
          pestType: reviewConfirmed ? resolvedPestType : 'none',
          severity: reviewConfirmed ? resolvedSeverity : 'none',
          expertNotes: expertNotes || '',
          treatmentRecommendations: treatmentRecommendations || [],
          reviewedBy: req.user._id,
          reviewedAt: new Date().toISOString(),
        },
      },
    });
    if (!detection) {
      return res.status(404).json({
        success: false,
        message: 'Detection not found',
        code: 'NOT_FOUND'
      });
    }

    await logPestAuditEvent({
      user_id: req.user.id,
      action: 'REVIEW_PEST_DETECTION',
      entity_type: 'pest_detections',
      entity_id: detectionId,
      old_values: {
        pest_detected: existingDetection.pest_detected,
        pest_type: existingDetection.pest_type,
        severity: existingDetection.severity,
        is_confirmed: existingDetection.is_confirmed,
        reviewed_by: existingDetection.reviewed_by,
      },
      new_values: {
        pest_detected: reviewConfirmed,
        pest_type: reviewConfirmed ? resolvedPestType : 'none',
        severity: reviewConfirmed ? resolvedSeverity : 'none',
        is_confirmed: reviewConfirmed,
        reviewed_by: req.user.id,
      },
    });

    if (
      aiService.shouldCreatePestAlertRecommendation({
        pestDetected: reviewConfirmed,
        confidenceScore: detection.confidence_score,
        severity: reviewConfirmed ? resolvedSeverity : 'none',
        expertVerified: true,
      })
    ) {
      Promise.resolve()
        .then(() =>
          recommendationService.createPestAlertRecommendation(detection.farm_id, {
            pestDetectionId: detection._id,
            pestType: resolvedPestType,
            severity: resolvedSeverity,
            confidence: detection.confidence_score,
            affectedArea: detection.affected_area_percentage,
            imageUrl: detection.image_url,
            recommendations: treatmentRecommendations || detection.detection_metadata?.analysis?.recommendations || [],
            expertVerified: true,
            expertId: req.user.id,
          })
        )
        .catch((error) => {
          logger.warn('Failed to create expert-confirmed pest alert recommendation:', error?.message || error);
        });
    }

    return successResponse(res, detection, 'Detection reviewed successfully');
  })
);

// =====================================================
// ADDITIONAL DETECTION PARAM ROUTES
// =====================================================

/**
 * @route DELETE /api/v1/pest-detection/:detectionId
 * @desc Delete a pest detection
 * @access Owner, Admin, Expert
 */
router.delete('/:detectionId',
  authenticate,
  ...validateUUID('detectionId'),
  handleValidationErrors,
  requireOwnership(getDetectionUserId),
  asyncHandler(async (req, res) => {
    const detection = await db.pestDetections.getById(req.params.detectionId);

    if (!detection) {
      return res.status(404).json({
        success: false,
        message: 'Detection not found',
        code: 'NOT_FOUND'
      });
    }

    await db.pestDetections.remove(req.params.detectionId);

    await logPestAuditEvent({
      user_id: req.user.id,
      action: 'DELETE_PEST_DETECTION',
      entity_type: 'pest_detections',
      entity_id: req.params.detectionId,
      old_values: {
        farm_id: detection.farm_id,
        image_url: detection.image_url,
        pest_detected: detection.pest_detected,
        pest_type: detection.pest_type,
        severity: detection.severity,
      },
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
