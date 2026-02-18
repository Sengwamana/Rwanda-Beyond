// =====================================================
// React Query Hooks - Smart Maize Farming System
// =====================================================

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { 
  farmService, 
  sensorService, 
  weatherService, 
  pestDetectionService, 
  recommendationService,
  authService,
  adminService,
  handleApiError 
} from '../services';
import { 
  Farm, 
  Sensor, 
  SensorData, 
  WeatherData, 
  WeatherForecast,
  PestDetection, 
  Recommendation,
  User,
  SystemOverview,
  IrrigationSchedule,
  FertilizationSchedule,
  FarmDashboardData
} from '../types';
import { useNotificationStore } from '../store';

// Query keys for cache management
export const queryKeys = {
  // Auth
  profile: ['profile'] as const,
  
  // Farms
  farms: ['farms'] as const,
  farm: (id: string) => ['farm', id] as const,
  farmDashboard: (id: string) => ['farmDashboard', id] as const,
  farmSensorData: (id: string) => ['farmSensorData', id] as const,
  farmSensorTrends: (id: string) => ['farmSensorTrends', id] as const,
  farmIrrigation: (id: string) => ['farmIrrigation', id] as const,
  farmFertilization: (id: string) => ['farmFertilization', id] as const,
  
  // Sensors
  sensors: ['sensors'] as const,
  sensor: (id: string) => ['sensor', id] as const,
  sensorReadings: (id: string) => ['sensorReadings', id] as const,
  
  // Weather
  weather: (farmId: string) => ['weather', farmId] as const,
  forecast: (farmId: string) => ['forecast', farmId] as const,
  farmingConditions: (farmId: string) => ['farmingConditions', farmId] as const,
  
  // Pest Detection
  pestDetections: ['pestDetections'] as const,
  pestDetection: (id: string) => ['pestDetection', id] as const,
  pestStatistics: ['pestStatistics'] as const,
  pendingReviews: ['pendingReviews'] as const,
  
  // Recommendations
  recommendations: ['recommendations'] as const,
  recommendation: (id: string) => ['recommendation', id] as const,
  activeRecommendations: ['activeRecommendations'] as const,
  
  // Admin
  users: ['users'] as const,
  user: (id: string) => ['user', id] as const,
  systemOverview: ['systemOverview'] as const,
  auditLogs: ['auditLogs'] as const,
  analytics: ['analytics'] as const,
};

// ===== Auth Hooks =====

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: async () => {
      const response = await authService.getProfile();
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  
  return useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      addNotification({ type: 'success', title: 'Profile updated successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to update profile', message: handleApiError(error) });
    },
  });
}

// ===== Farm Hooks =====

export function useFarms(params?: Parameters<typeof farmService.getAll>[0]) {
  return useQuery({
    queryKey: [...queryKeys.farms, params],
    queryFn: async () => {
      const response = await farmService.getAll(params);
      return response;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useFarm(id: string, options?: Partial<UseQueryOptions<Farm>>) {
  return useQuery({
    queryKey: queryKeys.farm(id),
    queryFn: async () => {
      const response = await farmService.getById(id);
      return response.data;
    },
    enabled: !!id,
    ...options,
  });
}

export function useFarmDashboard(id: string) {
  return useQuery({
    queryKey: queryKeys.farmDashboard(id),
    queryFn: async () => {
      const response = await farmService.getDashboard(id);
      return response.data;
    },
    enabled: !!id,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useFarmSensorData(
  id: string, 
  params?: Parameters<typeof farmService.getSensorData>[1]
) {
  return useQuery({
    queryKey: [...queryKeys.farmSensorData(id), params],
    queryFn: async () => {
      const response = await farmService.getSensorData(id, params);
      return response.data;
    },
    enabled: !!id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useFarmSensorTrends(
  id: string,
  params?: Parameters<typeof farmService.getSensorTrends>[1]
) {
  return useQuery({
    queryKey: [...queryKeys.farmSensorTrends(id), params],
    queryFn: async () => {
      const response = await farmService.getSensorTrends(id, params);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useIrrigationSchedules(
  farmId: string,
  params?: Parameters<typeof farmService.getIrrigationSchedules>[1]
) {
  return useQuery({
    queryKey: [...queryKeys.farmIrrigation(farmId), params],
    queryFn: async () => {
      const response = await farmService.getIrrigationSchedules(farmId, params);
      return response.data;
    },
    enabled: !!farmId,
  });
}

export function useFertilizationSchedules(
  farmId: string,
  params?: Parameters<typeof farmService.getFertilizationSchedules>[1]
) {
  return useQuery({
    queryKey: [...queryKeys.farmFertilization(farmId), params],
    queryFn: async () => {
      const response = await farmService.getFertilizationSchedules(farmId, params);
      return response.data;
    },
    enabled: !!farmId,
  });
}

export function useCreateFarm() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  
  return useMutation({
    mutationFn: farmService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farms });
      addNotification({ type: 'success', title: 'Farm created successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to create farm', message: handleApiError(error) });
    },
  });
}

export function useUpdateFarm() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof farmService.update>[1] }) =>
      farmService.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farms });
      queryClient.invalidateQueries({ queryKey: queryKeys.farm(variables.id) });
      addNotification({ type: 'success', title: 'Farm updated successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to update farm', message: handleApiError(error) });
    },
  });
}

export function useDeleteFarm() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  
  return useMutation({
    mutationFn: farmService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farms });
      addNotification({ type: 'success', title: 'Farm deleted successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to delete farm', message: handleApiError(error) });
    },
  });
}

