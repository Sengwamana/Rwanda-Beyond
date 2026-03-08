// =====================================================
// Pest Detection Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { 
  PestDetection, 
  ApiResponse, 
  PaginatedResponse 
} from '../types';

function normalizePestDetection(item: any): PestDetection {
  return {
    id: String(item?.id || item?._id || ''),
    farmId: String(item?.farmId || item?.farm_id || item?.farm?.id || ''),
    reportedBy: String(item?.reportedBy || item?.reported_by || item?.reporter?.id || ''),
    imageUrl: item?.imageUrl || item?.image_url || '',
    cloudinaryPublicId: item?.cloudinaryPublicId || item?.cloudinary_public_id || undefined,
    thumbnailUrl: item?.thumbnailUrl || item?.thumbnail_url || undefined,
    pestDetected: item?.pestDetected ?? item?.pest_detected ?? false,
    pestType: item?.pestType || item?.pest_type || undefined,
    severity: item?.severity || 'none',
    confidenceScore: item?.confidenceScore ?? item?.confidence_score,
    affectedAreaPercentage: item?.affectedAreaPercentage ?? item?.affected_area_percentage,
    modelVersion: item?.modelVersion || item?.model_version || undefined,
    detectionMetadata: item?.detectionMetadata || item?.detection_metadata || undefined,
    locationDescription: item?.locationDescription || item?.location_description || undefined,
    coordinates: item?.coordinates || undefined,
    reviewedBy: item?.reviewedBy || item?.reviewed_by || item?.reviewer?.id || undefined,
    reviewedAt:
      item?.reviewedAt
      || (typeof item?.reviewed_at === 'number' ? new Date(item.reviewed_at).toISOString() : item?.reviewed_at)
      || undefined,
    expertNotes: item?.expertNotes || item?.expert_notes || undefined,
    isConfirmed: item?.isConfirmed ?? item?.is_confirmed,
    createdAt:
      item?.createdAt
      || (typeof item?.created_at === 'number' ? new Date(item.created_at).toISOString() : item?.created_at)
      || new Date().toISOString(),
    updatedAt:
      item?.updatedAt
      || (typeof item?.updated_at === 'number' ? new Date(item.updated_at).toISOString() : item?.updated_at)
      || new Date().toISOString(),
    farm: item?.farm ? ({
      id: String(item.farm.id || item.farm._id || ''),
      userId: String(item.farm.userId || item.farm.user_id || ''),
      name: item.farm.name || '',
      cropVariety: item.farm.cropVariety || item.farm.crop_variety || '',
      isActive: item.farm.isActive ?? item.farm.is_active ?? true,
      createdAt: item.farm.createdAt || item.farm.created_at || new Date().toISOString(),
      updatedAt: item.farm.updatedAt || item.farm.updated_at || new Date().toISOString(),
    } as any) : undefined,
    reporter: item?.reporter ? ({
      id: String(item.reporter.id || item.reporter._id || ''),
      clerkId: String(item.reporter.clerkId || item.reporter.clerk_id || item.reporter.id || item.reporter._id || ''),
      role: item.reporter.role || 'farmer',
      preferredLanguage: item.reporter.preferredLanguage || item.reporter.preferred_language || 'en',
      isActive: item.reporter.isActive ?? item.reporter.is_active ?? true,
      isVerified: item.reporter.isVerified ?? item.reporter.is_verified ?? false,
      firstName: item.reporter.firstName || item.reporter.first_name || undefined,
      lastName: item.reporter.lastName || item.reporter.last_name || undefined,
      createdAt: item.reporter.createdAt || item.reporter.created_at || new Date().toISOString(),
      updatedAt: item.reporter.updatedAt || item.reporter.updated_at || new Date().toISOString(),
    } as any) : undefined,
    reviewer: item?.reviewer ? ({
      id: String(item.reviewer.id || item.reviewer._id || ''),
      clerkId: String(item.reviewer.clerkId || item.reviewer.clerk_id || item.reviewer.id || item.reviewer._id || ''),
      role: item.reviewer.role || 'expert',
      preferredLanguage: item.reviewer.preferredLanguage || item.reviewer.preferred_language || 'en',
      isActive: item.reviewer.isActive ?? item.reviewer.is_active ?? true,
      isVerified: item.reviewer.isVerified ?? item.reviewer.is_verified ?? false,
      firstName: item.reviewer.firstName || item.reviewer.first_name || undefined,
      lastName: item.reviewer.lastName || item.reviewer.last_name || undefined,
      createdAt: item.reviewer.createdAt || item.reviewer.created_at || new Date().toISOString(),
      updatedAt: item.reviewer.updatedAt || item.reviewer.updated_at || new Date().toISOString(),
    } as any) : undefined,
  };
}

function normalizePestResponse(response: PaginatedResponse<PestDetection>): PaginatedResponse<PestDetection> {
  return {
    ...response,
    data: Array.isArray(response.data) ? response.data.map(normalizePestDetection) : [],
  };
}

export interface SubmitPestDetectionData {
  farmId: string;
  image: File | Blob;
  locationDescription?: string;
  coordinates?: { lat: number; lng: number };
}

