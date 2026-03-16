// =====================================================
// Analytics Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { ApiResponse, FarmDashboardData, Recommendation, SensorData } from '../types';

// Analytics Types
export type FarmDashboardAnalytics = FarmDashboardData & {
  latestReadings?: SensorData | null;
};

export interface SensorTrendsData {
  farmId: string;
  period: {
    days?: number;
    start?: string;
    end?: string;
    startDate?: string;
  };
  trends: Array<{
    date?: string;
    reading_date?: string;
    avgSoilMoisture?: number;
    avg_soil_moisture?: number;
    minSoilMoisture?: number;
    min_soil_moisture?: number;
    maxSoilMoisture?: number;
    max_soil_moisture?: number;
    avgSoilTemperature?: number;
    avg_soil_temperature?: number;
    avgTemperature?: number;
    avg_temperature?: number;
    avgHumidity?: number;
    avg_humidity?: number;
    avgNitrogen?: number;
    avg_nitrogen?: number;
    avgPhosphorus?: number;
    avg_phosphorus?: number;
    avgPotassium?: number;
    avg_potassium?: number;
    readingsCount?: number;
    reading_count?: number;
  }>;
}

export interface RecommendationHistory {
  farmId: string;
  period: {
    days?: number;
    start?: string;
    end?: string;
  };
  history: Recommendation[];
  stats: {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byChannel: Record<string, number>;
    responseRate: number;
    averageResponseTime: number | null;
  };
}

export interface FarmActivityEvent {
  id: string;
  type: 'recommendation' | 'irrigation' | 'fertilization' | 'pest_control' | 'pest_detection' | 'farm_issue';
  action: 'created' | 'responded' | 'executed' | 'completed' | 'reported' | 'reviewed' | 'updated' | 'scheduled' | 'assigned' | 'postponed';
  title: string;
  description: string;
  timestamp: string;
  status?: string;
  metadata?: Record<string, any>;
}

export type FarmActivityType = FarmActivityEvent['type'];
export type FarmActivityFilterType = 'all' | FarmActivityType;

export interface FarmActivityFeed {
  farmId: string;
  period: {
    days: number;
    since: string;
    until: string;
  };
  filters?: {
    type: FarmActivityFilterType;
    limit: number;
  };
  summary: {
    total: number;
    byType: Record<string, number>;
    byAction: Record<string, number>;
  };
  activity: FarmActivityEvent[];
}

export interface SystemOverview {
  users: {
    total: number;
    farmers: number;
    experts: number;
    admins: number;
    activeToday: number;
  };
  farms: {
    total: number;
    active: number;
    byDistrict: Record<string, number>;
  };
  sensors: {
    total: number;
    active: number;
    offline: number;
    avgReadingsPerDay: number;
  };
  recommendations: {
    totalGenerated: number;
    pendingReview: number;
    acceptanceRate: number;
  };
  pestDetections: {
    total: number;
    confirmedOutbreaks: number;
    pendingReview: number;
  };
  systemHealth: {
    apiLatency: number;
    dbLatency: number;
    uptime: number;
    errorRate: number;
  };
}

export interface RecentActivity {
  period: {
    hours: number;
    since: string;
  };
  filters?: {
    type: string;
    limit: number;
  };
  summary: {
    newUsers: number;
    newFarms: number;
    sensorReadings: number;
    recommendations: number;
    pestDetections: number;
    pestControlActions: number;
  };
  activities: Array<{
    id: string;
    type: 'sensor_reading' | 'recommendation' | 'pest_detection' | 'pest_control' | 'farm' | 'user';
    title: string;
    description: string;
    timestamp: string;
    status?: string;
    metadata?: Record<string, any>;
  }>;
}

export interface DistrictAnalytics {
  district: string;
  farms: {
    total: number;
    active: number;
  };
  sensors: {
    total: number;
    active: number;
  };
  avgMetrics: {
    soilMoisture: number;
    temperature: number;
    humidity: number;
  };
  recommendations: {
    total: number;
    acceptanceRate: number;
  };
  pestDetections: {
    total: number;
    activeOutbreaks: number;
  };
  irrigationEfficiency: number;
}

export interface DashboardAnalyticsSummary {
  users?: { total: number };
  farms?: { total: number };
  recommendations?: { total: number };
  pestDetections?: { total: number };
}