export function useCreateIrrigation() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  
  return useMutation({
    mutationFn: ({ farmId, data }: { farmId: string; data: Parameters<typeof farmService.createIrrigationSchedule>[1] }) =>
      farmService.createIrrigationSchedule(farmId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmIrrigation(variables.farmId) });
      addNotification({ type: 'success', title: 'Irrigation scheduled successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to schedule irrigation', message: handleApiError(error) });
    },
  });
}

export function useExecuteIrrigation() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  
  return useMutation({
    mutationFn: ({ farmId, scheduleId, data }: { 
      farmId: string; 
      scheduleId: string; 
      data?: Parameters<typeof farmService.executeIrrigation>[2] 
    }) => farmService.executeIrrigation(farmId, scheduleId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmIrrigation(variables.farmId) });
      addNotification({ type: 'success', title: 'Irrigation executed successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to execute irrigation', message: handleApiError(error) });
    },
  });
}

// ===== Sensor Hooks =====

export function useSensors(params?: Parameters<typeof sensorService.getAll>[0]) {
  return useQuery({
    queryKey: [...queryKeys.sensors, params],
    queryFn: async () => {
      const response = await sensorService.getAll(params);
      return response;
    },
  });
}

export function useSensor(id: string) {
  return useQuery({
    queryKey: queryKeys.sensor(id),
    queryFn: async () => {
      const response = await sensorService.getById(id);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useSensorsByFarm(farmId: string) {
  return useQuery({
    queryKey: [...queryKeys.sensors, 'farm', farmId],
    queryFn: async () => {
      const response = await sensorService.getByFarm(farmId);
      return response.data;
    },
    enabled: !!farmId,
  });
}

export function useSensorReadings(
  sensorId: string,
  params?: Parameters<typeof sensorService.getReadings>[1]
) {
  return useQuery({
    queryKey: [...queryKeys.sensorReadings(sensorId), params],
    queryFn: async () => {
      const response = await sensorService.getReadings(sensorId, params);
      return response;
    },
    enabled: !!sensorId,
  });
}

// ===== Weather Hooks =====

export function useWeather(farmId: string) {
  return useQuery({
    queryKey: queryKeys.weather(farmId),
    queryFn: async () => {
      const response = await weatherService.getCurrentWeather(farmId);
      return response.data;
    },
    enabled: !!farmId,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}

export function useForecast(farmId: string, days?: number) {
  return useQuery({
    queryKey: [...queryKeys.forecast(farmId), days],
    queryFn: async () => {
      const response = await weatherService.getForecast(farmId, days);
      return response.data;
    },
    enabled: !!farmId,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

export function useFarmingConditions(farmId: string) {
  return useQuery({
    queryKey: queryKeys.farmingConditions(farmId),
    queryFn: async () => {
      const response = await weatherService.getFarmingConditions(farmId);
      return response.data;
    },
    enabled: !!farmId,
  });
}

// ===== Pest Detection Hooks =====

export function usePestDetections(params?: Parameters<typeof pestDetectionService.getAll>[0]) {
  return useQuery({
    queryKey: [...queryKeys.pestDetections, params],
    queryFn: async () => {
      const response = await pestDetectionService.getAll(params);
      return response;
    },
  });
}

export function usePestDetection(id: string) {
  return useQuery({
    queryKey: queryKeys.pestDetection(id),
    queryFn: async () => {
      const response = await pestDetectionService.getById(id);
      return response.data;
    },
    enabled: !!id,
  });
}

export function usePestStatistics(params?: Parameters<typeof pestDetectionService.getStatistics>[0]) {
  return useQuery({
    queryKey: [...queryKeys.pestStatistics, params],
    queryFn: async () => {
      const response = await pestDetectionService.getStatistics(params);
      return response.data;
    },
  });
}

export function usePendingReviews(params?: Parameters<typeof pestDetectionService.getPendingReview>[0]) {
  return useQuery({
    queryKey: [...queryKeys.pendingReviews, params],
    queryFn: async () => {
      const response = await pestDetectionService.getPendingReview(params);
      return response;
    },
  });
}

export function useAnalyzePest() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  
  return useMutation({
    mutationFn: pestDetectionService.analyze,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pestDetections });
      addNotification({ type: 'success', title: 'Image analyzed successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to analyze image', message: handleApiError(error) });
    },
  });
}

export function useReviewPestDetection() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof pestDetectionService.review>[1] }) =>
      pestDetectionService.review(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pestDetections });
      queryClient.invalidateQueries({ queryKey: queryKeys.pestDetection(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingReviews });
      addNotification({ type: 'success', title: 'Review submitted successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to submit review', message: handleApiError(error) });
    },
  });
}

