// =====================================================
// Analytics Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { ApiResponse } from '../types';

// Analytics Types
export interface FarmDashboardAnalytics {
  farm: {
    id: string;
    name: string;
    district: string;
    sizeHectares: number;
    currentGrowthStage: string;
  };
  sensors: {
    total: number;
    active: number;
    offline: number;
    latestReadings: {
      soilMoisture: number | null;
      temperature: number | null;
      humidity: number | null;
      npk: { n: number; p: number; k: number } | null;
    };
  };
  recommendations: {
    pending: number;
    accepted: number;
    rejected: number;
    total: number;
  };
  alerts: {
    active: number;
    critical: number;
    warnings: number;
  };
  irrigation: {
    lastIrrigation: string | null;
    nextScheduled: string | null;
    totalThisWeek: number;
  };
  pestDetections: {
    total: number;
    confirmed: number;
    lastDetection: string | null;
  };
}

export interface SensorTrendsData {
  farmId: string;
  period: {
    start: string;
    end: string;
  };
  trends: {
    soilMoisture: Array<{ timestamp: string; value: number; avg: number }>;
    temperature: Array<{ timestamp: string; value: number; avg: number }>;
    humidity: Array<{ timestamp: string; value: number; avg: number }>;
  };
  summary: {
    avgSoilMoisture: number;
    avgTemperature: number;
    avgHumidity: number;
    minSoilMoisture: number;
    maxSoilMoisture: number;
  };
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

// Analytics service functions
export const analyticsService = {
  /**
   * Get farm dashboard analytics
   */
  getFarmDashboard: async (farmId: string): Promise<ApiResponse<FarmDashboardAnalytics>> => {
    const response = await apiClient.get<ApiResponse<FarmDashboardAnalytics>>(
      `/analytics/farm/${farmId}/dashboard`
    );
    return response.data;
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
    return response.data;
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
