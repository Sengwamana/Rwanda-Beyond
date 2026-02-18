/**
 * AI Routes - Google Gemini Powered Agricultural Intelligence
 * 
 * Provides endpoints for:
 * - Agricultural advice and Q&A
 * - Crop image analysis
 * - AI service health monitoring
 */

import { Router } from 'express';
import { body, query } from 'express-validator';
import { validateRequest } from '../middleware/validation.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import * as aiService from '../services/aiService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * @route GET /api/v1/ai/health
 * @desc Check AI service health status
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    const health = await aiService.checkAIServiceHealth();
    
    return successResponse(res, health, 
      health.status === 'healthy' ? 'AI service is healthy' : 'AI service is degraded'
    );
  } catch (error) {
    logger.error('AI health check failed:', error);
    return errorResponse(res, 'Failed to check AI service health', 500);
  }
});

/**
 * @route POST /api/v1/ai/advice
 * @desc Get AI-powered agricultural advice
 * @access Private
 */
router.post('/advice',
  authenticate,
  [
    body('question')
      .notEmpty()
      .withMessage('Question is required')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Question must be between 10 and 1000 characters'),
    body('context')
      .optional()
      .isObject()
      .withMessage('Context must be an object'),
    body('context.cropType')
      .optional()
      .isString(),
    body('context.location')
      .optional()
      .isString(),
    body('context.growthStage')
      .optional()
      .isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { question, context = {} } = req.body;
      
      // Add user context
      const enrichedContext = {
        ...context,
        userId: req.auth?.userId,
        language: req.headers['accept-language'] || 'en'
      };
      
      const advice = await aiService.getAgriculturalAdvice(question, enrichedContext);
      
      return successResponse(res, advice, 'Agricultural advice generated successfully');
    } catch (error) {
      logger.error('Agricultural advice failed:', error);
      return errorResponse(res, error.message || 'Failed to generate advice', 500);
    }
  }
);

/**
 * @route POST /api/v1/ai/analyze-image
 * @desc Analyze farm/crop image for general health assessment
 * @access Private
 */
router.post('/analyze-image',
  authenticate,
  [
    body('imageUrl')
      .notEmpty()
      .withMessage('Image URL is required')
      .isURL()
      .withMessage('Must be a valid URL'),
    body('context')
      .optional()
      .isObject(),
    body('context.cropType')
      .optional()
      .isString(),
    body('context.expectedGrowthStage')
      .optional()
      .isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { imageUrl, context = {} } = req.body;
      
      const analysis = await aiService.analyzeFarmImage(imageUrl, context);
      
      return successResponse(res, analysis, 'Image analyzed successfully');
    } catch (error) {
      logger.error('Image analysis failed:', error);
      return errorResponse(res, error.message || 'Failed to analyze image', 500);
    }
  }
);

/**
 * @route POST /api/v1/ai/chat
 * @desc Interactive chat with agricultural AI assistant
 * @access Private
 */
router.post('/chat',
  authenticate,
  [
    body('message')
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ min: 1, max: 2000 })
      .withMessage('Message must be between 1 and 2000 characters'),
    body('conversationHistory')
      .optional()
      .isArray()
      .withMessage('Conversation history must be an array'),
    body('farmId')
      .optional()
      .isUUID()
      .withMessage('Farm ID must be a valid UUID')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { message, conversationHistory = [], farmId } = req.body;
      
      // Build context from conversation history and farm data
      const context = {
        conversationHistory: conversationHistory.slice(-10), // Last 10 messages
        userId: req.auth?.userId
      };
      
      // If farm ID provided, get farm context
      if (farmId) {
        // TODO: Fetch farm details and add to context
        context.farmId = farmId;
      }
      
      const response = await aiService.getAgriculturalAdvice(message, context);
      
      return successResponse(res, {
        reply: response.answer,
        suggestions: response.suggestions,
        confidence: response.confidence
      }, 'Response generated');
    } catch (error) {
      logger.error('AI chat failed:', error);
      return errorResponse(res, error.message || 'Failed to process message', 500);
    }
  }
);

/**
 * @route GET /api/v1/ai/capabilities
 * @desc Get AI service capabilities and supported features
 * @access Public
 */
router.get('/capabilities', (req, res) => {
  const capabilities = {
    provider: 'Google Gemini',
    model: 'gemini-1.5-flash',
    features: [
      {
        name: 'Agricultural Advice',
        endpoint: '/api/v1/ai/advice',
        description: 'Get expert agricultural guidance for maize farming in Rwanda'
      },
      {
        name: 'Image Analysis',
        endpoint: '/api/v1/ai/analyze-image',
        description: 'Analyze crop images for health assessment and issues'
      },
      {
        name: 'Pest Detection',
        endpoint: '/api/v1/pest-detection/analyze',
        description: 'Detect Fall Armyworm and other pests from images'
      },
      {
        name: 'Irrigation Recommendations',
        endpoint: '/api/v1/recommendations/irrigation/{farmId}',
        description: 'AI-powered irrigation scheduling based on sensor data'
      },
      {
        name: 'Fertilization Recommendations',
        endpoint: '/api/v1/recommendations/fertilization/{farmId}',
        description: 'Nutrient analysis and fertilization guidance'
      },
      {
        name: 'Interactive Chat',
        endpoint: '/api/v1/ai/chat',
        description: 'Conversational AI assistant for farming questions'
      }
    ],
    supportedLanguages: ['English', 'Kinyarwanda (partial)'],
    supportedCrops: ['Maize'],
    regions: ['Rwanda - All Districts']
  };
  
  return successResponse(res, capabilities, 'AI capabilities retrieved');
});

/**
 * @route POST /api/v1/ai/translate
 * @desc Translate agricultural terms between English and Kinyarwanda
 * @access Public (rate limited)
 */
router.post('/translate',
  optionalAuth,
  [
    body('text')
      .notEmpty()
      .withMessage('Text is required')
      .isLength({ max: 500 })
      .withMessage('Text must be under 500 characters'),
    body('targetLanguage')
      .isIn(['en', 'rw'])
      .withMessage('Target language must be "en" or "rw"')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { text, targetLanguage } = req.body;
      
      const context = {
        task: 'translation',
        targetLanguage: targetLanguage === 'rw' ? 'Kinyarwanda' : 'English',
        domain: 'agriculture'
      };
      
      const prompt = targetLanguage === 'rw' 
        ? `Translate the following agricultural text to Kinyarwanda. Provide only the translation: "${text}"`
        : `Translate the following Kinyarwanda agricultural text to English. Provide only the translation: "${text}"`;
      
      const response = await aiService.getAgriculturalAdvice(prompt, context);
      
      return successResponse(res, {
        original: text,
        translated: response.answer,
        targetLanguage
      }, 'Translation completed');
    } catch (error) {
      logger.error('Translation failed:', error);
      return errorResponse(res, 'Translation failed', 500);
    }
  }
);

export default router;
