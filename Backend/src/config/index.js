/**
 * Smart Maize Farming System - Configuration Module
 * 
 * Centralized configuration management with environment variable validation
 * and default values for development.
 * 
 * @module config
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });
dotenv.config({ path: join(__dirname, '../../.env.local'), override: true });

/**
 * Validates required environment variables and throws error if missing
 * @param {string[]} requiredVars - Array of required variable names
 */
const validateEnvVars = (requiredVars) => {
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// Validate critical production variables
if (process.env.NODE_ENV === 'production') {
  validateEnvVars([
    'CONVEX_URL',
    'CLERK_SECRET_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ]);
}

/**
 * Application configuration object
 */
const config = {
  // Server settings
  server: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    apiVersion: process.env.API_VERSION || 'v1',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development'
  },

  // Convex configuration
  convex: {
    url: process.env.CONVEX_URL || '',
  },

  // Scheduler settings
  scheduler: {
    enabled: process.env.ENABLE_SCHEDULED_TASKS !== undefined
      ? process.env.ENABLE_SCHEDULED_TASKS === 'true'
      : process.env.NODE_ENV !== 'development',
  },

  // Clerk authentication
  clerk: {
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
    secretKey: process.env.CLERK_SECRET_KEY || '',
    webhookSecret: process.env.CLERK_WEBHOOK_SECRET || ''
  },

  // Auth role bootstrap configuration
  auth: {
    bootstrapAdminEmails: (process.env.ADMIN_BOOTSTRAP_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  },

  // Cloudinary media management
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || 'smart_maize_uploads'
  },

  // Africa's Talking SMS/USSD
  africasTalking: {
    username: process.env.AT_USERNAME || 'sandbox',
    apiKey: process.env.AT_API_KEY || '',
    shortcode: process.env.AT_SHORTCODE || '44005',
    senderId: process.env.AT_SENDER_ID || 'SMARTMAIZE'
  },

  // Weather API configuration
  weather: {
    apiKey: process.env.OPENWEATHERMAP_API_KEY || '',
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    cacheTtl: parseInt(process.env.WEATHER_CACHE_TTL, 10) || 1800 // 30 minutes
  },

  // Redis cache configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || ''
  },

  // AI/ML service configuration (Google Gemini)
  ai: {
    provider: process.env.AI_PROVIDER || 'gemini',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    serviceUrl: process.env.AI_SERVICE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: process.env.AI_SERVICE_API_KEY || process.env.GEMINI_API_KEY || '',
    pestDetectionThreshold: parseFloat(process.env.PEST_DETECTION_THRESHOLD) || 0.75,
    irrigationModelVersion: process.env.IRRIGATION_MODEL_VERSION || 'v1.0',
    requestTimeoutMs: parseInt(process.env.AI_REQUEST_TIMEOUT_MS, 10) || 20000,
    imageFetchTimeoutMs: parseInt(process.env.AI_IMAGE_FETCH_TIMEOUT_MS, 10) || 15000,
    imageFetchCacheTtlMs: parseInt(process.env.AI_IMAGE_FETCH_CACHE_TTL_MS, 10) || 300000,
    imageFetchMaxBytes: parseInt(process.env.AI_IMAGE_FETCH_MAX_BYTES, 10) || 5242880,
    farmContextCacheTtlMs: parseInt(process.env.AI_FARM_CONTEXT_CACHE_TTL_MS, 10) || 60000,
    responseCacheTtlMs: parseInt(process.env.AI_RESPONSE_CACHE_TTL_MS, 10) || 60000,
    healthCacheTtlMs: parseInt(process.env.AI_HEALTH_CACHE_TTL_MS, 10) || 30000,
    comprehensiveAnalysisConcurrency: parseInt(process.env.AI_COMPREHENSIVE_ANALYSIS_CONCURRENCY, 10) || 3,
    irrigationAnalysisConcurrency: parseInt(process.env.AI_IRRIGATION_ANALYSIS_CONCURRENCY, 10) || 4,
    recommendationGenerationConcurrency: parseInt(process.env.AI_RECOMMENDATION_GENERATION_CONCURRENCY, 10) || 3,
    maxWeatherForecastEntries: parseInt(process.env.AI_MAX_WEATHER_FORECAST_ENTRIES, 10) || 6,
    maxConversationHistoryEntries: parseInt(process.env.AI_MAX_CONVERSATION_HISTORY_ENTRIES, 10) || 6,
    maxConversationEntryChars: parseInt(process.env.AI_MAX_CONVERSATION_ENTRY_CHARS, 10) || 240
  },

  // Security settings
  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(','),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
  },

  // IoT device settings
  iot: {
    deviceSecret: process.env.IOT_DEVICE_SECRET || 'dev-iot-secret',
    tokenExpiry: parseInt(process.env.IOT_TOKEN_EXPIRY, 10) || 86400, // 24 hours
    maxBatchReadings: parseInt(process.env.IOT_MAX_BATCH_READINGS, 10) || 500,
    tokenLastUsedWriteIntervalMs: parseInt(process.env.IOT_TOKEN_LAST_USED_WRITE_INTERVAL_MS, 10) || 300000
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined'
  },

  // Notification settings
  notifications: {
    criticalAlertDelayMs: parseInt(process.env.CRITICAL_ALERT_DELAY_MS, 10) || 0,
    importantRecommendationDelayMs: parseInt(process.env.IMPORTANT_RECOMMENDATION_DELAY_MS, 10) || 300000, // 5 min
    routineUpdateBatchIntervalMs: parseInt(process.env.ROUTINE_UPDATE_BATCH_INTERVAL_MS, 10) || 3600000, // 1 hour
    deliveryConcurrency: parseInt(process.env.NOTIFICATION_DELIVERY_CONCURRENCY, 10) || 4,
    retryConcurrency: parseInt(process.env.NOTIFICATION_RETRY_CONCURRENCY, 10) || 3,
    summaryConcurrency: parseInt(process.env.NOTIFICATION_SUMMARY_CONCURRENCY, 10) || 4
  },

  // Sensor data validation thresholds
  sensorValidation: {
    soilMoisture: { min: 0, max: 100 },
    temperature: { min: -10, max: 60 },
    humidity: { min: 0, max: 100 },
    nitrogen: { min: 0, max: 500 },
    phosphorus: { min: 0, max: 500 },
    potassium: { min: 0, max: 500 },
    maxRateOfChange: {
      soilMoisture: 20, // % per hour
      temperature: 10    // °C per hour
    }
  },

  // Crop-specific settings for maize
  maize: {
    optimalSoilMoisture: { min: 50, max: 70 },
    optimalTemperature: { min: 18, max: 32 },
    growthStages: ['germination', 'vegetative', 'flowering', 'grain_filling', 'maturity'],
    nutrientSufficiency: {
      nitrogen: { min: 150, max: 250 },
      phosphorus: { min: 25, max: 50 },
      potassium: { min: 150, max: 250 }
    }
  }
};

export default config;
