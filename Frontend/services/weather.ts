// =====================================================
// Weather Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { 
  WeatherData, 
  WeatherForecast, 
  FarmingConditions,
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
    return response.data;
  },

  /**
   * Get weather alerts for a farm
   */
  getWeatherAlerts: async (farmId: string): Promise<ApiResponse<{
    alerts: Array<{
      type: string;
      severity: string;
      title: string;
      description: string;
      startTime: string;
      endTime?: string;
    }>;
  }>> => {
    const response = await apiClient.get<ApiResponse<{
      alerts: Array<{
        type: string;
        severity: string;
        title: string;
        description: string;
        startTime: string;
        endTime?: string;
      }>;
    }>>(`/weather/farm/${farmId}/alerts`);
    return response.data;
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
  ): Promise<ApiResponse<WeatherData[]>> => {
    const response = await apiClient.get<ApiResponse<WeatherData[]>>(`/weather/farm/${farmId}/history`, { params });
    return response.data;
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
  getIrrigationWindow: async (farmId: string): Promise<ApiResponse<{
    farmId: string;
    recommended: boolean;
    optimalWindow: {
      start: string;
      end: string;
      confidence: number;
    } | null;
    factors: {
      currentSoilMoisture: number;
      forecastRain: boolean;
      expectedRainfall: number;
      temperature: number;
      humidity: number;
    };
    reasoning: string;
    nextCheck: string;
  }>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/weather/farm/${farmId}/irrigation-window`
    );
    return response.data;
  },
};

export default weatherService;
