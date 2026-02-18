// =====================================================
// Environment Configuration Utility
// Smart Maize Farming System - Frontend
// =====================================================

interface EnvironmentConfig {
  // API
  apiUrl: string;
  wsUrl: string;

  // Auth
  clerkPublishableKey: string;

  // Feature Flags
  enableWebSocket: boolean;
  enableVoiceAssistant: boolean;
  enableAnalytics: boolean;
  enableOfflineMode: boolean;

  // Cache TTL (in seconds)
  sensorCacheTTL: number;
  weatherCacheTTL: number;
  farmCacheTTL: number;

  // External Services
  mapboxAccessToken: string | null;
  sentryDsn: string | null;

  // Debug
  isDebugMode: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  // Environment
  isDevelopment: boolean;
  isProduction: boolean;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true';
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseLogLevel(value: string | undefined): 'debug' | 'info' | 'warn' | 'error' {
  const levels = ['debug', 'info', 'warn', 'error'];
  if (value && levels.includes(value.toLowerCase())) {
    return value.toLowerCase() as 'debug' | 'info' | 'warn' | 'error';
  }
  return import.meta.env.DEV ? 'debug' : 'info';
}

function createConfig(): EnvironmentConfig {
  const isDevelopment = import.meta.env.DEV;
  const isProduction = import.meta.env.PROD;

  // Derive WebSocket URL from API URL if not specified
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
  const defaultWsUrl = apiUrl.replace(/^http/, 'ws').replace(/\/api\/v1$/, '/ws');

  return {
    // API Configuration
    apiUrl,
    wsUrl: import.meta.env.VITE_WS_URL || defaultWsUrl,

    // Authentication
    clerkPublishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '',

    // Feature Flags
    enableWebSocket: parseBoolean(import.meta.env.VITE_ENABLE_WEBSOCKET, true),
    enableVoiceAssistant: parseBoolean(import.meta.env.VITE_ENABLE_VOICE_ASSISTANT, true),
    enableAnalytics: parseBoolean(import.meta.env.VITE_ENABLE_ANALYTICS, true),
    enableOfflineMode: parseBoolean(import.meta.env.VITE_ENABLE_OFFLINE_MODE, false),

    // Cache Configuration (in seconds)
    sensorCacheTTL: parseNumber(import.meta.env.VITE_SENSOR_CACHE_TTL, 30),
    weatherCacheTTL: parseNumber(import.meta.env.VITE_WEATHER_CACHE_TTL, 300),
    farmCacheTTL: parseNumber(import.meta.env.VITE_FARM_CACHE_TTL, 60),

    // External Services
    mapboxAccessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || null,
    sentryDsn: import.meta.env.VITE_SENTRY_DSN || null,

    // Debugging
    isDebugMode: parseBoolean(import.meta.env.VITE_DEBUG_MODE, isDevelopment),
    logLevel: parseLogLevel(import.meta.env.VITE_LOG_LEVEL),

    // Environment
    isDevelopment,
    isProduction,
  };
}

// Create singleton config instance
export const env = createConfig();

// Validate required configuration
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!env.clerkPublishableKey) {
    errors.push('VITE_CLERK_PUBLISHABLE_KEY is required');
  }

  if (!env.apiUrl) {
    errors.push('VITE_API_URL is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Log configuration in development (excluding sensitive data)
export function logConfig(): void {
  if (!env.isDebugMode) return;

  console.group('🌽 Smart Maize Config');
  console.log('Environment:', env.isProduction ? 'Production' : 'Development');
  console.log('API URL:', env.apiUrl);
  console.log('WebSocket URL:', env.wsUrl);
  console.log('Features:', {
    websocket: env.enableWebSocket,
    voiceAssistant: env.enableVoiceAssistant,
    analytics: env.enableAnalytics,
    offlineMode: env.enableOfflineMode,
  });
  console.log('Cache TTL:', {
    sensor: `${env.sensorCacheTTL}s`,
    weather: `${env.weatherCacheTTL}s`,
    farm: `${env.farmCacheTTL}s`,
  });
  console.groupEnd();
}

export default env;
