// =====================================================
// Image Upload Service
// Smart Maize Farming System
// Cloudinary Integration for Pest Detection
// =====================================================

import { api } from './apiClient';

// =====================================================
// Types
// =====================================================

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  resourceType: string;
}

export interface PestAnalysisResult {
  scanId: string;
  imageUrl: string;
  status: 'processing' | 'completed' | 'failed';
  result?: {
    detected: boolean;
    pest?: {
      name: string;
      scientificName?: string;
      confidence: number;
    };
    severity?: 'low' | 'medium' | 'high' | 'critical';
    affectedArea?: number;
    recommendations?: string[];
    treatmentOptions?: {
      organic: string[];
      chemical: string[];
    };
  };
  processedAt?: string;
}

export interface ImageValidationError {
  type: 'size' | 'format' | 'dimensions';
  message: string;
}

// =====================================================
// Configuration
// =====================================================

const IMAGE_CONFIG = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedFormats: ['image/jpeg', 'image/png', 'image/webp'],
  minWidth: 200,
  minHeight: 200,
  maxWidth: 4096,
  maxHeight: 4096,
};

// =====================================================
// Image Validation
// =====================================================

export async function validateImage(file: File): Promise<ImageValidationError | null> {
  // Check file size
  if (file.size > IMAGE_CONFIG.maxSizeBytes) {
    return {
      type: 'size',
      message: `Image size must be less than ${IMAGE_CONFIG.maxSizeBytes / (1024 * 1024)}MB`,
    };
  }

  // Check file format
  if (!IMAGE_CONFIG.allowedFormats.includes(file.type)) {
    return {
      type: 'format',
      message: `Allowed formats: ${IMAGE_CONFIG.allowedFormats.map((f) => f.split('/')[1]).join(', ')}`,
    };
  }

  // Check dimensions
  try {
    const dimensions = await getImageDimensions(file);
    if (dimensions.width < IMAGE_CONFIG.minWidth || dimensions.height < IMAGE_CONFIG.minHeight) {
      return {
        type: 'dimensions',
        message: `Image must be at least ${IMAGE_CONFIG.minWidth}x${IMAGE_CONFIG.minHeight} pixels`,
      };
    }
    if (dimensions.width > IMAGE_CONFIG.maxWidth || dimensions.height > IMAGE_CONFIG.maxHeight) {
      return {
        type: 'dimensions',
        message: `Image must be at most ${IMAGE_CONFIG.maxWidth}x${IMAGE_CONFIG.maxHeight} pixels`,
      };
    }
  } catch (error) {
    return {
      type: 'format',
      message: 'Unable to read image. Please try a different file.',
    };
  }

  return null;
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

// =====================================================
// Image Compression (Client-side)
// =====================================================

export async function compressImage(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {}
): Promise<File> {
  const { maxWidth = 1920, maxHeight = 1080, quality = 0.85 } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);

      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image for compression'));
    };
    img.src = URL.createObjectURL(file);
  });
}

// =====================================================
// Upload with Progress Tracking
// =====================================================

export async function uploadImage(
  file: File,
  endpoint: string,
  additionalData?: Record<string, string>,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('image', file);
  
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  return api.upload<UploadResult>(endpoint, formData, {
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        onProgress({
          loaded: progressEvent.loaded,
          total: progressEvent.total,
          percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total),
        });
      }
    },
  });
}

// =====================================================
// Pest Detection Image Upload
// =====================================================

export async function uploadPestImage(
  file: File,
  farmId: string,
  options?: {
    compress?: boolean;
    onProgress?: (progress: UploadProgress) => void;
    location?: { latitude: number; longitude: number };
  }
): Promise<PestAnalysisResult> {
  // Validate image
  const validationError = await validateImage(file);
  if (validationError) {
    throw new Error(validationError.message);
  }

  // Optionally compress image
  let imageToUpload = file;
  if (options?.compress !== false) {
    try {
      imageToUpload = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.9,
      });
    } catch (error) {
      console.warn('Image compression failed, uploading original:', error);
    }
  }

  // Prepare additional data
  const additionalData: Record<string, string> = {
    farmId,
  };
  
  if (options?.location) {
    additionalData.latitude = String(options.location.latitude);
    additionalData.longitude = String(options.location.longitude);
  }

  // Upload image
  const formData = new FormData();
  formData.append('image', imageToUpload);
  Object.entries(additionalData).forEach(([key, value]) => {
    formData.append(key, value);
  });

  return api.upload<PestAnalysisResult>(`/pest-detection/upload/${farmId}`, formData, {
    onUploadProgress: (progressEvent) => {
      if (options?.onProgress && progressEvent.total) {
        options.onProgress({
          loaded: progressEvent.loaded,
          total: progressEvent.total,
          percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total),
        });
      }
    },
  });
}

// =====================================================
// Poll for Analysis Result
// =====================================================

export async function pollPestAnalysisResult(
  scanId: string,
  options?: {
    maxAttempts?: number;
    intervalMs?: number;
    onStatusUpdate?: (status: PestAnalysisResult['status']) => void;
  }
): Promise<PestAnalysisResult> {
  const { maxAttempts = 30, intervalMs = 2000, onStatusUpdate } = options || {};
  let attempts = 0;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      attempts++;
      
      try {
        const result = await api.get<PestAnalysisResult>(`/pest-detection/scans/${scanId}`);
        
        if (onStatusUpdate) {
          onStatusUpdate(result.status);
        }

        if (result.status === 'completed' || result.status === 'failed') {
          resolve(result);
          return;
        }

        if (attempts >= maxAttempts) {
          reject(new Error('Analysis timed out. Please try again.'));
          return;
        }

        setTimeout(poll, intervalMs);
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}

// =====================================================
// Profile Image Upload
// =====================================================

export async function uploadProfileImage(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  // Validate image
  const validationError = await validateImage(file);
  if (validationError) {
    throw new Error(validationError.message);
  }

  // Compress to smaller size for profile
  const compressedImage = await compressImage(file, {
    maxWidth: 500,
    maxHeight: 500,
    quality: 0.85,
  });

  return uploadImage(compressedImage, '/users/profile/image', undefined, onProgress);
}

// =====================================================
// Farm Image Upload
// =====================================================

export async function uploadFarmImage(
  file: File,
  farmId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  // Validate image
  const validationError = await validateImage(file);
  if (validationError) {
    throw new Error(validationError.message);
  }

  // Compress for web
  const compressedImage = await compressImage(file, {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.85,
  });

  return uploadImage(compressedImage, `/farms/${farmId}/image`, undefined, onProgress);
}

// =====================================================
// Export
// =====================================================

export const imageService = {
  validate: validateImage,
  compress: compressImage,
  upload: uploadImage,
  uploadPestImage,
  pollPestAnalysisResult,
  uploadProfileImage,
  uploadFarmImage,
  config: IMAGE_CONFIG,
};

export default imageService;
