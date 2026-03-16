/**
 * Weather Routes
 * 
 * API endpoints for weather data retrieval and forecasting.
 * 
 * @module routes/weather
 */

import { Router } from 'express';
import { authenticate, ROLES, requireOwnership } from '../middleware/auth.js';
import { validateUUID, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';
import { db } from '../database/convex.js';
import * as weatherService from '../services/weatherService.js';

const router = Router();

/**
 * Get farm user ID for ownership check
 */
const getFarmUserId = async (req) => {
  const farmId = req.params.farmId || req.query.farmId;
  if (!farmId) return null;
  
  return await db.farms.getUserId(farmId);
};

const toForecastDateString = (date) => date.toISOString().split('T')[0];

// =====================================================
// FARM WEATHER ROUTES
// =====================================================

/**
 * @route GET /api/v1/weather/farm/:farmId/current
 * @desc Get current weather for a farm
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId/current',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const weather = await weatherService.getCurrentWeather(req.params.farmId);
    return successResponse(res, weather, 'Current weather retrieved successfully');
  })
);

/**
 * @route GET /api/v1/weather/farm/:farmId/forecast
 * @desc Get weather forecast for a farm
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId/forecast',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 5;
    const forecast = await weatherService.getForecast(req.params.farmId, days);
    return successResponse(res, forecast, 'Weather forecast retrieved successfully');
  })
);

/**
 * @route GET /api/v1/weather/farm/:farmId/history
 * @desc Get historical weather data for a farm
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId/history',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, days } = req.query;
    
    let start, end;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      const daysBack = parseInt(days) || 7;
      end = new Date();
      start = new Date();
      start.setDate(start.getDate() - daysBack);
    }

    const farm = await db.farms.getById(req.params.farmId);
    const districtId = farm?.district_id || farm?.district;

    const data = await db.weatherData.getByDistrict(districtId, {
      startDate: toForecastDateString(start),
      endDate: toForecastDateString(end)
    });

    return successResponse(res, {
      farmId: req.params.farmId,
      period: { start: start.toISOString(), end: end.toISOString() },
      data: data || []
    }, 'Historical weather data retrieved successfully');
  })
);

/**
 * @route GET /api/v1/weather/farm/:farmId/alerts
 * @desc Get weather alerts for a farm
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId/alerts',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const alerts = await weatherService.getWeatherAlerts(req.params.farmId);
    return successResponse(res, alerts, 'Weather alerts retrieved successfully');
  })
);

// =====================================================
// LOCATION-BASED WEATHER ROUTES
// =====================================================

/**
 * @route GET /api/v1/weather/location
 * @desc Get weather by coordinates
 * @access Authenticated
 */
router.get('/location',
  authenticate,
  asyncHandler(async (req, res) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
        code: 'VALIDATION_ERROR'
      });
    }

    const weather = await weatherService.getWeatherByCoordinates(
      parseFloat(lat),
      parseFloat(lon)
    );

    return successResponse(res, weather, 'Weather retrieved successfully');
  })
);

/**
 * @route GET /api/v1/weather/district/:district
 * @desc Get weather by district
 * @access Authenticated
 */
router.get('/district/:district',
  authenticate,
  asyncHandler(async (req, res) => {
    const weather = await weatherService.getWeatherByDistrict(req.params.district);
    return successResponse(res, weather, 'District weather retrieved successfully');
  })
);

// =====================================================
// AGRICULTURAL WEATHER INSIGHTS
// =====================================================

/**
 * @route GET /api/v1/weather/farm/:farmId/farming-conditions
 * @desc Get farming conditions assessment
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId/farming-conditions',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const farmId = req.params.farmId;
    
    // Get current weather and forecast
    const [current, forecast] = await Promise.all([
      weatherService.getCurrentWeather(farmId),
      weatherService.getForecast(farmId, 3)
    ]);

    const conditions = weatherService.analyzeWeatherImpact(forecast);

    return successResponse(res, {
      current,
      forecast: forecast.slice(0, 3),
      conditions
    }, 'Farming conditions retrieved successfully');
  })
);

/**
 * Assess farming conditions based on weather
 */
function assessFarmingConditions(current, forecast) {
  const conditions = {
    sprayingConditions: 'unknown',
    irrigationNeeded: false,
    harvestConditions: 'unknown',
    recommendations: []
  };

  if (!current) return conditions;

  // Assess spraying conditions
  const windSpeed = current.wind?.speed || 0;
  const humidity = current.humidity || 0;
  const willRain = forecast.some(f => 
    f.weather?.[0]?.main?.toLowerCase().includes('rain')
  );

  if (windSpeed < 15 && !willRain && humidity < 90) {
    conditions.sprayingConditions = 'good';
    conditions.recommendations.push('Good conditions for pesticide/fertilizer application');
  } else if (windSpeed > 25 || willRain) {
    conditions.sprayingConditions = 'poor';
    conditions.recommendations.push('Avoid spraying - high wind or rain expected');
  } else {
    conditions.sprayingConditions = 'moderate';
  }

  // Assess irrigation needs
  const temp = current.temperature || 25;
  const recentRain = current.rain?.['1h'] || 0;
  
  if (temp > 30 && humidity < 40 && recentRain === 0) {
    conditions.irrigationNeeded = true;
    conditions.recommendations.push('High temperature and low humidity - consider irrigation');
  }

  // Assess harvest conditions
  const forecastRain = forecast.filter(f => 
    f.weather?.[0]?.main?.toLowerCase().includes('rain')
  ).length;

  if (forecastRain === 0 && humidity < 70) {
    conditions.harvestConditions = 'good';
    conditions.recommendations.push('Good harvest conditions expected');
  } else if (forecastRain > 2) {
    conditions.harvestConditions = 'poor';
    conditions.recommendations.push('Rain expected - plan harvest accordingly');
  } else {
    conditions.harvestConditions = 'moderate';
  }

  return conditions;
}

/**
 * @route GET /api/v1/weather/farm/:farmId/irrigation-window
 * @desc Get optimal irrigation window
 * @access Owner, Admin, Expert
 */
router.get('/farm/:farmId/irrigation-window',
  authenticate,
  ...validateUUID('farmId'),
  handleValidationErrors,
  requireOwnership(getFarmUserId),
  asyncHandler(async (req, res) => {
    const forecast = await weatherService.getForecast(req.params.farmId, 5);

    // Find optimal irrigation windows (no rain, moderate temperature)
    const windows = forecast
      .filter(f => {
        const isRainy = String(f.condition || '').toLowerCase().includes('rain');
        const temp = f.temperatureMax || f.temperatureAvg || 25;
        return !isRainy && temp < 32 && temp > 15;
      })
      .map(f => ({
        date: f.date,
        conditions: {
          temperature: f.temperatureMax || f.temperatureAvg,
          humidity: f.humidityAvg,
          weather: f.condition
        },
        recommendation: (f.temperatureMax || f.temperatureAvg || 0) > 28
          ? 'Evening irrigation recommended'
          : 'Morning irrigation recommended'
      }));

    return successResponse(res, {
      farmId: req.params.farmId,
      optimalWindows: windows,
      nextBestWindow: windows[0] || null
    }, 'Irrigation windows retrieved successfully');
  })
);

export default router;
