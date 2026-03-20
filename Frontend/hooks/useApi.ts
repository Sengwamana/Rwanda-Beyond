// =====================================================
// React Query Hooks - Smart Maize Farming System
// =====================================================

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { 
  farmService, 
  farmIssueService,
  sensorService, 
  weatherService, 
  pestDetectionService, 
  recommendationService,
  messageService,
  authService,
  adminService,
  ussdService,
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
import { useAuthStore, useNotificationStore } from '../store';

// Query keys for cache management
export const queryKeys = {
  // Auth
  profile: ['profile'] as const,
  
  // Farms
  farms: ['farms'] as const,
  farmStats: ['farmStats'] as const,
  districts: ['districts'] as const,
  farm: (id: string) => ['farm', id] as const,
  farmDashboard: (id: string) => ['farmDashboard', id] as const,
  farmSensorData: (id: string) => ['farmSensorData', id] as const,
  farmLatestReadings: (id: string) => ['farmLatestReadings', id] as const,
  farmSensorTrends: (id: string) => ['farmSensorTrends', id] as const,
  farmIrrigation: (id: string) => ['farmIrrigation', id] as const,
  farmFertilization: (id: string) => ['farmFertilization', id] as const,
  farmPestControl: (id: string) => ['farmPestControl', id] as const,
  farmIssues: (id: string) => ['farmIssues', id] as const,
  farmIssue: (id: string) => ['farmIssue', id] as const,
  allFarmIssues: ['allFarmIssues'] as const,
  
  // Sensors
  sensors: ['sensors'] as const,
  sensor: (id: string) => ['sensor', id] as const,
  sensorReadings: (id: string) => ['sensorReadings', id] as const,
  sensorHealth: (farmId?: string) => ['sensorHealth', farmId || 'all'] as const,
  
  // Weather
  weather: (farmId: string) => ['weather', farmId] as const,
  weatherCoords: (lat?: number, lon?: number) => ['weatherCoords', lat ?? 'none', lon ?? 'none'] as const,
  districtWeather: (district: string) => ['districtWeather', district] as const,
  forecast: (farmId: string) => ['forecast', farmId] as const,
  farmingConditions: (farmId: string) => ['farmingConditions', farmId] as const,
  weatherAlerts: (farmId: string) => ['weatherAlerts', farmId] as const,
  weatherHistory: (farmId: string, params?: unknown) => ['weatherHistory', farmId, params] as const,
  irrigationWindow: (farmId: string) => ['irrigationWindow', farmId] as const,
  
  // Pest Detection
  pestDetections: ['pestDetections'] as const,
  pestDetection: (id: string) => ['pestDetection', id] as const,
  pestScans: (farmId?: string, params?: unknown) => ['pestScans', farmId || 'all', params] as const,
  pestScan: (id: string) => ['pestScan', id] as const,
  pestTreatments: (id: string) => ['pestTreatments', id] as const,
  pestStatistics: ['pestStatistics'] as const,
  pestOutbreakMap: (params?: unknown) => ['pestOutbreakMap', params] as const,
  pendingReviews: ['pendingReviews'] as const,
  
  // Recommendations
  recommendations: ['recommendations'] as const,
  recommendation: (id: string) => ['recommendation', id] as const,
  activeRecommendations: ['activeRecommendations'] as const,
  pendingRecommendations: ['pendingRecommendations'] as const,
  recommendationStatistics: ['recommendationStatistics'] as const,
  myMessages: (params?: unknown) => ['myMessages', params] as const,
  
  // Admin
  users: ['users'] as const,
  user: (id: string) => ['user', id] as const,
  adminUserStatistics: ['adminUserStatistics'] as const,
  adminFarmStatistics: ['adminFarmStatistics'] as const,
  adminFarms: ['adminFarms'] as const,
  systemOverview: ['systemOverview'] as const,
  auditLogs: ['auditLogs'] as const,
  analytics: ['analytics'] as const,
  adminConfigs: ['adminConfigs'] as const,
  adminDevices: ['adminDevices'] as const,
  adminSensorHealth: ['adminSensorHealth'] as const,
  notificationQueue: (params?: unknown) => ['notificationQueue', params] as const,
  systemHealth: ['systemHealth'] as const,
  systemMetrics: ['systemMetrics'] as const,
  alertStatistics: ['alertStatistics'] as const,

  // Analytics
  analyticsDashboard: (farmId?: string) => ['analyticsDashboard', farmId] as const,
  systemAnalytics: ['systemAnalytics'] as const,
  districtAnalytics: (district: string) => ['districtAnalytics', district] as const,
  allDistrictsAnalytics: ['allDistrictsAnalytics'] as const,
  farmSensorTrendsAnalytics: (id: string) => ['farmSensorTrendsAnalytics', id] as const,
  recommendationHistoryAnalytics: (id: string) => ['recommendationHistoryAnalytics', id] as const,
  farmActivityAnalytics: (id: string) => ['farmActivityAnalytics', id] as const,
  recentActivityAnalytics: (hours?: number, limit?: number, type?: string) => ['recentActivityAnalytics', hours, limit, type] as const,

  // AI
  aiCapabilities: ['aiCapabilities'] as const,
  aiHealth: ['aiHealth'] as const,

  // USSD
  ussdHealth: ['ussdHealth'] as const,

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

export function useMyMessages(params?: Parameters<typeof messageService.getMine>[0], enabled = true) {
  const currentUserId = useAuthStore((state) => state.user?.id || null);

  return useQuery({
    queryKey: [...queryKeys.myMessages(params), currentUserId],
    queryFn: async () => {
      const response = await messageService.getMine(params);
      return response.data;
    },
    enabled: enabled && !!currentUserId,
    staleTime: 60 * 1000,
  });
}

export function useMarkMessageRead() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: messageService.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myMessages'] });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to mark notification as read', message: handleApiError(error) });
    },
  });
}

