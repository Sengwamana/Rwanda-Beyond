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

function normalizeCoordinates(value: any): Farm['coordinates'] | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && typeof value.lat === 'number' && typeof value.lng === 'number') {
    return value;
  }
  return undefined;
}

function normalizeFarm(farm: any): Farm {
  return {
    id: String(farm?.id || farm?._id || ''),
    userId: String(farm?.userId || farm?.user_id || farm?.user?.id || ''),
    name: farm?.name || '',
    districtId: farm?.districtId || farm?.district_id || farm?.district?.id || undefined,
    locationName: farm?.locationName || farm?.location_name || undefined,
    coordinates: normalizeCoordinates(farm?.coordinates),
    sizeHectares:
      typeof farm?.sizeHectares === 'number'
        ? farm.sizeHectares
        : typeof farm?.size_hectares === 'number'
          ? farm.size_hectares
          : undefined,
    soilType: farm?.soilType || farm?.soil_type || undefined,
    cropVariety: farm?.cropVariety || farm?.crop_variety || '',
    plantingDate: farm?.plantingDate || farm?.planting_date || undefined,
    expectedHarvestDate: farm?.expectedHarvestDate || farm?.expected_harvest_date || undefined,
    currentGrowthStage: farm?.currentGrowthStage || farm?.current_growth_stage || undefined,
    isActive:
      typeof farm?.isActive === 'boolean'
        ? farm.isActive
        : typeof farm?.is_active === 'boolean'
          ? farm.is_active
          : true,
    metadata: farm?.metadata || undefined,
    createdAt: farm?.createdAt || farm?.created_at || new Date().toISOString(),
    updatedAt: farm?.updatedAt || farm?.updated_at || new Date().toISOString(),
    user: farm?.user
      ? {
          id: String(farm.user.id || farm.user._id || ''),
          clerkId: String(farm.user.clerkId || farm.user.clerk_id || farm.user.id || farm.user._id || ''),
          email: farm.user.email || undefined,
          phoneNumber: farm.user.phoneNumber || farm.user.phone_number || undefined,
          firstName: farm.user.firstName || farm.user.first_name || undefined,
          lastName: farm.user.lastName || farm.user.last_name || undefined,
          role: farm.user.role || 'farmer',
          preferredLanguage: farm.user.preferredLanguage || farm.user.preferred_language || 'en',
          profileImageUrl: farm.user.profileImageUrl || farm.user.profile_image_url || undefined,
          isActive: farm.user.isActive ?? farm.user.is_active ?? true,
          isVerified: farm.user.isVerified ?? farm.user.is_verified ?? false,
          createdAt: farm.user.createdAt || farm.user.created_at || new Date().toISOString(),
          updatedAt: farm.user.updatedAt || farm.user.updated_at || new Date().toISOString(),
        }
      : undefined,
    district: farm?.district
      ? {
          id: String(farm.district.id || farm.district._id || ''),
          name: farm.district.name,
          province: farm.district.province,
          coordinates: normalizeCoordinates(farm.district.coordinates),
        }
      : undefined,
    sensors: Array.isArray(farm?.sensors)
      ? farm.sensors.map((sensor: any) => ({
          id: String(sensor.id || sensor._id || ''),
          farmId: String(sensor.farmId || sensor.farm_id || farm?.id || farm?._id || ''),
          deviceId: sensor.deviceId || sensor.device_id || '',
          sensorType: sensor.sensorType || sensor.sensor_type || 'soil_moisture',
          name: sensor.name || undefined,
          locationDescription: sensor.locationDescription || sensor.location_description || undefined,
          coordinates: normalizeCoordinates(sensor.coordinates),
          status: sensor.status || 'active',
          batteryLevel: sensor.batteryLevel || sensor.battery_level || undefined,
          firmwareVersion: sensor.firmwareVersion || sensor.firmware_version || undefined,
          lastReadingAt: sensor.lastReadingAt || sensor.last_reading_at || undefined,
          calibrationDate: sensor.calibrationDate || sensor.calibration_date || undefined,
          createdAt: sensor.createdAt || sensor.created_at || new Date().toISOString(),
          updatedAt: sensor.updatedAt || sensor.updated_at || new Date().toISOString(),
        }))
      : undefined,
  };
}

function normalizeSensorDataItem(item: any): SensorData {
  return {
    id: String(item?.id || item?._id || ''),
    sensorId: String(item?.sensorId || item?.sensor_id || ''),
    farmId: String(item?.farmId || item?.farm_id || ''),
    readingTimestamp:
      item?.readingTimestamp
      || (typeof item?.reading_timestamp === 'number'
        ? new Date(item.reading_timestamp).toISOString()
        : item?.reading_timestamp
        || new Date().toISOString()),
    soilMoisture: item?.soilMoisture ?? item?.soil_moisture,
    soilTemperature: item?.soilTemperature ?? item?.soil_temperature,
    airTemperature: item?.airTemperature ?? item?.air_temperature,
    humidity: item?.humidity,
    nitrogen: item?.nitrogen,
    phosphorus: item?.phosphorus,
    potassium: item?.potassium,
    phLevel: item?.phLevel ?? item?.ph_level,
    lightIntensity: item?.lightIntensity ?? item?.light_intensity,
    rainfallMm: item?.rainfallMm ?? item?.rainfall_mm,
    isValid: item?.isValid ?? item?.is_valid ?? true,
    validationFlags: item?.validationFlags || item?.validation_flags || undefined,
    createdAt:
      item?.createdAt
      || (typeof item?.created_at === 'number' ? new Date(item.created_at).toISOString() : item?.created_at)
      || new Date().toISOString(),
  };
}

