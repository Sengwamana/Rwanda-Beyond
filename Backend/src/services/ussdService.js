/**
 * USSD Service
 * 
 * Handles USSD session management, menu navigation, and farmer interactions
 * through feature phones. Supports multiple languages (English, Kinyarwanda).
 * 
 * @module services/ussdService
 */

import { db } from '../database/convex.js';
import logger from '../utils/logger.js';
import * as recommendationService from './recommendationService.js';

/**
 * USSD Menu translations
 */
export const TRANSLATIONS = {
  en: {
    welcome: 'Welcome to SmartMaize\n\n1. View Recommendations\n2. Farm Status\n3. Weather Forecast\n4. Report Pest\n5. Settings\n0. Exit',
    welcomeRegistered: 'Welcome back, {name}!\n\n1. View Recommendations ({count} pending)\n2. Farm Status\n3. Weather Forecast\n4. Report Pest\n5. Settings\n0. Exit',
    noRecommendations: 'You have no pending recommendations.\n\n0. Back to menu',
    recommendations: 'Pending Recommendations:\n\n{list}\n\n0. Back',
    recommendationDetail: '{title}\n\n{description}\n\nAction: {action}\n\n1. Accept\n2. Reject\n3. Defer\n0. Back',
    farmStatus: 'Farm: {name}\n\nSoil Moisture: {moisture}%\nTemperature: {temp}°C\nLast Update: {lastUpdate}\n\n1. Irrigation Schedule\n2. Sensor Details\n0. Back',
    noFarms: 'No farms registered. Please contact support to register your farm.\n\n0. Back',
    weatherForecast: 'Weather for {location}:\n\nToday: {today}\nTomorrow: {tomorrow}\nRain Chance: {rainChance}%\n\n0. Back',
    reportPest: 'To report a pest issue:\n\n1. SMS photo to {number}\n2. Call hotline: {hotline}\n\nOr describe the issue:\n0. Back',
    settings: 'Settings:\n\n1. Change Language\n2. Update Phone\n3. Help\n0. Back',
    languageSelect: 'Select Language:\n\n1. English\n2. Kinyarwanda\n3. Français\n0. Back',
    languageChanged: 'Language updated to English.\n\n0. Back',
    acceptConfirm: 'Recommendation accepted. We will proceed with the recommended action.\n\n0. Back',
    rejectConfirm: 'Recommendation rejected. Please share your reason:\n\n1. Not suitable for my farm\n2. Weather conditions\n3. Resource constraints\n4. Other\n0. Skip',
    deferConfirm: 'Recommendation deferred.\n\nDefer until:\n1. Tomorrow\n2. Next week\n3. Custom date\n0. Back',
    goodbye: 'Thank you for using SmartMaize. Murakoze!',
    error: 'An error occurred. Please try again.\n\n0. Back',
    invalidOption: 'Invalid option. Please try again.',
    help: 'SmartMaize Help:\n\nFor support call: {hotline}\nSMS: {sms}\nEmail: support@smartmaize.rw\n\n0. Back',
    irrigationSchedule: 'Upcoming Irrigation:\n\n{schedule}\n\n0. Back',
    noIrrigation: 'No irrigation scheduled.\n\n0. Back'
  },
  rw: {
    welcome: 'Murakaza neza kuri SmartMaize\n\n1. Reba Inama\n2. Imiterere y\'Umurima\n3. Iteganyagihe\n4. Menyesha Ibyonnyi\n5. Igenamiterere\n0. Sohoka',
    welcomeRegistered: 'Murakaza neza, {name}!\n\n1. Reba Inama ({count} zitegereje)\n2. Imiterere y\'Umurima\n3. Iteganyagihe\n4. Menyesha Ibyonnyi\n5. Igenamiterere\n0. Sohoka',
    noRecommendations: 'Nta nama zitegereje.\n\n0. Subira inyuma',
    recommendations: 'Inama Zitegereje:\n\n{list}\n\n0. Subira',
    recommendationDetail: '{title}\n\n{description}\n\nIgikorwa: {action}\n\n1. Emera\n2. Hakanira\n3. Subiza\n0. Subira',
    farmStatus: 'Umurima: {name}\n\nUbuhehere bw\'ubutaka: {moisture}%\nUbushyuhe: {temp}°C\nIheruka: {lastUpdate}\n\n1. Gahunda yo Kuhira\n2. Amakuru y\'Ibikoresho\n0. Subira',
    noFarms: 'Nta murima wanditswe. Hamagara serivisi kugira ngo wandikishe.\n\n0. Subira',
    weatherForecast: 'Ikirere i {location}:\n\nUyu munsi: {today}\nEjo: {tomorrow}\nAmahirwe y\'imvura: {rainChance}%\n\n0. Subira',
    reportPest: 'Kugira ngo umenyeshe ibyonnyi:\n\n1. Ohereza ifoto kuri {number}\n2. Hamagara: {hotline}\n\nCyangwa sobanura ikibazo:\n0. Subira',
    settings: 'Igenamiterere:\n\n1. Hindura Ururimi\n2. Hindura Telefone\n3. Ubufasha\n0. Subira',
    languageSelect: 'Hitamo Ururimi:\n\n1. English\n2. Ikinyarwanda\n3. Igifaransa\n0. Subira',
    languageChanged: 'Ururimi rwahindutse neza.\n\n0. Subira',
    acceptConfirm: 'Inama yemewe. Tuzakomeza n\'igikorwa cyasabwe.\n\n0. Subira',
    rejectConfirm: 'Inama yahakanwe. Tugire impamvu:\n\n1. Ntabwo ihwanye n\'umurima wanjye\n2. Imiterere y\'ikirere\n3. Ibikoresho bike\n4. Ibindi\n0. Simbuka',
    deferConfirm: 'Inama yasubijwe.\n\nSubiza kugeza:\n1. Ejo\n2. Icyumweru gitaha\n3. Itariki yihariye\n0. Subira',
    goodbye: 'Murakoze gukoresha SmartMaize!',
    error: 'Habayeho ikosa. Ongera ugerageze.\n\n0. Subira',
    invalidOption: 'Ihitamo ritemewe. Ongera ugerageze.',
    help: 'Ubufasha bwa SmartMaize:\n\nHamagara: {hotline}\nSMS: {sms}\nEmail: support@smartmaize.rw\n\n0. Subira',
    irrigationSchedule: 'Gahunda yo Kuhira:\n\n{schedule}\n\n0. Subira',
    noIrrigation: 'Nta gahunda yo kuhira.\n\n0. Subira'
  },
  fr: {
    welcome: 'Bienvenue sur SmartMaize\n\n1. Voir Recommandations\n2. État de la Ferme\n3. Prévisions Météo\n4. Signaler Ravageur\n5. Paramètres\n0. Quitter',
    welcomeRegistered: 'Bienvenue, {name}!\n\n1. Recommandations ({count} en attente)\n2. État de la Ferme\n3. Prévisions Météo\n4. Signaler Ravageur\n5. Paramètres\n0. Quitter',
    goodbye: 'Merci d\'utiliser SmartMaize!',
    error: 'Une erreur s\'est produite. Veuillez réessayer.\n\n0. Retour'
  }
};