export function useMarkAllMessagesRead() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: messageService.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myMessages'] });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to mark notifications as read', message: handleApiError(error) });
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

export function useFarmStats(enabled = true) {
  return useQuery({
    queryKey: queryKeys.farmStats,
    queryFn: async () => {
      const response = await farmService.getStats();
      return response.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDistricts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.districts,
    queryFn: async () => {
      const response = await farmService.getDistricts();
      return response.data;
    },
    enabled,
    staleTime: 10 * 60 * 1000,
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

export function useSaveFarmImage() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ farmId, data }: { farmId: string; data: Parameters<typeof farmService.saveImage>[1] }) =>
      farmService.saveImage(farmId, data),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farm(variables.farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.farmDashboard(variables.farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.farms });
      addNotification({ type: 'success', title: 'Farm image saved to the farm record' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to save farm image', message: handleApiError(error) });
    },
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

export function useFarmLatestReadings(id: string) {
  return useQuery({
    queryKey: queryKeys.farmLatestReadings(id),
    queryFn: async () => {
      const response = await sensorService.getFarmLatestReadings(id);
      return response.data;
    },
    enabled: !!id,
    refetchInterval: 30000,
  });
}

export function usePestControlSchedules(
  farmId: string,
  params?: Parameters<typeof farmService.getPestControlSchedules>[1]
) {
  return useQuery({
    queryKey: [...queryKeys.farmPestControl(farmId), params],
    queryFn: async () => {
      const response = await farmService.getPestControlSchedules(farmId, params);
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

export function useCreatePestControl() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ farmId, data }: { farmId: string; data: Parameters<typeof farmService.createPestControlSchedule>[1] }) =>
      farmService.createPestControlSchedule(farmId, data),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmPestControl(variables.farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeRecommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.farmActivityAnalytics(variables.farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendationHistoryAnalytics(variables.farmId) });
      addNotification({ type: 'success', title: 'Pest control scheduled successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to schedule pest control', message: handleApiError(error) });
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

export function useExecutePestControl() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ farmId, scheduleId, data }: {
      farmId: string;
      scheduleId: string;
      data?: Parameters<typeof farmService.executePestControl>[2];
    }) => farmService.executePestControl(farmId, scheduleId, data),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmPestControl(variables.farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeRecommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.farmActivityAnalytics(variables.farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendationHistoryAnalytics(variables.farmId) });
      addNotification({ type: 'success', title: 'Pest control marked as executed' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to update pest control', message: handleApiError(error) });
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

export function useFarmIssues(
  farmId: string,
  params?: Parameters<typeof farmIssueService.getByFarm>[1],
  enabled = true
) {
  return useQuery({
    queryKey: [...queryKeys.farmIssues(farmId), params],
    queryFn: async () => {
      const response = await farmIssueService.getByFarm(farmId, params);
      return response;
    },
    enabled: !!farmId && enabled,
    staleTime: 60 * 1000,
  });
}

export function useAllFarmIssues(
  params?: Parameters<typeof farmIssueService.getAll>[0],
  enabled = true
) {
  return useQuery({
    queryKey: [...queryKeys.allFarmIssues, params],
    queryFn: async () => {
      const response = await farmIssueService.getAll(params);
      return response;
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useFarmIssue(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.farmIssue(id),
    queryFn: async () => {
      const response = await farmIssueService.getById(id);
      return response.data;
    },
    enabled: !!id && enabled,
    staleTime: 60 * 1000,
  });
}

export function useCreateFarmIssue() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ farmId, data }: { farmId: string; data: Parameters<typeof farmIssueService.create>[1] }) =>
      farmIssueService.create(farmId, data),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmIssues(variables.farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.allFarmIssues });
      addNotification({ type: 'success', title: 'Farm issue reported successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to report farm issue', message: handleApiError(error) });
    },
  });
}

