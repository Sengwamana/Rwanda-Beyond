// =====================================================
// Recommendations Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { 
  Recommendation, 
  ApiResponse, 
  PaginatedResponse 
} from '../types';

function normalizeRecommendation(item: any): Recommendation {
  return {
    id: String(item?.id || item?._id || ''),
    farmId: String(item?.farmId || item?.farm_id || item?.farm?.id || ''),
    userId: String(item?.userId || item?.user_id || item?.user?.id || ''),
    type: item?.type || 'general',
    priority: item?.priority || 'medium',
    status: item?.status || 'pending',
    title: item?.title || '',
    titleRw: item?.titleRw || item?.title_rw || undefined,
    description: item?.description || '',
    descriptionRw: item?.descriptionRw || item?.description_rw || undefined,
    recommendedAction: item?.recommendedAction || item?.recommended_action || undefined,
    irrigationScheduleId: item?.irrigationScheduleId || item?.irrigation_schedule_id || undefined,
    fertilizationScheduleId: item?.fertilizationScheduleId || item?.fertilization_schedule_id || undefined,
    pestDetectionId: item?.pestDetectionId || item?.pest_detection_id || undefined,
    actionDeadline:
      item?.actionDeadline
      || (typeof item?.action_deadline === 'number' ? new Date(item.action_deadline).toISOString() : item?.action_deadline)
      || undefined,
    supportingData: item?.supportingData || item?.supporting_data || undefined,
    confidenceScore: item?.confidenceScore ?? item?.confidence_score,
    modelVersion: item?.modelVersion || item?.model_version || undefined,
    respondedAt:
      item?.respondedAt
      || (typeof item?.responded_at === 'number' ? new Date(item.responded_at).toISOString() : item?.responded_at)
      || undefined,
    respondedBy:
      item?.respondedBy
      || item?.responded_by
      || undefined,
    responseChannel: item?.responseChannel || item?.response_channel || undefined,
    responseNotes: item?.responseNotes || item?.response_notes || undefined,
    deferredUntil:
      item?.deferredUntil
      || (typeof item?.deferred_until === 'number' ? new Date(item.deferred_until).toISOString() : item?.deferred_until)
      || undefined,
    notificationSent: item?.notificationSent ?? item?.notification_sent ?? false,
    expiresAt:
      item?.expiresAt
      || (typeof item?.expires_at === 'number' ? new Date(item.expires_at).toISOString() : item?.expires_at)
      || undefined,
    createdAt:
      item?.createdAt
      || (typeof item?.created_at === 'number' ? new Date(item.created_at).toISOString() : item?.created_at)
      || new Date().toISOString(),
    updatedAt:
      item?.updatedAt
      || (typeof item?.updated_at === 'number' ? new Date(item.updated_at).toISOString() : item?.updated_at)
      || new Date().toISOString(),
    farm: item?.farm ? {
      id: String(item.farm.id || item.farm._id || ''),
      userId: String(item.farm.userId || item.farm.user_id || ''),
      name: item.farm.name || '',
      cropVariety: item.farm.cropVariety || item.farm.crop_variety || '',
      isActive: item.farm.isActive ?? item.farm.is_active ?? true,
      createdAt: item.farm.createdAt || item.farm.created_at || new Date().toISOString(),
      updatedAt: item.farm.updatedAt || item.farm.updated_at || new Date().toISOString(),
    } as any : undefined,
  };
}

function normalizeRecommendationListResponse(response: PaginatedResponse<Recommendation>): PaginatedResponse<Recommendation> {
  return {
    ...response,
    data: Array.isArray(response.data) ? response.data.map(normalizeRecommendation) : [],
  };
}

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
  status?: 'accepted' | 'rejected' | 'deferred';
  action?: 'accept' | 'reject' | 'defer';
  responseNotes?: string;
  deferredUntil?: string;
  reason?: string;
  deferUntil?: string;
}

