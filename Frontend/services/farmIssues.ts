import apiClient from './api';
import { ApiResponse, FarmIssue, PaginatedResponse } from '../types';

const normalizeFarmIssue = (item: any): FarmIssue => ({
  id: String(item?.id || item?._id || ''),
  farmId: String(item?.farmId || item?.farm_id || item?.farm?.id || ''),
  reportedBy: String(item?.reportedBy || item?.reported_by || item?.reporter?.id || ''),
  assignedTo: item?.assignedTo || item?.assigned_to || item?.assignee?.id || undefined,
  title: item?.title || '',
  description: item?.description || '',
  category: item?.category || 'general',
  severity: item?.severity || 'medium',
  status: item?.status || 'open',
  sourceChannel: item?.sourceChannel || item?.source_channel || 'web',
  locationDescription: item?.locationDescription || item?.location_description || undefined,
  expertNotes: item?.expertNotes || item?.expert_notes || undefined,
  resolutionNotes: item?.resolutionNotes || item?.resolution_notes || undefined,
  metadata: item?.metadata || undefined,
  resolvedAt:
    item?.resolvedAt
    || (typeof item?.resolved_at === 'number' ? new Date(item.resolved_at).toISOString() : item?.resolved_at)
    || undefined,
  createdAt:
    item?.createdAt
    || (typeof item?.created_at === 'number' ? new Date(item.created_at).toISOString() : item?.created_at)
    || new Date().toISOString(),
  updatedAt:
    item?.updatedAt
    || (typeof item?.updated_at === 'number' ? new Date(item.updated_at).toISOString() : item?.updated_at)
    || new Date().toISOString(),
  farm: item?.farm ? {
    id: String(item.farm.id || item.farm._id || ''),
    userId: String(item.farm.userId || item.farm.user_id || ''),
    name: item.farm.name || '',
    districtId: item.farm.districtId || item.farm.district_id || item.farm.district?.id || undefined,
    cropVariety: item.farm.cropVariety || item.farm.crop_variety || '',
    isActive: item.farm.isActive ?? item.farm.is_active ?? true,
    createdAt: item.farm.createdAt || item.farm.created_at || new Date().toISOString(),
    updatedAt: item.farm.updatedAt || item.farm.updated_at || new Date().toISOString(),
    district: item.farm.district
      ? {
          id: String(item.farm.district.id || item.farm.district._id || ''),
          name: item.farm.district.name || '',
          province: item.farm.district.province || '',
        }
      : undefined,
  } as any : undefined,
  reporter: item?.reporter ? ({
    id: String(item.reporter.id || item.reporter._id || ''),
    clerkId: String(item.reporter.clerkId || item.reporter.clerk_id || item.reporter.id || item.reporter._id || ''),
    role: item.reporter.role || 'farmer',
    preferredLanguage: item.reporter.preferredLanguage || item.reporter.preferred_language || 'en',
    isActive: item.reporter.isActive ?? item.reporter.is_active ?? true,
    isVerified: item.reporter.isVerified ?? item.reporter.is_verified ?? false,
    firstName: item.reporter.firstName || item.reporter.first_name || undefined,
    lastName: item.reporter.lastName || item.reporter.last_name || undefined,
    createdAt: item.reporter.createdAt || item.reporter.created_at || new Date().toISOString(),
    updatedAt: item.reporter.updatedAt || item.reporter.updated_at || new Date().toISOString(),
  } as any) : undefined,
  assignee: item?.assignee ? ({
    id: String(item.assignee.id || item.assignee._id || ''),
    clerkId: String(item.assignee.clerkId || item.assignee.clerk_id || item.assignee.id || item.assignee._id || ''),
    role: item.assignee.role || 'expert',
    preferredLanguage: item.assignee.preferredLanguage || item.assignee.preferred_language || 'en',
    isActive: item.assignee.isActive ?? item.assignee.is_active ?? true,
    isVerified: item.assignee.isVerified ?? item.assignee.is_verified ?? false,
    firstName: item.assignee.firstName || item.assignee.first_name || undefined,
    lastName: item.assignee.lastName || item.assignee.last_name || undefined,
    createdAt: item.assignee.createdAt || item.assignee.created_at || new Date().toISOString(),
    updatedAt: item.assignee.updatedAt || item.assignee.updated_at || new Date().toISOString(),
  } as any) : undefined,
});

const normalizeList = (response: PaginatedResponse<FarmIssue>): PaginatedResponse<FarmIssue> => ({
  ...response,
  data: Array.isArray(response.data) ? response.data.map(normalizeFarmIssue) : [],
});

export interface FarmIssueQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  severity?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateFarmIssueData {
  title: string;
  description: string;
  category?: string;
  severity?: string;
  locationDescription?: string;
  metadata?: Record<string, any>;
}

export interface UpdateFarmIssueData {
  status?: string;
  severity?: string;
  assignedTo?: string;
  expertNotes?: string;
  resolutionNotes?: string;
  metadata?: Record<string, any>;
}

export const farmIssueService = {
  getByFarm: async (farmId: string, params?: FarmIssueQueryParams): Promise<PaginatedResponse<FarmIssue>> => {
    const response = await apiClient.get<PaginatedResponse<FarmIssue>>(`/farm-issues/farm/${farmId}`, { params });
    return normalizeList(response.data);
  },

  getAll: async (params?: FarmIssueQueryParams & { farmId?: string; reportedBy?: string; sourceChannel?: string }): Promise<PaginatedResponse<FarmIssue>> => {
    const response = await apiClient.get<PaginatedResponse<FarmIssue>>('/farm-issues', { params });
    return normalizeList(response.data);
  },

  getById: async (id: string): Promise<ApiResponse<FarmIssue>> => {
    const response = await apiClient.get<ApiResponse<FarmIssue>>(`/farm-issues/${id}`);
    return { ...response.data, data: normalizeFarmIssue(response.data.data) };
  },

  create: async (farmId: string, data: CreateFarmIssueData): Promise<ApiResponse<FarmIssue>> => {
    const response = await apiClient.post<ApiResponse<FarmIssue>>(`/farm-issues/farm/${farmId}`, data);
    return { ...response.data, data: normalizeFarmIssue(response.data.data) };
  },

  update: async (id: string, data: UpdateFarmIssueData): Promise<ApiResponse<FarmIssue>> => {
    const response = await apiClient.put<ApiResponse<FarmIssue>>(`/farm-issues/${id}`, data);
    return { ...response.data, data: normalizeFarmIssue(response.data.data) };
  },
};
