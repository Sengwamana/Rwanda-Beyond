/**
 * Image Service
 * 
 * Handles image uploads, processing, and management using Cloudinary.
 * Primarily used for pest detection image workflows.
 * 
 * @module services/imageService
 */

import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { db } from '../database/convex.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

const bufferToDataUrl = (imageData, mimeType = 'image/jpeg') => {
  if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
    return imageData;
  }

  if (Buffer.isBuffer(imageData)) {
    return `data:${mimeType};base64,${imageData.toString('base64')}`;
  }

  return null;
};

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret
});

const PEST_IMAGE_QUALITY_RULES = {
  minBytes: 40 * 1024,
  minWidth: 320,
  minHeight: 320,
};

const formatQualityIssues = (issues) => {
  if (issues.length === 0) {
    return '';
  }

  return `${issues.join(' ')} Please upload a clear, close-up image of the affected maize leaves or pest damage.`;
};

const logPestAuditEvent = async (entry) => {
  try {
    await db.auditLogs.create({
      ...entry,
      created_at: Date.now(),
    });
  } catch (error) {
    logger.warn('Failed to write image-service audit log:', error?.message || error);
  }
};

/**
 * Cloudinary storage configuration for multer
 */
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Generate folder path based on farm ID
    const farmId = req.body.farmId || req.params.farmId || 'unassigned';
    
    return {
      folder: `smart_maize/pest_detections/${farmId}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { width: 1024, height: 1024, crop: 'limit' },
        { quality: 'auto:good' }
      ],
      resource_type: 'image'
    };
  }
});

/**
 * File filter for image uploads
 */
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

/**
 * Multer upload middleware
 */
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  }
});

export const validatePestImageFile = (file) => {
  const issues = [];

  if (!file) {
    issues.push('Image file is missing.');
  } else if (typeof file.size === 'number' && file.size < PEST_IMAGE_QUALITY_RULES.minBytes) {
    issues.push(`Image file is too small. Minimum size is ${Math.round(PEST_IMAGE_QUALITY_RULES.minBytes / 1024)}KB.`);
  }

  return {
    valid: issues.length === 0,
    issues,
    message: formatQualityIssues(issues),
  };
};

export const validateUploadedPestImage = (image) => {
  const issues = [];

  if (typeof image?.width === 'number' && image.width < PEST_IMAGE_QUALITY_RULES.minWidth) {
    issues.push(`Image width is too small. Minimum width is ${PEST_IMAGE_QUALITY_RULES.minWidth}px.`);
  }

  if (typeof image?.height === 'number' && image.height < PEST_IMAGE_QUALITY_RULES.minHeight) {
    issues.push(`Image height is too small. Minimum height is ${PEST_IMAGE_QUALITY_RULES.minHeight}px.`);
  }

  return {
    valid: issues.length === 0,
    issues,
    message: formatQualityIssues(issues),
  };
};

export const deleteUploadedImages = async (uploads = []) => {
  await Promise.all(
    uploads
      .filter((upload) => upload?.publicId)
      .map((upload) => deleteImage(upload.publicId).catch(() => null))
  );
};

/**
 * Upload image directly to Cloudinary
 * @param {Buffer|string} imageData - Image buffer or base64 string
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Upload result
 */
export const uploadImage = async (imageData, options = {}) => {
  const {
    farmId = 'unassigned',
    folder = 'pest_detections',
    transformation = [],
    mimeType = 'image/jpeg'
  } = options;

  try {
    const uploadOptions = {
      folder: `smart_maize/${folder}/${farmId}`,
      resource_type: 'image',
      transformation: [
        { width: 1024, height: 1024, crop: 'limit' },
        { quality: 'auto:good' },
        ...transformation
      ]
    };

    // Handle both buffer and base64
    let uploadData = imageData;
    if (Buffer.isBuffer(imageData)) {
      uploadData = `data:image/jpeg;base64,${imageData.toString('base64')}`;
    }

    const result = await cloudinary.uploader.upload(uploadData, uploadOptions);

    logger.info(`Image uploaded: ${result.public_id}`);

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes
    };

  } catch (error) {
    logger.error('Cloudinary upload failed:', error);

    if (config.server.isDevelopment) {
      const fallbackUrl = bufferToDataUrl(imageData, mimeType);

      if (fallbackUrl) {
        logger.warn('Falling back to in-memory data URL image storage for development');
        return {
          url: fallbackUrl,
          publicId: undefined,
          width: undefined,
          height: undefined,
          format: mimeType.split('/')[1] || 'jpeg',
          bytes: Buffer.isBuffer(imageData) ? imageData.byteLength : undefined
        };
      }
    }

    throw new Error('Image upload failed');
  }
};

/**
 * Generate thumbnail URL for an image
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} options - Thumbnail options
 * @returns {string} Thumbnail URL
 */
export const getThumbnailUrl = (publicId, options = {}) => {
  const { width = 200, height = 200 } = options;

  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'fill',
    quality: 'auto:low',
    format: 'jpg'
  });
};

/**
 * Generate AI-optimized URL for pest detection
 * @param {string} publicId - Cloudinary public ID
 * @returns {string} AI-optimized image URL
 */
export const getAIOptimizedUrl = (publicId) => {
  return cloudinary.url(publicId, {
    width: 224,
    height: 224,
    crop: 'fill',
    quality: 'auto:best',
    format: 'jpg'
  });
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.info(`Image deleted: ${publicId}`);
    return result;
  } catch (error) {
    logger.error('Cloudinary deletion failed:', error);
    throw error;
  }
};

/**
 * Process uploaded pest detection image
 * @param {Object} file - Uploaded file from multer
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Processed image data
 */
export const processPestDetectionImage = async (file, metadata = {}) => {
  const {
    farmId,
    userId,
    locationDescription,
    latitude,
    longitude,
    capturedAt,
  } = metadata;

  // Generate thumbnail
  const thumbnailUrl = getThumbnailUrl(file.filename);
  
  // Generate AI-optimized URL
  const aiOptimizedUrl = getAIOptimizedUrl(file.filename);

  // Store in database
  try {
    const data = await db.pestDetections.create({
      farm_id: farmId,
      reported_by: userId,
      image_url: file.path,
      cloudinary_public_id: file.filename,
      thumbnail_url: thumbnailUrl,
      location_description: locationDescription,
      latitude,
      longitude,
      detection_metadata: capturedAt ? { captured_at: new Date(capturedAt).toISOString() } : undefined,
      pest_detected: false, // Will be updated after AI analysis
      severity: 'none'
    });

    await logPestAuditEvent({
      user_id: userId,
      action: 'CREATE_PEST_DETECTION',
      entity_type: 'pest_detections',
      entity_id: data._id,
      new_values: {
        farm_id: farmId,
        image_url: file.path,
        latitude,
        longitude,
        captured_at: capturedAt ? new Date(capturedAt).toISOString() : undefined,
      },
    });

    logger.info(`Pest detection image processed: ${data._id}`);

    return {
      detectionId: data._id,
      imageUrl: file.path,
      thumbnailUrl,
      aiOptimizedUrl,
      publicId: file.filename,
      capturedAt: capturedAt ? new Date(capturedAt).toISOString() : undefined,
    };
  } catch (error) {
    // Clean up uploaded image on database error
    await deleteImage(file.filename).catch(() => {});
    throw error;
  }
};

/**
 * Get images for a farm
 * @param {string} farmId - Farm UUID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} List of images
 */
export const getFarmImages = async (farmId, options = {}) => {
  const { page = 1, limit = 20, pestDetectedOnly = false } = options;

  const result = await db.pestDetections.getByFarm(farmId, {
    page,
    limit,
    pestDetected: pestDetectedOnly ? true : undefined
  });

  const data = result?.data || result || [];
  const total = result?.count ?? result?.total ?? data.length;

  return {
    images: data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};

/**
 * Update pest detection results
 * @param {string} detectionId - Pest detection UUID
 * @param {Object} results - AI detection results
 * @returns {Promise<Object>} Updated detection record
 */
export const updateDetectionResults = async (detectionId, results) => {
  const {
    pestDetected,
    pestType,
    severity,
    confidenceScore,
    affectedAreaPercentage,
    modelVersion,
    detectionMetadata
  } = results;

  const existing = await db.pestDetections.getById(detectionId);
  if (!existing) {
    throw new NotFoundError('Pest detection not found');
  }

  const data = await db.pestDetections.update(detectionId, {
    pest_detected: pestDetected,
    pest_type: pestType,
    severity,
    confidence_score: confidenceScore,
    affected_area_percentage: affectedAreaPercentage,
    model_version: modelVersion,
    detection_metadata: detectionMetadata
  });
  if (!data) {
    throw new NotFoundError('Pest detection not found');
  }

  await logPestAuditEvent({
    user_id: existing?.reported_by,
    action: 'UPDATE_PEST_DETECTION_RESULTS',
    entity_type: 'pest_detections',
    entity_id: detectionId,
    old_values: existing
      ? {
          pest_detected: existing.pest_detected,
          pest_type: existing.pest_type,
          severity: existing.severity,
          confidence_score: existing.confidence_score,
        }
      : undefined,
    new_values: {
      pest_detected: pestDetected,
      pest_type: pestType,
      severity,
      confidence_score: confidenceScore,
    },
  });

  logger.info(`Detection results updated: ${detectionId}, pest_detected: ${pestDetected}`);
  return data;
};

/**
 * Add expert review to detection
 * @param {string} detectionId - Pest detection UUID
 * @param {string} expertId - Expert user UUID
 * @param {Object} review - Review data
 * @returns {Promise<Object>} Updated detection record
 */
export const addExpertReview = async (detectionId, expertId, review) => {
  const { isConfirmed, notes } = review;

  const existing = await db.pestDetections.getById(detectionId);
  if (!existing) {
    throw new NotFoundError('Pest detection not found');
  }

  const data = await db.pestDetections.update(detectionId, {
    reviewed_by: expertId,
    reviewed_at: Date.now(),
    is_confirmed: isConfirmed,
    expert_notes: notes
  });
  if (!data) {
    throw new NotFoundError('Pest detection not found');
  }

  await logPestAuditEvent({
    user_id: expertId,
    action: 'REVIEW_PEST_DETECTION',
    entity_type: 'pest_detections',
    entity_id: detectionId,
    old_values: existing
      ? {
          reviewed_by: existing.reviewed_by,
          is_confirmed: existing.is_confirmed,
          expert_notes: existing.expert_notes,
        }
      : undefined,
    new_values: {
      reviewed_by: expertId,
      is_confirmed: isConfirmed,
      expert_notes: notes,
    },
  });

  logger.info(`Expert review added to detection ${detectionId} by ${expertId}`);
  return data;
};

/**
 * Get unreviewed detections (for expert dashboard)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Unreviewed detections
 */
export const getUnreviewedDetections = async (options = {}) => {
  const { page = 1, limit = 20, minConfidence = 0.5 } = options;

  const result = await db.pestDetections.getUnreviewed({ page, limit, minConfidence });

  const data = result?.data || result || [];
  const total = result?.count ?? result?.total ?? data.length;

  return {
    detections: data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};

/**
 * Get pest detection statistics
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Detection statistics
 */
export const getDetectionStats = async (options = {}) => {
  const { farmId, startDate, endDate } = options;

  const stats = await db.pestDetections.getStats({
    ...(farmId ? { farmId } : {}),
    ...(startDate ? { since: new Date(startDate).getTime() } : {}),
    ...(endDate ? { until: new Date(endDate).getTime() } : {})
  });

  return stats;
};

/**
 * Cleanup old images (scheduled job)
 * @param {number} daysOld - Delete images older than this many days
 */
export const cleanupOldImages = async (daysOld = 90) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  // Get old images that are not confirmed positives
  const data = await db.pestDetections.getOldImages(cutoffDate.getTime());

  if (!data || data.length === 0) {
    logger.info('No old images to clean up');
    return;
  }

  logger.info(`Cleaning up ${data.length} old images`);

  await Promise.all(
    data.map(async (record) => {
      try {
        if (record.cloudinary_public_id) {
          await deleteImage(record.cloudinary_public_id);
        }

        const detectionId = record.id || record._id;
        await db.pestDetections.remove(detectionId);
        await logPestAuditEvent({
          action: 'DELETE_PEST_DETECTION',
          entity_type: 'pest_detections',
          entity_id: detectionId,
          old_values: {
            cloudinary_public_id: record.cloudinary_public_id || null,
            created_at: record.created_at || null,
            reviewed_by: record.reviewed_by || null,
            is_confirmed: record.is_confirmed,
          },
          new_values: {
            deleted_by_cleanup: true,
            retention_days: daysOld,
          },
        });
      } catch (cleanupError) {
        logger.error(`Failed to cleanup image ${record.id || record._id}:`, cleanupError);
      }
    })
  );

  logger.info('Image cleanup completed');
};

export default {
  upload,
  uploadImage,
  validatePestImageFile,
  validateUploadedPestImage,
  deleteUploadedImages,
  getThumbnailUrl,
  getAIOptimizedUrl,
  deleteImage,
  processPestDetectionImage,
  getFarmImages,
  updateDetectionResults,
  addExpertReview,
  getUnreviewedDetections,
  getDetectionStats,
  cleanupOldImages
};