/**
 * Session storage (in production, use Redis)
 */
const sessions = new Map();

/**
 * Get translation for a key
 * @param {string} key - Translation key
 * @param {string} lang - Language code
 * @param {Object} params - Interpolation parameters
 * @returns {string} Translated text
 */
const t = (key, lang = 'rw', params = {}) => {
  const translation = TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
  return Object.entries(params).reduce(
    (text, [k, v]) => text.replace(new RegExp(`{${k}}`, 'g'), v),
    translation
  );
};

/**
 * Get or create USSD session
 * @param {string} sessionId - Africa's Talking session ID
 * @returns {Object} Session data
 */
const getSession = (sessionId) => {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      step: 'main',
      language: 'rw',
      userId: null,
      farmId: null,
      recommendationId: null,
      data: {}
    });
  }
  return sessions.get(sessionId);
};

/**
 * Update session data
 * @param {string} sessionId - Session ID
 * @param {Object} updates - Data to update
 */
const updateSession = (sessionId, updates) => {
  const session = getSession(sessionId);
  sessions.set(sessionId, { ...session, ...updates });
};

/**
 * Clean up session
 * @param {string} sessionId - Session ID
 */
const clearSession = (sessionId) => {
  sessions.delete(sessionId);
};

/**
 * Get user by phone number
 * @param {string} phoneNumber - User's phone number
 * @returns {Promise<Object|null>} User object or null
 */
