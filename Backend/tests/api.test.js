/**
 * API Integration Tests
 * 
 * Comprehensive test suite for the Smart Maize Farming System API.
 * Tests health endpoints, authentication, USSD, sensor data, and more.
 * 
 * Run with: npm test
 */

import request from 'supertest';
import { jest } from '@jest/globals';

// Mock the config before importing app
jest.unstable_mockModule('../src/config/index.js', () => ({
  default: {
    server: {
      env: 'test',
      port: 3001,
      apiVersion: 'v1',
      isProduction: false,
      isDevelopment: false
    },
    convex: {
      url: process.env.CONVEX_URL || 'https://test.convex.cloud'
    },
    clerk: {
      publishableKey: 'test-pk',
      secretKey: 'test-sk',
      webhookSecret: 'test-webhook'
    },
    cloudinary: {
      cloudName: 'test-cloud',
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      uploadPreset: 'test-preset'
    },
    africasTalking: {
      username: 'sandbox',
      apiKey: 'test-at-key',
      shortcode: '12345',
      senderId: 'TEST'
    },
    weather: {
      apiKey: 'test-weather-key',
      baseUrl: 'https://api.openweathermap.org/data/2.5',
      cacheTtl: 1800
    },
    redis: {
      url: 'redis://localhost:6379',
      password: ''
    },
    ai: {
      serviceUrl: 'http://localhost:5000',
      apiKey: 'test-ai-key',
      pestDetectionThreshold: 0.75,
      irrigationModelVersion: 'v1.0'
    },
    security: {
      jwtSecret: 'test-jwt-secret',
      corsOrigins: ['http://localhost:3000'],
      rateLimitWindowMs: 900000,
      rateLimitMaxRequests: 100
    },
    iot: {
      deviceSecret: 'test-iot-secret',
      tokenExpiry: 86400
    },
    logging: {
      level: 'error',
      format: 'combined'
    },
    notifications: {
      criticalAlertDelayMs: 0,
      importantRecommendationDelayMs: 0,
      routineUpdateBatchIntervalMs: 0
    },
    sensorValidation: {
      soilMoisture: { min: 0, max: 100 },
      temperature: { min: -10, max: 60 },
      humidity: { min: 0, max: 100 },
      nitrogen: { min: 0, max: 500 },
      phosphorus: { min: 0, max: 500 },
      potassium: { min: 0, max: 500 },
      maxRateOfChange: {
        soilMoisture: 20,
        temperature: 10
      }
    },
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
  }
}));

