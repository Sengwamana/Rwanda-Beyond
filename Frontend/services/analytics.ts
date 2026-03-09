// =====================================================
// Analytics Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { ApiResponse, FarmDashboardData, SensorData } from '../types';

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
    start: string;
    end: string;
  };
  recommendations: Array<{
    id: string;
    type: string;
    status: string;
    priority: string;
    createdAt: string;
    respondedAt: string | null;
    responseTime: number | null;
  }>;
  statistics: {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    acceptanceRate: number;
    avgResponseTimeHours: number;
  };
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
  activities: Array<{
    id: string;
    type: 'sensor_reading' | 'recommendation' | 'pest_detection' | 'irrigation' | 'user_action';
    description: string;
    farmId?: string;
    farmName?: string;
    userId?: string;
    userName?: string;
    timestamp: string;
    metadata?: Record<string, any>;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
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
      startDate?: string;
      endDate?: string;
      type?: string;
    }
  ): Promise<ApiResponse<RecommendationHistory>> => {
    const response = await apiClient.get<ApiResponse<RecommendationHistory>>(
      `/analytics/farm/${farmId}/recommendations`,
      { params }
    );
    return response.data;
  },

  /**
   * Get system-wide overview (admin only)
   */
  getSystemOverview: async (): Promise<ApiResponse<SystemOverview>> => {
    const response = await apiClient.get<ApiResponse<SystemOverview>>('/analytics/overview');
    return response.data;
  },

  /**
   * Get recent system activity
   */
  getRecentActivity: async (params?: {
    page?: number;
    limit?: number;
    type?: string;
    farmId?: string;
  }): Promise<ApiResponse<RecentActivity>> => {
    const response = await apiClient.get<ApiResponse<RecentActivity>>(
      '/analytics/activity',
      { params }
    );
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
