/**
 * USSD Routes
 * 
 * Africa's Talking USSD callback handler for feature phone access.
 * Provides menu-driven interface for farmers to access recommendations,
 * farm status, weather forecasts, and system settings.
 * 
 * @module routes/ussd
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { handleUssdRequest } from '../services/ussdService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * @route POST /api/v1/ussd/callback
 * @desc Africa's Talking USSD callback endpoint
 * @access Public (validated by Africa's Talking)
 * 
 * USSD text format:
 * - Empty string "" for initial request
 * - "1" for first menu selection
 * - "1*2" for nested selection (1 then 2)
 * 
 * Menu Structure:
 * 1. View Recommendations - List and respond to pending recommendations
 * 2. Farm Status - View sensor readings and irrigation schedule
 * 3. Weather Forecast - Get local weather information
 * 4. Report Pest - Instructions for reporting pest issues
 * 5. Settings - Language and preferences
 * 0. Exit
 */
router.post('/callback',
  asyncHandler(async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;

    logger.info('USSD callback received', {
      sessionId,
      serviceCode,
      phoneNumber: phoneNumber?.slice(-4), // Log only last 4 digits for privacy
      text,
      timestamp: new Date().toISOString()
    });

    // Process USSD request through USSD service
    const response = await handleUssdRequest({
      sessionId,
      serviceCode,
      phoneNumber,
      text: text || ''
    });

    // USSD response format:
    // CON = Continue session (expect more input)
    // END = End session
    res.set('Content-Type', 'text/plain');
    res.send(response);
  })
);

/**
 * @route POST /api/v1/ussd/callback/v2
 * @desc Enhanced USSD callback with language detection
 * @access Public (validated by Africa's Talking)
 */
router.post('/callback/v2',
  asyncHandler(async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text, networkCode } = req.body;

    // Detect preferred language from previous interactions or default to Kinyarwanda
    const language = await detectUserLanguage(phoneNumber);

    logger.info('USSD v2 callback received', {
      sessionId,
      phoneNumber: phoneNumber?.slice(-4),
      text,
      language,
      networkCode
    });

    const response = await handleUssdRequest({
      sessionId,
      serviceCode,
      phoneNumber,
      text: text || '',
      language,
      networkCode
    });

    res.set('Content-Type', 'text/plain');
    res.send(response);
  })
);

/**
 * Detect user's preferred language from database
 * @param {string} phoneNumber - User's phone number
 * @returns {Promise<string>} Language code (en, rw, or fr)
 */
async function detectUserLanguage(phoneNumber) {
  try {
    const { db } = await import('../database/convex.js');
    const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
    
    const user = await db.users.getByPhone(cleanPhone);

    return user?.preferred_language || 'rw'; // Default to Kinyarwanda
  } catch {
    return 'rw';
  }
}

/**
 * @route GET /api/v1/ussd/health
 * @desc Health check for USSD service
 * @access Public
 */
router.get('/health',
  (req, res) => {
    res.json({
      status: 'ok',
      service: 'ussd',
      timestamp: new Date().toISOString()
    });
  }
);

export default router;
