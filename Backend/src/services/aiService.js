/**
 * AI Service
 * 
 * Handles integration with AI/ML models for irrigation optimization,
 * pest detection, and fertilization recommendations.
 * 
 * Uses Google Gemini API for AI-powered analysis.
 * 
 * @module services/aiService
 */

import { db } from '../database/convex.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { AIServiceError } from '../utils/errors.js';
import * as weatherService from './weatherService.js';
import * as sensorService from './sensorService.js';
import * as recommendationService from './recommendationService.js';
import * as imageService from './imageService.js';
import * as geminiService from './geminiService.js';

/**
 * Analyze irrigation needs for a farm
 * @param {string} farmId - Farm UUID
 * @returns {Promise<Object>} Irrigation analysis results
 */
export const analyzeIrrigationNeeds = async (farmId) => {
  try {
    // Get latest sensor readings
    const latestReadings = await sensorService.getLatestReadings(farmId);
    
    if (!latestReadings) {
      logger.warn(`No sensor data for farm ${farmId}`);
      return null;
    }

    // Get weather forecast
    const weather = await weatherService.getWeatherForFarm(farmId, 3);
    const weatherImpact = weatherService.analyzeWeatherImpact(weather.forecast);

    // Get farm details for growth stage
    const farm = await db.farms.getById(farmId);

    // Resolve district name
    let districtName = null;
    if (farm?.district_id) {
      const district = await db.districts.getById(farm.district_id);
      districtName = district?.name;
    }

    // Use Gemini for intelligent analysis
    let geminiAnalysis = null;
    try {
      geminiAnalysis = await geminiService.getIrrigationRecommendation({
        soilMoisture: latestReadings.soil_moisture,
        soilTemperature: latestReadings.soil_temperature,
        airTemperature: latestReadings.air_temperature,
        humidity: latestReadings.humidity,
        growthStage: farm?.current_growth_stage,
        farmSize: farm?.size_hectares,
        soilType: farm?.soil_type,
        weatherForecast: weather.forecast,
        lastIrrigation: latestReadings.last_irrigation
      });
    } catch (geminiError) {
      logger.warn('Gemini analysis unavailable, using fallback:', geminiError.message);
    }

    // Combine Gemini analysis with local calculations
    const analysis = geminiAnalysis || calculateIrrigationNeeds({
      soilMoisture: latestReadings.soil_moisture,
      temperature: latestReadings.air_temperature,
      humidity: latestReadings.humidity,
      growthStage: farm?.current_growth_stage,
      farmSize: farm?.size_hectares,
      weatherForecast: weather.forecast,
      weatherImpact
    });

    // If irrigation needed and not delayed by weather, create recommendation
    if (analysis.needsIrrigation && weatherImpact.irrigationRecommendation !== 'delay') {
      await recommendationService.createIrrigationRecommendation(farmId, {
        currentSoilMoisture: latestReadings.soil_moisture,
        targetSoilMoisture: analysis.targetMoisture || 50,
        waterVolume: analysis.waterVolume,
        duration: analysis.duration,
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledTime: analysis.recommendedTime,
        weatherImpact,
        confidence: analysis.confidence,
        aiReasoning: analysis.reasoning || null
      });
    }

    return {
      ...analysis,
      weatherImpact,
      currentReadings: {
        soilMoisture: latestReadings.soil_moisture,
        temperature: latestReadings.air_temperature,
        humidity: latestReadings.humidity
      },
      aiProvider: geminiAnalysis ? 'gemini' : 'fallback'
    };

  } catch (error) {
    logger.error('Irrigation analysis failed:', error);
    throw new AIServiceError('Failed to analyze irrigation needs');
  }
};

/**
 * Calculate irrigation requirements
 * @param {Object} data - Input data for calculation
 * @returns {Object} Irrigation requirements
 */
