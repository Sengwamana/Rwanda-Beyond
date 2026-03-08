/**
 * Smart Maize Farming System - Main Application Entry Point
 * 
 * IoT-Based Smart Maize Farming System for Rwanda
 * Providing AI-driven decision support for irrigation optimization
 * and Fall Armyworm detection for smallholder farmers.
 * 
 * @module index
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import path from 'path';
import { createServer } from 'http';
import config from './config/index.js';
import logger from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { transformResponseMiddleware } from './middleware/transformResponse.js';
import { wsManager } from './services/websocketService.js';

// Import routes
import userRoutes from './routes/users.js';
import farmRoutes from './routes/farms.js';
import sensorRoutes from './routes/sensors.js';
import recommendationRoutes from './routes/recommendations.js';
import pestDetectionRoutes from './routes/pest-detection.js';
import weatherRoutes from './routes/weather.js';
import analyticsRoutes from './routes/analytics.js';
import adminRoutes from './routes/admin.js';
import ussdRoutes from './routes/ussd.js';
import aiRoutes from './routes/ai.js';
import contentRoutes from './routes/content.js';

// Create Express application
const app = express();

// Create HTTP server for WebSocket support
const httpServer = createServer(app);

// =====================================================
// MIDDLEWARE CONFIGURATION
// =====================================================

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      scriptSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: config.security.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Device-ID',
    'X-Device-Token',
    'X-Timestamp',
    'X-Signature',
    'X-Request-ID',
    'X-Request-Time',
  ]
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Request logging
if (config.server.env !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.http(message.trim())
    }
  }));
}

// Rate limiting for API routes
app.use('/api/', apiLimiter);

// Transform snake_case responses to camelCase for frontend compatibility
app.use('/api/', transformResponseMiddleware);

// =====================================================
// HEALTH CHECK ENDPOINTS
// =====================================================

/**
 * @route GET /health
 * @desc Basic health check
 * @access Public
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: config.server.apiVersion,
    environment: config.server.env
  });
});

/**
 * @route GET /api/health
 * @desc API health check with more details
 * @access Public
 */
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: config.server.apiVersion,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };

  // Check database connection
  try {
    const { testConnection } = await import('./database/convex.js');
    const connected = await testConnection();
    health.database = connected ? 'connected' : 'unhealthy';
    if (!connected) {
      health.status = 'degraded';
    }
  } catch (e) {
    health.database = 'disconnected';
    health.status = 'degraded';
  }

  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

// =====================================================
// API ROUTES
// =====================================================

const API_VERSION = '/api/v1';

// User management
app.use(`${API_VERSION}/users`, userRoutes);

// Farm management
app.use(`${API_VERSION}/farms`, farmRoutes);

// Sensor data and IoT
app.use(`${API_VERSION}/sensors`, sensorRoutes);

// Recommendations
app.use(`${API_VERSION}/recommendations`, recommendationRoutes);

// Pest detection
app.use(`${API_VERSION}/pest-detection`, pestDetectionRoutes);

// Weather data
app.use(`${API_VERSION}/weather`, weatherRoutes);

// Analytics and dashboards
app.use(`${API_VERSION}/analytics`, analyticsRoutes);

// Admin operations
app.use(`${API_VERSION}/admin`, adminRoutes);

// USSD callbacks (Africa's Talking)
app.use(`${API_VERSION}/ussd`, ussdRoutes);

// AI/Gemini powered services
app.use(`${API_VERSION}/ai`, aiRoutes);

// Public dynamic content
app.use(`${API_VERSION}/content`, contentRoutes);

// =====================================================
// API DOCUMENTATION ENDPOINT
// =====================================================

/**
 * @route GET /api
 * @desc API documentation overview
 * @access Public
 */
