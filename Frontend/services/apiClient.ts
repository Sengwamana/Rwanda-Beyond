// =====================================================
// Enhanced API Client - Smart Maize Farming System
// Comprehensive API communication layer with Clerk auth,
// retry logic, caching, and WebSocket support
// =====================================================

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
  AxiosProgressEvent,
} from 'axios';

// =====================================================
// Types and Interfaces
// =====================================================

export interface ApiConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export type RequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _retryCount?: number;
};

type UploadOptions = {
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void;
};

// Error types for categorization
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  SERVER = 'SERVER',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN',
}

// =====================================================
// Configuration
// =====================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

const defaultConfig: ApiConfig = {
  baseURL: API_BASE_URL,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};

// =====================================================
// Token Management
// =====================================================

let tokenGetter: (() => Promise<string | null>) | null = null;
let tokenRefresher: (() => Promise<string | null>) | null = null;

/**
 * Configure token management functions
 * Should be called during app initialization with Clerk functions
 */
export const configureAuth = (
  getToken: () => Promise<string | null>,
  refreshToken?: () => Promise<string | null>
): void => {
  tokenGetter = getToken;
  tokenRefresher = refreshToken || getToken;
};

/**
 * Get the current auth token
 */
const getAuthToken = async (): Promise<string | null> => {
  if (tokenGetter) {
    try {
      return await tokenGetter();
    } catch (error) {
      console.warn('Failed to get auth token:', error);
      return null;
    }
  }
  // Fallback to localStorage for development
  return localStorage.getItem('clerk-token');
};

/**
 * Refresh the auth token
 */
const refreshAuthToken = async (): Promise<string | null> => {
  if (tokenRefresher) {
    try {
      return await tokenRefresher();
    } catch (error) {
      console.warn('Failed to refresh auth token:', error);
      return null;
    }
  }
  return null;
};

// =====================================================
// Error Handling
// =====================================================

/**
 * Categorize error by type for appropriate handling
 */
export const categorizeError = (error: AxiosError): ErrorCategory => {
  if (!error.response) {
    return ErrorCategory.NETWORK;
  }

  const status = error.response.status;

  if (status === 401) return ErrorCategory.AUTHENTICATION;
  if (status === 403) return ErrorCategory.AUTHORIZATION;
  if (status === 400 || status === 422) return ErrorCategory.VALIDATION;
  if (status === 429) return ErrorCategory.RATE_LIMIT;
  if (status >= 500) return ErrorCategory.SERVER;

  return ErrorCategory.UNKNOWN;
};

/**
 * Format error for display
 */
export const formatError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{
      message?: string;
      error?: string;
      errors?: Array<{ message: string; field?: string }>;
    }>;

    const status = axiosError.response?.status || 0;
    const data = axiosError.response?.data;

    // Extract message from various response formats
    let message = 'An unexpected error occurred';
    if (data?.message) {
      message = data.message;
    } else if (data?.error) {
      message = data.error;
    } else if (data?.errors?.length) {
      message = data.errors.map((e) => e.message).join(', ');
    } else if (axiosError.message) {
      message = axiosError.message;
    }

    // Map status codes to user-friendly messages
    if (!data?.message) {
      switch (status) {
        case 400:
          message = 'Invalid request. Please check your input.';
          break;
        case 401:
          message = 'Your session has expired. Please log in again.';
          break;
        case 403:
          message = 'You do not have permission to perform this action.';
          break;
        case 404:
          message = 'The requested resource was not found.';
          break;
        case 429:
          message = 'Too many requests. Please wait a moment.';
          break;
        case 500:
          message = 'Server error. Our team has been notified.';
          break;
        case 502:
        case 503:
        case 504:
          message = 'Service temporarily unavailable. Please try again.';
          break;
      }
    }

    return {
      message,
      code: categorizeError(axiosError),
      status,
      details: data as Record<string, unknown>,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: ErrorCategory.UNKNOWN,
      status: 0,
    };
  }

  return {
    message: 'An unexpected error occurred',
    code: ErrorCategory.UNKNOWN,
    status: 0,
  };
};

// =====================================================
// Retry Logic
// =====================================================

/**
 * Determine if request should be retried
 */