export function useUpdateFarmIssue() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ id, data, farmId }: { id: string; farmId: string; data: Parameters<typeof farmIssueService.update>[1] }) =>
      farmIssueService.update(id, data),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmIssues(variables.farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.farmIssue(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.allFarmIssues });
      addNotification({ type: 'success', title: 'Farm issue updated successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to update farm issue', message: handleApiError(error) });
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

export function useUpdateFarmGrowthStage() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => farmService.updateGrowthStage(id, stage),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farms });
      queryClient.invalidateQueries({ queryKey: queryKeys.farm(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.farmDashboard(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.analyticsDashboard(variables.id) });
      addNotification({ type: 'success', title: 'Growth stage updated successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to update growth stage', message: handleApiError(error) });
    },
  });
}

export function useUpdateIrrigation() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ farmId, scheduleId, data }: {
      farmId: string;
      scheduleId: string;
      data: Parameters<typeof farmService.updateIrrigationSchedule>[2];
    }) => farmService.updateIrrigationSchedule(farmId, scheduleId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmIrrigation(variables.farmId) });
      addNotification({ type: 'success', title: 'Irrigation schedule updated successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to update irrigation schedule', message: handleApiError(error) });
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

export function useSensorHealth(farmId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.sensorHealth(farmId),
    queryFn: async () => {
      const response = await sensorService.getSensorHealth(farmId);
      return response.data;
    },
    enabled,
    refetchInterval: 60000,
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

export function useWeatherByCoordinates(lat?: number, lon?: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.weatherCoords(lat, lon),
    queryFn: async () => {
      const response = await weatherService.getCurrentWeatherByCoords(lat as number, lon as number);
      return response.data;
    },
    enabled: enabled && typeof lat === 'number' && typeof lon === 'number',
    staleTime: 15 * 60 * 1000,
  });
}

export function useDistrictWeather(district: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.districtWeather(district),
    queryFn: async () => {
      const response = await weatherService.getByDistrict(district);
      return response.data;
    },
    enabled: enabled && !!district,
    staleTime: 15 * 60 * 1000,
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

export function useWeatherAlerts(farmId: string) {
  return useQuery({
    queryKey: queryKeys.weatherAlerts(farmId),
    queryFn: async () => {
      const response = await weatherService.getWeatherAlerts(farmId);
      return response.data;
    },
    enabled: !!farmId,
    staleTime: 15 * 60 * 1000,
  });
}

export function useHistoricalWeather(
  farmId: string,
  params: Parameters<typeof weatherService.getHistoricalWeather>[1]
) {
  return useQuery({
    queryKey: queryKeys.weatherHistory(farmId, params),
    queryFn: async () => {
      const response = await weatherService.getHistoricalWeather(farmId, params);
      return response.data;
    },
    enabled: !!farmId && !!params?.startDate && !!params?.endDate,
    staleTime: 30 * 60 * 1000,
  });
}

export function useIrrigationWindow(farmId: string) {
  return useQuery({
    queryKey: queryKeys.irrigationWindow(farmId),
    queryFn: async () => {
      const response = await weatherService.getIrrigationWindow(farmId);
      return response.data;
    },
    enabled: !!farmId,
    staleTime: 30 * 60 * 1000,
  });
}

// ===== Pest Detection Hooks =====

export function usePestDetections(
  params?: Parameters<typeof pestDetectionService.getAll>[0],
  enabled = true
) {
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
    enabled,
  });
}

