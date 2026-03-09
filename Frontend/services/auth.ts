// =====================================================
// Authentication Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { User, ApiResponse, UserRole } from '../types';

export interface RegisterData {
  email?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  role?: 'farmer' | 'expert' | 'admin';
  preferredLanguage?: 'en' | 'rw' | 'fr';
}

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  preferredLanguage?: 'en' | 'rw' | 'fr';
  profileImageUrl?: string;
  metadata?: Record<string, any>;
}

const PREFERRED_ROLE_KEY = 'preferred-role';

function isValidRole(role: string | null): role is UserRole {
  return role === 'farmer' || role === 'expert' || role === 'admin';
}

function normalizeLanguage(language: unknown): User['preferredLanguage'] {
  return language === 'rw' || language === 'fr' || language === 'en' ? language : 'en';
}

export function normalizeUser(user: any): User {
  const metadata = user?.metadata && typeof user.metadata === 'object' ? user.metadata : {};
  const verifiedFromMetadata =
    typeof metadata.is_verified === 'boolean' ? metadata.is_verified : undefined;

  return {
    id: String(user?.id || user?._id || user?.clerkId || user?.clerk_id || ''),
    clerkId: String(user?.clerkId || user?.clerk_id || user?.id || user?._id || ''),
    email: user?.email || undefined,
    phoneNumber: user?.phoneNumber || user?.phone_number || undefined,
    firstName: user?.firstName || user?.first_name || undefined,
    lastName: user?.lastName || user?.last_name || undefined,
    role: isValidRole(user?.role ?? null) ? user.role : 'farmer',
    preferredLanguage: normalizeLanguage(user?.preferredLanguage || user?.preferred_language),
    profileImageUrl: user?.profileImageUrl || user?.profile_image_url || undefined,
    isActive:
      typeof user?.isActive === 'boolean'
        ? user.isActive
        : typeof user?.is_active === 'boolean'
          ? user.is_active
          : true,
    isVerified:
      typeof user?.isVerified === 'boolean'
        ? user.isVerified
        : typeof user?.is_verified === 'boolean'
          ? user.is_verified
          : typeof verifiedFromMetadata === 'boolean'
            ? verifiedFromMetadata
            : false,
    lastLoginAt: user?.lastLoginAt || user?.last_login_at || undefined,
    metadata,
    createdAt: user?.createdAt || user?.created_at || new Date().toISOString(),
    updatedAt: user?.updatedAt || user?.updated_at || new Date().toISOString(),
  };
}

function normalizeApiResponse<T>(response: ApiResponse<T>): ApiResponse<any> {
  if (!response?.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
    return response;
  }

  return {
    ...response,
    data: normalizeUser(response.data),
  };
}

// Auth service functions
export const authService = {
  /**
   * Get or create user profile - backend auto-creates user on first /users/me call
   * when authenticated via Clerk. No explicit register endpoint needed.
   */
  register: async (data: RegisterData): Promise<ApiResponse<User>> => {
    // First sync with backend (creates user if not exists)
    const user = await authService.getProfile();
    // Then update profile with additional data if provided
    if (data.firstName || data.lastName || data.phoneNumber || data.preferredLanguage) {
      return authService.updateProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        preferredLanguage: data.preferredLanguage,
      });
    }
    return user;
  },

  /**
   * Get the current authenticated user's profile
   */
  getProfile: async (): Promise<ApiResponse<User>> => {
    const response = await apiClient.get<ApiResponse<User>>('/users/me');
    return normalizeApiResponse(response.data);
  },

  /**
   * Update the current user's profile
   */
  updateProfile: async (data: UserProfile): Promise<ApiResponse<User>> => {
    const response = await apiClient.put<ApiResponse<User>>('/users/me', data);
    return normalizeApiResponse(response.data);
  },

  /**
   * Sync Clerk user with backend database (uses /users/me which auto-creates user)
   */
  syncUser: async (): Promise<ApiResponse<User>> => {
    const response = await apiClient.get<ApiResponse<User>>('/users/me');
    return normalizeApiResponse(response.data);
  },

  /**
   * Update user's notification preferences
   * Note: Currently stored in user profile, update via /users/me
   */
  updateNotificationPreferences: async (preferences: {
    smsEnabled?: boolean;
    emailEnabled?: boolean;
    pushEnabled?: boolean;
    alertThreshold?: 'all' | 'high' | 'critical';
  }): Promise<ApiResponse<User>> => {
    const response = await apiClient.put<ApiResponse<User>>('/users/me', { 
      notificationPreferences: preferences 
    });
    return normalizeApiResponse(response.data);
  },

  /**
   * Delete user account
   * Note: Uses admin deactivate endpoint for self if needed
   */
  deleteAccount: async (): Promise<ApiResponse<{ message: string }>> => {
    // For now, this would need to be done through admin
    // or we can add a dedicated endpoint on backend
    throw new Error('Account deletion must be requested through support');
  },

  /**
   * Store preferred role during auth flows (used before backend profile exists)
   */
  setPreferredRole: (role: UserRole): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(PREFERRED_ROLE_KEY, role);
  },

  /**
   * Get preferred role selected on the auth screen, if available
   */
  getPreferredRole: (): UserRole | null => {
    if (typeof window === 'undefined') return null;
    const role = sessionStorage.getItem(PREFERRED_ROLE_KEY);
    return isValidRole(role) ? role : null;
  },

  /**
   * Clear temporary auth role preference
   */
  clearPreferredRole: (): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(PREFERRED_ROLE_KEY);
  },
};

export default authService;
