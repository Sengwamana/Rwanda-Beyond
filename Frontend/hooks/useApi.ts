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
import { analyticsService } from '../services/analytics';
import aiService, { AgriculturalAdviceRequest, ChatRequest, ChatMessage } from '../services/ai';
import { contentService } from '../services/content';
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
  adminConfigs: ['adminConfigs'] as const,
  adminDevices: ['adminDevices'] as const,
  systemHealth: ['systemHealth'] as const,
  systemMetrics: ['systemMetrics'] as const,

  // Analytics
  analyticsDashboard: (farmId?: string) => ['analyticsDashboard', farmId] as const,
  systemAnalytics: ['systemAnalytics'] as const,
  districtAnalytics: (district: string) => ['districtAnalytics', district] as const,
  allDistrictsAnalytics: ['allDistrictsAnalytics'] as const,
  farmSensorTrendsAnalytics: (id: string) => ['farmSensorTrendsAnalytics', id] as const,

  // AI
  aiCapabilities: ['aiCapabilities'] as const,
  aiHealth: ['aiHealth'] as const,

  // Content
  contentResources: ['contentResources'] as const,
  contentFAQ: ['contentFAQ'] as const,
}

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

export function useCreateFertilization() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ farmId, data }: { farmId: string; data: Parameters<typeof farmService.createFertilizationSchedule>[1] }) =>
      farmService.createFertilizationSchedule(farmId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmFertilization(variables.farmId) });
      addNotification({ type: 'success', title: 'Fertilization schedule created successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to create fertilization schedule', message: handleApiError(error) });
    },
  });
}

export function useUpdateFertilization() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ farmId, scheduleId, data }: {
      farmId: string;
      scheduleId: string;
      data: Parameters<typeof farmService.updateFertilizationSchedule>[2];
    }) => farmService.updateFertilizationSchedule(farmId, scheduleId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmFertilization(variables.farmId) });
      addNotification({ type: 'success', title: 'Fertilization schedule updated successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to update fertilization schedule', message: handleApiError(error) });
    },
  });
}

export function useDeleteFertilization() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ farmId, scheduleId }: { farmId: string; scheduleId: string }) =>
      farmService.deleteFertilizationSchedule(farmId, scheduleId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmFertilization(variables.farmId) });
      addNotification({ type: 'success', title: 'Fertilization schedule deleted successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to delete fertilization schedule', message: handleApiError(error) });
    },
  });
}

export function useExecuteFertilization() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ farmId, scheduleId, data }: {
      farmId: string;
      scheduleId: string;
      data?: Parameters<typeof farmService.executeFertilization>[2];
    }) => farmService.executeFertilization(farmId, scheduleId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmFertilization(variables.farmId) });
      addNotification({ type: 'success', title: 'Fertilization marked as executed' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to update fertilization status', message: handleApiError(error) });
    },
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
      if (!params?.farmId) {
        return {
          success: true,
          message: 'No farm selected',
          data: [],
          pagination: {
            page: 1,
            limit: 0,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
          timestamp: new Date().toISOString(),
        };
      }
      const response = await sensorService.getAll(params);
      return response;
    },
    enabled: !!params?.farmId,
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
      const response = params?.farmId
        ? await pestDetectionService.getByFarm(params.farmId, {
            page: params.page,
            limit: params.limit,
            pestDetected: params.pestDetected,
            severity: params.severity,
            isConfirmed: params.isConfirmed,
            startDate: params.startDate,
            endDate: params.endDate,
          })
        : await pestDetectionService.getAll(params);
      return response;
    },
  });
}

export function useCreateSensor() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: sensorService.register,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.sensors, 'farm', variables.farmId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.sensors });
      addNotification({ type: 'success', title: 'Sensor registered successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to register sensor', message: handleApiError(error) });
    },
  });
}

export function useUpdateSensor() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof sensorService.update>[1] }) =>
      sensorService.update(id, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sensors });
      queryClient.invalidateQueries({ queryKey: queryKeys.sensor(response.data.id) });
      addNotification({ type: 'success', title: 'Sensor updated successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to update sensor', message: handleApiError(error) });
    },
  });
}

export function useDeleteSensor() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ id }: { id: string; farmId: string }) => sensorService.delete(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sensors });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.sensors, 'farm', variables.farmId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.farmSensorData(variables.farmId) });
      addNotification({ type: 'success', title: 'Sensor deleted successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to delete sensor', message: handleApiError(error) });
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

export function useDeletePestDetection() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: pestDetectionService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pestDetections });
      addNotification({ type: 'success', title: 'Pest detection deleted successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to delete pest detection', message: handleApiError(error) });
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
      if (!farmId) return [];
      const response = await recommendationService.getActive(farmId);
      return response.data;
    },
    enabled: !!farmId,
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

export function useUsers(params?: Parameters<typeof adminService.getUsers>[0], enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.users, params],
    queryFn: async () => {
      const response = await adminService.getUsers(params);
      return response;
    },
    enabled,
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

export function useSystemOverview(enabled = true) {
  return useQuery({
    queryKey: queryKeys.systemOverview,
    queryFn: async () => {
      const response = await adminService.getSystemOverview();
      return response.data;
    },
    refetchInterval: 60000, // Refresh every minute
    enabled,
  });
}

export function useAuditLogs(params?: Parameters<typeof adminService.getAuditLogs>[0], enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.auditLogs, params],
    queryFn: async () => {
      const response = await adminService.getAuditLogs(params);
      return response;
    },
    enabled,
  });
}

