/**
 * Fertilization Service
 * 
 * Handles soil nutrient analysis, fertilization recommendations,
 * and schedule management for optimal maize growth.
 * 
 * @module services/fertilizerService
 */

import { db } from '../database/convex.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import * as recommendationService from './recommendationService.js';

/**
 * Nutrient sufficiency ranges for maize by growth stage (mg/kg)
 */
export const NUTRIENT_RANGES = {
  germination: {
    nitrogen: { min: 100, max: 150, optimal: 125 },
    phosphorus: { min: 20, max: 35, optimal: 28 },
    potassium: { min: 100, max: 150, optimal: 125 }
  },
  vegetative: {
    nitrogen: { min: 150, max: 250, optimal: 200 },
    phosphorus: { min: 25, max: 45, optimal: 35 },
    potassium: { min: 140, max: 200, optimal: 170 }
  },
  flowering: {
    nitrogen: { min: 180, max: 280, optimal: 230 },
    phosphorus: { min: 30, max: 50, optimal: 40 },
    potassium: { min: 180, max: 280, optimal: 230 }
  },
  grain_filling: {
    nitrogen: { min: 160, max: 240, optimal: 200 },
    phosphorus: { min: 25, max: 45, optimal: 35 },
    potassium: { min: 200, max: 300, optimal: 250 }
  },
  maturity: {
    nitrogen: { min: 100, max: 180, optimal: 140 },
    phosphorus: { min: 20, max: 35, optimal: 28 },
    potassium: { min: 150, max: 220, optimal: 185 }
  }
};

/**
 * Common fertilizer types and their NPK ratios
 */
export const FERTILIZER_TYPES = {
  'DAP': { n: 18, p: 46, k: 0, name: 'Di-ammonium Phosphate', useCase: 'Phosphorus deficiency, planting' },
  'NPK_17-17-17': { n: 17, p: 17, k: 17, name: 'NPK Balanced', useCase: 'General purpose' },
  'NPK_20-10-10': { n: 20, p: 10, k: 10, name: 'NPK High Nitrogen', useCase: 'Vegetative growth' },
  'UREA': { n: 46, p: 0, k: 0, name: 'Urea', useCase: 'Nitrogen deficiency' },
  'MOP': { n: 0, p: 0, k: 60, name: 'Muriate of Potash', useCase: 'Potassium deficiency' },
  'TSP': { n: 0, p: 46, k: 0, name: 'Triple Super Phosphate', useCase: 'Phosphorus deficiency' },
  'CAN': { n: 27, p: 0, k: 0, name: 'Calcium Ammonium Nitrate', useCase: 'Top dressing, nitrogen boost' }
};

/**
 * Analyze soil nutrients for a farm
 * @param {string} farmId - Farm UUID
 * @returns {Promise<Object>} Nutrient analysis results
 */
