// =====================================================
// API Client Configuration - Smart Maize Farming System
// =====================================================

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// API Base URL - configurable via environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// Create axios instance with default configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;
let tokenRefresher: TokenGetter | null = null;

export const configureApiAuth = (
  getToken: TokenGetter,
  refreshToken?: TokenGetter
): void => {
  tokenGetter = getToken;
  tokenRefresher = refreshToken || getToken;
};

const getLiveToken = async (): Promise<string | null> => {
  if (tokenGetter) {
    try {
      return await tokenGetter();
    } catch {
      return null;
    }
  }
  return localStorage.getItem('clerk-token');
};

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getLiveToken();
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    const requestWithRetry = originalRequest as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    
    // Handle 401 Unauthorized - attempt one silent token refresh and retry once.
    if (error.response?.status === 401 && requestWithRetry && !requestWithRetry._retry) {
      requestWithRetry._retry = true;
      if (tokenRefresher) {
        try {
          const refreshed = await tokenRefresher();
          if (refreshed) {
            setAuthToken(refreshed);
            requestWithRetry.headers = requestWithRetry.headers || {};
            requestWithRetry.headers.Authorization = `Bearer ${refreshed}`;
            return apiClient(requestWithRetry);
          }
        } catch {
          // Fall through to surface original error.
        }
      }
    }
    
    // Handle 403 Forbidden - insufficient permissions
    if (error.response?.status === 403) {
      console.error('Access denied. Insufficient permissions.');
    }
    
    // Handle 429 Rate Limited
    if (error.response?.status === 429) {
      console.error('Rate limit exceeded. Please try again later.');
    }
    
    // Handle 500+ Server Errors
    if (error.response?.status && error.response.status >= 500) {
      if (error.response.status === 503) {
        console.error('Backend database service unavailable.');
      } else {
        console.error('Server error. Please try again later.');
      }
    }
    
    return Promise.reject(error);
  }
);

// Helper function to set auth token
export const setAuthToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem('clerk-token', token);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('clerk-token');
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

// Helper function to handle API errors
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; errors?: Array<{ message: string }> }>;
    
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    
    if (axiosError.response?.data?.errors?.length) {
      return axiosError.response.data.errors.map(e => e.message).join(', ');
    }
    
    switch (axiosError.response?.status) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Authentication required. Please log in.';
      case 403:
        return 'Access denied. You do not have permission.';
      case 404:
        return 'Resource not found.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 503:
        return 'Backend database service is unavailable. Start Convex or point the backend to a live Convex deployment.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return axiosError.message || 'An unexpected error occurred.';
    }
  }
  
  return 'An unexpected error occurred.';
};

export default apiClient;
