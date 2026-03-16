// =====================================================
// Sensor Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { 
  Sensor, 
  SensorData, 
  SensorLatestReadingsPayload,
  ApiResponse, 
  PaginatedResponse 
} from '../types';

function normalizeSensor(sensor: any): Sensor {
  const latitude = sensor?.coordinates?.lat ?? sensor?.latitude;
  const longitude = sensor?.coordinates?.lng ?? sensor?.longitude;

  return {
    id: String(sensor?.id || sensor?._id || ''),
    farmId: String(sensor?.farmId || sensor?.farm_id || sensor?.farm?.id || ''),
    deviceId: sensor?.deviceId || sensor?.device_id || '',
    sensorType: sensor?.sensorType || sensor?.sensor_type || sensor?.type || 'soil_moisture',
    name: sensor?.name || undefined,
    locationDescription: sensor?.locationDescription || sensor?.location_description || undefined,
    coordinates:
      typeof latitude === 'number' && typeof longitude === 'number'
        ? { lat: latitude, lng: longitude }
        : undefined,
    status: sensor?.status || 'inactive',
    batteryLevel: sensor?.batteryLevel ?? sensor?.battery_level,
    firmwareVersion: sensor?.firmwareVersion || sensor?.firmware_version || undefined,
    lastReadingAt:
      sensor?.lastReadingAt
      || (typeof sensor?.last_reading_at === 'number' ? new Date(sensor.last_reading_at).toISOString() : sensor?.last_reading_at)
      || undefined,
    calibrationDate: sensor?.calibrationDate || sensor?.calibration_date || undefined,
    createdAt:
      sensor?.createdAt
      || (typeof sensor?.created_at === 'number' ? new Date(sensor.created_at).toISOString() : sensor?.created_at)
      || new Date().toISOString(),
    updatedAt:
      sensor?.updatedAt
      || (typeof sensor?.updated_at === 'number' ? new Date(sensor.updated_at).toISOString() : sensor?.updated_at)
      || new Date().toISOString(),
  };
}

function normalizeSensorReading(reading: any): SensorData {
  return {
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
  };
}