export const analyzeSoilNutrients = async (farmId) => {
  // Get farm details including growth stage
  const farm = await db.farms.getById(farmId);

  if (!farm) {
    throw new NotFoundError('Farm not found');
  }

  // Get latest NPK sensor readings
  const allReadings = await db.sensorData.getLatestReadings(farmId, 20);
  const latestReadings = (allReadings || [])
    .filter(r => r.is_valid && r.nitrogen != null)
    .slice(0, 5);

  if (!latestReadings || latestReadings.length === 0) {
    return {
      farmId,
      farmName: farm.name,
      status: 'no_data',
      message: 'No NPK sensor data available for analysis'
    };
  }

  // Calculate averages from recent readings
  const avgNitrogen = latestReadings.reduce((sum, r) => sum + (r.nitrogen || 0), 0) / latestReadings.length;
  const avgPhosphorus = latestReadings.reduce((sum, r) => sum + (r.phosphorus || 0), 0) / latestReadings.length;
  const avgPotassium = latestReadings.reduce((sum, r) => sum + (r.potassium || 0), 0) / latestReadings.length;
  const avgPh = latestReadings.reduce((sum, r) => sum + (r.ph_level || 6.5), 0) / latestReadings.length;

  // Get appropriate ranges for growth stage
  const growthStage = farm.current_growth_stage || 'vegetative';
  const ranges = NUTRIENT_RANGES[growthStage] || NUTRIENT_RANGES.vegetative;

  // Analyze each nutrient
  const analysis = {
    nitrogen: analyzeNutrient(avgNitrogen, ranges.nitrogen, 'Nitrogen'),
    phosphorus: analyzeNutrient(avgPhosphorus, ranges.phosphorus, 'Phosphorus'),
    potassium: analyzeNutrient(avgPotassium, ranges.potassium, 'Potassium'),
    ph: analyzePh(avgPh)
  };

  // Determine overall soil health score
  const healthScore = calculateSoilHealthScore(analysis);

  // Get fertilization history
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentApplications = await db.fertilizationSchedules.getHistory(farmId, since);

  return {
    farmId,
    farmName: farm.name,
    growthStage,
    sizeHectares: farm.size_hectares || 1,
    plantingDate: farm.planting_date,
    currentLevels: {
      nitrogen: Math.round(avgNitrogen * 100) / 100,
      phosphorus: Math.round(avgPhosphorus * 100) / 100,
      potassium: Math.round(avgPotassium * 100) / 100,
      ph: Math.round(avgPh * 100) / 100
    },
    targetRanges: ranges,
    analysis,
    healthScore,
    recentApplications: recentApplications || [],
    lastReadingAt: latestReadings[0].reading_timestamp,
    readingCount: latestReadings.length
  };
};

/**
 * Analyze individual nutrient level
 * @param {number} value - Current value
 * @param {Object} range - Acceptable range
 * @param {string} nutrient - Nutrient name
 * @returns {Object} Analysis result
 */
const analyzeNutrient = (value, range, nutrient) => {
  const deficit = range.min - value;
  const excess = value - range.max;

  let status, severity, recommendation;

  if (value < range.min) {
    status = 'deficient';
    severity = deficit > (range.optimal - range.min) ? 'high' : 'moderate';
    recommendation = `Apply ${nutrient.toLowerCase()}-rich fertilizer`;
  } else if (value > range.max) {
    status = 'excess';
    severity = excess > (range.max - range.optimal) ? 'high' : 'low';
    recommendation = `Reduce ${nutrient.toLowerCase()} application`;
  } else {
    status = 'optimal';
    severity = 'none';
    recommendation = 'Maintain current levels';
  }

  return {
    value: Math.round(value * 100) / 100,
    status,
    severity,
    range,
    deficit: Math.max(0, deficit),
    excess: Math.max(0, excess),
    recommendation
  };
};

/**
 * Analyze soil pH
 * @param {number} ph - pH value
 * @returns {Object} pH analysis
 */
const analyzePh = (ph) => {
  // Optimal pH for maize: 5.8 - 7.0
  const optimalMin = 5.8;
  const optimalMax = 7.0;

  let status, recommendation;

  if (ph < 5.5) {
    status = 'too_acidic';
    recommendation = 'Apply lime to raise soil pH';
  } else if (ph < optimalMin) {
    status = 'slightly_acidic';
    recommendation = 'Consider liming if pH continues to drop';
  } else if (ph > 7.5) {
    status = 'too_alkaline';
    recommendation = 'Apply sulfur or acidifying fertilizers';
  } else if (ph > optimalMax) {
    status = 'slightly_alkaline';
    recommendation = 'Monitor pH levels';
  } else {
    status = 'optimal';
    recommendation = 'pH is in optimal range';
  }

  return {
    value: Math.round(ph * 100) / 100,
    status,
    optimalRange: { min: optimalMin, max: optimalMax },
    recommendation
  };
};

/**
 * Calculate overall soil health score
 * @param {Object} analysis - Nutrient analysis results
 * @returns {Object} Health score
 */