const normalizeSensorReading = (reading: any): SensorData => ({
  id: String(reading?.id || reading?._id || ''),
  sensorId: String(reading?.sensorId || reading?.sensor_id || ''),
  farmId: String(reading?.farmId || reading?.farm_id || ''),
  readingTimestamp:
    reading?.readingTimestamp
    || (typeof reading?.reading_timestamp === 'number'
      ? new Date(reading.reading_timestamp).toISOString()
      : reading?.reading_timestamp
      || new Date().toISOString()),
  soilMoisture: reading?.soilMoisture ?? reading?.soil_moisture,
  soilTemperature: reading?.soilTemperature ?? reading?.soil_temperature,
  airTemperature: reading?.airTemperature ?? reading?.air_temperature,
  humidity: reading?.humidity,
  nitrogen: reading?.nitrogen,
  phosphorus: reading?.phosphorus,
  potassium: reading?.potassium,
  phLevel: reading?.phLevel ?? reading?.ph_level,
  lightIntensity: reading?.lightIntensity ?? reading?.light_intensity,
  rainfallMm: reading?.rainfallMm ?? reading?.rainfall_mm,
  isValid: reading?.isValid ?? reading?.is_valid ?? true,
  validationFlags: reading?.validationFlags || reading?.validation_flags || undefined,
  createdAt:
    reading?.createdAt
    || (typeof reading?.created_at === 'number' ? new Date(reading.created_at).toISOString() : reading?.created_at)
    || new Date().toISOString(),
});

const normalizeTrendRow = (row: any) => ({
  ...row,
  date: row?.date || row?.reading_date,
  avgSoilMoisture: row?.avgSoilMoisture ?? row?.avg_soil_moisture,
  minSoilMoisture: row?.minSoilMoisture ?? row?.min_soil_moisture,
  maxSoilMoisture: row?.maxSoilMoisture ?? row?.max_soil_moisture,
  avgSoilTemperature: row?.avgSoilTemperature ?? row?.avg_soil_temperature,
  avgTemperature: row?.avgTemperature ?? row?.avg_temperature,
  avgHumidity: row?.avgHumidity ?? row?.avg_humidity,
  avgNitrogen: row?.avgNitrogen ?? row?.avg_nitrogen,
  avgPhosphorus: row?.avgPhosphorus ?? row?.avg_phosphorus,
  avgPotassium: row?.avgPotassium ?? row?.avg_potassium,
  readingsCount: row?.readingsCount ?? row?.reading_count,
});

const normalizeRecommendationHistoryItem = (item: any): Recommendation => ({
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
  respondedBy: item?.respondedBy || item?.responded_by || undefined,
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
});

