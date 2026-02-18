// =====================================================
// Sensor Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { 
  Sensor, 
  SensorData, 
  ApiResponse, 
  PaginatedResponse 
} from '../types';

export interface CreateSensorData {
  farmId: string;
  deviceId: string;
  sensorType: string;
  name?: string;
  locationDescription?: string;
  coordinates?: { lat: number; lng: number };
}

export interface UpdateSensorData {
  name?: string;
  locationDescription?: string;
  coordinates?: { lat: number; lng: number };
  status?: string;
}

export interface SensorReadingData {
  sensorId: string;
  farmId: string;
  soilMoisture?: number;
  soilTemperature?: number;
  airTemperature?: number;
  humidity?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  phLevel?: number;
  lightIntensity?: number;
  rainfallMm?: number;
}

export interface SensorQueryParams {
  page?: number;
  limit?: number;
  farmId?: string;
  sensorType?: string;
  status?: string;
}

// Sensor service functions
export const sensorService = {
  /**
   * Get all sensors
   */
  getAll: async (params?: SensorQueryParams): Promise<PaginatedResponse<Sensor>> => {
    const response = await apiClient.get<PaginatedResponse<Sensor>>('/sensors', { params });
    return response.data;
  },

  /**
   * Get a single sensor by ID
   */
  getById: async (id: string): Promise<ApiResponse<Sensor>> => {
    const response = await apiClient.get<ApiResponse<Sensor>>(`/sensors/${id}`);
    return response.data;
  },

  /**
   * Register a new sensor
   */
  register: async (data: CreateSensorData): Promise<ApiResponse<Sensor>> => {
    const response = await apiClient.post<ApiResponse<Sensor>>('/sensors', data);
    return response.data;
  },

  /**
   * Update sensor information
   */
  update: async (id: string, data: UpdateSensorData): Promise<ApiResponse<Sensor>> => {
    const response = await apiClient.put<ApiResponse<Sensor>>(`/sensors/${id}`, data);
    return response.data;
  },

  /**
   * Delete a sensor
   */
  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/sensors/${id}`);
    return response.data;
  },

  /**
   * Submit sensor reading data (IoT devices use this endpoint)
   */
  submitReading: async (data: SensorReadingData): Promise<ApiResponse<SensorData>> => {
    const response = await apiClient.post<ApiResponse<SensorData>>('/sensors/data/ingest', data);
    return response.data;
  },

  /**
   * Get sensor readings
   */
  getReadings: async (
    sensorId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      limit?: number;
      page?: number;
    }
  ): Promise<PaginatedResponse<SensorData>> => {
    const response = await apiClient.get<PaginatedResponse<SensorData>>(`/sensors/${sensorId}/readings`, { params });
    return response.data;
  },

  /**
   * Get latest reading for a sensor
   */
  getLatestReading: async (sensorId: string): Promise<ApiResponse<SensorData>> => {
    const response = await apiClient.get<ApiResponse<SensorData>>(`/sensors/${sensorId}/readings/latest`);
    return response.data;
  },

  /**
   * Calibrate a sensor
   */
  calibrate: async (id: string, calibrationData: Record<string, number>): Promise<ApiResponse<Sensor>> => {
    const response = await apiClient.post<ApiResponse<Sensor>>(`/sensors/${id}/calibrate`, calibrationData);
    return response.data;
  },

  /**
   * Update sensor status
   */
  updateStatus: async (id: string, status: string): Promise<ApiResponse<Sensor>> => {
    const response = await apiClient.put<ApiResponse<Sensor>>(`/sensors/${id}/status`, { status });
    return response.data;
  },

  /**
   * Get sensors by farm
   */
  getByFarm: async (farmId: string): Promise<ApiResponse<Sensor[]>> => {
    const response = await apiClient.get<ApiResponse<Sensor[]>>(`/farms/${farmId}/sensors`);
    return response.data;
  },

  /**
   * Batch submit multiple readings
   */
  submitBatchReadings: async (readings: SensorReadingData[]): Promise<ApiResponse<{ processed: number; failed: number }>> => {
    const response = await apiClient.post<ApiResponse<{ processed: number; failed: number }>>('/sensors/data/batch', { readings });
    return response.data;
  },

  // =====================================================
  // ADDITIONAL ENDPOINTS (Backend Compatibility)
  // =====================================================

  /**
   * Get sensors for a specific farm
   */
  getFarmSensors: async (
    farmId: string,
    params?: { status?: string; sensorType?: string }
  ): Promise<ApiResponse<Sensor[]>> => {
    const response = await apiClient.get<ApiResponse<Sensor[]>>(`/sensors/farm/${farmId}`, { params });
    return response.data;
  },

  /**
   * Get sensor health status (admin/expert)
   */
  getSensorHealth: async (farmId?: string): Promise<ApiResponse<{
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    offline: number;
    sensors: Array<{
      id: string;
      name: string;
      status: string;
      lastReading: string | null;
      batteryLevel: number | null;
      signalStrength: number | null;
    }>;
  }>> => {
    const response = await apiClient.get<ApiResponse<any>>('/sensors/health', {
      params: farmId ? { farmId } : undefined,
    });
    return response.data;
  },

  /**
   * Get sensor data for a farm
   */
  getFarmSensorData: async (
    farmId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      sensorType?: string;
      limit?: number;
    }
  ): Promise<ApiResponse<SensorData[]>> => {
    const response = await apiClient.get<ApiResponse<SensorData[]>>(
      `/sensors/data/farm/${farmId}`,
      { params }
    );
    return response.data;
  },

  /**
   * Get latest sensor readings for a farm
   */
  getFarmLatestReadings: async (farmId: string): Promise<ApiResponse<{
    farmId: string;
    readings: {
      soilMoisture: SensorData | null;
      temperature: SensorData | null;
      humidity: SensorData | null;
      npk: SensorData | null;
      rainfall: SensorData | null;
    };
    lastUpdated: string;
  }>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/sensors/data/farm/${farmId}/latest`
    );
    return response.data;
  },

  /**
   * Get daily aggregated sensor data
   */
  getDailyAggregates: async (
    farmId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      days?: number;
    }
  ): Promise<ApiResponse<Array<{
    date: string;
    avgSoilMoisture: number;
    avgTemperature: number;
    avgHumidity: number;
    minSoilMoisture: number;
    maxSoilMoisture: number;
    totalRainfall: number;
    readingsCount: number;
  }>>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/sensors/data/farm/${farmId}/daily`,
      { params }
    );
    return response.data;
  },
};

export default sensorService;
