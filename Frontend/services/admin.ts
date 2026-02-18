// =====================================================
// Admin Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { 
  User, 
  Farm, 
  SystemConfig,
  AuditLog,
  SystemOverview,
  ApiResponse, 
  PaginatedResponse 
} from '../types';

export interface UserQueryParams {
  page?: number;
  limit?: number;
  role?: string;
  isActive?: boolean;
  search?: string;
}

export interface AdminUserUpdate {
  role?: 'farmer' | 'expert' | 'admin';
  isActive?: boolean;
  isVerified?: boolean;
}

export interface SystemConfigUpdate {
  value: any;
  description?: string;
  isActive?: boolean;
}

// Admin service functions
export const adminService = {
  // ===== User Management =====
  
  /**
   * Get all users (admin only)
   */
  getUsers: async (params?: UserQueryParams): Promise<PaginatedResponse<User>> => {
    const response = await apiClient.get<PaginatedResponse<User>>('/admin/users', { params });
    return response.data;
  },

  /**
   * Get a single user by ID
   */
  getUserById: async (id: string): Promise<ApiResponse<User>> => {
    const response = await apiClient.get<ApiResponse<User>>(`/admin/users/${id}`);
    return response.data;
  },

  /**
   * Update user (admin only)
   */
  updateUser: async (id: string, data: AdminUserUpdate): Promise<ApiResponse<User>> => {
    const response = await apiClient.put<ApiResponse<User>>(`/admin/users/${id}`, data);
    return response.data;
  },

  /**
   * Delete user (admin only)
   */
  deleteUser: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/admin/users/${id}`);
    return response.data;
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
    return response.data;
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
  getConfigs: async (): Promise<ApiResponse<SystemConfig[]>> => {
    const response = await apiClient.get<ApiResponse<SystemConfig[]>>('/admin/config');
    return response.data;
  },

  /**
   * Update a system configuration
   */
  updateConfig: async (key: string, data: SystemConfigUpdate): Promise<ApiResponse<SystemConfig>> => {
    const response = await apiClient.put<ApiResponse<SystemConfig>>(`/admin/config/${key}`, data);
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
    period?: 'day' | 'week' | 'month' | 'year';
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{
    apiCalls: Array<{ date: string; count: number }>;
    activeUsers: Array<{ date: string; count: number }>;
    sensorReadings: Array<{ date: string; count: number }>;
    recommendations: Array<{ date: string; count: number }>;
    pestDetections: Array<{ date: string; count: number }>;
  }>> => {
    const response = await apiClient.get<ApiResponse<{
      apiCalls: Array<{ date: string; count: number }>;
      activeUsers: Array<{ date: string; count: number }>;
      sensorReadings: Array<{ date: string; count: number }>;
      recommendations: Array<{ date: string; count: number }>;
      pestDetections: Array<{ date: string; count: number }>;
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
    type: 'farms' | 'users' | 'sensors' | 'recommendations' | 'pest-detections';
    format: 'json' | 'csv';
    startDate?: string;
    endDate?: string;
    filters?: Record<string, any>;
  }): Promise<Blob> => {
    const response = await apiClient.post('/admin/reports/generate', params, {
      responseType: 'blob',
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
    services: {
      database: { status: string; latency: number };
      redis: { status: string; latency: number };
      weatherApi: { status: string; latency: number };
      aiService: { status: string; latency: number };
      smsGateway: { status: string; latency: number };
    };
    uptime: number;
    lastCheck: string;
  }>> => {
    const response = await apiClient.get<ApiResponse<any>>('/admin/health');
    return response.data;
  },

  /**
   * Get system metrics
   */
  getSystemMetrics: async (params?: {
    period?: 'hour' | 'day' | 'week';
  }): Promise<ApiResponse<{
    cpu: Array<{ timestamp: string; value: number }>;
    memory: Array<{ timestamp: string; value: number }>;
    activeConnections: Array<{ timestamp: string; value: number }>;
    requestsPerMinute: Array<{ timestamp: string; value: number }>;
    errorRate: Array<{ timestamp: string; value: number }>;
    avgResponseTime: Array<{ timestamp: string; value: number }>;
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
    channel: 'sms' | 'push' | 'email' | 'all';
    targetRole?: 'farmer' | 'expert' | 'admin' | 'all';
    targetDistrict?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
  }): Promise<ApiResponse<{
    sent: number;
    failed: number;
    queued: number;
  }>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      '/admin/broadcast',
      data
    );
    return response.data;
  },
};

export default adminService;
