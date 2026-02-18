// =====================================================
// Farm Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { 
  Farm, 
  ApiResponse, 
  PaginatedResponse,
  FarmDashboardData,
  SensorData,
  SensorTrends,
  IrrigationSchedule,
  FertilizationSchedule
} from '../types';

export interface CreateFarmData {
  name: string;
  districtId?: string;
  locationName?: string;
  coordinates?: { lat: number; lng: number };
  sizeHectares?: number;
  soilType?: string;
  cropVariety: string;
  plantingDate?: string;
  metadata?: Record<string, any>;
}

export interface UpdateFarmData extends Partial<CreateFarmData> {
  currentGrowthStage?: string;
  isActive?: boolean;
}

export interface FarmQueryParams {
  page?: number;
  limit?: number;
  isActive?: boolean;
  districtId?: string;
  search?: string;
}

// Farm service functions
export const farmService = {
  /**
   * Create a new farm
   */
  create: async (data: CreateFarmData): Promise<ApiResponse<Farm>> => {
    const response = await apiClient.post<ApiResponse<Farm>>('/farms', data);
    return response.data;
  },

  /**
   * Get all farms for the current user
   */
  getAll: async (params?: FarmQueryParams): Promise<PaginatedResponse<Farm>> => {
    const response = await apiClient.get<PaginatedResponse<Farm>>('/farms', { params });
    return response.data;
  },

  /**
   * Get a single farm by ID
   */
  getById: async (id: string): Promise<ApiResponse<Farm>> => {
    const response = await apiClient.get<ApiResponse<Farm>>(`/farms/${id}`);
    return response.data;
  },

  /**
   * Update a farm
   */
  update: async (id: string, data: UpdateFarmData): Promise<ApiResponse<Farm>> => {
    const response = await apiClient.put<ApiResponse<Farm>>(`/farms/${id}`, data);
    return response.data;
  },

  /**
   * Delete a farm
   */
  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/farms/${id}`);
    return response.data;
  },

  /**
   * Get farm summary with latest data (dashboard data)
   */
  getDashboard: async (id: string): Promise<ApiResponse<FarmDashboardData>> => {
    const response = await apiClient.get<ApiResponse<FarmDashboardData>>(`/farms/${id}/summary`);
    return response.data;
  },

  /**
   * Get latest sensor readings for a farm
   */
  getSensorData: async (
    id: string, 
    params?: { 
      startDate?: string; 
      endDate?: string; 
      sensorType?: string;
      limit?: number;
    }
  ): Promise<ApiResponse<SensorData[]>> => {
    const response = await apiClient.get<ApiResponse<SensorData[]>>(`/farms/${id}/sensors/data`, { params });
    return response.data;
  },

  /**
   * Get sensor trends for a farm
   */
  getSensorTrends: async (
    id: string,
    params?: {
      days?: number;
      interval?: 'hour' | 'day' | 'week';
    }
  ): Promise<ApiResponse<SensorTrends[]>> => {
    const response = await apiClient.get<ApiResponse<SensorTrends[]>>(`/farms/${id}/sensors/trends`, { params });
    return response.data;
  },

  /**
   * Get irrigation schedules for a farm
   */
  getIrrigationSchedules: async (
    id: string,
    params?: {
      startDate?: string;
      endDate?: string;
      isExecuted?: boolean;
    }
  ): Promise<ApiResponse<IrrigationSchedule[]>> => {
    const response = await apiClient.get<ApiResponse<IrrigationSchedule[]>>(`/farms/${id}/irrigation`, { params });
    return response.data;
  },

  /**
   * Create an irrigation schedule
   */
  createIrrigationSchedule: async (
    farmId: string,
    data: {
      scheduledDate: string;
      scheduledTime?: string;
      durationMinutes: number;
      waterVolumeLiters?: number;
      triggerSource?: 'manual' | 'auto' | 'recommendation';
      notes?: string;
    }
  ): Promise<ApiResponse<IrrigationSchedule>> => {
    const response = await apiClient.post<ApiResponse<IrrigationSchedule>>(`/farms/${farmId}/irrigation`, data);
    return response.data;
  },

  /**
   * Mark irrigation as executed
   */
  executeIrrigation: async (
    farmId: string,
    scheduleId: string,
    data?: {
      actualDurationMinutes?: number;
      actualWaterVolume?: number;
    }
  ): Promise<ApiResponse<IrrigationSchedule>> => {
    const response = await apiClient.put<ApiResponse<IrrigationSchedule>>(
      `/farms/${farmId}/irrigation/${scheduleId}/execute`,
      data
    );
    return response.data;
  },

  /**
   * Get fertilization schedules for a farm
   */
  getFertilizationSchedules: async (
    id: string,
    params?: {
      startDate?: string;
      endDate?: string;
      isExecuted?: boolean;
    }
  ): Promise<ApiResponse<FertilizationSchedule[]>> => {
    const response = await apiClient.get<ApiResponse<FertilizationSchedule[]>>(`/farms/${id}/fertilization`, { params });
    return response.data;
  },

  /**
   * Create a fertilization schedule
   */
  createFertilizationSchedule: async (
    farmId: string,
    data: {
      scheduledDate: string;
      fertilizerType: string;
      applicationMethod?: string;
      nitrogenKg?: number;
      phosphorusKg?: number;
      potassiumKg?: number;
      totalQuantityKg?: number;
      notes?: string;
    }
  ): Promise<ApiResponse<FertilizationSchedule>> => {
    const response = await apiClient.post<ApiResponse<FertilizationSchedule>>(`/farms/${farmId}/fertilization`, data);
    return response.data;
  },

  /**
   * Mark fertilization as executed
   */
  executeFertilization: async (
    farmId: string,
    scheduleId: string,
    data?: {
      actualQuantityKg?: number;
    }
  ): Promise<ApiResponse<FertilizationSchedule>> => {
    const response = await apiClient.put<ApiResponse<FertilizationSchedule>>(
      `/farms/${farmId}/fertilization/${scheduleId}/execute`,
      data
    );
    return response.data;
  },

  /**
   * Update farm growth stage
   */
  updateGrowthStage: async (
    id: string,
    stage: string
  ): Promise<ApiResponse<Farm>> => {
    const response = await apiClient.put<ApiResponse<Farm>>(`/farms/${id}/growth-stage`, { stage });
    return response.data;
  },

  // =====================================================
  // ADDITIONAL ENDPOINTS (Backend Compatibility)
  // =====================================================

  /**
   * Get all districts (public endpoint)
   */
  getDistricts: async (): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    province: string;
    coordinates?: { lat: number; lng: number };
    farmCount?: number;
  }>>> => {
    const response = await apiClient.get<ApiResponse<any>>('/farms/districts');
    return response.data;
  },

  /**
   * Get farm statistics
   */
  getStats: async (): Promise<ApiResponse<{
    totalFarms: number;
    activeFarms: number;
    totalAreaHectares: number;
    avgSizeHectares: number;
    byDistrict: Record<string, number>;
    byGrowthStage: Record<string, number>;
    byCropVariety: Record<string, number>;
  }>> => {
    const response = await apiClient.get<ApiResponse<any>>('/farms/stats');
    return response.data;
  },
};

export default farmService;