const calculateSoilHealthScore = (analysis) => {
  let score = 100;
  const issues = [];

  // Deduct points for deficiencies and excesses
  ['nitrogen', 'phosphorus', 'potassium'].forEach(nutrient => {
    const a = analysis[nutrient];
    if (a.status === 'deficient') {
      score -= a.severity === 'high' ? 20 : 10;
      issues.push(`${nutrient} deficiency`);
    } else if (a.status === 'excess') {
      score -= a.severity === 'high' ? 15 : 5;
      issues.push(`${nutrient} excess`);
    }
  });

  // Deduct for pH issues
  if (analysis.ph.status === 'too_acidic' || analysis.ph.status === 'too_alkaline') {
    score -= 15;
    issues.push('pH imbalance');
  } else if (analysis.ph.status.startsWith('slightly_')) {
    score -= 5;
  }

  let rating;
  if (score >= 90) rating = 'excellent';
  else if (score >= 75) rating = 'good';
  else if (score >= 60) rating = 'fair';
  else if (score >= 40) rating = 'poor';
  else rating = 'critical';

  return {
    score: Math.max(0, score),
    rating,
    issues
  };
};

/**
 * Generate fertilization recommendation
 * @param {string} farmId - Farm UUID
 * @returns {Promise<Object>} Fertilization recommendation
 */
export const generateFertilizationRecommendation = async (farmId) => {
  const analysis = await analyzeSoilNutrients(farmId);

  if (analysis.status === 'no_data') {
    return {
      success: false,
      message: 'Insufficient data for fertilization recommendation'
    };
  }

  const { growthStage, sizeHectares, analysis: nutrientAnalysis, healthScore } = analysis;

  // Don't recommend if soil is healthy
  if (healthScore.score >= 85 && healthScore.issues.length === 0) {
    return {
      success: true,
      action: 'none',
      message: 'Soil nutrients are at optimal levels. No fertilization needed.',
      analysis
    };
  }

  // Determine primary deficiency
  const deficiencies = [];
  if (nutrientAnalysis.nitrogen.status === 'deficient') {
    deficiencies.push({ 
      nutrient: 'nitrogen', 
      deficit: nutrientAnalysis.nitrogen.deficit,
      severity: nutrientAnalysis.nitrogen.severity
    });
  }
  if (nutrientAnalysis.phosphorus.status === 'deficient') {
    deficiencies.push({ 
      nutrient: 'phosphorus', 
      deficit: nutrientAnalysis.phosphorus.deficit,
      severity: nutrientAnalysis.phosphorus.severity
    });
  }
  if (nutrientAnalysis.potassium.status === 'deficient') {
    deficiencies.push({ 
      nutrient: 'potassium', 
      deficit: nutrientAnalysis.potassium.deficit,
      severity: nutrientAnalysis.potassium.severity
    });
  }

  if (deficiencies.length === 0) {
    return {
      success: true,
      action: 'monitor',
      message: 'No significant deficiencies. Continue monitoring soil health.',
      analysis
    };
  }

  // Select appropriate fertilizer
  const fertilizerRecommendation = selectFertilizer(deficiencies, growthStage);

  // Calculate application rate (kg per hectare)
  const applicationRate = calculateApplicationRate(deficiencies, fertilizerRecommendation);
  const totalQuantity = Math.round(applicationRate * (sizeHectares || 1) * 100) / 100;

  // Create recommendation record
  const farm = await db.farms.getById(farmId);

  if (farm) {
    // Create fertilization schedule
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 1); // Schedule for tomorrow

    const schedule = await db.fertilizationSchedules.create({
      farm_id: farmId,
      scheduled_date: scheduledDate.toISOString().split('T')[0],
      fertilizer_type: fertilizerRecommendation.type,
      application_method: 'broadcast',
      nitrogen_kg: (fertilizerRecommendation.fertilizer.n / 100) * totalQuantity,
      phosphorus_kg: (fertilizerRecommendation.fertilizer.p / 100) * totalQuantity,
      potassium_kg: (fertilizerRecommendation.fertilizer.k / 100) * totalQuantity,
      total_quantity_kg: totalQuantity,
      growth_stage: growthStage,
      soil_npk_at_scheduling: analysis.currentLevels
    });

    // Create recommendation
    await recommendationService.createRecommendation({
      farmId,
      userId: farm.user_id,
      type: 'fertilization',
      priority: healthScore.score < 50 ? 'high' : 'medium',
      title: `Fertilization Recommended: ${fertilizerRecommendation.fertilizer.name}`,
      titleRw: `Ifumbire Irasabwa: ${fertilizerRecommendation.fertilizer.name}`,
      description: `Your soil analysis shows ${deficiencies.map(d => d.nutrient).join(', ')} deficiency. Apply ${totalQuantity} kg of ${fertilizerRecommendation.fertilizer.name} per ${sizeHectares || 1} hectare(s).`,
      descriptionRw: `Isuzuma ry'ubutaka ryerekanye ko ${deficiencies.map(d => d.nutrient).join(', ')} bikennye. Shyira ${totalQuantity} kg ya ${fertilizerRecommendation.fertilizer.name} kuri hegitari ${sizeHectares || 1}.`,
      recommendedAction: `Apply ${totalQuantity} kg of ${fertilizerRecommendation.type} within 2-3 days`,
      supportingData: {
        soilAnalysis: analysis.currentLevels,
        deficiencies,
        healthScore,
        applicationRate,
        fertilizerType: fertilizerRecommendation.type
      },
      fertilizationScheduleId: schedule?._id,
      confidenceScore: 0.85
    });
  }

  return {
    success: true,
    action: 'fertilize',
    recommendation: {
      fertilizer: fertilizerRecommendation.fertilizer.name,
      fertilizerType: fertilizerRecommendation.type,
      applicationRate: `${applicationRate} kg/hectare`,
      totalQuantity: `${totalQuantity} kg`,
      timing: 'Within 2-3 days',
      method: 'Broadcast application, followed by light irrigation',
      deficiencies: deficiencies.map(d => d.nutrient),
      npkRatio: `${fertilizerRecommendation.fertilizer.n}-${fertilizerRecommendation.fertilizer.p}-${fertilizerRecommendation.fertilizer.k}`
    },
    analysis,
    message: `Apply ${totalQuantity} kg of ${fertilizerRecommendation.fertilizer.name} to address ${deficiencies.map(d => d.nutrient).join(' and ')} deficiency.`
  };
};

