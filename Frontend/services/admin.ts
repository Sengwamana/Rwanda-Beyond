// =====================================================
// Admin Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { 
  User, 
  Farm, 
  SystemConfig,
  AuditLog,
  Message,
  SystemOverview,
  ApiResponse, 
  PaginatedResponse 
} from '../types';
import { normalizeUser } from './auth';

function normalizeCoordinates(value: any): Farm['coordinates'] | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && typeof value.lat === 'number' && typeof value.lng === 'number') {
    return value;
  }
  if (typeof value === 'object' && typeof value.latitude === 'number' && typeof value.longitude === 'number') {
    return { lat: value.latitude, lng: value.longitude };
  }
  return undefined;
}

function normalizeAdminFarm(farm: any): Farm {
  return {
    id: String(farm?.id || farm?._id || ''),
    userId: String(farm?.userId || farm?.user_id || farm?.user?.id || ''),
    name: farm?.name || '',
    districtId: farm?.districtId || farm?.district_id || farm?.district?.id || undefined,
    locationName: farm?.locationName || farm?.location_name || undefined,
    coordinates: normalizeCoordinates(farm?.coordinates) || normalizeCoordinates(farm),
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
    user: farm?.user ? normalizeUser(farm.user) : undefined,
    district: farm?.district
      ? {
          id: String(farm.district.id || farm.district._id || ''),
          name: farm.district.name,
          province: farm.district.province,
          coordinates: normalizeCoordinates(farm.district.coordinates) || normalizeCoordinates(farm.district),
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
          coordinates: normalizeCoordinates(sensor.coordinates) || normalizeCoordinates(sensor),
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

export interface UserQueryParams {
  page?: number;
  limit?: number;
  role?: string;
  isActive?: boolean;
  status?: 'active' | 'inactive';
  search?: string;
}

export interface AdminUserUpdate {
  role?: 'farmer' | 'expert' | 'admin';
  isActive?: boolean;
  isVerified?: boolean;
  districtId?: string | null;
  metadata?: Record<string, any>;
}

export interface SystemConfigUpdate {
  value: any;
  description?: string;
  isActive?: boolean;
}

export interface SystemConfigItem {
  value: any;
  description?: string;
  updatedAt?: string | number;
  isActive?: boolean;
}

export type SystemConfigMap = Record<string, Record<string, SystemConfigItem>>;

export interface NotificationQueueSnapshot {
  queued: Message[];
  failed: Message[];
  counts: {
    queued: number;
    failed: number;
    queuedByChannel: Record<string, number>;
    failedByChannel: Record<string, number>;
  };
  filters: {
    limit: number;
    maxRetries: number;
  };
}

const normalizeAdminMessage = (item: any): Message => ({
  id: String(item?.id || item?._id || ''),
  userId: String(item?.userId || item?.user_id || ''),
  recommendationId: item?.recommendationId || item?.recommendation_id || undefined,
  channel: item?.channel || 'push',
  recipient: item?.recipient || '',
  subject: item?.subject || undefined,
  content: item?.content || '',
  contentRw: item?.contentRw || item?.content_rw || undefined,
  status: ((item?.readAt || item?.read_at) ? 'read' : (item?.status || 'queued')),
  externalMessageId: item?.externalMessageId || item?.external_message_id || undefined,
  sentAt:
    item?.sentAt
    || (typeof item?.sent_at === 'number' ? new Date(item.sent_at).toISOString() : item?.sent_at)
    || undefined,
  deliveredAt:
    item?.deliveredAt
    || (typeof item?.delivered_at === 'number' ? new Date(item.delivered_at).toISOString() : item?.delivered_at)
    || undefined,
  readAt:
    item?.readAt
    || (typeof item?.read_at === 'number' ? new Date(item.read_at).toISOString() : item?.read_at)
    || undefined,
  failedReason: item?.failedReason || item?.failed_reason || undefined,
  retryCount: item?.retryCount ?? item?.retry_count ?? 0,
  createdAt:
    item?.createdAt
    || (typeof item?.created_at === 'number' ? new Date(item.created_at).toISOString() : item?.created_at)
    || new Date().toISOString(),
});

// Admin service functions
export const adminService = {
  // ===== User Management =====
  
  /**
   * Get all users via the admin route
   */
  getAdminUsers: async (params?: UserQueryParams): Promise<PaginatedResponse<User>> => {
    const requestParams = {
      ...params,
      status:
        params?.status
        || (params?.isActive === true
          ? 'active'
          : params?.isActive === false
            ? 'inactive'
            : undefined),
    };
    delete (requestParams as any).isActive;

    const response = await apiClient.get<PaginatedResponse<User>>('/admin/users', { params: requestParams });
    return {
      ...response.data,
      data: Array.isArray(response.data?.data) ? response.data.data.map(normalizeUser) : [],
    };
  },

  /**
   * Get all users (admin only)
   */
  getUsers: async (params?: UserQueryParams): Promise<PaginatedResponse<User>> => {
    const requestParams = {
      ...params,
      isActive:
        params?.isActive ??
        (params?.status === 'active'
          ? true
          : params?.status === 'inactive'
            ? false
            : undefined),
    };
    delete (requestParams as any).status;
    const response = await apiClient.get<PaginatedResponse<User>>('/users', { params: requestParams });
    return {
      ...response.data,
      data: Array.isArray(response.data?.data) ? response.data.data.map(normalizeUser) : [],
    };
  },

  /**
   * Get a single user by ID
   */
  getUserById: async (id: string): Promise<ApiResponse<User>> => {
    const response = await apiClient.get<ApiResponse<User>>(`/admin/users/${id}`);
    return {
      ...response.data,
      data: normalizeUser(response.data.data),
    };
  },

  /**
   * Update user (admin only)
   */
  updateUser: async (id: string, data: AdminUserUpdate): Promise<ApiResponse<User>> => {
    let latestResponse: ApiResponse<User> | null = null;

    if (data.role) {
      const roleResponse = await apiClient.put<ApiResponse<User>>(`/users/${id}/role`, { role: data.role });
      latestResponse = roleResponse.data;
    }

    if (data.isActive === false) {
      const deactivateResponse = await apiClient.post<ApiResponse<User>>(`/users/${id}/deactivate`, {});
      latestResponse = deactivateResponse.data;
    }

    if (data.isActive === true) {
      const reactivateResponse = await apiClient.post<ApiResponse<User>>(`/users/${id}/reactivate`);
      latestResponse = reactivateResponse.data;
    }

    if (data.metadata || data.districtId !== undefined) {
      const profileResponse = await apiClient.put<ApiResponse<User>>(`/admin/users/${id}/profile`, {
        metadata: data.metadata,
        districtId: data.districtId,
      });
      latestResponse = profileResponse.data;
    }

    if (latestResponse) {
      return {
        ...latestResponse,
        data: normalizeUser(latestResponse.data),
      };
    }

    const userResponse = await apiClient.get<ApiResponse<User>>(`/users/${id}`);
    return {
      ...userResponse.data,
      data: normalizeUser(userResponse.data.data),
    };
  },

  /**
   * Delete user (admin only)
   */
  deleteUser: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    await apiClient.post<ApiResponse<User>>(`/users/${id}/deactivate`, {});
    return {
      success: true,
      message: 'User deactivated successfully',
      data: { message: 'User deactivated successfully' },
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Get user statistics
   */
  getUserStatistics: async (): Promise<ApiResponse<{
    totalUsers: number;
    activeUsers: number;
    byRole: Record<string, number>;
    newUsersThisMonth: number;
    newUsersLastMonth: number;
  }>> => {
    const response = await apiClient.get<ApiResponse<{
      totalUsers: number;
      activeUsers: number;
      byRole: Record<string, number>;
      newUsersThisMonth: number;
      newUsersLastMonth: number;
    }>>('/admin/users/statistics');
    return response.data;
  },

  // ===== Farm Management =====

  /**
   * Get all farms (admin only)
   */
  getAllFarms: async (params?: {
    page?: number;
    limit?: number;
    districtId?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<PaginatedResponse<Farm>> => {
    const response = await apiClient.get<PaginatedResponse<Farm>>('/admin/farms', { params });
    return {
      ...response.data,
      data: Array.isArray(response.data?.data) ? response.data.data.map(normalizeAdminFarm) : [],
    };
  },

  /**
   * Get farm statistics
   */
  getFarmStatistics: async (): Promise<ApiResponse<{
    totalFarms: number;
    activeFarms: number;
    byDistrict: Record<string, number>;
    totalAreaHectares: number;
    avgSizeHectares: number;
  }>> => {
    const response = await apiClient.get<ApiResponse<{
      totalFarms: number;
      activeFarms: number;
      byDistrict: Record<string, number>;
      totalAreaHectares: number;
      avgSizeHectares: number;
    }>>('/admin/farms/statistics');
    return response.data;
  },

  // ===== System Overview =====

  /**
   * Get system overview dashboard
   */
  getSystemOverview: async (): Promise<ApiResponse<SystemOverview>> => {
    const response = await apiClient.get<ApiResponse<SystemOverview>>('/admin/overview');
    return response.data;
  },

  /**
   * Get sensor health statistics
   */
  getSensorHealth: async (): Promise<ApiResponse<{
    totalSensors: number;
    activeSensors: number;
    faultySensors: number;
    maintenanceRequired: number;
    byType: Record<string, { total: number; active: number }>;
    avgBatteryLevel: number;
  }>> => {
    const response = await apiClient.get<ApiResponse<{
      totalSensors: number;
      activeSensors: number;
      faultySensors: number;
      maintenanceRequired: number;
      byType: Record<string, { total: number; active: number }>;
      avgBatteryLevel: number;
    }>>('/admin/sensors/health');
    return response.data;
  },

  // ===== System Configuration =====

  /**
   * Get all system configurations
   */
  getConfigs: async (): Promise<ApiResponse<SystemConfigMap>> => {
    const response = await apiClient.get<ApiResponse<SystemConfigMap>>('/admin/config');
    return response.data;
  },

  /**
   * Update a system configuration
   */
  updateConfig: async (key: string, data: SystemConfigUpdate): Promise<ApiResponse<SystemConfig>> => {
    const response = await apiClient.put<ApiResponse<SystemConfig>>(`/admin/config/${encodeURIComponent(key)}`, data);
    return response.data;
  },

  // ===== Audit Logs =====

  /**
   * Get audit logs
   */
  getAuditLogs: async (params?: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<AuditLog>> => {
    const response = await apiClient.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', { params });
    return response.data;
  },

  // ===== Analytics =====

  /**
   * Get system analytics
   */
  getAnalytics: async (params?: {
    period?: '7d' | '30d' | '90d';
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{
    period?: string;
    since?: string;
    metrics?: {
      sensorReadings?: number;
      recommendationsGenerated?: number;
      messagesSent?: number;
      errors?: number;
    };
    apiCalls?: Array<{ date: string; count: number }>;
    activeUsers?: Array<{ date: string; count: number }>;
    sensorReadings?: Array<{ date: string; count: number }>;
    recommendations?: Array<{ date: string; count: number }>;
    pestDetections?: Array<{ date: string; count: number }>;
  }>> => {
    const response = await apiClient.get<ApiResponse<{
      period?: string;
      since?: string;
      metrics?: {
        sensorReadings?: number;
        recommendationsGenerated?: number;
        messagesSent?: number;
        errors?: number;
      };
      apiCalls?: Array<{ date: string; count: number }>;
      activeUsers?: Array<{ date: string; count: number }>;
      sensorReadings?: Array<{ date: string; count: number }>;
      recommendations?: Array<{ date: string; count: number }>;
      pestDetections?: Array<{ date: string; count: number }>;
    }>>('/admin/analytics', { params });
    return response.data;
  },

  /**
   * Get alert statistics
   */
  getAlertStatistics: async (params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{
    totalAlerts: number;
    criticalAlerts: number;
    resolvedAlerts: number;
    avgResolutionTime: number;
    byType: Record<string, number>;
    byDistrict: Record<string, number>;
  }>> => {
    const response = await apiClient.get<ApiResponse<{
      totalAlerts: number;
      criticalAlerts: number;
      resolvedAlerts: number;
      avgResolutionTime: number;
      byType: Record<string, number>;
      byDistrict: Record<string, number>;
    }>>('/admin/alerts/statistics', { params });
    return response.data;
  },

  // ===== Reports =====

  /**
   * Generate system report
   */
  generateReport: async (params: {
    type: 'summary' | 'farms' | 'users' | 'sensors' | 'recommendations' | 'farm-issues' | 'pest-detections' | 'pest-control';
    format: 'json' | 'csv';
    startDate?: string;
    endDate?: string;
    filters?: Record<string, any>;
  }): Promise<Blob | any> => {
    const isCsv = params.format === 'csv';
    const response = await apiClient.post('/admin/reports/generate', params, {
      responseType: isCsv ? 'blob' : 'json',
    });
    return response.data;
  },

  // =====================================================
  // ADDITIONAL ENDPOINTS (Backend Compatibility)
  // =====================================================

  // ===== User Management (Backend Routes) =====

  /**
   * Update user role (correct backend route)
   */
  updateUserRole: async (userId: string, role: 'farmer' | 'expert' | 'admin'): Promise<ApiResponse<User>> => {
    const response = await apiClient.put<ApiResponse<User>>(
      `/users/${userId}/role`,
      { role }
    );
    return response.data;
  },

  /**
   * Deactivate user account
   */
  deactivateUser: async (userId: string): Promise<ApiResponse<User>> => {
    const response = await apiClient.post<ApiResponse<User>>(
      `/users/${userId}/deactivate`
    );
    return response.data;
  },

  /**
   * Reactivate user account
   */
  reactivateUser: async (userId: string): Promise<ApiResponse<User>> => {
    const response = await apiClient.post<ApiResponse<User>>(
      `/users/${userId}/reactivate`
    );
    return response.data;
  },

  /**
   * Get all users (correct backend route via /users)
   */
  getAllUsers: async (params?: UserQueryParams): Promise<PaginatedResponse<User>> => {
    const response = await apiClient.get<PaginatedResponse<User>>('/users', { params });
    return response.data;
  },

  /**
   * Get user stats (correct backend route via /users/stats)
   */
  getUserStats: async (): Promise<ApiResponse<{
    total: number;
    byRole: Record<string, number>;
    active: number;
    inactive: number;
    newThisMonth: number;
  }>> => {
    const response = await apiClient.get<ApiResponse<any>>('/users/stats');
    return response.data;
  },

  // ===== IoT Device Management =====

  /**
   * Get all IoT devices
   */
  getDevices: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    farmId?: string;
  }): Promise<PaginatedResponse<{
    id: string;
    deviceId: string;
    farmId: string;
    farmName: string;
    status: 'active' | 'inactive' | 'revoked';
    lastSeen: string | null;
    createdAt: string;
  }>> => {
    const response = await apiClient.get<PaginatedResponse<any>>('/admin/devices', { params });
    return response.data;
  },

  /**
   * Generate new device token
   */
  generateDeviceToken: async (data: {
    farmId: string;
    deviceName: string;
    deviceType?: string;
  }): Promise<ApiResponse<{
    deviceId: string;
    token: string;
    expiresAt: string;
  }>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      '/admin/devices/token',
      data
    );
    return response.data;
  },

  /**
   * Revoke device token
   */
  revokeDeviceToken: async (deviceId: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>(
      `/admin/devices/${deviceId}/revoke`
    );
    return response.data;
  },

  // ===== System Health & Monitoring =====

  /**
   * Get system health status
   */
  getSystemHealth: async (): Promise<ApiResponse<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp?: string;
    checks?: Record<string, any>;
  }>> => {
    const response = await apiClient.get<ApiResponse<any>>('/admin/health');
    return response.data;
  },

  /**
   * Get system metrics
   */
  getSystemMetrics: async (params?: {
    period?: '1h' | '6h' | '24h' | '7d';
  }): Promise<ApiResponse<{
    period?: string;
    since?: string;
    metrics?: {
      sensorReadings?: number;
      recommendationsGenerated?: number;
      messagesSent?: number;
      errors?: number;
    };
  }>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      '/admin/metrics',
      { params }
    );
    return response.data;
  },

  // ===== Communication =====

  /**
   * Send broadcast message to users
   */
  sendBroadcast: async (data: {
    message: string;
    messageKinyarwanda?: string;
    channel: 'sms' | 'push' | 'email' | 'all';
    targetRole?: 'farmer' | 'expert' | 'admin' | 'all';
    targetDistrict?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
  }): Promise<ApiResponse<{
    queued: number;
    targetedUsers: number;
  }>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      '/admin/broadcast',
      data
    );
    return response.data;
  },

  processNotificationQueue: async (): Promise<ApiResponse<{
    processed: number;
    sent: number;
    failed: number;
    retried: number;
  }>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      '/admin/notifications/process',
      {}
    );
    return response.data;
  },

  getNotificationQueueSnapshot: async (params?: {
    limit?: number;
    maxRetries?: number;
  }): Promise<ApiResponse<NotificationQueueSnapshot>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      '/admin/notifications/queue',
      { params }
    );

    return {
      ...response.data,
      data: {
        queued: Array.isArray(response.data?.data?.queued)
          ? response.data.data.queued.map(normalizeAdminMessage)
          : [],
        failed: Array.isArray(response.data?.data?.failed)
          ? response.data.data.failed.map(normalizeAdminMessage)
          : [],
        counts: {
          queued: response.data?.data?.counts?.queued ?? 0,
          failed: response.data?.data?.counts?.failed ?? 0,
          queuedByChannel: response.data?.data?.counts?.queuedByChannel || {},
          failedByChannel: response.data?.data?.counts?.failedByChannel || {},
        },
        filters: {
          limit: response.data?.data?.filters?.limit ?? (params?.limit ?? 8),
          maxRetries: response.data?.data?.filters?.maxRetries ?? (params?.maxRetries ?? 3),
        },
      },
    };
  },
};

export default adminService;