export function usePestScans(
  farmId: string,
  params?: Omit<Parameters<typeof pestDetectionService.getScans>[1], 'farmId'>,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.pestScans(farmId, params),
    queryFn: async () => {
      const response = await pestDetectionService.getScans(farmId, params);
      return response;
    },
    enabled: !!farmId && enabled,
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

export function usePestScan(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.pestScan(id),
    queryFn: async () => {
      const response = await pestDetectionService.getScanById(id);
      return response.data;
    },
    enabled: !!id && enabled,
  });
}

export function usePestTreatmentRecommendations(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.pestTreatments(id),
    queryFn: async () => {
      const response = await pestDetectionService.getTreatmentRecommendations(id);
      return response.data;
    },
    enabled: !!id && enabled,
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

export function usePestOutbreakMap(
  params?: Parameters<typeof pestDetectionService.getOutbreakMap>[0],
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.pestOutbreakMap(params),
    queryFn: async () => {
      const response = await pestDetectionService.getOutbreakMap(params);
      return response.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pestDetections });
      queryClient.invalidateQueries({ queryKey: queryKeys.pestScans(variables.farmId) });
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
    onSuccess: (_, detectionId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pestDetections });
      queryClient.invalidateQueries({ queryKey: queryKeys.pestScans() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pestScan(detectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pestDetection(detectionId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.pestScan(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pestScans() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingReviews });
      addNotification({ type: 'success', title: 'Review submitted successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to submit review', message: handleApiError(error) });
    },
  });
}

// ===== Recommendation Hooks =====

export function useRecommendations(
  params?: Parameters<typeof recommendationService.getAll>[0],
  enabled = true
) {
  return useQuery({
    queryKey: [...queryKeys.recommendations, params],
    queryFn: async () => {
      const response = params?.farmId
        ? await recommendationService.getByFarm(params.farmId, {
            page: params.page,
            limit: params.limit,
            status: params.status,
            type: params.type,
            priority: params.priority,
          })
        : await recommendationService.getAll(params);
      return response;
    },
    enabled,
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

export function useActiveRecommendations(farmId?: string, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.activeRecommendations, farmId || 'all'],
    queryFn: async () => {
      const response = await recommendationService.getActive(farmId);
      return response.data;
    },
    enabled,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useRespondToRecommendation() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof recommendationService.respond>[1] }) =>
      recommendationService.respond(id, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeRecommendations });
      if (response?.data?.farmId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.farmIrrigation(response.data.farmId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.farmActivityAnalytics(response.data.farmId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.recommendationHistoryAnalytics(response.data.farmId) });
      }
      addNotification({ type: 'success', title: 'Response recorded successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to respond', message: handleApiError(error) });
    },
  });
}

export function useCompleteRecommendation() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ id, notes, outcome }: { id: string; notes?: string; outcome?: string }) =>
      recommendationService.markCompleted(id, notes, outcome),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeRecommendations });
      if (response?.data?.farmId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.farmActivityAnalytics(response.data.farmId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.recommendationHistoryAnalytics(response.data.farmId) });
      }
      addNotification({ type: 'success', title: 'Recommendation marked as completed' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to complete recommendation', message: handleApiError(error) });
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

export function useReanalyzePestDetection() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: pestDetectionService.reanalyze,
    onSuccess: (response, detectionId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pestDetections });
      queryClient.invalidateQueries({ queryKey: queryKeys.pestDetection(detectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pestScan(detectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pestScans() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingReviews });
      queryClient.invalidateQueries({ queryKey: queryKeys.pestStatistics });
      queryClient.invalidateQueries({ queryKey: queryKeys.pestOutbreakMap() });
      addNotification({
        type: 'success',
        title: 'Detection reanalyzed successfully',
        message: response.data.analysis?.pestType || response.data.detection?.pestType || undefined,
      });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to reanalyze detection', message: handleApiError(error) });
    },
  });
}