function normalizeOptionalSensorReading(reading: any): SensorData | null {
  if (!reading || typeof reading !== 'object') {
    return null;
  }

  return normalizeSensorReading(reading);
}

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
    if (!params?.farmId) {
      throw new Error('farmId is required for listing sensors');
    }

    const response = await apiClient.get<ApiResponse<Sensor[]>>(`/sensors/farm/${params.farmId}`, {
      params: { status: params.status, sensorType: params.sensorType },
    });

    const data = response.data.data || [];
    return {
      success: response.data.success,
      message: response.data.message,
      data: data.map(normalizeSensor),
      pagination: {
        page: params.page || 1,
        limit: params.limit || data.length || 20,
        total: data.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
      timestamp: response.data.timestamp,
    };
  },

  /**
   * Get a single sensor by ID
   */
  getById: async (id: string): Promise<ApiResponse<Sensor>> => {
    const response = await apiClient.get<ApiResponse<Sensor>>(`/sensors/${id}`);
    return { ...response.data, data: normalizeSensor(response.data.data) };
  },

  /**
   * Register a new sensor
   */
  register: async (data: CreateSensorData): Promise<ApiResponse<Sensor>> => {
    const payload = {
      farmId: data.farmId,
      deviceId: data.deviceId,
      sensorType: data.sensorType,
      name: data.name,
      locationDescription: data.locationDescription,
      latitude: data.coordinates?.lat,
      longitude: data.coordinates?.lng,
    };
    const response = await apiClient.post<ApiResponse<Sensor>>('/sensors', payload);
    return { ...response.data, data: normalizeSensor(response.data.data) };
  },

  /**
   * Update sensor information
   */
  update: async (id: string, data: UpdateSensorData): Promise<ApiResponse<Sensor>> => {
    const payload = {
      name: data.name,
      locationDescription: data.locationDescription,
      latitude: data.coordinates?.lat,
      longitude: data.coordinates?.lng,
      status: data.status,
    };
    const response = await apiClient.put<ApiResponse<Sensor>>(`/sensors/${id}`, payload);
    return { ...response.data, data: normalizeSensor(response.data.data) };
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
   * 
   * @warning This endpoint uses DEVICE authentication (IoT token), NOT user JWT.
   * Do not call from dashboard UI — it will fail with 401.
   * For manual data entry, use a different approach.
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
    const sensor = await sensorService.getById(sensorId);
    const farmId = sensor.data.farmId || (sensor.data as any).farm_id;
    if (!farmId) {
      throw new Error('Unable to resolve farm for sensor');
    }

    const response = await apiClient.get<PaginatedResponse<SensorData>>(
      `/sensors/data/farm/${farmId}`,
      {
        params: {
          ...params,
          sensorId,
        },
      }
    );
    return {
      ...response.data,
      data: Array.isArray(response.data.data) ? response.data.data.map(normalizeSensorReading) : [],
    };
  },

  /**
   * Get latest reading for a sensor
   */
  getLatestReading: async (sensorId: string): Promise<ApiResponse<SensorData>> => {
    const readings = await sensorService.getReadings(sensorId, { limit: 1, page: 1 });
    const latest = readings.data[0];
    if (!latest) {
      throw new Error('No sensor readings found');
    }
    return {
      success: readings.success,
      message: readings.message,
      data: latest,
      timestamp: readings.timestamp,
    };
  },

  /**
   * Calibrate a sensor
   */
  calibrate: async (id: string, calibrationData: Record<string, number>): Promise<ApiResponse<Sensor>> => {
    const response = await apiClient.put<ApiResponse<Sensor>>(`/sensors/${id}`, {
      calibrationData,
      calibrationDate: new Date().toISOString(),
    });
    return response.data;
  },

  /**
   * Update sensor status
   */
  updateStatus: async (id: string, status: string): Promise<ApiResponse<Sensor>> => {
    const response = await apiClient.put<ApiResponse<Sensor>>(`/sensors/${id}`, { status });
    return response.data;
  },

  /**
   * Get sensors by farm
   */
  getByFarm: async (farmId: string): Promise<ApiResponse<Sensor[]>> => {
    const response = await apiClient.get<ApiResponse<Sensor[]>>(`/sensors/farm/${farmId}`);
    return {
      ...response.data,
      data: Array.isArray(response.data.data) ? response.data.data.map(normalizeSensor) : [],
    };
  },

  /**
   * Batch submit multiple readings
   * 
   * @warning This endpoint uses DEVICE authentication (IoT token), NOT user JWT.
   * Do not call from dashboard UI — it will fail with 401.
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
    return {
      ...response.data,
      data: Array.isArray(response.data.data) ? response.data.data.map(normalizeSensor) : [],
    };
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
    return {
      ...response.data,
      data: Array.isArray(response.data.data) ? response.data.data.map(normalizeSensorReading) : [],
    };
  },

  /**
   * Get latest sensor readings for a farm
   */
  getFarmLatestReadings: async (farmId: string): Promise<ApiResponse<SensorLatestReadingsPayload>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/sensors/data/farm/${farmId}/latest`
    );
    const payload = response.data.data || {};

    return {
      ...response.data,
      data: {
        farmId: payload?.farmId || payload?.farm_id || farmId,
        readings: {
          soilMoisture: normalizeOptionalSensorReading(payload?.readings?.soilMoisture),
          temperature: normalizeOptionalSensorReading(payload?.readings?.temperature),
          humidity: normalizeOptionalSensorReading(payload?.readings?.humidity),
          npk: normalizeOptionalSensorReading(payload?.readings?.npk),
          rainfall: normalizeOptionalSensorReading(payload?.readings?.rainfall),
        },
        lastUpdated: payload?.lastUpdated || payload?.last_updated,
      },
    };
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
    avgSoilTemperature?: number;
    avgTemperature: number;
    avgHumidity: number;
    minSoilMoisture: number;
    maxSoilMoisture: number;
    avgNitrogen?: number;
    avgPhosphorus?: number;
    avgPotassium?: number;
    totalRainfall?: number;
    readingsCount: number;
  }>>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/sensors/data/farm/${farmId}/aggregates`,
      { params }
    );
    return response.data;
  },
};

export default sensorService;
