// =====================================================
// Services Index - Smart Maize Farming System
// =====================================================

// Core API client
export { default as apiClient, setAuthToken, handleApiError } from './api';
export { 
  default as enhancedApiClient, 
  configureAuth, 
  categorizeError,
  ErrorCategory,
  type ApiConfig,
  type ApiError,
  type ApiResponse 
} from './apiClient';

// Domain services
export { authService } from './auth';
export { farmService } from './farms';
export { sensorService } from './sensors';
export { weatherService } from './weather';
export { pestDetectionService } from './pestDetection';
export { recommendationService } from './recommendations';
export { adminService } from './admin';
export { analyticsService } from './analytics';
export { default as aiService } from './ai';

// WebSocket and real-time
export { wsManager as webSocketManager, WebSocketEventType, type WebSocketEvent } from './websocket';

// Image handling
export { imageUploadService, ImageValidationError } from './imageService';

// Re-export types for convenience
export type { RegisterData, UserProfile } from './auth';
export type { CreateFarmData, UpdateFarmData, FarmQueryParams } from './farms';
export type { CreateSensorData, UpdateSensorData, SensorReadingData, SensorQueryParams } from './sensors';
export type { SubmitPestDetectionData, PestDetectionQueryParams, PestReviewData } from './pestDetection';
export type { RecommendationQueryParams, RecommendationResponse } from './recommendations';
export type { UserQueryParams, AdminUserUpdate, SystemConfigUpdate } from './admin';
export type {
  FarmDashboardAnalytics,
  SensorTrendsData,
  RecommendationHistory,
  SystemOverview,
  RecentActivity,
  DistrictAnalytics,
} from './analytics';
export type {
  AgriculturalAdviceRequest,
  AgriculturalAdviceResponse,
  ImageAnalysisRequest,
  ImageAnalysisResponse,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  AICapabilities,
  AIHealthStatus,
  TranslationRequest,
  TranslationResponse,
} from './ai';