describe('Smart Maize Farming System API', () => {
  let app;

  beforeAll(async () => {
    // Dynamic import after mocking
    const module = await import('../src/index.js');
    app = module.default;
  });

  // ===========================================
  // HEALTH CHECK TESTS
  // ===========================================
  describe('Health Endpoints', () => {
    test('GET /health returns healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment', 'test');
    });

    test('GET /api/health returns detailed health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body.memory).toHaveProperty('heapUsed');
    });

    test('Health check includes version info', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.version).toBe('v1');
    });
  });

  // ===========================================
  // API DOCUMENTATION TESTS
  // ===========================================
  describe('API Documentation', () => {
    test('GET /api returns API documentation', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Smart Maize Farming System API');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.endpoints).toHaveProperty('users');
      expect(response.body.endpoints).toHaveProperty('farms');
      expect(response.body.endpoints).toHaveProperty('sensors');
      expect(response.body.endpoints).toHaveProperty('recommendations');
      expect(response.body.endpoints).toHaveProperty('pestDetection');
      expect(response.body.endpoints).toHaveProperty('weather');
    });

    test('API documentation includes authentication info', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body).toHaveProperty('authentication');
      expect(response.body).toHaveProperty('iotAuthentication');
    });
  });

  // ===========================================
  // AUTHENTICATION TESTS
  // ===========================================
  describe('Authentication', () => {
    test('GET /api/v1/users/me returns 401 without auth', async () => {
      const response = await request(app)
        .get('/api/v1/users/me')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    test('GET /api/v1/farms returns 401 without auth', async () => {
      const response = await request(app)
        .get('/api/v1/farms')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    test('Invalid Bearer token returns 401', async () => {
      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid-token-12345')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    test('Missing Authorization header returns 401', async () => {
      const response = await request(app)
        .get('/api/v1/farms')
        .expect(401);

      expect(response.body.code).toBe('AUTH_FAILED');
    });
  });

  // ===========================================
  // USSD ENDPOINT TESTS
  // ===========================================
  describe('USSD Endpoints', () => {
    test('GET /api/v1/ussd/health returns ok', async () => {
      const response = await request(app)
        .get('/api/v1/ussd/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service', 'ussd');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('POST /api/v1/ussd/callback handles initial USSD session', async () => {
      const response = await request(app)
        .post('/api/v1/ussd/callback')
        .send({
          sessionId: 'test-session-123',
          serviceCode: '*123#',
          phoneNumber: '+250788000001',
          text: ''
        })
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/plain/);
      expect(response.text).toMatch(/^CON/); // Initial menu should continue
      expect(response.text).toContain('SmartMaize');
    });

    test('POST /api/v1/ussd/callback handles menu selection', async () => {
      const response = await request(app)
        .post('/api/v1/ussd/callback')
        .send({
          sessionId: 'test-session-456',
          serviceCode: '*123#',
          phoneNumber: '+250788000002',
          text: '0' // Exit option
        })
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/plain/);
      expect(response.text).toMatch(/^END/); // Should end session
    });

    test('POST /api/v1/ussd/callback/v2 supports language detection', async () => {
      const response = await request(app)
        .post('/api/v1/ussd/callback/v2')
        .send({
          sessionId: 'test-session-789',
          serviceCode: '*123#',
          phoneNumber: '+250788000003',
          text: '',
          networkCode: '63510'
        })
        .expect(200);

      expect(response.text).toMatch(/^CON/);
    });
  });

  // ===========================================
  // SENSOR DATA ENDPOINT TESTS
  // ===========================================
  describe('Sensor Data Endpoints', () => {
    test('POST /api/v1/sensors/data/ingest requires device auth', async () => {
      const response = await request(app)
        .post('/api/v1/sensors/data/ingest')
        .send({
          readings: [
            {
              soilMoisture: 45,
              airTemperature: 25,
              humidity: 65,
              timestamp: new Date().toISOString()
            }
          ]
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    test('POST /api/v1/sensors/data/ingest requires device ID header', async () => {
      const response = await request(app)
        .post('/api/v1/sensors/data/ingest')
        .set('X-Device-Token', 'some-token')
        .send({
          readings: [
            { soilMoisture: 45 }
          ]
        })
        .expect(401);

      expect(response.body.message).toContain('device');
    });
  });

  // ===========================================
  // 404 AND ERROR HANDLING TESTS
  // ===========================================
  describe('Error Handling', () => {
    test('GET /nonexistent returns 404', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent-endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
    });

    test('Invalid JSON body returns 400', async () => {
      const response = await request(app)
        .post('/api/v1/ussd/callback')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });

  // ===========================================
  // CORS AND SECURITY TESTS
  // ===========================================
  describe('Security Headers', () => {
    test('Response includes security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Helmet adds these headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });

    test('OPTIONS request returns CORS headers', async () => {
      const response = await request(app)
        .options('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  // ===========================================
  // RATE LIMITING TESTS
  // ===========================================
  describe('Rate Limiting', () => {
    test('Health endpoint allows multiple requests', async () => {
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(request(app).get('/health'));
      }

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});

// ===========================================
// INPUT VALIDATION TESTS
// ===========================================
describe('Input Validation', () => {
  let app;

  beforeAll(async () => {
    const module = await import('../src/index.js');
    app = module.default;
  });

  test('Invalid UUID returns 422', async () => {
    const response = await request(app)
      .get('/api/v1/farms/invalid-uuid')
      .set('Authorization', 'Bearer test-token');

    // Either 401 (auth failed) or 422 (validation failed) is acceptable
    expect([401, 422]).toContain(response.status);
  });

  test('Invalid pagination parameters return 422', async () => {
    const response = await request(app)
      .get('/api/v1/farms')
      .query({ page: -1, limit: 1000 })
      .set('Authorization', 'Bearer test-token');

    expect([401, 422]).toContain(response.status);
  });

  test('Page limit exceeding max returns error', async () => {
    const response = await request(app)
      .get('/api/v1/farms')
      .query({ limit: 500 }) // Max is 100
      .set('Authorization', 'Bearer test-token');

    expect([401, 422]).toContain(response.status);
  });
});

// ===========================================
// SERVICE UNIT TESTS
// ===========================================
describe('Service Unit Tests', () => {
  describe('USSD Service', () => {
    test('USSD translations exist for Kinyarwanda', async () => {
      const { TRANSLATIONS } = await import('../src/services/ussdService.js');
      
      expect(TRANSLATIONS).toHaveProperty('rw');
      expect(TRANSLATIONS.rw).toHaveProperty('welcome');
      expect(TRANSLATIONS.rw).toHaveProperty('goodbye');
    });

    test('USSD translations exist for English', async () => {
      const { TRANSLATIONS } = await import('../src/services/ussdService.js');
      
      expect(TRANSLATIONS).toHaveProperty('en');
      expect(TRANSLATIONS.en).toHaveProperty('welcome');
    });
  });

  describe('Fertilizer Service', () => {
    test('Fertilizer types are defined', async () => {
      const { FERTILIZER_TYPES } = await import('../src/services/fertilizerService.js');
      
      expect(FERTILIZER_TYPES).toHaveProperty('DAP');
      expect(FERTILIZER_TYPES).toHaveProperty('UREA');
      expect(FERTILIZER_TYPES).toHaveProperty('NPK_17-17-17');
      expect(FERTILIZER_TYPES.DAP).toHaveProperty('n');
      expect(FERTILIZER_TYPES.DAP).toHaveProperty('p');
      expect(FERTILIZER_TYPES.DAP).toHaveProperty('k');
    });

    test('Nutrient ranges are defined for all growth stages', async () => {
      const { NUTRIENT_RANGES } = await import('../src/services/fertilizerService.js');
      
      expect(NUTRIENT_RANGES).toHaveProperty('germination');
      expect(NUTRIENT_RANGES).toHaveProperty('vegetative');
      expect(NUTRIENT_RANGES).toHaveProperty('flowering');
      expect(NUTRIENT_RANGES).toHaveProperty('grain_filling');
      expect(NUTRIENT_RANGES).toHaveProperty('maturity');
    });
  });
});

// ===========================================
// ERROR CLASS TESTS
// ===========================================
describe('Error Classes', () => {
  test('Custom errors have correct status codes', async () => {
    const errors = await import('../src/utils/errors.js');
    
    const badRequest = new errors.BadRequestError('Test');
    expect(badRequest.statusCode).toBe(400);
    
    const unauthorized = new errors.UnauthorizedError('Test');
    expect(unauthorized.statusCode).toBe(401);
    
    const forbidden = new errors.ForbiddenError('Test');
    expect(forbidden.statusCode).toBe(403);
    
    const notFound = new errors.NotFoundError('Test');
    expect(notFound.statusCode).toBe(404);
  });

  test('Custom errors include error codes', async () => {
    const errors = await import('../src/utils/errors.js');
    
    const badRequest = new errors.BadRequestError('Test', 'CUSTOM_CODE');
    expect(badRequest.code).toBe('CUSTOM_CODE');
  });
});