function normalizeIrrigationScheduleItem(item: any): IrrigationSchedule {
  return {
    id: String(item?.id || item?._id || ''),
    farmId: String(item?.farmId || item?.farm_id || ''),
    recommendationId: item?.recommendationId || item?.recommendation_id || undefined,
    scheduledDate: item?.scheduledDate || item?.scheduled_date || '',
    scheduledTime: item?.scheduledTime || item?.scheduled_time || undefined,
    durationMinutes: item?.durationMinutes ?? item?.duration_minutes ?? 0,
    waterVolumeLiters: item?.waterVolumeLiters ?? item?.water_volume_liters,
    isExecuted: item?.isExecuted ?? item?.is_executed ?? false,
    executedAt:
      item?.executedAt
      || (typeof item?.executed_at === 'number' ? new Date(item.executed_at).toISOString() : item?.executed_at)
      || undefined,
    actualDurationMinutes: item?.actualDurationMinutes ?? item?.actual_duration_minutes,
    actualWaterVolume: item?.actualWaterVolume ?? item?.actual_water_volume,
    triggerSource: item?.triggerSource || item?.trigger_source || 'manual',
    soilMoistureAtScheduling: item?.soilMoistureAtScheduling ?? item?.soil_moisture_at_scheduling,
    targetSoilMoisture: item?.targetSoilMoisture ?? item?.target_soil_moisture,
    notes: item?.notes || undefined,
    createdAt:
      item?.createdAt
      || (typeof item?.created_at === 'number' ? new Date(item.created_at).toISOString() : item?.created_at)
      || new Date().toISOString(),
    updatedAt:
      item?.updatedAt
      || (typeof item?.updated_at === 'number' ? new Date(item.updated_at).toISOString() : item?.updated_at)
      || new Date().toISOString(),
  };
}

function normalizeFertilizationScheduleItem(item: any): FertilizationSchedule {
  return {
    id: String(item?.id || item?._id || ''),
    farmId: String(item?.farmId || item?.farm_id || ''),
    recommendationId: item?.recommendationId || item?.recommendation_id || undefined,
    scheduledDate: item?.scheduledDate || item?.scheduled_date || '',
    fertilizerType: item?.fertilizerType || item?.fertilizer_type || '',
    applicationMethod: item?.applicationMethod || item?.application_method || undefined,
    nitrogenKg: item?.nitrogenKg ?? item?.nitrogen_kg,
    phosphorusKg: item?.phosphorusKg ?? item?.phosphorus_kg,
    potassiumKg: item?.potassiumKg ?? item?.potassium_kg,
    totalQuantityKg: item?.totalQuantityKg ?? item?.total_quantity_kg ?? item?.quantityKg ?? item?.quantity_kg,
    isExecuted: item?.isExecuted ?? item?.is_executed ?? false,
    executedAt:
      item?.executedAt
      || (typeof item?.executed_at === 'number' ? new Date(item.executed_at).toISOString() : item?.executed_at)
      || undefined,
    actualQuantityKg: item?.actualQuantityKg ?? item?.actual_quantity_kg,
    growthStage: item?.growthStage || item?.growth_stage || undefined,
    soilNpkAtScheduling: item?.soilNpkAtScheduling || item?.soil_npk_at_scheduling || undefined,
    notes: item?.notes || undefined,
    createdAt:
      item?.createdAt
      || (typeof item?.created_at === 'number' ? new Date(item.created_at).toISOString() : item?.created_at)
      || new Date().toISOString(),
    updatedAt:
      item?.updatedAt
      || (typeof item?.updated_at === 'number' ? new Date(item.updated_at).toISOString() : item?.updated_at)
      || new Date().toISOString(),
  };
}