// Recommendations service functions
export const recommendationService = {
  /**
   * Get all recommendations for the current user
   */
  getAll: async (params?: RecommendationQueryParams): Promise<PaginatedResponse<Recommendation>> => {
    const response = await apiClient.get<PaginatedResponse<Recommendation>>('/recommendations', { params });
    return normalizeRecommendationListResponse(response.data);
  },

  /**
   * Get a single recommendation by ID
   */
  getById: async (id: string): Promise<ApiResponse<Recommendation>> => {
    const response = await apiClient.get<ApiResponse<Recommendation>>(`/recommendations/${id}`);
    return { ...response.data, data: normalizeRecommendation(response.data.data) };
  },

  /**
   * Get recommendations for a specific farm
   */
  getByFarm: async (farmId: string, params?: Omit<RecommendationQueryParams, 'farmId'>): Promise<PaginatedResponse<Recommendation>> => {
    const response = await apiClient.get<PaginatedResponse<Recommendation>>(`/recommendations/farm/${farmId}`, { params });
    return normalizeRecommendationListResponse(response.data);
  },

  /**
   * Get active (pending) recommendations
   */
  getActive: async (farmId?: string): Promise<ApiResponse<Recommendation[]>> => {
    const response = farmId
      ? await apiClient.get<ApiResponse<Recommendation[]>>(`/recommendations/farm/${farmId}/active`)
      : await apiClient.get<ApiResponse<Recommendation[]>>('/recommendations/active');
    return {
      ...response.data,
      data: Array.isArray(response.data.data) ? response.data.data.map(normalizeRecommendation) : [],
    };
  },

  /**
   * Respond to a recommendation (accept, reject, or defer)
   */
  respond: async (id: string, data: RecommendationResponse): Promise<ApiResponse<Recommendation>> => {
    const action = data.action
      || (data.status === 'accepted' ? 'accept'
        : data.status === 'rejected' ? 'reject'
        : data.status === 'deferred' ? 'defer'
        : undefined);

    if (!action) {
      throw new Error('Recommendation action is required');
    }

    const payload = {
      action,
      reason: data.reason ?? data.responseNotes,
      deferUntil: data.deferUntil ?? data.deferredUntil,
    };

    const response = await apiClient.post<ApiResponse<Recommendation>>(`/recommendations/${id}/respond`, payload);
    return { ...response.data, data: normalizeRecommendation(response.data.data) };
  },

  /**
   * Mark a recommendation as completed
   */
  markCompleted: async (id: string, notes?: string, outcome?: string): Promise<ApiResponse<Recommendation>> => {
    const response = await apiClient.post<ApiResponse<Recommendation>>(`/recommendations/${id}/complete`, { notes, outcome });
    return { ...response.data, data: normalizeRecommendation(response.data.data) };
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
    byChannel: Record<string, number>;
    responseRate: number;
    acceptanceRate: number;
    avgResponseTime: number;
    averageResponseTime?: number | null;
  }>> => {
    const response = await apiClient.get<ApiResponse<{
      total: number;
      byType: Record<string, number>;
      byStatus: Record<string, number>;
      byPriority: Record<string, number>;
      byChannel: Record<string, number>;
      responseRate: number;
      acceptanceRate: number;
      avgResponseTime: number;
      averageResponseTime?: number | null;
    }>>('/recommendations/stats', { params });
    return response.data;
  },

  /**
   * Generate new recommendations for a farm (triggers AI analysis)
   */
  generate: async (farmId: string): Promise<ApiResponse<Recommendation[]>> => {
    await apiClient.post<ApiResponse<any>>(`/recommendations/farm/${farmId}/generate`);

    const farmRecommendations = await apiClient.get<PaginatedResponse<Recommendation>>(
      `/recommendations/farm/${farmId}`,
      { params: { page: 1, limit: 20 } }
    );

    return {
      success: farmRecommendations.data.success,
      message: 'Recommendations generated successfully',
      data: Array.isArray(farmRecommendations.data.data)
        ? farmRecommendations.data.data.map(normalizeRecommendation)
        : [],
      timestamp: farmRecommendations.data.timestamp,
    };
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
    return normalizeRecommendationListResponse(response.data);
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
    return normalizeRecommendationListResponse(response.data);
  },

  /**
   * Get active recommendations for a specific farm
   */
  getFarmActiveRecommendations: async (farmId: string): Promise<ApiResponse<Recommendation[]>> => {
    const response = await apiClient.get<ApiResponse<Recommendation[]>>(
      `/recommendations/farm/${farmId}/active`
    );
    return {
      ...response.data,
      data: Array.isArray(response.data.data) ? response.data.data.map(normalizeRecommendation) : [],
    };
  },

  /**
   * Get all pending recommendations (expert/admin)
   */
  getPendingRecommendations: async (params?: {
    page?: number;
    limit?: number;
    district?: string;
    type?: string;
    priority?: string;
  }): Promise<PaginatedResponse<Recommendation>> => {
    const response = await apiClient.get<PaginatedResponse<Recommendation>>(
      '/recommendations/pending',
      { params }
    );
    return normalizeRecommendationListResponse(response.data);
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
    return { ...response.data, data: normalizeRecommendation(response.data.data) };
  },

  /**
   * Bulk generate recommendations (admin)
   */
  bulkGenerate: async (params?: {
    district?: string;
    type?: string;
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