const calculateIrrigationNeeds = (data) => {
  const {
    soilMoisture,
    temperature,
    humidity,
    growthStage,
    farmSize = 1,
    weatherForecast,
    weatherImpact
  } = data;

  const thresholds = config.maize.optimalSoilMoisture;
  
  // Determine if irrigation is needed
  const needsIrrigation = soilMoisture < thresholds.min;
  const urgency = soilMoisture < 20 ? 'critical' : soilMoisture < 30 ? 'high' : 'medium';

  if (!needsIrrigation) {
    return {
      needsIrrigation: false,
      currentMoisture: soilMoisture,
      message: 'Soil moisture is adequate',
      confidence: 0.9
    };
  }

  // Calculate target moisture based on growth stage
  const targetMoisture = growthStage === 'flowering' || growthStage === 'grain_filling'
    ? thresholds.max
    : (thresholds.min + thresholds.max) / 2;

  // Calculate water volume needed
  // Simplified calculation: ~25 liters per m² to raise moisture by 10%
  const moistureDeficit = targetMoisture - soilMoisture;
  const waterPerHectare = (moistureDeficit / 10) * 2500; // liters per hectare
  const waterVolume = Math.round(waterPerHectare * farmSize);

  // Calculate duration (assuming 100L/min irrigation rate)
  const duration = Math.round(waterVolume / 100);

  // Determine best time based on temperature
  let recommendedTime = '06:00';
  if (temperature > 30) {
    recommendedTime = '05:00'; // Earlier if hot
  } else if (temperature < 20) {
    recommendedTime = '07:00'; // Later if cool
  }

  // Adjust for weather
  if (weatherImpact.irrigationRecommendation === 'early_morning') {
    recommendedTime = '05:00';
  }

  // Calculate confidence based on data quality
  let confidence = 0.85;
  if (!temperature) confidence -= 0.1;
  if (!humidity) confidence -= 0.05;
  if (!growthStage) confidence -= 0.1;

  return {
    needsIrrigation: true,
    urgency,
    currentMoisture: soilMoisture,
    targetMoisture,
    moistureDeficit,
    waterVolume,
    duration,
    recommendedTime,
    confidence,
    message: `Irrigation recommended: ${duration} minutes at ${recommendedTime}`
  };
};

/**
 * Analyze pest detection image using Gemini Vision
 * @param {string} imageUrl - Image URL or detection ID
 * @param {Object} context - Additional context
 * @returns {Promise<Object>} Detection results
 */
export const analyzePestImage = async (imageUrl, context = {}) => {
  try {
    logger.info('Starting pest image analysis with Gemini');

    // If imageUrl is actually a detection ID, fetch the record
    let actualImageUrl = imageUrl;
    let detectionId = null;
    let farmId = context.farmId;
    const isDataUrl = typeof imageUrl === 'string' && imageUrl.startsWith('data:image/');

    if (imageUrl && !imageUrl.startsWith('http') && !isDataUrl) {
      // Assume it's a detection ID
      detectionId = imageUrl;
      const detection = await db.pestDetections.getById(detectionId);

      if (!detection) {
        throw new Error('Detection record not found');
      }

      actualImageUrl = detection.image_url;
      farmId = detection.farm_id;

      // Get AI-optimized image URL if we have cloudinary public id
      if (detection.cloudinary_public_id) {
        actualImageUrl = imageService.getAIOptimizedUrl(detection.cloudinary_public_id);
      }
    }

    // Get farm context if available
    let farmContext = {};
    if (farmId) {
      const farm = await db.farms.getById(farmId);
      
      if (farm) {
        let districtName = 'Rwanda';
        if (farm.district_id) {
          const district = await db.districts.getById(farm.district_id);
          districtName = district?.name || 'Rwanda';
        }

        farmContext = {
          growthStage: farm.current_growth_stage,
          location: districtName
        };
      }
    }

    // Call Gemini for pest analysis
    const aiResult = await geminiService.analyzePestImage(actualImageUrl, {
      ...farmContext,
      ...context
    });

    // Process results
    const results = {
      pestDetected: aiResult.pest_detected,
      pestType: aiResult.pest_type || 'fall_armyworm',
      severity: aiResult.severity || 'none',
      confidenceScore: aiResult.confidence,
      affectedAreaPercentage: aiResult.affected_area,
      symptoms: aiResult.symptoms || [],
      recommendations: aiResult.recommendations || [],
      urgency: aiResult.urgency || 'none',
      modelVersion: aiResult.model_version || config.ai.geminiModel,
      detectionMetadata: aiResult.metadata || {}
    };

    // Update detection record if we have one
    if (detectionId) {
      await imageService.updateDetectionResults(detectionId, results);

      // Create alert recommendation if pest detected above threshold
      if (results.pestDetected && results.confidenceScore >= config.ai.pestDetectionThreshold) {
        await recommendationService.createPestAlertRecommendation(farmId, {
          pestDetectionId: detectionId,
          pestType: results.pestType,
          severity: results.severity,
          confidence: results.confidenceScore,
          affectedArea: results.affectedAreaPercentage,
          imageUrl: actualImageUrl,
          symptoms: results.symptoms,
          recommendations: results.recommendations
        });
      }
    }

    return results;

  } catch (error) {
    logger.error('Pest analysis failed:', error);
    throw new AIServiceError(`Failed to analyze pest image: ${error.message}`);
  }
};