/**
 * Select appropriate fertilizer based on deficiencies
 * @param {Array} deficiencies - Nutrient deficiencies
 * @param {string} growthStage - Current growth stage
 * @returns {Object} Fertilizer recommendation
 */
const selectFertilizer = (deficiencies, growthStage) => {
  const hasN = deficiencies.find(d => d.nutrient === 'nitrogen');
  const hasP = deficiencies.find(d => d.nutrient === 'phosphorus');
  const hasK = deficiencies.find(d => d.nutrient === 'potassium');

  // Multiple deficiencies - use balanced NPK
  if ((hasN && hasP) || (hasN && hasK) || (hasP && hasK)) {
    if (hasN?.severity === 'high') {
      return { type: 'NPK_20-10-10', fertilizer: FERTILIZER_TYPES['NPK_20-10-10'] };
    }
    return { type: 'NPK_17-17-17', fertilizer: FERTILIZER_TYPES['NPK_17-17-17'] };
  }

  // Single nutrient deficiency
  if (hasN) {
    // Use CAN for top dressing in vegetative/flowering, UREA otherwise
    if (growthStage === 'vegetative' || growthStage === 'flowering') {
      return { type: 'CAN', fertilizer: FERTILIZER_TYPES['CAN'] };
    }
    return { type: 'UREA', fertilizer: FERTILIZER_TYPES['UREA'] };
  }

  if (hasP) {
    // DAP for early stages, TSP for later
    if (growthStage === 'germination' || growthStage === 'vegetative') {
      return { type: 'DAP', fertilizer: FERTILIZER_TYPES['DAP'] };
    }
    return { type: 'TSP', fertilizer: FERTILIZER_TYPES['TSP'] };
  }

  if (hasK) {
    return { type: 'MOP', fertilizer: FERTILIZER_TYPES['MOP'] };
  }

  // Default to balanced
  return { type: 'NPK_17-17-17', fertilizer: FERTILIZER_TYPES['NPK_17-17-17'] };
};