const getUserByPhone = async (phoneNumber) => {
  const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
  
  const user = await db.users.getByPhone(cleanPhone);
  
  return user;
};

/**
 * Get user's farms
 * @param {string} userId - User ID
 * @returns {Promise<Array>} User's farms
 */
const getUserFarms = async (userId) => {
  const farms = await db.farms.getByUser(userId, { limit: 5, isActive: true });
  
  return farms || [];
};

/**
 * Get pending recommendations count
 * @param {string} userId - User ID
 * @returns {Promise<number>} Count of pending recommendations
 */
const getPendingCount = async (userId) => {
  const count = await db.recommendations.getPendingCount({ userId });
  
  return count || 0;
};

/**
 * Get latest sensor readings for a farm
 * @param {string} farmId - Farm ID
 * @returns {Promise<Object|null>} Latest readings
 */
const getLatestReadings = async (farmId) => {
  const data = await db.sensorData.getLatestByFarm(farmId, true);
  
  return data;
};

/**
 * Main USSD handler
 * @param {Object} params - USSD callback parameters
 * @returns {Promise<string>} USSD response
 */
export const handleUssdRequest = async ({ sessionId, phoneNumber, text, language: preferredLang }) => {
  try {
    const session = getSession(sessionId);
    let user = null;

    try {
      user = await getUserByPhone(phoneNumber);
    } catch (lookupError) {
      logger.warn('USSD user lookup failed, continuing as guest:', lookupError.message);
    }

    const lang = user?.preferred_language || preferredLang || 'rw';
    
    // Update session with user info
    if (user && !session.userId) {
      updateSession(sessionId, { 
        userId: user._id, 
        language: lang 
      });
    }
    
    // Parse input
    const inputs = text ? text.split('*') : [];
    const currentInput = inputs[inputs.length - 1];
    
    // Handle based on current menu level
    const response = await processUssdMenu(sessionId, inputs, currentInput, user, lang);
    
    return response;
  } catch (error) {
    logger.error('USSD handling error:', error);
    const fallbackLang = preferredLang || 'rw';
    if (!text) {
      return `CON ${t('welcome', fallbackLang)}`;
    }
    return `END ${t('error', fallbackLang)}`;
  }
};

/**
 * Process USSD menu navigation
 * @param {string} sessionId - Session ID
 * @param {Array} inputs - All inputs in session
 * @param {string} currentInput - Current input
 * @param {Object} user - User object
 * @param {string} lang - Language code
 * @returns {Promise<string>} USSD response
 */
const processUssdMenu = async (sessionId, inputs, currentInput, user, lang) => {
  const session = getSession(sessionId);
  const depth = inputs.length;
  
  // Initial menu (no input yet)
  if (depth === 0 || inputs[0] === '') {
    if (user) {
      const count = await getPendingCount(user._id);
      return `CON ${t('welcomeRegistered', lang, { 
        name: user.first_name || 'Farmer',
        count: count.toString()
      })}`;
    }
    return `CON ${t('welcome', lang)}`;
  }
  
  // Main menu selection
  const mainChoice = inputs[0];
  
  switch (mainChoice) {
    case '0':
      clearSession(sessionId);
      return `END ${t('goodbye', lang)}`;
      
    case '1':
      return await handleRecommendationsMenu(sessionId, inputs, user, lang);
      
    case '2':
      return await handleFarmStatusMenu(sessionId, inputs, user, lang);
      
    case '3':
      return await handleWeatherMenu(sessionId, inputs, user, lang);
      
    case '4':
      return handleReportPestMenu(lang);
      
    case '5':
      return await handleSettingsMenu(sessionId, inputs, user, lang);
      
    default:
      return `CON ${t('invalidOption', lang)}\n\n${t('welcome', lang)}`;
  }
};

