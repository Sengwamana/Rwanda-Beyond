/**
 * Weather Service
 * 
 * Handles weather data fetching, caching, and retrieval
 * using OpenWeatherMap API.
 * 
 * @module services/weatherService
 */

import axios from 'axios';
import { db } from '../database/convex.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { ServiceUnavailableError } from '../utils/errors.js';

// Simple in-memory cache for weather data
const weatherCache = new Map();

/**
 * Get cache key for coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string} Cache key
 */
const getCacheKey = (lat, lon) => {
  // Round to 2 decimal places to group nearby locations
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  return `${roundedLat},${roundedLon}`;
};

/**
 * Check if cached data is still valid
 * @param {Object} cacheEntry - Cached data entry
 * @returns {boolean} Whether cache is valid
 */
const isCacheValid = (cacheEntry) => {
  if (!cacheEntry) return false;
  const ageMs = Date.now() - cacheEntry.timestamp;
  return ageMs < config.weather.cacheTtl * 1000;
};

/**
 * Fetch current weather from OpenWeatherMap
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Current weather data
 */
export const fetchCurrentWeather = async (lat, lon) => {
  const cacheKey = getCacheKey(lat, lon);
  
  // Check cache first
  const cached = weatherCache.get(`current_${cacheKey}`);
  if (isCacheValid(cached)) {
    logger.debug(`Weather cache hit for ${cacheKey}`);
    return cached.data;
  }

  try {
    const response = await axios.get(`${config.weather.baseUrl}/weather`, {
      params: {
        lat,
        lon,
        appid: config.weather.apiKey,
        units: 'metric'
      },
      timeout: 10000
    });

    const weather = {
      temperature: response.data.main.temp,
      feelsLike: response.data.main.feels_like,
      humidity: response.data.main.humidity,
      pressure: response.data.main.pressure,
      windSpeed: response.data.wind.speed,
      windDirection: response.data.wind.deg,
      condition: response.data.weather[0]?.main,
      description: response.data.weather[0]?.description,
      cloudCover: response.data.clouds.all,
      visibility: response.data.visibility,
      timestamp: Date.now()
    };

    // Cache the result
    weatherCache.set(`current_${cacheKey}`, {
      data: weather,
      timestamp: Date.now()
    });

    return weather;
  } catch (error) {
    logger.error('Failed to fetch current weather:', error.message);
    throw new ServiceUnavailableError('Weather service unavailable');
  }
};

/**
 * Fetch weather forecast from OpenWeatherMap
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} days - Number of days (max 7)
 * @returns {Promise<Array>} Weather forecast data
 */
export const fetchWeatherForecast = async (lat, lon, days = 7) => {
  const cacheKey = getCacheKey(lat, lon);
  
  // Check cache first
  const cached = weatherCache.get(`forecast_${cacheKey}`);
  if (isCacheValid(cached)) {
    logger.debug(`Forecast cache hit for ${cacheKey}`);
    return cached.data;
  }

  try {
    // Use 5-day/3-hour forecast endpoint
    const response = await axios.get(`${config.weather.baseUrl}/forecast`, {
      params: {
        lat,
        lon,
        appid: config.weather.apiKey,
        units: 'metric'
      },
      timeout: 15000
    });

    // Process and aggregate forecast data by day
    const forecastByDay = {};
    
    response.data.list.forEach(item => {
      const date = item.dt_txt.split(' ')[0];
      
      if (!forecastByDay[date]) {
        forecastByDay[date] = {
          date,
          temperatures: [],
          humidity: [],
          precipitation: [],
          conditions: [],
          windSpeeds: []
        };
      }

      forecastByDay[date].temperatures.push(item.main.temp);
      forecastByDay[date].humidity.push(item.main.humidity);
      forecastByDay[date].precipitation.push(item.pop || 0);
      forecastByDay[date].conditions.push(item.weather[0]?.main);
      forecastByDay[date].windSpeeds.push(item.wind.speed);
      
      if (item.rain?.['3h']) {
        forecastByDay[date].rainMm = (forecastByDay[date].rainMm || 0) + item.rain['3h'];
      }
    });

    // Aggregate to daily summaries
    const forecast = Object.values(forecastByDay)
      .slice(0, days)
      .map(day => ({
        date: day.date,
        temperatureMin: Math.min(...day.temperatures),
        temperatureMax: Math.max(...day.temperatures),
        temperatureAvg: day.temperatures.reduce((a, b) => a + b, 0) / day.temperatures.length,
        humidityAvg: Math.round(day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length),
        precipitationProbability: Math.round(Math.max(...day.precipitation) * 100),
        rainMm: day.rainMm || 0,
        condition: getMostFrequent(day.conditions),
        windSpeedAvg: day.windSpeeds.reduce((a, b) => a + b, 0) / day.windSpeeds.length
      }));

    // Cache the result
    weatherCache.set(`forecast_${cacheKey}`, {
      data: forecast,
      timestamp: Date.now()
    });

    return forecast;
  } catch (error) {
    logger.error('Failed to fetch weather forecast:', error.message);
    throw new ServiceUnavailableError('Weather service unavailable');
  }
};

/**
 * Get most frequent item in array
 * @param {Array} arr - Array of items
 * @returns {*} Most frequent item
 */
const getMostFrequent = (arr) => {
  const counts = {};
  let maxCount = 0;
  let mostFrequent = null;

  arr.forEach(item => {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      mostFrequent = item;
    }
  });

  return mostFrequent;
};

/**
 * Store weather data in database
 * @param {string} districtId - District UUID
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Array} forecastData - Forecast data to store
 */
