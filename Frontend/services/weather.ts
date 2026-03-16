// =====================================================
// Weather Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { 
  WeatherData, 
  WeatherForecast, 
  FarmingConditions,
  WeatherAlert,
  WeatherHistoryPayload,
  IrrigationWindowPayload,
  ApiResponse 
} from '../types';

// Weather service functions
export const weatherService = {
  /**
   * Get current weather for a farm location
   */
  getCurrentWeather: async (farmId: string): Promise<ApiResponse<WeatherData>> => {
    const response = await apiClient.get<ApiResponse<WeatherData>>(`/weather/farm/${farmId}/current`);
    return response.data;
  },

  /**
   * Get current weather by coordinates
   */
  getCurrentWeatherByCoords: async (lat: number, lon: number): Promise<ApiResponse<WeatherData>> => {
    const response = await apiClient.get<ApiResponse<WeatherData>>('/weather/location', {
      params: { lat, lon }
    });
    return response.data;
  },

  /**
   * Get weather forecast for a farm
   */
  getForecast: async (farmId: string, days?: number): Promise<ApiResponse<WeatherForecast[]>> => {
    const response = await apiClient.get<ApiResponse<WeatherForecast[]>>(`/weather/farm/${farmId}/forecast`, {
      params: { days }
    });
    return response.data;
  },

  /**
   * Get weather forecast by coordinates
   */
  getForecastByCoords: async (lat: number, lon: number, days?: number): Promise<ApiResponse<WeatherForecast[]>> => {
    const response = await apiClient.get<ApiResponse<WeatherForecast[]>>('/weather/location', {
      params: { lat, lon, days, type: 'forecast' }
    });
    return response.data;
  },

  /**
   * Get farming conditions assessment
   */
  getFarmingConditions: async (farmId: string): Promise<ApiResponse<FarmingConditions>> => {
    const response = await apiClient.get<ApiResponse<FarmingConditions>>(`/weather/farm/${farmId}/farming-conditions`);
    const payload: any = response.data.data;
    return {
      ...response.data,
      data: payload?.conditions || payload,
    };
  },

  /**
   * Get weather alerts for a farm
   */
  getWeatherAlerts: async (farmId: string): Promise<ApiResponse<{
    alerts: WeatherAlert[];
  }>> => {
    const response = await apiClient.get<ApiResponse<any>>(`/weather/farm/${farmId}/alerts`);
    const payload = response.data.data;
    const rawAlerts = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.alerts)
        ? payload.alerts
        : [];

    return {
      ...response.data,
      data: {
        alerts: rawAlerts.map((alert: any) => ({
          type: alert?.type || 'weather',
          severity: alert?.severity || 'info',
          title: alert?.title || 'Weather update',
          description: alert?.description || '',
          startTime: alert?.startTime || alert?.start_time,
          endTime: alert?.endTime || alert?.end_time,
        })),
      },
    };
  },

  /**
   * Get historical weather data
   */
  getHistoricalWeather: async (
    farmId: string,
    params: {
      startDate: string;
      endDate: string;
    }
  ): Promise<ApiResponse<WeatherHistoryPayload>> => {
    const response = await apiClient.get<ApiResponse<any>>(`/weather/farm/${farmId}/history`, { params });
    const payload = response.data.data || {};
    const rows = Array.isArray(payload?.data) ? payload.data : [];

    return {
      ...response.data,
      data: {
        farmId: payload?.farmId || payload?.farm_id || farmId,
        period: payload?.period || {
          start: params.startDate,
          end: params.endDate,
        },
        data: rows.map((row: any) => ({
          id: row?._id || row?.id,
          forecastDate: row?.forecastDate || row?.forecast_date,
          forecastTime: row?.forecastTime || row?.forecast_time,
          temperature: row?.temperature,
          humidity: row?.humidity,
          precipitationProbability: row?.precipitationProbability ?? row?.precipitation_probability,
          rainMm: row?.rainMm ?? row?.rain_mm,
          weatherCondition: row?.weatherCondition || row?.weather_condition,
          windSpeed: row?.windSpeed ?? row?.wind_speed,
          source: row?.source,
        })),
      },
    };
  },

  // =====================================================
  // ADDITIONAL ENDPOINTS (Backend Compatibility)
  // =====================================================

  /**
   * Get weather by district
   */
  getByDistrict: async (district: string): Promise<ApiResponse<WeatherData>> => {
    const response = await apiClient.get<ApiResponse<WeatherData>>(
      `/weather/district/${encodeURIComponent(district)}`
    );
    return response.data;
  },

  /**
   * Get optimal irrigation window for a farm
   */
  getIrrigationWindow: async (farmId: string): Promise<ApiResponse<IrrigationWindowPayload>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/weather/farm/${farmId}/irrigation-window`
    );
    const payload = response.data.data || {};

    return {
      ...response.data,
      data: {
        farmId: payload?.farmId || payload?.farm_id || farmId,
        optimalWindows: Array.isArray(payload?.optimalWindows)
          ? payload.optimalWindows.map((window: any) => ({
              date: window?.date,
              conditions: {
                temperature: window?.conditions?.temperature,
                humidity: window?.conditions?.humidity,
                weather: window?.conditions?.weather,
              },
              recommendation: window?.recommendation || 'Recommended irrigation slot',
            }))
          : [],
        nextBestWindow: payload?.nextBestWindow
          ? {
              date: payload.nextBestWindow?.date,
              conditions: {
                temperature: payload.nextBestWindow?.conditions?.temperature,
                humidity: payload.nextBestWindow?.conditions?.humidity,
                weather: payload.nextBestWindow?.conditions?.weather,
              },
              recommendation: payload.nextBestWindow?.recommendation || 'Recommended irrigation slot',
            }
          : null,
      },
    };
  },
};

export default weatherService;
