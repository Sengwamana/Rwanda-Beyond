// =====================================================
// Integrated API Hooks
// Smart Maize Farming System
// React Query + API Client Integration
// =====================================================

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { api } from '../services/apiClient';
import { queryKeys, staleTimes, invalidateQueries } from '../config/queryClient';

// =====================================================
// Types
// =====================================================

interface Farm {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  size: number;
  sizeUnit: 'hectares' | 'acres';
  cropType: string;
  plantingDate?: string;
  soilType?: string;
  irrigationSystem?: string;
  status: 'active' | 'dormant' | 'harvested';
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface Sensor {
  id: string;
  farmId: string;
  type: 'soil_moisture' | 'temperature' | 'humidity' | 'ph' | 'light' | 'rain' | 'wind';
  deviceId: string;
  name: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  status: 'active' | 'inactive' | 'maintenance';
  lastReading?: SensorReading;
  createdAt: string;
}

interface SensorReading {
  id: string;
  sensorId: string;
  value: number;
  unit: string;
  timestamp: string;
  batteryLevel?: number;
  signalStrength?: number;
}

interface Weather {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  precipitation: number;
  description: string;
  icon: string;
  forecast?: WeatherForecast[];
}

interface WeatherForecast {
  date: string;
  high: number;
  low: number;
  humidity: number;
  precipitation: number;
  description: string;
  icon: string;
}

interface Recommendation {
  id: string;
  farmId: string;
  type: 'irrigation' | 'fertilization' | 'pest_control' | 'harvest' | 'planting' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  action?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  createdAt: string;
  dueDate?: string;
}

interface Alert {
  id: string;
  farmId: string;
  type: 'warning' | 'error' | 'info' | 'success';
  category: 'sensor' | 'weather' | 'pest' | 'irrigation' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface PestScan {
  id: string;
  farmId: string;
  imageUrl: string;
  result: {
    detected: boolean;
    pest?: string;
    confidence: number;
    recommendations?: string[];
  };
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
}

// =====================================================
// Farm Hooks
// =====================================================

export function useFarms(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.farms.list(filters),
    queryFn: () => api.get<Farm[]>('/farms', { params: filters }),
    staleTime: staleTimes.farms,
  });
}

export function useFarm(farmId: string) {
  return useQuery({
    queryKey: queryKeys.farms.detail(farmId),
    queryFn: () => api.get<Farm>(`/farms/${farmId}`),
    staleTime: staleTimes.farms,
    enabled: !!farmId,
  });
}

export function useFarmStats(farmId: string) {
  return useQuery({
    queryKey: queryKeys.farms.stats(farmId),
    queryFn: () => api.get(`/farms/${farmId}/stats`),
    staleTime: staleTimes.analytics,
    enabled: !!farmId,
  });
}

export function useCreateFarm() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<Farm>) => api.post<Farm>('/farms', data),
    onSuccess: () => {
      invalidateQueries.farms();
    },
  });
}

export function useUpdateFarm() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Farm> }) =>
      api.put<Farm>(`/farms/${id}`, data),
    onSuccess: (_, variables) => {
      invalidateQueries.farm(variables.id);
    },
  });
}

export function useDeleteFarm() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => api.delete(`/farms/${id}`),
    onSuccess: () => {
      invalidateQueries.farms();
    },
  });
}

// =====================================================
// Sensor Hooks
// =====================================================

export function useSensors(farmId?: string) {
  return useQuery({
    queryKey: queryKeys.sensors.all(farmId),
    queryFn: () => api.get<Sensor[]>('/sensors', { params: farmId ? { farmId } : {} }),
    staleTime: staleTimes.sensors,
  });
}

export function useSensor(sensorId: string) {
  return useQuery({
    queryKey: queryKeys.sensors.detail(sensorId),
    queryFn: () => api.get<Sensor>(`/sensors/${sensorId}`),
    staleTime: staleTimes.sensors,
    enabled: !!sensorId,
  });
}

export function useLatestSensorReadings(farmId: string) {
  return useQuery({
    queryKey: queryKeys.sensors.latestReadings(farmId),
    queryFn: () => api.get<SensorReading[]>(`/sensors/data/farm/${farmId}/latest`),
    staleTime: staleTimes.sensors,
    enabled: !!farmId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useSensorHistory(sensorId: string, startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: queryKeys.sensors.history(sensorId, startDate, endDate),
    queryFn: () =>
      api.get<SensorReading[]>(`/sensors/${sensorId}/readings`, {
        params: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      }),
    staleTime: staleTimes.historical,
    enabled: !!sensorId,
  });
}

export function useRegisterSensor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<Sensor>) => api.post<Sensor>('/sensors', data),
    onSuccess: (_, variables) => {
      if (variables.farmId) {
        invalidateQueries.sensorData(variables.farmId);
      }
    },
  });
}

// =====================================================
// Weather Hooks
// =====================================================

export function useCurrentWeather(farmId: string) {
  return useQuery({
    queryKey: queryKeys.weather.current(farmId),
    queryFn: () => api.get<Weather>(`/weather/farm/${farmId}/current`),
    staleTime: staleTimes.weather,
    enabled: !!farmId,
  });
}