export function useAdminAnalytics(params?: Parameters<typeof adminService.getAnalytics>[0], enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.analytics, params],
    queryFn: async () => {
      const response = await adminService.getAnalytics(params);
      return response.data;
    },
    enabled,
  });
}

export function useAdminConfigs(enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminConfigs,
    queryFn: async () => {
      const response = await adminService.getConfigs();
      return response.data;
    },
    enabled,
  });
}

export function useAdminDevices(
  params?: Parameters<typeof adminService.getDevices>[0],
  enabled = true
) {
  return useQuery({
    queryKey: [...queryKeys.adminDevices, params],
    queryFn: async () => {
      const response = await adminService.getDevices(params);
      return response;
    },
    enabled,
  });
}

export function useSystemHealth(enabled = true) {
  return useQuery({
    queryKey: queryKeys.systemHealth,
    queryFn: async () => {
      const response = await adminService.getSystemHealth();
      return response.data;
    },
    enabled,
    refetchInterval: 60000,
  });
}

export function useSystemMetrics(
  params?: Parameters<typeof adminService.getSystemMetrics>[0],
  enabled = true
) {
  return useQuery({
    queryKey: [...queryKeys.systemMetrics, params],
    queryFn: async () => {
      const response = await adminService.getSystemMetrics(params);
      return response.data;
    },
    enabled,
    refetchInterval: 60000,
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

export function useUpdateSystemConfig() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: Parameters<typeof adminService.updateConfig>[1] }) =>
      adminService.updateConfig(key, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminConfigs });
      addNotification({ type: 'success', title: 'Configuration updated successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to update configuration', message: handleApiError(error) });
    },
  });
}

export function useGenerateDeviceToken() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: adminService.generateDeviceToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDevices });
      addNotification({ type: 'success', title: 'Device token generated successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to generate device token', message: handleApiError(error) });
    },
  });
}

export function useRevokeDeviceToken() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: adminService.revokeDeviceToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminDevices });
      addNotification({ type: 'success', title: 'Device token revoked successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to revoke device token', message: handleApiError(error) });
    },
  });
}

export function useSendBroadcast() {
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: adminService.sendBroadcast,
    onSuccess: () => {
      addNotification({ type: 'success', title: 'Broadcast queued successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to send broadcast', message: handleApiError(error) });
    },
  });
}

export function useGenerateAdminReport() {
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: adminService.generateReport,
    onSuccess: () => {
      addNotification({ type: 'success', title: 'Report generated successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to generate report', message: handleApiError(error) });
    },
  });
}

// ===== Analytics Hooks =====

export function useAnalyticsDashboard(farmId?: string) {
  return useQuery({
    queryKey: queryKeys.analyticsDashboard(farmId),
    queryFn: async () => {
      const response = await analyticsService.getDashboard(farmId ? { farmId } : undefined);
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useSystemAnalytics() {
  return useQuery({
    queryKey: queryKeys.systemAnalytics,
    queryFn: async () => {
      const response = await analyticsService.getSystemOverview();
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDistrictAnalytics(district: string) {
  return useQuery({
    queryKey: queryKeys.districtAnalytics(district),
    queryFn: async () => {
      const response = await analyticsService.getDistrictAnalytics(district);
      return response.data;
    },
    enabled: !!district,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllDistrictsAnalytics() {
  return useQuery({
    queryKey: queryKeys.allDistrictsAnalytics,
    queryFn: async () => {
      const response = await analyticsService.getAllDistrictsAnalytics();
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useFarmSensorTrendsAnalytics(
  farmId: string,
  params?: { startDate?: string; endDate?: string; interval?: 'hour' | 'day' | 'week' }
) {
  return useQuery({
    queryKey: [...queryKeys.farmSensorTrendsAnalytics(farmId), params],
    queryFn: async () => {
      const response = await analyticsService.getSensorTrends(farmId, params);
      return response.data;
    },
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useExportAnalyticsData() {
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: analyticsService.exportData,
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to export data', message: handleApiError(error) });
    },
  });
}

// ===== AI Hooks =====

export function useAiAdvice() {
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: (request: AgriculturalAdviceRequest) => aiService.getAgriculturalAdvice(request),
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to get AI advice', message: handleApiError(error) });
    },
  });
}

export function useAiChat() {
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: (request: ChatRequest) => aiService.sendChatMessage(request),
    onError: (error) => {
      addNotification({ type: 'error', title: 'AI chat error', message: handleApiError(error) });
    },
  });
}

export function useAiCapabilities() {
  return useQuery({
    queryKey: queryKeys.aiCapabilities,
    queryFn: () => aiService.getCapabilities(),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useAiHealth() {
  return useQuery({
    queryKey: queryKeys.aiHealth,
    queryFn: () => aiService.checkHealth(),
    refetchInterval: 60 * 1000,
  });
}

// ===== Content Hooks =====

export function useContentResources() {
  return useQuery({
    queryKey: queryKeys.contentResources,
    queryFn: async () => {
      const response = await contentService.getResources();
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useContentFAQ() {
  return useQuery({
    queryKey: queryKeys.contentFAQ,
    queryFn: async () => {
      const response = await contentService.getFAQ();
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useSubmitCareerInterest() {
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ positionId, positionTitle }: { positionId?: string; positionTitle: string }) =>
      contentService.submitCareerInterest(positionId, positionTitle),
    onSuccess: () => {
      addNotification({ type: 'success', title: 'Career interest submitted!' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to submit interest', message: handleApiError(error) });
    },
  });
}