// Analytics service functions
export const analyticsService = {
  /**
   * Get farm dashboard analytics
   */
  getFarmDashboard: async (farmId: string): Promise<ApiResponse<FarmDashboardAnalytics>> => {
    const response = await apiClient.get<ApiResponse<FarmDashboardAnalytics>>(
      `/analytics/farm/${farmId}/dashboard`
    );
    const payload: any = response.data.data || {};
    const latestSensorPayload = payload.latestSensorData || payload.latestReadings;

    return {
      ...response.data,
      data: {
        ...payload,
        latestReadings: payload.latestReadings ? normalizeSensorReading(payload.latestReadings) : undefined,
        latestSensorData: Array.isArray(latestSensorPayload)
          ? latestSensorPayload.map(normalizeSensorReading)
          : latestSensorPayload
            ? [normalizeSensorReading(latestSensorPayload)]
            : [],
      },
    };
  },

  /**
   * Get sensor trends for a farm
   */
  getSensorTrends: async (
    farmId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      interval?: 'hour' | 'day' | 'week';
    }
  ): Promise<ApiResponse<SensorTrendsData>> => {
    const response = await apiClient.get<ApiResponse<SensorTrendsData>>(
      `/analytics/farm/${farmId}/sensor-trends`,
      { params }
    );
    const payload: any = response.data.data || {};

    return {
      ...response.data,
      data: {
        ...payload,
        trends: Array.isArray(payload.trends) ? payload.trends.map(normalizeTrendRow) : [],
      },
    };
  },

  /**
   * Get recommendation history for a farm
   */
  getRecommendationHistory: async (
    farmId: string,
    params?: {
      days?: number;
    }
  ): Promise<ApiResponse<RecommendationHistory>> => {
    const response = await apiClient.get<ApiResponse<RecommendationHistory>>(
      `/analytics/farm/${farmId}/recommendation-history`,
      { params }
    );
    const payload: any = response.data.data || {};

    return {
      ...response.data,
      data: {
        ...payload,
        history: Array.isArray(payload.history)
          ? payload.history.map(normalizeRecommendationHistoryItem)
          : [],
      },
    };
  },

  /**
   * Get farm activity history for a farm
   */
  getFarmActivity: async (
    farmId: string,
    params?: {
      days?: number;
      limit?: number;
      type?: FarmActivityFilterType;
    }
  ): Promise<ApiResponse<FarmActivityFeed>> => {
    const response = await apiClient.get<ApiResponse<FarmActivityFeed>>(
      `/analytics/farm/${farmId}/activity`,
      { params }
    );
    const payload: any = response.data.data || {};

    return {
      ...response.data,
      data: {
        ...payload,
        activity: Array.isArray(payload.activity) ? payload.activity : [],
      },
    };
  },

  /**
   * Export farm activity history
   */
  exportFarmActivity: async (
    farmId: string,
    params?: {
      days?: number;
      limit?: number;
      type?: FarmActivityFilterType;
      format?: 'csv' | 'json';
    }
  ): Promise<Blob> => {
    const response = await apiClient.get(`/analytics/farm/${farmId}/activity/export`, {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Get system-wide overview (admin only)
   */
  getSystemOverview: async (): Promise<ApiResponse<SystemOverview>> => {
    const response = await apiClient.get<ApiResponse<SystemOverview>>('/analytics/system/overview');
    return response.data;
  },

  /**
   * Get recent system activity
   */
  getRecentActivity: async (params?: {
    hours?: number;
    limit?: number;
    type?: 'all' | 'user' | 'farm' | 'recommendation' | 'pest_detection' | 'pest_control' | 'sensor_reading';
  }): Promise<ApiResponse<RecentActivity>> => {
    const response = await apiClient.get<ApiResponse<RecentActivity>>(
      '/analytics/system/activity',
      { params }
    );
    const payload: any = response.data.data || {};

    return {
      ...response.data,
      data: {
        ...payload,
        activities: Array.isArray(payload.activities) ? payload.activities : [],
      },
    };
  },

  /**
   * Export recent system activity
   */
  exportRecentActivity: async (params?: {
    hours?: number;
    limit?: number;
    type?: 'all' | 'user' | 'farm' | 'recommendation' | 'pest_detection' | 'pest_control' | 'sensor_reading';
    format?: 'csv' | 'json';
  }): Promise<Blob> => {
    const response = await apiClient.get('/analytics/system/activity/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Get district-level analytics
   */
  getDistrictAnalytics: async (district: string): Promise<ApiResponse<DistrictAnalytics>> => {
    const response = await apiClient.get<ApiResponse<DistrictAnalytics>>(
      `/analytics/district/${encodeURIComponent(district)}`
    );
    return response.data;
  },

  /**
   * Get all districts analytics summary
   */
  getAllDistrictsAnalytics: async (): Promise<ApiResponse<DistrictAnalytics[]>> => {
    const response = await apiClient.get<ApiResponse<DistrictAnalytics[]>>(
      '/analytics/districts'
    );
    return response.data;
  },

  /**
   * Get dashboard analytics (farm-level when farmId is provided, otherwise system summary)
   */
  getDashboard: async (params?: {
    farmId?: string;
  }): Promise<ApiResponse<FarmDashboardAnalytics | DashboardAnalyticsSummary>> => {
    const response = await apiClient.get<ApiResponse<FarmDashboardAnalytics | DashboardAnalyticsSummary>>(
      '/analytics/dashboard',
      { params }
    );
    return response.data;
  },

  /**
   * Export analytics data
   */
  exportData: async (params: {
    type: 'farms' | 'sensors' | 'recommendations' | 'pest-detections';
    format: 'csv' | 'json' | 'xlsx';
    startDate?: string;
    endDate?: string;
    farmId?: string;
    district?: string;
  }): Promise<Blob> => {
    const response = await apiClient.get('/analytics/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

export default analyticsService;
