// =====================================================
// React Query Configuration
// Smart Maize Farming System - Caching Strategies
// =====================================================

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React from 'react';
import env from '../config/env';

// =====================================================
// Query Key Factories
// =====================================================

export const queryKeys = {
  // User queries
  users: {
    all: ['users'] as const,
    detail: (id: string) => ['users', id] as const,
    profile: () => ['users', 'profile'] as const,
    preferences: () => ['users', 'preferences'] as const,
  },

  // Farm queries
  farms: {
    all: () => ['farms'] as const,
    list: (filters?: Record<string, unknown>) => ['farms', 'list', filters] as const,
    detail: (id: string) => ['farms', 'detail', id] as const,
    stats: (id: string) => ['farms', 'stats', id] as const,
    analytics: (id: string, range?: string) => ['farms', 'analytics', id, range] as const,
  },

  // Sensor queries
  sensors: {
    all: (farmId?: string) => ['sensors', farmId] as const,
    detail: (id: string) => ['sensors', 'detail', id] as const,
    readings: (sensorId: string, range?: string) => ['sensors', 'readings', sensorId, range] as const,
    latestReadings: (farmId: string) => ['sensors', 'latest', farmId] as const,
    history: (sensorId: string, start: Date, end: Date) =>
      ['sensors', 'history', sensorId, start.toISOString(), end.toISOString()] as const,
  },

  // Weather queries
  weather: {
    current: (farmId: string) => ['weather', 'current', farmId] as const,
    forecast: (farmId: string, days?: number) => ['weather', 'forecast', farmId, days] as const,
    historical: (farmId: string, range: string) => ['weather', 'historical', farmId, range] as const,
    alerts: (farmId: string) => ['weather', 'alerts', farmId] as const,
  },

  // Recommendations
  recommendations: {
    all: (farmId?: string) => ['recommendations', farmId] as const,
    active: (farmId: string) => ['recommendations', 'active', farmId] as const,
    history: (farmId: string) => ['recommendations', 'history', farmId] as const,
    detail: (id: string) => ['recommendations', 'detail', id] as const,
  },

  // Pest detection
  pests: {
    scans: (farmId?: string) => ['pests', 'scans', farmId] as const,
    detail: (id: string) => ['pests', 'detail', id] as const,
    history: (farmId: string) => ['pests', 'history', farmId] as const,
  },

  // Alerts
  alerts: {
    all: (farmId?: string) => ['alerts', farmId] as const,
    unread: (farmId?: string) => ['alerts', 'unread', farmId] as const,
    detail: (id: string) => ['alerts', 'detail', id] as const,
  },

  // Analytics
  analytics: {
    dashboard: (farmId?: string) => ['analytics', 'dashboard', farmId] as const,
    yields: (farmId: string, range?: string) => ['analytics', 'yields', farmId, range] as const,
    costs: (farmId: string, range?: string) => ['analytics', 'costs', farmId, range] as const,
    comparison: (farmIds: string[]) => ['analytics', 'comparison', farmIds] as const,
  },
} as const;

// =====================================================
// Stale Time Configuration (in milliseconds)
// =====================================================

export const staleTimes = {
  // Real-time data - short cache
  sensors: env.sensorCacheTTL * 1000, // Default 30 seconds
  alerts: 10 * 1000, // 10 seconds

  // Moderate data - medium cache
  weather: env.weatherCacheTTL * 1000, // Default 5 minutes
  farms: env.farmCacheTTL * 1000, // Default 1 minute
  recommendations: 2 * 60 * 1000, // 2 minutes

  // Static data - long cache
  user: 5 * 60 * 1000, // 5 minutes
  analytics: 10 * 60 * 1000, // 10 minutes
  historical: 30 * 60 * 1000, // 30 minutes
};

// =====================================================
// Query Client Configuration
// =====================================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default stale time
      staleTime: 30 * 1000, // 30 seconds

      // Cache time (how long to keep in cache after becoming unused)
      gcTime: 5 * 60 * 1000, // 5 minutes

      // Retry configuration
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch configuration
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,

      // Network mode
      networkMode: env.enableOfflineMode ? 'offlineFirst' : 'online',
    },

    mutations: {
      // Retry configuration for mutations
      retry: 1,
      retryDelay: 1000,

      // Network mode
      networkMode: env.enableOfflineMode ? 'offlineFirst' : 'online',
    },
  },
});

// =====================================================
// Query Client Provider Component
// =====================================================

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {env.isDevelopment && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

// =====================================================
// Cache Invalidation Helpers
// =====================================================

export const invalidateQueries = {
  // Invalidate all farm-related queries
  farms: () => {
    queryClient.invalidateQueries({ queryKey: ['farms'] });
  },

  // Invalidate specific farm
  farm: (farmId: string) => {
    queryClient.invalidateQueries({ queryKey: ['farms', 'detail', farmId] });
    queryClient.invalidateQueries({ queryKey: ['sensors', farmId] });
    queryClient.invalidateQueries({ queryKey: ['weather', 'current', farmId] });
    queryClient.invalidateQueries({ queryKey: ['recommendations', farmId] });
    queryClient.invalidateQueries({ queryKey: ['alerts', farmId] });
  },

  // Invalidate sensor data for a farm
  sensorData: (farmId: string) => {
    queryClient.invalidateQueries({ queryKey: ['sensors', farmId] });
    queryClient.invalidateQueries({ queryKey: ['sensors', 'latest', farmId] });
  },

  // Invalidate weather data
  weather: (farmId: string) => {
    queryClient.invalidateQueries({ queryKey: ['weather', 'current', farmId] });
    queryClient.invalidateQueries({ queryKey: ['weather', 'forecast', farmId] });
  },

  // Invalidate recommendations
  recommendations: (farmId?: string) => {
    if (farmId) {
      queryClient.invalidateQueries({ queryKey: ['recommendations', farmId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    }
  },

  // Invalidate alerts
  alerts: (farmId?: string) => {
    if (farmId) {
      queryClient.invalidateQueries({ queryKey: ['alerts', farmId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  },

  // Invalidate user data
  user: () => {
    queryClient.invalidateQueries({ queryKey: ['users', 'profile'] });
    queryClient.invalidateQueries({ queryKey: ['users', 'preferences'] });
  },

  // Invalidate everything
  all: () => {
    queryClient.invalidateQueries();
  },
};

// =====================================================
// Prefetch Helpers
// =====================================================

export const prefetchQueries = {
  // Prefetch farm dashboard data
  farmDashboard: async (farmId: string, fetchFunctions: {
    fetchFarm: () => Promise<any>;
    fetchSensors: () => Promise<any>;
    fetchWeather: () => Promise<any>;
    fetchRecommendations: () => Promise<any>;
  }) => {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.farms.detail(farmId),
        queryFn: fetchFunctions.fetchFarm,
        staleTime: staleTimes.farms,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.sensors.latestReadings(farmId),
        queryFn: fetchFunctions.fetchSensors,
        staleTime: staleTimes.sensors,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.weather.current(farmId),
        queryFn: fetchFunctions.fetchWeather,
        staleTime: staleTimes.weather,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.recommendations.active(farmId),
        queryFn: fetchFunctions.fetchRecommendations,
        staleTime: staleTimes.recommendations,
      }),
    ]);
  },
};

export default queryClient;
