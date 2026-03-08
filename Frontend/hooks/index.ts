// =====================================================
// Custom Hooks - Smart Maize Farming System
// =====================================================

// Primary API hooks with React Query
export * from './useApi';

// WebSocket hooks
export {
  useWebSocket,
  useSensorData,
  useRecommendationUpdates,
  useWeatherUpdates,
  usePestDetectionUpdates,
  useSystemHealth,
  useWebSocketEvent,
} from './useWebSocket';

// Utility hooks
export { useTranslation } from './useTranslation';
export { useLocalStorage } from './useLocalStorage';
export { useMediaQuery } from './useMediaQuery';
export { useDebounce } from './useDebounce';