/**
 * Determine pest severity based on confidence and affected area
 * @param {number} confidence - Detection confidence
 * @param {number} affectedArea - Affected area percentage
 * @returns {string} Severity level
 */
const determineSeverity = (confidence, affectedArea) => {
  if (confidence < 0.5) return 'none';
  
  if (affectedArea >= 50) return 'severe';
  if (affectedArea >= 30) return 'high';
  if (affectedArea >= 15) return 'moderate';
  if (affectedArea >= 5) return 'low';
  
  return 'none';
};

/**
 * Analyze nutrient levels and recommend fertilization using Gemini
 * @param {string} farmId - Farm UUID
 * @returns {Promise<Object>} Fertilization analysis results
 */
export const analyzeNutrientNeeds = async (farmId) => {
  try {
    // Get latest sensor readings with NPK data
    const latestReadings = await sensorService.getLatestReadings(farmId);
    
    if (!latestReadings) {
      logger.warn(`No sensor data for farm ${farmId}`);
      return null;
    }

    // Check if we have NPK data
    if (!latestReadings.nitrogen && !latestReadings.phosphorus && !latestReadings.potassium) {
      logger.warn(`No NPK data for farm ${farmId}`);
      return { message: 'No nutrient data available', needsFertilization: false };
    }

    // Get farm growth stage and details
    const farm = await db.farms.getById(farmId);

    // Resolve district name
    let districtName = null;
    if (farm?.district_id) {
      const district = await db.districts.getById(farm.district_id);
      districtName = district?.name;
    }

    // Get last fertilization record
    const lastFertilization = await db.fertilizationSchedules.getLastExecuted(farmId);

    // Use Gemini for intelligent analysis
    let geminiAnalysis = null;
    try {
      geminiAnalysis = await geminiService.getFertilizationRecommendation({
        nitrogen: latestReadings.nitrogen,
        phosphorus: latestReadings.phosphorus,
        potassium: latestReadings.potassium,
        phLevel: latestReadings.ph_level,
        growthStage: farm?.current_growth_stage,
        farmSize: farm?.size_hectares,
        soilType: farm?.soil_type,
        lastFertilization: lastFertilization ? 
          `${lastFertilization.fertilizer_type} on ${lastFertilization.scheduled_date}` : 
          'Unknown'
      });
    } catch (geminiError) {
      logger.warn('Gemini analysis unavailable, using fallback:', geminiError.message);
    }

    // Use Gemini results or fallback to local calculation
    const analysis = geminiAnalysis ? {
      needsFertilization: geminiAnalysis.needsFertilization,
      urgency: geminiAnalysis.urgency,
      currentNutrients: {
        nitrogen: latestReadings.nitrogen,
        phosphorus: latestReadings.phosphorus,
        potassium: latestReadings.potassium
      },
      deficiencies: geminiAnalysis.deficiencies,
      recommendedFertilizer: geminiAnalysis.recommendedFertilizer,
      applicationRate: geminiAnalysis.applicationRate,
      quantities: {
        total: geminiAnalysis.totalQuantity
      },
      applicationMethod: geminiAnalysis.applicationMethod,
      timing: geminiAnalysis.timing,
      confidence: geminiAnalysis.confidence,
      reasoning: geminiAnalysis.reasoning,
      precautions: geminiAnalysis.precautions,
      costEstimate: geminiAnalysis.costEstimate,
      aiProvider: 'gemini'
    } : calculateFertilizationNeeds({
      nitrogen: latestReadings.nitrogen,
      phosphorus: latestReadings.phosphorus,
      potassium: latestReadings.potassium,
      growthStage: farm?.current_growth_stage,
      farmSize: farm?.size_hectares
    });

    // Create recommendation if fertilization needed
    if (analysis.needsFertilization && (analysis.deficiencies?.length > 0 || analysis.urgency !== 'none')) {
      await recommendationService.createFertilizationRecommendation(farmId, {
        currentNutrients: {
          nitrogen: latestReadings.nitrogen,
          phosphorus: latestReadings.phosphorus,
          potassium: latestReadings.potassium
        },
        targetNutrients: analysis.targetNutrients || {},
        deficiencies: analysis.deficiencies,
        fertilizerType: analysis.recommendedFertilizer,
        quantities: analysis.quantities,
        growthStage: farm?.current_growth_stage,
        aiReasoning: analysis.reasoning || null
      });
    }

    return analysis;

  } catch (error) {
    logger.error('Nutrient analysis failed:', error);
    throw new AIServiceError('Failed to analyze nutrient needs');
  }
};