app.get('/api', (req, res) => {
  res.json({
    name: 'Smart Maize Farming System API',
    version: config.server.apiVersion,
    description: 'IoT-Based Smart Maize Farming System for Rwanda',
    documentation: '/api/docs',
    endpoints: {
      health: {
        'GET /health': 'Basic health check',
        'GET /api/health': 'Detailed API health check'
      },
      users: {
        'GET /api/v1/users': 'List users (admin)',
        'GET /api/v1/users/me': 'Get current user profile',
        'PUT /api/v1/users/me': 'Update current user profile'
      },
      farms: {
        'GET /api/v1/farms': 'List user farms',
        'POST /api/v1/farms': 'Create new farm',
        'GET /api/v1/farms/:id': 'Get farm details',
        'PUT /api/v1/farms/:id': 'Update farm',
        'GET /api/v1/farms/:id/summary': 'Get farm summary with all data'
      },
      sensors: {
        'GET /api/v1/sensors/farm/:farmId': 'List farm sensors',
        'POST /api/v1/sensors/data/ingest': 'Ingest sensor data (IoT)',
        'GET /api/v1/sensors/data/farm/:farmId': 'Get sensor data',
        'GET /api/v1/sensors/data/farm/:farmId/latest': 'Get latest readings'
      },
      recommendations: {
        'GET /api/v1/recommendations/farm/:farmId': 'List farm recommendations',
        'GET /api/v1/recommendations/farm/:farmId/active': 'Get active recommendations',
        'POST /api/v1/recommendations/:id/respond': 'Respond to recommendation'
      },
      pestDetection: {
        'POST /api/v1/pest-detection/upload/:farmId': 'Upload pest image',
        'GET /api/v1/pest-detection/farm/:farmId': 'List pest detections',
        'POST /api/v1/pest-detection/:id/review': 'Expert review (expert/admin)'
      },
      weather: {
        'GET /api/v1/weather/farm/:farmId/current': 'Current weather',
        'GET /api/v1/weather/farm/:farmId/forecast': 'Weather forecast',
        'GET /api/v1/weather/farm/:farmId/farming-conditions': 'Farming conditions'
      },
      analytics: {
        'GET /api/v1/analytics/farm/:farmId/dashboard': 'Farmer dashboard',
        'GET /api/v1/analytics/system/overview': 'System overview (admin/expert)'
      },
      ussd: {
        'POST /api/v1/ussd/callback': 'USSD callback (Africa\'s Talking)'
      }
    },
    authentication: 'Bearer token (Clerk JWT) required for most endpoints',
    iotAuthentication: 'Device ID + Token + HMAC signature for IoT endpoints'
  });
});

// =====================================================
// ERROR HANDLING
// =====================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// =====================================================
// SCHEDULED TASKS
// =====================================================

/**
 * Initialize scheduled tasks (cron jobs)
 */
async function initializeScheduledTasks() {
  try {
    const { initializeScheduledTasks } = await import('./services/schedulerService.js');
    const tasks = await initializeScheduledTasks();
    logger.info(`Initialized ${tasks.length} scheduled tasks`);
  } catch (error) {
    logger.error('Failed to initialize scheduled tasks', { error: error.message });
  }
}

// =====================================================
// SERVER STARTUP
// =====================================================

/**
 * Start the server
 */
async function startServer() {
  try {
    // Verify database connection
    const { testConnection } = await import('./database/convex.js');
    const connected = await testConnection();
    
    if (!connected) {
      logger.warn('Database connection check failed');
    } else {
      logger.info('Database connection verified');
    }

    // Initialize scheduled tasks
    if (config.server.env !== 'test') {
      await initializeScheduledTasks();
    }

    // Initialize WebSocket server
    wsManager.initialize(httpServer);

    // Start HTTP server with WebSocket support
    httpServer.listen(config.server.port, () => {
      logger.info(`🌽 Smart Maize Farming System API started`, {
        port: config.server.port,
        environment: config.server.env,
        version: config.server.apiVersion,
        nodeVersion: process.version,
        websocket: true
      });
      
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🌽 SMART MAIZE FARMING SYSTEM                               ║
║   IoT-Based Agricultural Decision Support for Rwanda          ║
║                                                               ║
║   Server running on port ${config.server.port}                              ║
║   Environment: ${config.server.env.padEnd(10)}                              ║
║   Version: ${config.server.apiVersion.padEnd(10)}                                  ║
║   WebSocket: Enabled                                          ║
║                                                               ║
║   API Base: http://localhost:${config.server.port}/api/v1                   ║
║   WebSocket: ws://localhost:${config.server.port}/ws                        ║
║   Health:   http://localhost:${config.server.port}/health                   ║
║   Docs:     http://localhost:${config.server.port}/api                      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully`);
      
      // Shutdown WebSocket server
      wsManager.shutdown();
      
      httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
    });

    return httpServer;
  } catch (error) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

// Start the server only when executed directly, not when imported in tests
if (isDirectRun) {
  startServer();
}

// Export for testing
export { app, httpServer, wsManager, startServer };
export default app;
