import apiClient from './api';
import { ApiResponse, PaginatedResponse, User } from '../types';
import { normalizeUser } from './auth';

export interface UsersQueryParams {
  page?: number;
  limit?: number;
  role?: string;
  isActive?: boolean;
  search?: string;
}

export const usersService = {
  list: async (params?: UsersQueryParams): Promise<PaginatedResponse<User>> => {
    const response = await apiClient.get<PaginatedResponse<User>>('/users', { params });
    return {
      ...response.data,
      data: Array.isArray(response.data?.data) ? response.data.data.map(normalizeUser) : [],
    };
  },

  getMe: async (): Promise<ApiResponse<User>> => {
    const response = await apiClient.get<ApiResponse<User>>('/users/me');
    return {
      ...response.data,
      data: normalizeUser(response.data.data),
    };
  },

  updateMe: async (data: Partial<User>): Promise<ApiResponse<User>> => {
    const response = await apiClient.put<ApiResponse<User>>('/users/me', data);
    return {
      ...response.data,
      data: normalizeUser(response.data.data),
    };
  },

  getStats: async (): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>('/users/stats');
    return response.data;
  },

  getById: async (userId: string): Promise<ApiResponse<User>> => {
    const response = await apiClient.get<ApiResponse<User>>(`/users/${userId}`);
    return {
      ...response.data,
      data: normalizeUser(response.data.data),
    };
  },

  updateRole: async (userId: string, role: 'farmer' | 'expert' | 'admin'): Promise<ApiResponse<User>> => {
    const response = await apiClient.put<ApiResponse<User>>(`/users/${userId}/role`, { role });
    return {
      ...response.data,
      data: normalizeUser(response.data.data),
    };
  },

  deactivate: async (userId: string): Promise<ApiResponse<User>> => {
    const response = await apiClient.post<ApiResponse<User>>(`/users/${userId}/deactivate`);
    return {
      ...response.data,
      data: normalizeUser(response.data.data),
    };
  },

  reactivate: async (userId: string): Promise<ApiResponse<User>> => {
    const response = await apiClient.post<ApiResponse<User>>(`/users/${userId}/reactivate`);
    return {
      ...response.data,
      data: normalizeUser(response.data.data),
    };
  },
};

export default usersService;