export function useWeatherForecast(farmId: string, days: number = 7) {
  return useQuery({
    queryKey: queryKeys.weather.forecast(farmId, days),
    queryFn: () => api.get<WeatherForecast[]>(`/weather/farm/${farmId}/forecast`, { params: { days } }),
    staleTime: staleTimes.weather,
    enabled: !!farmId,
  });
}

export function useWeatherAlerts(farmId: string) {
  return useQuery({
    queryKey: queryKeys.weather.alerts(farmId),
    queryFn: () => api.get(`/weather/farm/${farmId}/alerts`),
    staleTime: staleTimes.alerts,
    enabled: !!farmId,
  });
}

// =====================================================
// Recommendation Hooks
// =====================================================

export function useRecommendations(farmId?: string) {
  return useQuery({
    queryKey: queryKeys.recommendations.all(farmId),
    queryFn: () => api.get<Recommendation[]>('/recommendations', { params: farmId ? { farmId } : {} }),
    staleTime: staleTimes.recommendations,
  });
}

export function useActiveRecommendations(farmId: string) {
  return useQuery({
    queryKey: queryKeys.recommendations.active(farmId),
    queryFn: () =>
      api.get<Recommendation[]>(`/recommendations/farm/${farmId}`, {
        params: { status: 'pending,in_progress' },
      }),
    staleTime: staleTimes.recommendations,
    enabled: !!farmId,
  });
}

export function useUpdateRecommendationStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Recommendation['status'] }) =>
      api.patch(`/recommendations/${id}`, { status }),
    onSuccess: () => {
      invalidateQueries.recommendations();
    },
  });
}

// =====================================================
// Alert Hooks
// =====================================================

export function useAlerts(farmId?: string) {
  return useQuery({
    queryKey: queryKeys.alerts.all(farmId),
    queryFn: () => api.get<Alert[]>('/alerts', { params: farmId ? { farmId } : {} }),
    staleTime: staleTimes.alerts,
  });
}

export function useUnreadAlerts(farmId?: string) {
  return useQuery({
    queryKey: queryKeys.alerts.unread(farmId),
    queryFn: () =>
      api.get<Alert[]>('/alerts', { params: { isRead: false, ...(farmId ? { farmId } : {}) } }),
    staleTime: staleTimes.alerts,
    refetchInterval: 30000, // Check for new alerts every 30 seconds
  });
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => api.patch(`/alerts/${id}`, { isRead: true }),
    onSuccess: () => {
      invalidateQueries.alerts();
    },
  });
}

export function useMarkAllAlertsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (farmId?: string) =>
      api.post('/alerts/mark-all-read', { farmId }),
    onSuccess: () => {
      invalidateQueries.alerts();
    },
  });
}

// =====================================================
// Pest Detection Hooks
// =====================================================

export function usePestScans(farmId?: string) {
  return useQuery({
    queryKey: queryKeys.pests.scans(farmId),
    queryFn: () => api.get<PestScan[]>('/pest-detection/scans', { params: farmId ? { farmId } : {} }),
    staleTime: staleTimes.recommendations,
  });
}

export function usePestScan(scanId: string) {
  return useQuery({
    queryKey: queryKeys.pests.detail(scanId),
    queryFn: () => api.get<PestScan>(`/pest-detection/scans/${scanId}`),
    enabled: !!scanId,
    // Poll while processing
    refetchInterval: (query) => {
      const data = query.state.data as PestScan | undefined;
      return data?.status === 'processing' ? 2000 : false;
    },
  });
}

export function useUploadPestImage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ farmId, image }: { farmId: string; image: File }) => {
      const formData = new FormData();
      formData.append('farmId', farmId);
      formData.append('image', image);
      
      return api.upload<PestScan>('/pest-detection/analyze', formData);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pests.scans(variables.farmId) });
    },
  });
}

// =====================================================
// User Hooks
// =====================================================

export function useUserProfile() {
  return useQuery({
    queryKey: queryKeys.users.profile(),
    queryFn: () => api.get('/users/me'),
    staleTime: staleTimes.user,
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put('/users/me', data),
    onSuccess: () => {
      invalidateQueries.user();
    },
  });
}

export function useUserPreferences() {
  return useQuery({
    queryKey: queryKeys.users.preferences(),
    queryFn: () => api.get('/users/preferences'),
    staleTime: staleTimes.user,
  });
}

export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put('/users/preferences', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.preferences() });
    },
  });
}

// =====================================================
// Analytics Hooks
// =====================================================

export function useDashboardAnalytics(farmId?: string) {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard(farmId),
    queryFn: () => api.get('/analytics/dashboard', { params: farmId ? { farmId } : {} }),
    staleTime: staleTimes.analytics,
  });
}

export function useYieldAnalytics(farmId: string, range: string = '1y') {
  return useQuery({
    queryKey: queryKeys.analytics.yields(farmId, range),
    queryFn: () => api.get(`/analytics/farm/${farmId}/sensor-trends`, { params: { range } }),
    staleTime: staleTimes.historical,
    enabled: !!farmId,
  });
}

// =====================================================
// Export Query Keys for External Use
// =====================================================

export { queryKeys, staleTimes, invalidateQueries };