export function useBulkGenerateRecommendations() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: recommendationService.bulkGenerate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingRecommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeRecommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendationStatistics });
      queryClient.invalidateQueries({ queryKey: queryKeys.systemOverview });
      queryClient.invalidateQueries({ queryKey: queryKeys.systemAnalytics });
      addNotification({ type: 'success', title: 'Bulk recommendations generated successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to bulk generate recommendations', message: handleApiError(error) });
    },
  });
}

export function useCreateManualRecommendation() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: recommendationService.createManual,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeRecommendations });
      if (response?.data?.farmId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.farmActivityAnalytics(response.data.farmId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.recommendationHistoryAnalytics(response.data.farmId) });
      }
      addNotification({ type: 'success', title: 'Expert recommendation created successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to create expert recommendation', message: handleApiError(error) });
    },
  });
}

export function useRecommendationStatistics(
  params?: Parameters<typeof recommendationService.getStatistics>[0],
  enabled = true
) {
  return useQuery({
    queryKey: [...queryKeys.recommendationStatistics, params],
    queryFn: async () => {
      const response = await recommendationService.getStatistics(params);
      return response.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecommendationHistoryList(
  params?: Parameters<typeof recommendationService.getHistory>[0],
  enabled = true
) {
  return useQuery({
    queryKey: [...queryKeys.recommendations, 'history', params],
    queryFn: async () => {
      const response = await recommendationService.getHistory(params);
      return response;
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

export function usePendingRecommendations(
  params?: Parameters<typeof recommendationService.getPendingRecommendations>[0],
  enabled = true
) {
  return useQuery({
    queryKey: [...queryKeys.pendingRecommendations, params],
    queryFn: async () => {
      const response = await recommendationService.getPendingRecommendations(params);
      return response;
    },
    enabled,
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

export function useAdminUsers(params?: Parameters<typeof adminService.getAdminUsers>[0], enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.users, 'admin', params],
    queryFn: async () => {
      const response = await adminService.getAdminUsers(params);
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

export function useAdminUserStatistics(enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminUserStatistics,
    queryFn: async () => {
      const response = await adminService.getUserStatistics();
      return response.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminFarmStatistics(enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminFarmStatistics,
    queryFn: async () => {
      const response = await adminService.getFarmStatistics();
      return response.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminFarms(
  params?: Parameters<typeof adminService.getAllFarms>[0],
  enabled = true
) {
  return useQuery({
    queryKey: [...queryKeys.adminFarms, params],
    queryFn: async () => {
      const response = await adminService.getAllFarms(params);
      return response;
    },
    enabled,
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

export function useAdminSensorHealth(enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminSensorHealth,
    queryFn: async () => {
      const response = await adminService.getSensorHealth();
      return response.data;
    },
    enabled,
    refetchInterval: 60000,
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

export function useAlertStatistics(
  params?: Parameters<typeof adminService.getAlertStatistics>[0],
  enabled = true
) {
  return useQuery({
    queryKey: [...queryKeys.alertStatistics, params],
    queryFn: async () => {
      const response = await adminService.getAlertStatistics(params);
      return response.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
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
    const queryClient = useQueryClient();
    const { addNotification } = useNotificationStore();
  
    return useMutation({
      mutationFn: adminService.sendBroadcast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationQueue'] });
      addNotification({ type: 'success', title: 'Broadcast queued successfully' });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to send broadcast', message: handleApiError(error) });
      },
    });
  }

export function useProcessNotificationQueue() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: adminService.processNotificationQueue,
    onSuccess: (response) => {
      const result = response.data;
      queryClient.invalidateQueries({ queryKey: ['notificationQueue'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.systemMetrics });
      queryClient.invalidateQueries({ queryKey: queryKeys.systemOverview });
      addNotification({
        type: 'success',
        title: 'Notification queue processed',
        message: `Processed ${result?.processed ?? 0}, sent ${result?.sent ?? 0}, failed ${result?.failed ?? 0}, retried ${result?.retried ?? 0}.`,
      });
    },
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to process notification queue', message: handleApiError(error) });
    },
  });
}

export function useNotificationQueueSnapshot(
  params?: Parameters<typeof adminService.getNotificationQueueSnapshot>[0],
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.notificationQueue(params),
    queryFn: async () => {
      const response = await adminService.getNotificationQueueSnapshot(params);
      return response.data;
    },
    enabled,
    staleTime: 30 * 1000,
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

export function useAnalyticsDashboard(farmId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.analyticsDashboard(farmId),
    queryFn: async () => {
      const response = farmId
        ? await analyticsService.getFarmDashboard(farmId)
        : await analyticsService.getDashboard();
      return response.data;
    },
    enabled,
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

export function useRecommendationHistoryAnalytics(
  farmId: string,
  params?: { days?: number }
) {
  return useQuery({
    queryKey: [...queryKeys.recommendationHistoryAnalytics(farmId), params],
    queryFn: async () => {
      const response = await analyticsService.getRecommendationHistory(farmId, params);
      return response.data;
    },
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFarmActivityAnalytics(
  farmId: string,
  params?: {
    days?: number;
    limit?: number;
    type?: 'all' | 'recommendation' | 'irrigation' | 'fertilization' | 'pest_control' | 'pest_detection' | 'farm_issue';
  }
) {
  return useQuery({
    queryKey: [...queryKeys.farmActivityAnalytics(farmId), params],
    queryFn: async () => {
      const response = await analyticsService.getFarmActivity(farmId, params);
      return response.data;
    },
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecentActivityAnalytics(
  params?: {
    hours?: number;
    limit?: number;
    type?: 'all' | 'user' | 'farm' | 'recommendation' | 'pest_detection' | 'pest_control' | 'sensor_reading';
  },
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.recentActivityAnalytics(params?.hours, params?.limit, params?.type),
    queryFn: async () => {
      const response = await analyticsService.getRecentActivity(params);
      return response.data;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useExportRecentActivity() {
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: (params?: {
      hours?: number;
      limit?: number;
      type?: 'all' | 'user' | 'farm' | 'recommendation' | 'pest_detection' | 'pest_control' | 'sensor_reading';
      format?: 'csv' | 'json';
    }) => analyticsService.exportRecentActivity(params),
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to export system activity', message: handleApiError(error) });
    },
  });
}

export function useExportFarmActivity() {
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({
      farmId,
      params,
    }: {
      farmId: string;
      params?: {
        days?: number;
        limit?: number;
        type?: 'all' | 'recommendation' | 'irrigation' | 'fertilization' | 'pest_control' | 'pest_detection' | 'farm_issue';
        format?: 'csv' | 'json';
      };
    }) => analyticsService.exportFarmActivity(farmId, params),
    onError: (error) => {
      addNotification({ type: 'error', title: 'Failed to export farm activity', message: handleApiError(error) });
    },
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

export function useAiImageAnalysis() {
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: aiService.analyzeImage,
    onError: (error) => {
      addNotification({ type: 'error', title: 'AI image analysis failed', message: handleApiError(error) });
    },
  });
}

export function useAiTranslate() {
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: aiService.translateText,
    onError: (error) => {
      addNotification({ type: 'error', title: 'Translation failed', message: handleApiError(error) });
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
    queryFn: async () => {
      const health = await aiService.checkHealth();
      return health ?? {
        status: 'unhealthy',
        provider: 'unknown',
        lastChecked: new Date().toISOString(),
        error: 'No health payload returned',
      };
    },
    refetchInterval: 60 * 1000,
  });
}

export function useUssdHealth(enabled = true) {
  return useQuery({
    queryKey: queryKeys.ussdHealth,
    queryFn: async () => {
      const response = await ussdService.getHealth();
      return 'data' in (response as any) ? (response as any).data : response;
    },
    enabled,
    refetchInterval: 60 * 1000,
  });
}

export function useUssdCallback() {
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ussdService.callback,
    onError: (error) => {
      addNotification({ type: 'error', title: 'USSD callback failed', message: handleApiError(error) });
    },
  });
}

export function useUssdCallbackV2() {
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ussdService.callbackV2,
    onError: (error) => {
      addNotification({ type: 'error', title: 'USSD v2 callback failed', message: handleApiError(error) });
    },
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