/**
 * Handle recommendations menu
 */
const handleRecommendationsMenu = async (sessionId, inputs, user, lang) => {
  if (!user) {
    return `END ${t('error', lang)}`;
  }
  
  const depth = inputs.length;
  
  if (depth === 1) {
    // Show list of pending recommendations
    const pending = await recommendationService.getPendingRecommendations(user._id, 5);
    
    if (!pending || pending.length === 0) {
      return `CON ${t('noRecommendations', lang)}`;
    }
    
    const list = pending.map((rec, i) => {
      const title = lang === 'rw' && rec.title_rw ? rec.title_rw : rec.title;
      const priority = rec.priority === 'critical' ? '🚨' : rec.priority === 'high' ? '⚠️' : '';
      return `${i + 1}. ${priority}${title.substring(0, 30)}`;
    }).join('\n');
    
    updateSession(sessionId, { data: { recommendations: pending } });
    return `CON ${t('recommendations', lang, { list })}`;
  }
  
  if (depth === 2) {
    // Show recommendation detail
    const session = getSession(sessionId);
    const recIndex = parseInt(inputs[1]) - 1;
    
    if (inputs[1] === '0') {
      return `CON ${t('welcome', lang)}`;
    }
    
    const recommendations = session.data?.recommendations || [];
    if (recIndex < 0 || recIndex >= recommendations.length) {
      return `CON ${t('invalidOption', lang)}`;
    }
    
    const rec = recommendations[recIndex];
    updateSession(sessionId, { recommendationId: rec._id });
    
    const title = lang === 'rw' && rec.title_rw ? rec.title_rw : rec.title;
    const description = lang === 'rw' && rec.description_rw ? rec.description_rw : rec.description;
    
    return `CON ${t('recommendationDetail', lang, {
      title: title.substring(0, 40),
      description: description.substring(0, 80),
      action: rec.recommended_action?.substring(0, 40) || ''
    })}`;
  }
  
  if (depth === 3) {
    // Handle recommendation response
    const session = getSession(sessionId);
    const action = inputs[2];
    
    if (action === '0') {
      return `CON ${t('recommendations', lang, { list: '...' })}`;
    }
    
    if (!session.recommendationId) {
      return `CON ${t('error', lang)}`;
    }
    
    switch (action) {
      case '1': // Accept
        await recommendationService.respondToRecommendation(
          session.recommendationId,
          'accept',
          { respondedBy: user._id, channel: 'ussd' }
        );
        return `CON ${t('acceptConfirm', lang)}`;
        
      case '2': // Reject
        return `CON ${t('rejectConfirm', lang)}`;
        
      case '3': // Defer
        return `CON ${t('deferConfirm', lang)}`;
        
      default:
        return `CON ${t('invalidOption', lang)}`;
    }
  }
  
  if (depth === 4) {
    // Handle rejection reason or defer timing
    const session = getSession(sessionId);
    const previousAction = inputs[2];
    const subChoice = inputs[3];
    
    if (subChoice === '0') {
      return `CON ${t('welcome', lang)}`;
    }
    
    if (previousAction === '2') {
      // Rejection reason
      const reasons = ['Not suitable', 'Weather conditions', 'Resource constraints', 'Other'];
      const reason = reasons[parseInt(subChoice) - 1] || 'Not specified';
      
      await recommendationService.respondToRecommendation(
        session.recommendationId,
        'reject',
        { respondedBy: user._id, reason, channel: 'ussd' }
      );
      return `END ${t('goodbye', lang)}`;
    }
    
    if (previousAction === '3') {
      // Defer timing
      const deferDays = { '1': 1, '2': 7, '3': 14 };
      const days = deferDays[subChoice] || 1;
      const deferUntil = new Date();
      deferUntil.setDate(deferUntil.getDate() + days);
      
      await recommendationService.respondToRecommendation(
        session.recommendationId,
        'defer',
        { respondedBy: user._id, deferUntil: deferUntil.toISOString(), channel: 'ussd' }
      );
      return `END ${t('goodbye', lang)}`;
    }
  }
  
  return `END ${t('goodbye', lang)}`;
};

