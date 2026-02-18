// =====================================================
// Authentication Service - Smart Maize Farming System
// =====================================================

import apiClient from './api';
import { User, ApiResponse } from '../types';

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
    return response.data;
  },

  /**
   * Update the current user's profile
   */
  updateProfile: async (data: UserProfile): Promise<ApiResponse<User>> => {
    const response = await apiClient.put<ApiResponse<User>>('/users/me', data);
    return response.data;
  },

  /**
   * Sync Clerk user with backend database (uses /users/me which auto-creates user)
   */
  syncUser: async (): Promise<ApiResponse<User>> => {
    const response = await apiClient.get<ApiResponse<User>>('/users/me');
    return response.data;
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
    return response.data;
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
};

export default authService;