export interface PestDetectionQueryParams {
  page?: number;
  limit?: number;
  farmId?: string;
  pestDetected?: boolean;
  severity?: string;
  isConfirmed?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface PestReviewData {
  isConfirmed: boolean;
  pestType?: string;
  severity?: string;
  expertNotes?: string;
}

// Pest Detection service functions
export const pestDetectionService = {
  /**
   * Upload and analyze pest image
   */
  analyze: async (
    data: SubmitPestDetectionData
  ): Promise<ApiResponse<PestDetection> & { analysis?: Record<string, any>; imageUrls?: string[] }> => {
    const formData = new FormData();
    formData.append('images', data.image);
    
    if (data.locationDescription) {
      formData.append('notes', data.locationDescription);
    }
    
    if (data.coordinates) {
      formData.append('location', JSON.stringify(data.coordinates));
    }
    
    const response = await apiClient.post<ApiResponse<PestDetection>>(`/pest-detection/upload/${data.farmId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    const payload: any = response.data.data;
    const detection = payload?.detection ?? payload;

    return {
      ...response.data,
      data: normalizePestDetection(detection),
      analysis: payload?.analysis,
      imageUrls: payload?.imageUrls,
    };
  },

  /**
   * Get all pest detections
   */
  getAll: async (params?: PestDetectionQueryParams): Promise<PaginatedResponse<PestDetection>> => {
    const response = await apiClient.get<PaginatedResponse<PestDetection>>('/pest-detection', { params });
    return normalizePestResponse(response.data);
  },

  /**
   * Get a single pest detection by ID
   */
  getById: async (id: string): Promise<ApiResponse<PestDetection>> => {
    const response = await apiClient.get<ApiResponse<PestDetection>>(`/pest-detection/${id}`);
    return { ...response.data, data: normalizePestDetection(response.data.data) };
  },

  /**
   * Get pest detections for a specific farm
   */
  getByFarm: async (farmId: string, params?: Omit<PestDetectionQueryParams, 'farmId'>): Promise<PaginatedResponse<PestDetection>> => {
    const response = await apiClient.get<PaginatedResponse<PestDetection>>(`/pest-detection/farm/${farmId}`, { params });
    return normalizePestResponse(response.data);
  },

  /**
   * Review a pest detection (expert only)
   */
  review: async (id: string, data: PestReviewData): Promise<ApiResponse<PestDetection>> => {
    const response = await apiClient.post<ApiResponse<PestDetection>>(`/pest-detection/${id}/review`, data);
    return { ...response.data, data: normalizePestDetection(response.data.data) };
  },

  /**
   * Get pest detection statistics
   */
  getStatistics: async (params?: {
    farmId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{
    totalDetections: number;
    positiveDetections: number;
    bySeverity: Record<string, number>;
    byPestType: Record<string, number>;
    confirmedCount: number;
    pendingReviewCount: number;
  }>> => {
    const response = await apiClient.get<ApiResponse<{
      totalDetections: number;
      positiveDetections: number;
      bySeverity: Record<string, number>;
      byPestType: Record<string, number>;
      confirmedCount: number;
      pendingReviewCount: number;
    }>>('/pest-detection/statistics', { params });
    return response.data;
  },

  /**
   * Get recent detections needing review (expert only)
   */
  getPendingReview: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<PestDetection>> => {
    const response = await apiClient.get<PaginatedResponse<PestDetection>>('/pest-detection/pending-review', { params });
    return normalizePestResponse(response.data);
  },

  /**
   * Delete a pest detection record
   */
  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/pest-detection/${id}`);
    return response.data;
  },

  /**
   * Get treatment recommendations for a detected pest
   */
  getTreatmentRecommendations: async (detectionId: string): Promise<ApiResponse<{
    pestType: string;
    severity: string;
    treatments: Array<{
      method: string;
      description: string;
      cost: string;
      effectiveness: string;
      organic: boolean;
    }>;
  }>> => {
    const response = await apiClient.get<ApiResponse<{
      pestType: string;
      severity: string;
      treatments: Array<{
        method: string;
        description: string;
        cost: string;
        effectiveness: string;
        organic: boolean;
      }>;
    }>>(`/pest-detection/${detectionId}/treatments`);
    return response.data;
  },

  // =====================================================
  // ADDITIONAL ENDPOINTS (Backend Compatibility)
  // =====================================================

  /**
   * Get pest detections for a specific farm (correct backend route)
   */
  getFarmDetections: async (
    farmId: string,
    params?: Omit<PestDetectionQueryParams, 'farmId'>
  ): Promise<PaginatedResponse<PestDetection>> => {
    const response = await apiClient.get<PaginatedResponse<PestDetection>>(
      `/pest-detection/farm/${farmId}`,
      { params }
    );
    return normalizePestResponse(response.data);
  },

  /**
   * Re-run AI analysis on existing detection (expert/admin)
   */
  reanalyze: async (detectionId: string): Promise<ApiResponse<{
    detection: PestDetection;
    previousAnalysis: Record<string, any>;
    newAnalysis: Record<string, any>;
    changed: boolean;
  }>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/pest-detection/${detectionId}/reanalyze`
    );
    return response.data;
  },

  /**
   * Get pest outbreak map data
   */
  getOutbreakMap: async (params?: {
    district?: string;
    startDate?: string;
    endDate?: string;
    severity?: string;
  }): Promise<ApiResponse<{
    outbreaks: Array<{
      id: string;
      farmId: string;
      farmName: string;
      location: { lat: number; lng: number };
      pestType: string;
      severity: string;
      detectedAt: string;
      isConfirmed: boolean;
    }>;
    hotspots: Array<{
      district: string;
      count: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
      center: { lat: number; lng: number };
    }>;
  }>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      '/pest-detection/outbreak-map',
      { params }
    );
    return response.data;
  },

  /**
   * Get pest statistics with correct backend route
   */
  getStats: async (params?: {
    farmId?: string;
    district?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{
    total: number;
    confirmed: number;
    pending: number;
    byPestType: Record<string, number>;
    bySeverity: Record<string, number>;
    byDistrict: Record<string, number>;
    trend: Array<{ date: string; count: number }>;
  }>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      '/pest-detection/stats',
      { params }
    );
    return response.data;
  },
};

export default pestDetectionService;