// ===== Recommendation Hooks =====

export function useRecommendations(params?: Parameters<typeof recommendationService.getAll>[0]) {
  return useQuery({
    queryKey: [...queryKeys.recommendations, params],
    queryFn: async () => {
      const response = await recommendationService.getAll(params);
      return response;
    },
  });
}

export function useRecommendation(id: string) {
  return useQuery({
    queryKey: queryKeys.recommendation(id),
    queryFn: async () => {
      const response = await recommendationService.getById(id);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useActiveRecommendations(farmId?: string) {
  return useQuery({
    queryKey: [...queryKeys.activeRecommendations, farmId],
    queryFn: async () => {
      const response = await recommendationService.getActive(farmId);
      return response.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useRespondToRecommendation() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof recommendationService.respond>[1] }) =>
      recommendationService.respond(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeRecommendations });
      addNotification({ type: 'success', title: 'Response recorded successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to respond', message: handleApiError(error) });
    },
  });
}

export function useGenerateRecommendations() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  
  return useMutation({
    mutationFn: recommendationService.generate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeRecommendations });
      addNotification({ type: 'success', title: 'New recommendations generated' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to generate recommendations', message: handleApiError(error) });
    },
  });
}

// ===== Admin Hooks =====

export function useUsers(params?: Parameters<typeof adminService.getUsers>[0]) {
  return useQuery({
    queryKey: [...queryKeys.users, params],
    queryFn: async () => {
      const response = await adminService.getUsers(params);
      return response;
    },
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.user(id),
    queryFn: async () => {
      const response = await adminService.getUserById(id);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useSystemOverview() {
  return useQuery({
    queryKey: queryKeys.systemOverview,
    queryFn: async () => {
      const response = await adminService.getSystemOverview();
      return response.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useAuditLogs(params?: Parameters<typeof adminService.getAuditLogs>[0]) {
  return useQuery({
    queryKey: [...queryKeys.auditLogs, params],
    queryFn: async () => {
      const response = await adminService.getAuditLogs(params);
      return response;
    },
  });
}

export function useAdminAnalytics(params?: Parameters<typeof adminService.getAnalytics>[0]) {
  return useQuery({
    queryKey: [...queryKeys.analytics, params],
    queryFn: async () => {
      const response = await adminService.getAnalytics(params);
      return response.data;
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof adminService.updateUser>[1] }) =>
      adminService.updateUser(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.user(variables.id) });
      addNotification({ type: 'success', title: 'User updated successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to update user', message: handleApiError(error) });
    },
  });
}
