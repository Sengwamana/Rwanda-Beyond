// =====================================================
// Recommendations Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { 
  Recommendation, 
  ApiResponse, 
  PaginatedResponse 
} from '../types';

export interface RecommendationQueryParams {
  page?: number;
  limit?: number;
  farmId?: string;
  type?: string;
  status?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
}

export interface RecommendationResponse {
  status: 'accepted' | 'rejected' | 'deferred';
  responseNotes?: string;
  deferredUntil?: string;
}

// Recommendations service functions
export const recommendationService = {
  /**
   * Get all recommendations for the current user
   */
  getAll: async (params?: RecommendationQueryParams): Promise<PaginatedResponse<Recommendation>> => {
    const response = await apiClient.get<PaginatedResponse<Recommendation>>('/recommendations', { params });
    return response.data;
  },

  /**
   * Get a single recommendation by ID
   */
  getById: async (id: string): Promise<ApiResponse<Recommendation>> => {
    const response = await apiClient.get<ApiResponse<Recommendation>>(`/recommendations/${id}`);
    return response.data;
  },

  /**
   * Get recommendations for a specific farm
   */
  getByFarm: async (farmId: string, params?: Omit<RecommendationQueryParams, 'farmId'>): Promise<PaginatedResponse<Recommendation>> => {
    const response = await apiClient.get<PaginatedResponse<Recommendation>>(`/recommendations/farm/${farmId}`, { params });
    return response.data;
  },

  /**
   * Get active (pending) recommendations
   */
  getActive: async (farmId?: string): Promise<ApiResponse<Recommendation[]>> => {
    const params = farmId ? { farmId } : {};
    const response = await apiClient.get<ApiResponse<Recommendation[]>>('/recommendations/active', { params });
    return response.data;
  },

  /**
   * Respond to a recommendation (accept, reject, or defer)
   */
  respond: async (id: string, data: RecommendationResponse): Promise<ApiResponse<Recommendation>> => {
    const response = await apiClient.post<ApiResponse<Recommendation>>(`/recommendations/${id}/respond`, data);
    return response.data;
  },

  /**
   * Mark a recommendation as completed
   */
  markCompleted: async (id: string, notes?: string, outcome?: string): Promise<ApiResponse<Recommendation>> => {
    const response = await apiClient.post<ApiResponse<Recommendation>>(`/recommendations/${id}/complete`, { notes, outcome });
    return response.data;
  },

  /**
   * Get recommendation statistics
   */
  getStatistics: async (params?: {
    farmId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    acceptanceRate: number;
    avgResponseTime: number;
  }>> => {
    const response = await apiClient.get<ApiResponse<{
      total: number;
      byType: Record<string, number>;
      byStatus: Record<string, number>;
      byPriority: Record<string, number>;
      acceptanceRate: number;
      avgResponseTime: number;
    }>>('/recommendations/statistics', { params });
    return response.data;
  },

  /**
   * Generate new recommendations for a farm (triggers AI analysis)
   */
  generate: async (farmId: string): Promise<ApiResponse<Recommendation[]>> => {
    const response = await apiClient.post<ApiResponse<Recommendation[]>>(`/farms/${farmId}/recommendations/generate`);
    return response.data;
  },

  /**
   * Get recommendation history
   */
  getHistory: async (params?: {
    farmId?: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<Recommendation>> => {
    const response = await apiClient.get<PaginatedResponse<Recommendation>>('/recommendations/history', { params });
    return response.data;
  },

  // =====================================================
  // ADDITIONAL ENDPOINTS (Backend Compatibility)
  // =====================================================

  /**
   * Get recommendations for a specific farm
   */
  getFarmRecommendations: async (
    farmId: string,
    params?: {
      page?: number;
      limit?: number;
      status?: string;
      type?: string;
      priority?: string;
    }
  ): Promise<PaginatedResponse<Recommendation>> => {
    const response = await apiClient.get<PaginatedResponse<Recommendation>>(
      `/recommendations/farm/${farmId}`,
      { params }
    );
    return response.data;
  },

  /**
   * Get active recommendations for a specific farm
   */
  getFarmActiveRecommendations: async (farmId: string): Promise<ApiResponse<Recommendation[]>> => {
    const response = await apiClient.get<ApiResponse<Recommendation[]>>(
      `/recommendations/farm/${farmId}/active`
    );
    return response.data;
  },

  /**
   * Get all pending recommendations (expert/admin)
   */
  getPendingRecommendations: async (params?: {
    page?: number;
    limit?: number;
    district?: string;
  }): Promise<PaginatedResponse<Recommendation>> => {
    const response = await apiClient.get<PaginatedResponse<Recommendation>>(
      '/recommendations/pending',
      { params }
    );
    return response.data;
  },

  /**
   * Create a manual recommendation (expert/admin)
   */
  createManual: async (data: {
    farmId: string;
    type: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    actionRequired: string;
    validUntil?: string;
    metadata?: Record<string, any>;
  }): Promise<ApiResponse<Recommendation>> => {
    const response = await apiClient.post<ApiResponse<Recommendation>>(
      '/recommendations/manual',
      data
    );
    return response.data;
  },

  /**
   * Bulk generate recommendations (admin)
   */
  bulkGenerate: async (params?: {
    district?: string;
    farmIds?: string[];
  }): Promise<ApiResponse<{
    generated: number;
    farms: string[];
    errors: Array<{ farmId: string; error: string }>;
  }>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      '/recommendations/bulk-generate',
      params
    );
    return response.data;
  },
};

export default recommendationService;
