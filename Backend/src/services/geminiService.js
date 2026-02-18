/**
 * Gemini AI Service
 * 
 * Handles integration with Google's Gemini API for AI-powered features:
 * - Pest detection and image analysis
 * - Irrigation recommendations
 * - Fertilization guidance
 * - Natural language agricultural advice
 * 
 * @module services/geminiService
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { AIServiceError } from '../utils/errors.js';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);

// Safety settings for agricultural content
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

// Generation config for consistent outputs
const generationConfig = {
  temperature: 0.4,
  topK: 32,
  topP: 0.95,
  maxOutputTokens: 4096,
};

/**
 * Get the Gemini model instance
 * @param {boolean} useVision - Whether to use vision-capable model
 * @returns {GenerativeModel} Gemini model instance
 */
const getModel = (useVision = false) => {
  const modelName = useVision ? 'gemini-1.5-flash' : config.ai.geminiModel;
  return genAI.getGenerativeModel({ 
    model: modelName,
    safetySettings,
    generationConfig
  });
};

/**
 * Analyze pest image using Gemini Vision
 * @param {string} imageUrl - URL of the image to analyze
 * @param {Object} context - Additional context about the farm
 * @returns {Promise<Object>} Analysis results
 */
export const analyzePestImage = async (imageUrl, context = {}) => {
  try {
    logger.info('Analyzing pest image with Gemini Vision', { imageUrl });

    // Download image and convert to base64
    const imageData = await fetchImageAsBase64(imageUrl);
    
    const model = getModel(true);

    const prompt = `You are an expert agricultural AI specialized in maize crop pest detection, specifically Fall Armyworm (Spodoptera frugiperda) identification in Rwanda.

Analyze this maize crop image and provide a detailed assessment in JSON format.

Context:
- Farm Location: ${context.location || 'Rwanda'}
- Growth Stage: ${context.growthStage || 'Unknown'}
- Notes: ${context.notes || 'None'}

Please analyze the image and respond ONLY with a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "pest_detected": boolean,
  "pest_type": "fall_armyworm" | "stem_borer" | "aphids" | "leaf_blight" | "other" | null,
  "confidence": number between 0 and 1,
  "affected_area": number between 0 and 100 (percentage),
  "severity": "none" | "low" | "moderate" | "high" | "severe",
  "symptoms_observed": ["list of visible symptoms"],
  "recommendations": ["list of recommended actions"],
  "urgency": "none" | "low" | "medium" | "high" | "critical",
  "additional_notes": "any other observations"
}

Be precise and conservative in your assessment. Only report pest detection if you have reasonable confidence.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.base64
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Parse JSON response
    const analysis = parseJsonResponse(text);

    logger.info('Gemini pest analysis complete', { 
      pestDetected: analysis.pest_detected,
      confidence: analysis.confidence 
    });

    return {
      pest_detected: analysis.pest_detected || false,
      pest_type: analysis.pest_type || null,
      confidence: analysis.confidence || 0,
      affected_area: analysis.affected_area || 0,
      severity: analysis.severity || 'none',
      symptoms: analysis.symptoms_observed || [],
      recommendations: analysis.recommendations || [],
      urgency: analysis.urgency || 'none',
      notes: analysis.additional_notes || '',
      model_version: 'gemini-1.5-flash',
      metadata: {
        provider: 'google-gemini',
        analyzed_at: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Gemini pest analysis failed:', error);
    throw new AIServiceError(`Pest image analysis failed: ${error.message}`);
  }
};

/**
 * Get irrigation recommendation using Gemini
 * @param {Object} data - Sensor and weather data
 * @returns {Promise<Object>} Irrigation recommendation
 */
export const getIrrigationRecommendation = async (data) => {
  try {
    const model = getModel(false);

    const prompt = `You are an expert agricultural AI advisor for maize farming in Rwanda. Analyze the following sensor data and weather conditions to provide irrigation recommendations.

SENSOR DATA:
- Soil Moisture: ${data.soilMoisture}% (Optimal range: 40-60%)
- Soil Temperature: ${data.soilTemperature || 'N/A'}°C
- Air Temperature: ${data.airTemperature || 'N/A'}°C  
- Humidity: ${data.humidity || 'N/A'}%
- Last Irrigation: ${data.lastIrrigation || 'Unknown'}

WEATHER FORECAST (Next 3 days):
${data.weatherForecast ? JSON.stringify(data.weatherForecast, null, 2) : 'Not available'}

FARM DETAILS:
- Growth Stage: ${data.growthStage || 'Unknown'}
- Farm Size: ${data.farmSize || 1} hectares
- Soil Type: ${data.soilType || 'Unknown'}

Provide your recommendation as a JSON object (no markdown, no code blocks):
{
  "needs_irrigation": boolean,
  "urgency": "none" | "low" | "medium" | "high" | "critical",
  "recommended_time": "HH:MM format",
  "duration_minutes": number,
  "water_volume_liters": number,
  "confidence": number between 0 and 1,
  "reasoning": "explanation of the recommendation",
  "weather_consideration": "how weather affects the decision",
  "growth_stage_notes": "specific notes for current growth stage",
  "delay_if_rain": boolean,
  "next_check_hours": number
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const recommendation = parseJsonResponse(text);

    return {
      needsIrrigation: recommendation.needs_irrigation || false,
      urgency: recommendation.urgency || 'none',
      recommendedTime: recommendation.recommended_time || '06:00',
      duration: recommendation.duration_minutes || 0,
      waterVolume: recommendation.water_volume_liters || 0,
      confidence: recommendation.confidence || 0.5,
      reasoning: recommendation.reasoning || '',
      weatherConsideration: recommendation.weather_consideration || '',
      growthStageNotes: recommendation.growth_stage_notes || '',
      delayIfRain: recommendation.delay_if_rain || false,
      nextCheckHours: recommendation.next_check_hours || 24,
      model: 'gemini',
      analyzedAt: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Gemini irrigation recommendation failed:', error);
    throw new AIServiceError(`Irrigation recommendation failed: ${error.message}`);
  }
};

/**
 * Get fertilization recommendation using Gemini
 * @param {Object} data - Nutrient and soil data
 * @returns {Promise<Object>} Fertilization recommendation
 */
export const getFertilizationRecommendation = async (data) => {
  try {
    const model = getModel(false);

    const prompt = `You are an expert agricultural AI advisor for maize farming in Rwanda. Analyze the following soil nutrient data and provide fertilization recommendations.

SOIL NUTRIENT DATA:
- Nitrogen (N): ${data.nitrogen || 'N/A'} mg/kg (Optimal: 40-60 mg/kg)
- Phosphorus (P): ${data.phosphorus || 'N/A'} mg/kg (Optimal: 25-40 mg/kg)
- Potassium (K): ${data.potassium || 'N/A'} mg/kg (Optimal: 150-250 mg/kg)
- pH Level: ${data.phLevel || 'N/A'} (Optimal: 5.5-7.0)

FARM DETAILS:
- Growth Stage: ${data.growthStage || 'Unknown'}
- Farm Size: ${data.farmSize || 1} hectares
- Soil Type: ${data.soilType || 'Unknown'}
- Previous Application: ${data.lastFertilization || 'Unknown'}

Available fertilizers in Rwanda:
- Urea (46-0-0)
- DAP (18-46-0)
- NPK (17-17-17)
- MOP/KCl (0-0-60)
- CAN (27-0-0)

Provide your recommendation as a JSON object (no markdown, no code blocks):
{
  "needs_fertilization": boolean,
  "urgency": "none" | "low" | "medium" | "high" | "critical",
  "deficiencies": [
    {
      "nutrient": "Nitrogen" | "Phosphorus" | "Potassium",
      "current_level": number,
      "target_level": number,
      "severity": "mild" | "moderate" | "severe"
    }
  ],
  "recommended_fertilizer": "fertilizer name",
  "application_rate_kg_per_hectare": number,
  "total_quantity_kg": number,
  "application_method": "broadcasting" | "side_dressing" | "foliar_spray",
  "timing": "recommended application time/conditions",
  "confidence": number between 0 and 1,
  "reasoning": "explanation",
  "precautions": ["list of precautions"],
  "cost_estimate_rwf": number (optional estimate)
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const recommendation = parseJsonResponse(text);

    return {
      needsFertilization: recommendation.needs_fertilization || false,
      urgency: recommendation.urgency || 'none',
      deficiencies: recommendation.deficiencies || [],
      recommendedFertilizer: recommendation.recommended_fertilizer || 'NPK',
      applicationRate: recommendation.application_rate_kg_per_hectare || 0,
      totalQuantity: recommendation.total_quantity_kg || 0,
      applicationMethod: recommendation.application_method || 'broadcasting',
      timing: recommendation.timing || '',
      confidence: recommendation.confidence || 0.5,
      reasoning: recommendation.reasoning || '',
      precautions: recommendation.precautions || [],
      costEstimate: recommendation.cost_estimate_rwf || null,
      model: 'gemini',
      analyzedAt: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Gemini fertilization recommendation failed:', error);
    throw new AIServiceError(`Fertilization recommendation failed: ${error.message}`);
  }
};

/**
 * Get agricultural advice via chat
 * @param {string} question - Farmer's question
 * @param {Object} context - Farm context
 * @returns {Promise<Object>} AI response
 */
export const getAgriculturalAdvice = async (question, context = {}) => {
  try {
    const model = getModel(false);

    const systemPrompt = `You are a helpful agricultural AI assistant specialized in maize farming in Rwanda. You provide practical, actionable advice to smallholder farmers.

Context about the farmer:
- Location: ${context.district || 'Rwanda'}
- Farm Size: ${context.farmSize || 'Unknown'} hectares
- Current Growth Stage: ${context.growthStage || 'Unknown'}
- Language Preference: ${context.language || 'English'}

Guidelines:
1. Provide clear, practical advice suitable for smallholder farmers
2. Consider local conditions in Rwanda
3. Be concise but thorough
4. If asked about pests, emphasize Fall Armyworm awareness
5. Include cost-effective solutions when possible
6. Mention if professional help is needed

Respond in ${context.language === 'rw' ? 'Kinyarwanda' : context.language === 'fr' ? 'French' : 'English'}.`;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `Farmer's Question: ${question}` }
    ]);

    const response = await result.response;
    const advice = response.text();

    return {
      question,
      answer: advice,
      language: context.language || 'en',
      model: 'gemini',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Gemini agricultural advice failed:', error);
    throw new AIServiceError(`Failed to get agricultural advice: ${error.message}`);
  }
};

/**
 * Analyze multiple images for comprehensive farm assessment
 * @param {string[]} imageUrls - Array of image URLs
 * @param {Object} context - Farm context
 * @returns {Promise<Object>} Comprehensive assessment
 */
export const analyzeFarmImages = async (imageUrls, context = {}) => {
  try {
    const model = getModel(true);
    
    // Fetch all images
    const imageDataPromises = imageUrls.slice(0, 4).map(url => fetchImageAsBase64(url));
    const imagesData = await Promise.all(imageDataPromises);

    const prompt = `You are an expert agricultural AI analyzing multiple images from a maize farm in Rwanda.

Context:
- Farm Location: ${context.district || 'Rwanda'}
- Growth Stage: ${context.growthStage || 'Unknown'}
- Recent Weather: ${context.recentWeather || 'Unknown'}

Analyze all images and provide a comprehensive farm health assessment as JSON (no markdown):
{
  "overall_health": "excellent" | "good" | "fair" | "poor" | "critical",
  "health_score": number between 0 and 100,
  "issues_detected": [
    {
      "type": "pest" | "disease" | "nutrient_deficiency" | "water_stress" | "physical_damage",
      "name": "specific issue name",
      "severity": "low" | "moderate" | "high" | "severe",
      "affected_percentage": number,
      "image_index": number
    }
  ],
  "positive_observations": ["list of good signs"],
  "immediate_actions": ["urgent actions needed"],
  "preventive_measures": ["preventive recommendations"],
  "growth_assessment": "assessment of crop development",
  "yield_forecast": "estimated yield impact",
  "confidence": number between 0 and 1
}`;

    const content = [
      prompt,
      ...imagesData.map(img => ({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64
        }
      }))
    ];

    const result = await model.generateContent(content);
    const response = await result.response;
    const text = response.text();
    
    const assessment = parseJsonResponse(text);

    return {
      overallHealth: assessment.overall_health || 'unknown',
      healthScore: assessment.health_score || 0,
      issuesDetected: assessment.issues_detected || [],
      positiveObservations: assessment.positive_observations || [],
      immediateActions: assessment.immediate_actions || [],
      preventiveMeasures: assessment.preventive_measures || [],
      growthAssessment: assessment.growth_assessment || '',
      yieldForecast: assessment.yield_forecast || '',
      confidence: assessment.confidence || 0.5,
      imagesAnalyzed: imageUrls.length,
      model: 'gemini-1.5-flash',
      analyzedAt: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Gemini farm assessment failed:', error);
    throw new AIServiceError(`Farm assessment failed: ${error.message}`);
  }
};

/**
 * Fetch image from URL and convert to base64
 * @param {string} url - Image URL
 * @returns {Promise<Object>} Base64 image data with mime type
 */
const fetchImageAsBase64 = async (url) => {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    const base64 = Buffer.from(response.data).toString('base64');
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    return {
      base64,
      mimeType: contentType
    };
  } catch (error) {
    logger.error('Failed to fetch image:', error);
    throw new Error(`Failed to fetch image from URL: ${error.message}`);
  }
};

/**
 * Parse JSON response from Gemini, handling potential formatting issues
 * @param {string} text - Raw text response
 * @returns {Object} Parsed JSON object
 */
const parseJsonResponse = (text) => {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    
    // Try to find JSON object in text
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    
    logger.error('Failed to parse Gemini response:', text);
    throw new Error('Invalid JSON response from Gemini');
  }
};

/**
 * Check if Gemini service is available
 * @returns {Promise<boolean>} Service availability
 */
export const checkServiceHealth = async () => {
  try {
    const model = getModel(false);
    const result = await model.generateContent('Respond with only the word "OK"');
    const response = await result.response;
    return response.text().toLowerCase().includes('ok');
  } catch (error) {
    logger.error('Gemini health check failed:', error);
    return false;
  }
};

export default {
  analyzePestImage,
  getIrrigationRecommendation,
  getFertilizationRecommendation,
  getAgriculturalAdvice,
  analyzeFarmImages,
  checkServiceHealth
};