/**
 * Calculate fertilization requirements
 * @param {Object} data - Input data for calculation
 * @returns {Object} Fertilization requirements
 */
const calculateFertilizationNeeds = (data) => {
  const {
    nitrogen,
    phosphorus,
    potassium,
    growthStage,
    farmSize = 1
  } = data;

  const ranges = config.maize.nutrientSufficiency;
  const deficiencies = [];
  const targetNutrients = {};

  // Check each nutrient
  if (nitrogen !== undefined && nitrogen < ranges.nitrogen.min) {
    deficiencies.push({
      nutrient: 'Nitrogen',
      current: nitrogen,
      target: ranges.nitrogen.min,
      level: nitrogen < ranges.nitrogen.min * 0.5 ? 'severe' : 'moderate'
    });
    targetNutrients.nitrogen = ranges.nitrogen.min;
  }

  if (phosphorus !== undefined && phosphorus < ranges.phosphorus.min) {
    deficiencies.push({
      nutrient: 'Phosphorus',
      current: phosphorus,
      target: ranges.phosphorus.min,
      level: phosphorus < ranges.phosphorus.min * 0.5 ? 'severe' : 'moderate'
    });
    targetNutrients.phosphorus = ranges.phosphorus.min;
  }

  if (potassium !== undefined && potassium < ranges.potassium.min) {
    deficiencies.push({
      nutrient: 'Potassium',
      current: potassium,
      target: ranges.potassium.min,
      level: potassium < ranges.potassium.min * 0.5 ? 'severe' : 'moderate'
    });
    targetNutrients.potassium = ranges.potassium.min;
  }

  if (deficiencies.length === 0) {
    return {
      needsFertilization: false,
      currentNutrients: { nitrogen, phosphorus, potassium },
      message: 'Nutrient levels are adequate',
      deficiencies: []
    };
  }

  // Calculate fertilizer quantities based on deficiencies
  const quantities = {
    nitrogen: 0,
    phosphorus: 0,
    potassium: 0,
    total: 0
  };

  deficiencies.forEach(def => {
    const deficit = def.target - def.current;
    const nutrientKey = def.nutrient.toLowerCase();
    // Rough conversion: 1 kg/ha of nutrient per 10 mg/kg deficit
    quantities[nutrientKey] = Math.round((deficit / 10) * farmSize);
  });

  quantities.total = quantities.nitrogen + quantities.phosphorus + quantities.potassium;

  // Recommend fertilizer type based on deficiencies
  let recommendedFertilizer = 'NPK';
  if (deficiencies.length === 1) {
    const nutrient = deficiencies[0].nutrient;
    if (nutrient === 'Nitrogen') recommendedFertilizer = 'Urea (46-0-0)';
    else if (nutrient === 'Phosphorus') recommendedFertilizer = 'DAP (18-46-0)';
    else if (nutrient === 'Potassium') recommendedFertilizer = 'MOP (0-0-60)';
  }

  return {
    needsFertilization: true,
    currentNutrients: { nitrogen, phosphorus, potassium },
    targetNutrients,
    deficiencies,
    recommendedFertilizer,
    quantities,
    message: `Fertilization recommended: ${deficiencies.map(d => d.nutrient).join(', ')} deficient`
  };
};