export const storeWeatherData = async (districtId, lat, lon, forecastData) => {
  const records = forecastData.map(day => ({
    district_id: districtId,
    coordinates: `POINT(${lon} ${lat})`,
    forecast_date: day.date,
    temperature: day.temperatureAvg,
    humidity: day.humidityAvg,
    precipitation_probability: day.precipitationProbability,
    rain_mm: day.rainMm,
    weather_condition: day.condition,
    wind_speed: day.windSpeedAvg,
    source: 'openweathermap',
    raw_response: day,
    fetched_at: Date.now()
  }));

  // Upsert weather data
  await db.weatherData.upsert(records);

  logger.info(`Stored ${records.length} weather records for district ${districtId}`);
};

/**
 * Get stored weather data for a location
 * @param {string} districtId - District UUID
 * @param {number} days - Number of forecast days
 * @returns {Promise<Array>} Stored weather data
 */
export const getStoredWeather = async (districtId, days = 7) => {
  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const data = await db.weatherData.getByDistrict(districtId, {
    startDate,
    endDate: endDate.toISOString().split('T')[0]
  });

  return data || [];
};

/**
 * Get weather for a farm
 * @param {string} farmId - Farm UUID
 * @param {number} forecastDays - Number of forecast days
 * @returns {Promise<Object>} Current and forecast weather
 */
export const getWeatherForFarm = async (farmId, forecastDays = 7) => {
  // Get farm coordinates
  const farm = await db.farms.getById(farmId);

  if (!farm) {
    throw new Error('Farm not found');
  }

  // Default to Kigali coordinates if farm doesn't have coordinates
  let lat = -1.9403;
  let lon = 29.8739;

  if (farm.coordinates) {
    // Parse POINT coordinates
    const match = farm.coordinates.match(/POINT\(([^ ]+) ([^)]+)\)/);
    if (match) {
      lon = parseFloat(match[1]);
      lat = parseFloat(match[2]);
    }
  }

  // Fetch current weather and forecast
  const [current, forecast] = await Promise.all([
    fetchCurrentWeather(lat, lon),
    fetchWeatherForecast(lat, lon, forecastDays)
  ]);

  // Store forecast in database
  if (farm.district_id) {
    await storeWeatherData(farm.district_id, lat, lon, forecast).catch(err => {
      logger.warn('Failed to store weather data:', err.message);
    });
  }

  return {
    current,
    forecast,
    location: { lat, lon }
  };
};

/**
 * Analyze weather impact on irrigation
 * @param {Object} forecast - Weather forecast data
 * @returns {Object} Weather impact analysis
 */
export const analyzeWeatherImpact = (forecast) => {
  const analysis = {
    irrigationRecommendation: 'proceed',
    delayDays: 0,
    reasons: []
  };

  // Check for rain in next 24 hours
  const tomorrow = forecast[0];
  if (tomorrow && tomorrow.precipitationProbability > 70) {
    analysis.irrigationRecommendation = 'delay';
    analysis.delayDays = 1;
    analysis.reasons.push(`High probability of rain tomorrow (${tomorrow.precipitationProbability}%)`);
  }

  // Check for significant rain in next 48 hours
  const next48Hours = forecast.slice(0, 2);
  const totalExpectedRain = next48Hours.reduce((sum, day) => sum + (day.rainMm || 0), 0);
  if (totalExpectedRain > 10) {
    analysis.irrigationRecommendation = 'delay';
    analysis.delayDays = 2;
    analysis.reasons.push(`Expected rainfall: ${totalExpectedRain.toFixed(1)}mm in next 48 hours`);
  }

  // Check for extreme temperatures
  if (tomorrow && tomorrow.temperatureMax > 35) {
    analysis.reasons.push(`High temperature expected: ${tomorrow.temperatureMax}°C`);
    if (analysis.irrigationRecommendation === 'proceed') {
      analysis.irrigationRecommendation = 'early_morning';
      analysis.reasons.push('Recommend early morning irrigation to reduce evaporation');
    }
  }

  return analysis;
};

/**
 * Update weather data for all districts (scheduled job)
 */
export const updateAllDistrictsWeather = async () => {
  logger.info('Starting weather update for all districts...');

  const districts = await db.districts.listWithCoordinates();

  if (!districts || districts.length === 0) {
    logger.error('Failed to fetch districts or no districts found');
    return;
  }

  // Default coordinates for Rwanda districts (simplified)
  const districtCoords = {
    'Kigali': { lat: -1.9403, lon: 29.8739 },
    'Eastern': { lat: -2.0, lon: 30.5 },
    'Western': { lat: -2.3, lon: 29.0 },
    'Northern': { lat: -1.5, lon: 29.8 },
    'Southern': { lat: -2.5, lon: 29.7 }
  };

  for (const district of districts) {
    try {
      // Get coordinates (from district or default by province)
      let lat, lon;
      if (district.coordinates) {
        const match = district.coordinates.match(/POINT\(([^ ]+) ([^)]+)\)/);
        if (match) {
          lon = parseFloat(match[1]);
          lat = parseFloat(match[2]);
        }
      }

      if (!lat || !lon) {
        // Use default for Kigali
        lat = -1.9403;
        lon = 29.8739;
      }

      const forecast = await fetchWeatherForecast(lat, lon, 7);
      await storeWeatherData(district._id, lat, lon, forecast);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      logger.error(`Failed to update weather for ${district.name}:`, err.message);
    }
  }

  logger.info('Weather update completed for all districts');
};

/**
 * Clear weather cache
 */
export const clearWeatherCache = () => {
  weatherCache.clear();
  logger.info('Weather cache cleared');
};

export default {
  fetchCurrentWeather,
  fetchWeatherForecast,
  storeWeatherData,
  getStoredWeather,
  getWeatherForFarm,
  analyzeWeatherImpact,
  updateAllDistrictsWeather,
  clearWeatherCache
};