/**
 * Handle farm status menu
 */
const handleFarmStatusMenu = async (sessionId, inputs, user, lang) => {
  if (!user) {
    return `CON ${t('noFarms', lang)}`;
  }
  
  const depth = inputs.length;
  const farms = await getUserFarms(user._id);
  
  if (farms.length === 0) {
    return `CON ${t('noFarms', lang)}`;
  }
  
  if (depth === 1) {
    // Show farm status (first farm)
    const farm = farms[0];
    const readings = await getLatestReadings(farm._id);
    
    const lastUpdate = readings?.reading_timestamp 
      ? new Date(readings.reading_timestamp).toLocaleString('en-RW', { 
          hour: '2-digit', 
          minute: '2-digit',
          day: '2-digit',
          month: 'short'
        })
      : 'N/A';
    
    return `CON ${t('farmStatus', lang, {
      name: farm.name,
      moisture: readings?.soil_moisture?.toFixed(1) || 'N/A',
      temp: readings?.air_temperature?.toFixed(1) || 'N/A',
      lastUpdate
    })}`;
  }
  
  if (depth === 2) {
    const choice = inputs[1];
    
    if (choice === '0') {
      return `CON ${t('welcome', lang)}`;
    }
    
    if (choice === '1') {
      // Irrigation schedule
      const farm = farms[0];
      const schedules = await db.irrigationSchedules.getUpcoming(
        farm._id,
        new Date().toISOString().split('T')[0],
        3
      );
      
      if (!schedules || schedules.length === 0) {
        return `CON ${t('noIrrigation', lang)}`;
      }
      
      const schedule = schedules.map(s => 
        `${s.scheduled_date} ${s.scheduled_time || ''} (${s.duration_minutes}min)`
      ).join('\n');
      
      return `CON ${t('irrigationSchedule', lang, { schedule })}`;
    }
  }
  
  return `CON ${t('welcome', lang)}`;
};

/**
 * Handle weather menu
 */
const handleWeatherMenu = async (sessionId, inputs, user, lang) => {
  // Get weather for user's farm location or default
  const farms = user ? await getUserFarms(user._id) : [];
  const location = farms[0]?.location_name || 'Kigali';
  
  // Simplified weather response (in production, fetch from weather service)
  return `CON ${t('weatherForecast', lang, {
    location,
    today: '25°C, Partly Cloudy',
    tomorrow: '24°C, Light Rain',
    rainChance: '60'
  })}`;
};

/**
 * Handle report pest menu
 */
const handleReportPestMenu = (lang) => {
  return `CON ${t('reportPest', lang, {
    number: '+250788123456',
    hotline: '3030'
  })}`;
};

/**
 * Handle settings menu
 */
const handleSettingsMenu = async (sessionId, inputs, user, lang) => {
  const depth = inputs.length;
  
  if (depth === 1) {
    return `CON ${t('settings', lang)}`;
  }
  
  if (depth === 2) {
    const choice = inputs[1];
    
    if (choice === '0') {
      return `CON ${t('welcome', lang)}`;
    }
    
    if (choice === '1') {
      return `CON ${t('languageSelect', lang)}`;
    }
    
    if (choice === '3') {
      return `CON ${t('help', lang, {
        hotline: '3030',
        sms: '8080'
      })}`;
    }
  }
  
  if (depth === 3 && inputs[1] === '1') {
    // Language selection
    const langChoice = inputs[2];
    const langMap = { '1': 'en', '2': 'rw', '3': 'fr' };
    const newLang = langMap[langChoice] || 'rw';
    
    if (user) {
      await db.users.update(user._id, { preferred_language: newLang });
    }
    
    return `CON ${t('languageChanged', newLang)}`;
  }
  
  return `CON ${t('welcome', lang)}`;
};

export default {
  handleUssdRequest,
  TRANSLATIONS
};