/**
 * Run comprehensive analysis for a farm
 * @param {string} farmId - Farm UUID
 * @returns {Promise<Object>} Comprehensive analysis results
 */
export const runComprehensiveAnalysis = async (farmId) => {
  const results = {
    irrigation: null,
    nutrients: null,
    timestamp: Date.now()
  };

  try {
    // Run irrigation analysis
    results.irrigation = await analyzeIrrigationNeeds(farmId);
  } catch (error) {
    logger.error('Irrigation analysis error:', error);
    results.irrigation = { error: error.message };
  }

  try {
    // Run nutrient analysis
    results.nutrients = await analyzeNutrientNeeds(farmId);
  } catch (error) {
    logger.error('Nutrient analysis error:', error);
    results.nutrients = { error: error.message };
  }

  return results;
};

/**
 * Scheduled analysis for all active farms
 */
export const runScheduledAnalysis = async () => {
  logger.info('Starting scheduled farm analysis...');

  const farms = await db.farms.listActive();

  if (!farms || farms.length === 0) {
    logger.error('Failed to fetch farms or no active farms found');
    return;
  }

  let analyzed = 0;
  let errors = 0;

  for (const farm of farms) {
    try {
      await runComprehensiveAnalysis(farm._id);
      analyzed++;
    } catch (analysisError) {
      logger.error(`Analysis failed for farm ${farm._id}:`, analysisError);
      errors++;
    }

    // Small delay between farms to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  logger.info(`Scheduled analysis complete: ${analyzed} farms analyzed, ${errors} errors`);
};

/**
 * Get AI-powered agricultural advice using Gemini
 * @param {string} question - User's agricultural question
 * @param {Object} context - Optional context (farm data, location, etc.)
 * @returns {Promise<Object>} AI response with advice
 */
export const getAgriculturalAdvice = async (question, context = {}) => {
  try {
    const response = await geminiService.getAgriculturalAdvice(question, context);
    
    return {
      success: true,
      answer: response.answer,
      suggestions: response.suggestions,
      relatedTopics: response.relatedTopics,
      confidence: response.confidence,
      sources: response.sources,
      aiProvider: 'gemini'
    };
  } catch (error) {
    logger.error('Agricultural advice failed:', error);
    throw new AIServiceError(`Failed to get agricultural advice: ${error.message}`);
  }
};

/**
 * Analyze farm images for general crop health assessment
 * @param {string} imageUrl - URL of the farm image
 * @param {Object} context - Analysis context
 * @returns {Promise<Object>} Image analysis results
 */
export const analyzeFarmImage = async (imageUrl, context = {}) => {
  try {
    const response = await geminiService.analyzeFarmImages(imageUrl, context);
    
    return {
      success: true,
      overallHealth: response.overallHealth,
      observations: response.observations,
      issues: response.issues,
      recommendations: response.recommendations,
      growthStageEstimate: response.growthStageEstimate,
      confidence: response.confidence,
      aiProvider: 'gemini'
    };
  } catch (error) {
    logger.error('Farm image analysis failed:', error);
    throw new AIServiceError(`Failed to analyze farm image: ${error.message}`);
  }
};

/**
 * Check AI service health status
 * @returns {Promise<Object>} Health status of AI services
 */
export const checkAIServiceHealth = async () => {
  try {
    const geminiHealth = await geminiService.checkServiceHealth();
    
    return {
      status: geminiHealth.available ? 'healthy' : 'degraded',
      provider: 'gemini',
      model: geminiHealth.model,
      lastChecked: Date.now(),
      details: geminiHealth
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      provider: 'gemini',
      error: error.message,
      lastChecked: Date.now()
    };
  }
};

export default {
  analyzeIrrigationNeeds,
  analyzePestImage,
  analyzeNutrientNeeds,
  runComprehensiveAnalysis,
  runScheduledAnalysis,
  getAgriculturalAdvice,
  analyzeFarmImage,
  checkAIServiceHealth
};