/**
 * Calculate fertilizer application rate
 * @param {Array} deficiencies - Nutrient deficiencies
 * @param {Object} fertilizer - Selected fertilizer
 * @returns {number} Application rate in kg/hectare
 */
const calculateApplicationRate = (deficiencies, fertilizerRec) => {
  const { fertilizer } = fertilizerRec;
  
  // Base rates per hectare by growth stage (kg/ha)
  const baseRates = {
    nitrogen: 50, // kg N/ha typically needed
    phosphorus: 25, // kg P2O5/ha
    potassium: 40  // kg K2O/ha
  };

  let targetNutrientKg = 0;

  // Find the limiting nutrient and calculate based on that
  deficiencies.forEach(d => {
    const rate = baseRates[d.nutrient] * (d.severity === 'high' ? 1.2 : 1.0);
    if (d.nutrient === 'nitrogen' && fertilizer.n > 0) {
      const needed = rate / (fertilizer.n / 100);
      if (needed > targetNutrientKg) {
        targetNutrientKg = needed;
      }
    }
    if (d.nutrient === 'phosphorus' && fertilizer.p > 0) {
      const needed = rate / (fertilizer.p / 100);
      if (needed > targetNutrientKg) {
        targetNutrientKg = needed;
      }
    }
    if (d.nutrient === 'potassium' && fertilizer.k > 0) {
      const needed = rate / (fertilizer.k / 100);
      if (needed > targetNutrientKg) {
        targetNutrientKg = needed;
      }
    }
  });

  // Clamp to reasonable range (50-300 kg/ha)
  return Math.max(50, Math.min(300, Math.round(targetNutrientKg)));
};

/**
 * Get fertilization history for a farm
 * @param {string} farmId - Farm UUID
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Fertilization history
 */
export const getFertilizationHistory = async (farmId, days = 90) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const data = await db.fertilizationSchedules.getHistory(farmId, startDate.getTime());

  // Calculate totals
  const totals = (data || []).reduce((acc, app) => {
    if (app.is_executed) {
      acc.nitrogen += app.nitrogen_kg || 0;
      acc.phosphorus += app.phosphorus_kg || 0;
      acc.potassium += app.potassium_kg || 0;
      acc.total += app.total_quantity_kg || 0;
      acc.executedCount++;
    }
    return acc;
  }, { nitrogen: 0, phosphorus: 0, potassium: 0, total: 0, executedCount: 0 });

  return {
    applications: data || [],
    period: { days, startDate: startDate.toISOString() },
    totals: {
      nitrogen: Math.round(totals.nitrogen * 100) / 100,
      phosphorus: Math.round(totals.phosphorus * 100) / 100,
      potassium: Math.round(totals.potassium * 100) / 100,
      totalQuantity: Math.round(totals.total * 100) / 100,
      applicationCount: totals.executedCount
    }
  };
};

/**
 * Mark fertilization as executed
 * @param {string} scheduleId - Schedule UUID
 * @param {Object} executionData - Execution details
 * @returns {Promise<Object>} Updated schedule
 */
export const markFertilizationExecuted = async (scheduleId, executionData = {}) => {
  const { actualQuantity, notes, executedBy } = executionData;

  const data = await db.fertilizationSchedules.update(scheduleId, {
    is_executed: true,
    executed_at: Date.now(),
    actual_quantity_kg: actualQuantity,
    notes
  });

  if (!data) {
    throw new NotFoundError('Fertilization schedule not found');
  }

  logger.info(`Fertilization marked as executed: ${scheduleId}`);
  return data;
};

export default {
  analyzeSoilNutrients,
  generateFertilizationRecommendation,
  getFertilizationHistory,
  markFertilizationExecuted,
  FERTILIZER_TYPES,
  NUTRIENT_RANGES
};
