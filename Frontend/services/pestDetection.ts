// =====================================================
// Pest Detection Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { 
  PestDetection, 
  ApiResponse, 
  PaginatedResponse 
} from '../types';

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
  analyze: async (data: SubmitPestDetectionData): Promise<ApiResponse<PestDetection>> => {
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
    return response.data;
  },

  /**
   * Get all pest detections
   */
  getAll: async (params?: PestDetectionQueryParams): Promise<PaginatedResponse<PestDetection>> => {
    const response = await apiClient.get<PaginatedResponse<PestDetection>>('/pest-detection', { params });
    return response.data;
  },

  /**
   * Get a single pest detection by ID
   */
  getById: async (id: string): Promise<ApiResponse<PestDetection>> => {
    const response = await apiClient.get<ApiResponse<PestDetection>>(`/pest-detection/${id}`);
    return response.data;
  },

  /**
   * Get pest detections for a specific farm
   */
  getByFarm: async (farmId: string, params?: Omit<PestDetectionQueryParams, 'farmId'>): Promise<PaginatedResponse<PestDetection>> => {
    const response = await apiClient.get<PaginatedResponse<PestDetection>>(`/pest-detection/farm/${farmId}`, { params });
    return response.data;
  },

  /**
   * Review a pest detection (expert only)
   */
  review: async (id: string, data: PestReviewData): Promise<ApiResponse<PestDetection>> => {
    const response = await apiClient.post<ApiResponse<PestDetection>>(`/pest-detection/${id}/review`, data);
    return response.data;
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
    return response.data;
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
    return response.data;
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