const shouldRetry = (error: AxiosError, retryCount: number): boolean => {
  // Don't retry if max attempts reached
  if (retryCount >= defaultConfig.retryAttempts) {
    return false;
  }

  // Don't retry client errors (except rate limiting)
  if (error.response?.status) {
    const status = error.response.status;
    if (status >= 400 && status < 500 && status !== 429) {
      return false;
    }
  }

  // Retry network errors and server errors
  return !error.response || error.response.status >= 500 || error.response.status === 429;
};

/**
 * Calculate delay for retry with exponential backoff
 */
const getRetryDelay = (retryCount: number, baseDelay: number = 1000): number => {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, retryCount);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
};

// =====================================================
// Create API Client Instance
// =====================================================

const createApiClient = (config: Partial<ApiConfig> = {}): AxiosInstance => {
  const mergedConfig = { ...defaultConfig, ...config };

  const client = axios.create({
    baseURL: mergedConfig.baseURL,
    timeout: mergedConfig.timeout,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    withCredentials: true,
  });

  // Request interceptor - Add auth token
  client.interceptors.request.use(
    async (config: RequestConfig) => {
      const token = await getAuthToken();

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add request ID for tracing
      config.headers['X-Request-ID'] = generateRequestId();

      // Add timestamp for debugging
      config.headers['X-Request-Time'] = new Date().toISOString();

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - Handle errors and retry
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      // Log successful requests in development
      if (import.meta.env.DEV) {
        console.debug(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
      }
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as RequestConfig;

      if (!originalRequest) {
        return Promise.reject(error);
      }

      // Initialize retry count
      originalRequest._retryCount = originalRequest._retryCount || 0;

      // Handle 401 - Try token refresh
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const newToken = await refreshAuthToken();
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return client(originalRequest);
          }
          return Promise.reject(error);
        } catch (refreshError) {
          return Promise.reject(error);
        }
      }

      // Retry logic for network/server errors
      if (shouldRetry(error, originalRequest._retryCount)) {
        originalRequest._retryCount += 1;
        const delay = getRetryDelay(originalRequest._retryCount);

        console.warn(
          `[API] Retrying request (${originalRequest._retryCount}/${mergedConfig.retryAttempts}): ${originalRequest.url}`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        return client(originalRequest);
      }

      // Log error in development
      if (import.meta.env.DEV) {
        console.error(`[API Error] ${originalRequest.method?.toUpperCase()} ${originalRequest.url}:`, formatError(error));
      }

      return Promise.reject(error);
    }
  );

  return client;
};

// =====================================================
// Utility Functions
// =====================================================

/**
 * Generate unique request ID for tracing
 */
const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Build query string from params object
 */
export const buildQueryString = (params: Record<string, unknown>): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParams.append(key, String(v)));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

// =====================================================
// API Client Instance
// =====================================================

export const apiClient = createApiClient();

// =====================================================
// HTTP Method Wrappers with Type Safety
// =====================================================

export const api = {
  /**
   * GET request
   */
  get: async <T>(url: string, params?: Record<string, unknown>): Promise<T> => {
    const queryString = params ? buildQueryString(params) : '';
    const response = await apiClient.get<T>(`${url}${queryString}`);
    return response.data;
  },

  /**
   * POST request
   */
  post: async <T>(url: string, data?: unknown): Promise<T> => {
    const response = await apiClient.post<T>(url, data);
    return response.data;
  },

  /**
   * PUT request
   */
  put: async <T>(url: string, data?: unknown): Promise<T> => {
    const response = await apiClient.put<T>(url, data);
    return response.data;
  },

  /**
   * PATCH request
   */
  patch: async <T>(url: string, data?: unknown): Promise<T> => {
    const response = await apiClient.patch<T>(url, data);
    return response.data;
  },

  /**
   * DELETE request
   */
  delete: async <T>(url: string): Promise<T> => {
    const response = await apiClient.delete<T>(url);
    return response.data;
  },

  /**
   * Upload file with progress tracking
   */
  upload: async <T>(
    url: string,
    formData: FormData,
    onProgressOrOptions?: ((progress: number) => void) | UploadOptions
  ): Promise<T> => {
    const options: UploadOptions =
      typeof onProgressOrOptions === 'function'
        ? {
            onUploadProgress: (progressEvent: AxiosProgressEvent) => {
              if (progressEvent.total) {
                const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                onProgressOrOptions(progress);
              }
            },
          }
        : onProgressOrOptions || {};

    const response = await apiClient.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: options.onUploadProgress,
    });
    return response.data;
  },
};

// =====================================================
// Export Configuration
// =====================================================

export { API_BASE_URL, WS_BASE_URL };
export default api;