function normalizePaginatedFarms(response: PaginatedResponse<Farm>): PaginatedResponse<Farm> {
  return {
    ...response,
    data: Array.isArray(response.data) ? response.data.map(normalizeFarm) : [],
  };
}

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
    return { ...response.data, data: normalizeFarm(response.data.data) };
  },

  /**
   * Get all farms for the current user
   */
  getAll: async (params?: FarmQueryParams): Promise<PaginatedResponse<Farm>> => {
    const response = await apiClient.get<PaginatedResponse<Farm>>('/farms', { params });
    return normalizePaginatedFarms(response.data);
  },

  /**
   * Get a single farm by ID
   */
  getById: async (id: string): Promise<ApiResponse<Farm>> => {
    const response = await apiClient.get<ApiResponse<Farm>>(`/farms/${id}`);
    return { ...response.data, data: normalizeFarm(response.data.data) };
  },

  /**
   * Update a farm
   */
  update: async (id: string, data: UpdateFarmData): Promise<ApiResponse<Farm>> => {
    const response = await apiClient.put<ApiResponse<Farm>>(`/farms/${id}`, data);
    return { ...response.data, data: normalizeFarm(response.data.data) };
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
    const payload: any = response.data.data || {};
    const latestSensorPayload = payload.latestSensorData || payload.latestReadings;
    return {
      ...response.data,
      data: {
        farm: payload.farm ? normalizeFarm(payload.farm) : ({} as Farm),
        latestSensorData: Array.isArray(latestSensorPayload)
          ? latestSensorPayload.map(normalizeSensorDataItem)
          : latestSensorPayload
            ? [normalizeSensorDataItem(latestSensorPayload)]
            : [],
        activeRecommendations: Array.isArray(payload.activeRecommendations) ? payload.activeRecommendations : [],
        recentAlerts: Array.isArray(payload.recentAlerts) ? payload.recentAlerts : [],
        irrigationSchedule: Array.isArray(payload.irrigationSchedule || payload.upcomingIrrigation)
          ? (payload.irrigationSchedule || payload.upcomingIrrigation).map(normalizeIrrigationScheduleItem)
          : [],
        recentPestDetections: Array.isArray(payload.recentPestDetections || payload.recentPests)
          ? (payload.recentPestDetections || payload.recentPests)
          : [],
      },
    };
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
    const response = await apiClient.get<PaginatedResponse<SensorData>>(
      `/sensors/data/farm/${id}`,
      {
        params: {
          startDate: params?.startDate,
          endDate: params?.endDate,
          limit: params?.limit,
        },
      }
    );
    return {
      success: response.data.success,
      message: response.data.message,
      data: Array.isArray(response.data.data) ? response.data.data.map(normalizeSensorDataItem) : [],
      timestamp: response.data.timestamp,
    };
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
    const response = await apiClient.get<ApiResponse<Array<{
      date: string;
      avgSoilMoisture: number;
      minSoilMoisture: number;
      maxSoilMoisture: number;
      avgSoilTemperature?: number;
      avgTemperature: number;
      avgHumidity: number;
      avgNitrogen?: number;
      avgPhosphorus?: number;
      avgPotassium?: number;
      totalRainfall?: number;
      readingsCount: number;
    }>>>(
      `/sensors/data/farm/${id}/daily`,
      { params: { days: params?.days } }
    );

    const trends: SensorTrends[] = response.data.data.map((item) => ({
      date: item.date,
      avgSoilMoisture: item.avgSoilMoisture,
      minSoilMoisture: item.minSoilMoisture,
      maxSoilMoisture: item.maxSoilMoisture,
      avgSoilTemperature: item.avgSoilTemperature,
      avgTemperature: item.avgTemperature,
      avgHumidity: item.avgHumidity,
      avgNitrogen: item.avgNitrogen,
      avgPhosphorus: item.avgPhosphorus,
      avgPotassium: item.avgPotassium,
      readingCount: item.readingsCount,
    }));

    return {
      ...response.data,
      data: trends,
    };
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
    return {
      ...response.data,
      data: Array.isArray(response.data.data) ? response.data.data.map(normalizeIrrigationScheduleItem) : [],
    };
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
    return { ...response.data, data: normalizeIrrigationScheduleItem(response.data.data) };
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
    return { ...response.data, data: normalizeIrrigationScheduleItem(response.data.data) };
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
    return {
      ...response.data,
      data: Array.isArray(response.data.data) ? response.data.data.map(normalizeFertilizationScheduleItem) : [],
    };
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
    return { ...response.data, data: normalizeFertilizationScheduleItem(response.data.data) };
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
    return { ...response.data, data: normalizeFertilizationScheduleItem(response.data.data) };
  },

  /**
   * Update a fertilization schedule
   */
  updateFertilizationSchedule: async (
    farmId: string,
    scheduleId: string,
    data: {
      scheduledDate?: string;
      fertilizerType?: string;
      applicationMethod?: string;
      nitrogenKg?: number;
      phosphorusKg?: number;
      potassiumKg?: number;
      totalQuantityKg?: number;
      growthStage?: string;
      notes?: string;
    }
  ): Promise<ApiResponse<FertilizationSchedule>> => {
    const response = await apiClient.put<ApiResponse<FertilizationSchedule>>(
      `/farms/${farmId}/fertilization/${scheduleId}`,
      data
    );
    return { ...response.data, data: normalizeFertilizationScheduleItem(response.data.data) };
  },

  /**
   * Delete a fertilization schedule
   */
  deleteFertilizationSchedule: async (
    farmId: string,
    scheduleId: string
  ): Promise<ApiResponse<{ id: string }>> => {
    const response = await apiClient.delete<ApiResponse<{ id: string }>>(
      `/farms/${farmId}/fertilization/${scheduleId}`
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
    const response = await apiClient.put<ApiResponse<Farm>>(`/farms/${id}/growth-stage`, { growthStage: stage });
    return { ...response.data, data: normalizeFarm(response.data.data) };
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
