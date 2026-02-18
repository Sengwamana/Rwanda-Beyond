/**
 * Notification Service
 * 
 * Handles SMS and USSD notifications using Africa's Talking API.
 * Supports multiple languages and priority-based delivery.
 * 
 * @module services/notificationService
 */

import AT from 'africastalking';
import { db } from '../database/convex.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// Initialize Africa's Talking
const africasTalking = AT({
  username: config.africasTalking.username,
  apiKey: config.africasTalking.apiKey
});

const sms = africasTalking.SMS;

// Message queue for batching routine notifications
const messageQueue = [];
let batchTimeout = null;

/**
 * Send SMS message
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} message - Message content
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Send result
 */
export const sendSMS = async (phoneNumber, message, options = {}) => {
  const { 
    userId, 
    recommendationId, 
    priority = 'medium',
    language = 'en'
  } = options;

  try {
    // Ensure phone number is in international format
    const formattedNumber = formatPhoneNumber(phoneNumber);

    // Truncate message if too long (SMS limit is typically 160 chars for single SMS)
    const truncatedMessage = message.length > 480 
      ? message.substring(0, 477) + '...'
      : message;

    const smsOptions = {
      to: [formattedNumber],
      message: truncatedMessage
    };

    // Add sender ID if not in sandbox mode
    if (config.africasTalking.username !== 'sandbox' && config.africasTalking.senderId) {
      smsOptions.from = config.africasTalking.senderId;
    }

    const response = await sms.send(smsOptions);

    // Log message to database
    const messageRecord = await logMessage({
      userId,
      recommendationId,
      channel: 'sms',
      recipient: formattedNumber,
      content: truncatedMessage,
      status: response.SMSMessageData?.Recipients?.[0]?.status === 'Success' ? 'sent' : 'failed',
      externalMessageId: response.SMSMessageData?.Recipients?.[0]?.messageId,
      failedReason: response.SMSMessageData?.Recipients?.[0]?.status !== 'Success' 
        ? response.SMSMessageData?.Recipients?.[0]?.status 
        : null,
      costUnits: response.SMSMessageData?.Recipients?.[0]?.cost
    });

    logger.info(`SMS sent to ${formattedNumber}: ${messageRecord._id}`);
    return {
      success: true,
      messageId: messageRecord._id,
      externalId: response.SMSMessageData?.Recipients?.[0]?.messageId
    };

  } catch (error) {
    logger.error(`Failed to send SMS to ${phoneNumber}:`, error.message);

    // Log failed attempt
    await logMessage({
      userId,
      recommendationId,
      channel: 'sms',
      recipient: phoneNumber,
      content: message,
      status: 'failed',
      failedReason: error.message
    });

    throw error;
  }
};

/**
 * Format phone number to international format
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} Formatted phone number
 */
const formatPhoneNumber = (phoneNumber) => {
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // Add Rwanda country code if not present
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = '+250' + cleaned.substring(1);
    } else if (cleaned.startsWith('250')) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+250' + cleaned;
    }
  }

  return cleaned;
};

/**
 * Log message to database
 * @param {Object} messageData - Message data to log
 * @returns {Promise<Object>} Created message record
 */
const logMessage = async (messageData) => {
  const {
    userId,
    recommendationId,
    channel,
    recipient,
    content,
    contentRw,
    status,
    externalMessageId,
    failedReason,
    costUnits
  } = messageData;

  const data = await db.messages.create({
    user_id: userId,
    recommendation_id: recommendationId,
    channel,
    recipient,
    content,
    content_rw: contentRw,
    status,
    external_message_id: externalMessageId,
    failed_reason: failedReason,
    cost_units: costUnits,
    sent_at: status === 'sent' ? Date.now() : null
  });

  return data;
};

/**
 * Send recommendation notification
 * @param {string} userId - User UUID
 * @param {string} recommendationId - Recommendation UUID
 * @param {Object} notificationData - Notification details
 */
export const sendRecommendationNotification = async (userId, recommendationId, notificationData) => {
  const {
    phoneNumber,
    priority,
    type,
    title,
    description,
    farmName
  } = notificationData;

  // Build message based on type
  const message = buildNotificationMessage(type, {
    title,
    description,
    farmName,
    priority
  });

  // Determine delivery timing based on priority
  const delay = getDeliveryDelay(priority);

  if (delay === 0) {
    // Send immediately for critical alerts
    await sendSMS(phoneNumber, message, {
      userId,
      recommendationId,
      priority
    });
  } else {
    // Queue for delayed/batched delivery
    queueMessage({
      phoneNumber,
      message,
      userId,
      recommendationId,
      priority,
      delay
    });
  }

  // Update recommendation notification status
  await db.recommendations.update(recommendationId, {
    notification_sent: true,
    notification_sent_at: Date.now(),
    notification_channel: 'sms'
  });
};

/**
 * Build notification message based on type
 * @param {string} type - Recommendation type
 * @param {Object} data - Message data
 * @returns {string} Formatted message
 */
const buildNotificationMessage = (type, data) => {
  const { title, description, farmName, priority } = data;
  
  const priorityEmoji = {
    critical: '🚨',
    high: '⚠️',
    medium: 'ℹ️',
    low: '📋'
  };

  const emoji = priorityEmoji[priority] || 'ℹ️';

  let message = `${emoji} SMARTMAIZE\n\n`;
  
  if (farmName) {
    message += `Farm: ${farmName}\n`;
  }

  message += `${title}\n\n`;
  message += description;

  // Add response instructions
  message += '\n\nReply:\n1-Accept\n2-Reject\n3-Defer';

  return message;
};

/**
 * Get delivery delay based on priority
 * @param {string} priority - Notification priority
 * @returns {number} Delay in milliseconds
 */
const getDeliveryDelay = (priority) => {
  switch (priority) {
    case 'critical':
      return config.notifications.criticalAlertDelayMs;
    case 'high':
      return config.notifications.importantRecommendationDelayMs;
    default:
      return config.notifications.routineUpdateBatchIntervalMs;
  }
};

/**
 * Queue message for delayed delivery
 * @param {Object} messageData - Message to queue
 */
const queueMessage = (messageData) => {
  messageQueue.push({
    ...messageData,
    queuedAt: Date.now()
  });

  // Set up batch processing if not already scheduled
  if (!batchTimeout) {
    batchTimeout = setTimeout(processBatchedMessages, config.notifications.routineUpdateBatchIntervalMs);
  }
};

/**
 * Process queued messages
 */
const processBatchedMessages = async () => {
  const now = Date.now();
  const messagesToSend = [];

  // Find messages ready to send
  for (let i = messageQueue.length - 1; i >= 0; i--) {
    const msg = messageQueue[i];
    if (now - msg.queuedAt >= msg.delay) {
      messagesToSend.push(msg);
      messageQueue.splice(i, 1);
    }
  }

  // Send messages
  for (const msg of messagesToSend) {
    try {
      await sendSMS(msg.phoneNumber, msg.message, {
        userId: msg.userId,
        recommendationId: msg.recommendationId,
        priority: msg.priority
      });
    } catch (error) {
      logger.error('Batch message send failed:', error);
    }
  }

  // Reschedule if there are more messages
  if (messageQueue.length > 0) {
    batchTimeout = setTimeout(processBatchedMessages, config.notifications.routineUpdateBatchIntervalMs);
  } else {
    batchTimeout = null;
  }

  logger.info(`Processed ${messagesToSend.length} batched messages, ${messageQueue.length} remaining`);
};

/**
 * Send bulk SMS to multiple recipients
 * @param {Array} recipients - Array of {phoneNumber, message} objects
 * @param {Object} options - Common options
 * @returns {Promise<Object>} Bulk send results
 */
export const sendBulkSMS = async (recipients, options = {}) => {
  const results = {
    total: recipients.length,
    successful: 0,
    failed: 0,
    errors: []
  };

  for (const recipient of recipients) {
    try {
      await sendSMS(recipient.phoneNumber, recipient.message, {
        ...options,
        userId: recipient.userId
      });
      results.successful++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        phoneNumber: recipient.phoneNumber,
        error: error.message
      });
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  logger.info(`Bulk SMS complete: ${results.successful} sent, ${results.failed} failed`);
  return results;
};

/**
 * USSD callback handler
 * @param {Object} sessionData - USSD session data
 * @returns {Promise<string>} USSD response
 */
export const handleUSSDCallback = async (sessionData) => {
  const {
    sessionId,
    phoneNumber,
    serviceCode,
    text,
    networkCode
  } = sessionData;

  // Parse user input
  const inputs = text.split('*').filter(Boolean);
  const currentLevel = inputs.length;

  let response = '';

  try {
    // Get user by phone number
    const user = await db.users.getByPhone(formatPhoneNumber(phoneNumber));

    if (!user) {
      response = 'END Ntabwo mwanditse. Please register first.';
      return response;
    }

    const lang = user.preferred_language || 'rw';

    if (currentLevel === 0) {
      // Main menu
      response = `CON Murakaza neza, ${user.first_name}!\n`;
      response += lang === 'rw' 
        ? '1. Reba inama\n2. Imirima\n3. Sensor data\n4. Amakuru y\'ikirere'
        : '1. View recommendations\n2. My farms\n3. Sensor data\n4. Weather';
    } else if (inputs[0] === '1') {
      // Recommendations menu
      response = await handleRecommendationsMenu(user._id, inputs.slice(1), lang);
    } else if (inputs[0] === '2') {
      // Farms menu
      response = await handleFarmsMenu(user._id, inputs.slice(1), lang);
    } else if (inputs[0] === '3') {
      // Sensor data
      response = await handleSensorMenu(user._id, inputs.slice(1), lang);
    } else if (inputs[0] === '4') {
      // Weather
      response = await handleWeatherMenu(user._id, inputs.slice(1), lang);
    } else {
      response = 'END Invalid option. Subira inyuma.';
    }

  } catch (error) {
    logger.error('USSD error:', error);
    response = 'END An error occurred. Please try again.';
  }

  return response;
};

/**
 * Handle recommendations USSD menu
 */
const handleRecommendationsMenu = async (userId, inputs, lang) => {
  const { getPendingRecommendations, updateRecommendationStatus } = await import('./recommendationService.js');

  if (inputs.length === 0) {
    // Show pending recommendations
    const recommendations = await getPendingRecommendations(userId, 3);
    
    if (recommendations.length === 0) {
      return lang === 'rw' 
        ? 'END Ntayo nama itegereje.'
        : 'END No pending recommendations.';
    }

    let response = 'CON ' + (lang === 'rw' ? 'Inama zitegereje:\n' : 'Pending recommendations:\n');
    recommendations.forEach((rec, i) => {
      const title = lang === 'rw' && rec.title_rw ? rec.title_rw : rec.title;
      response += `${i + 1}. ${title.substring(0, 30)}...\n`;
    });
    return response;
  }

  if (inputs.length === 1) {
    // Show specific recommendation
    const recommendations = await getPendingRecommendations(userId, 3);
    const index = parseInt(inputs[0]) - 1;
    
    if (index < 0 || index >= recommendations.length) {
      return 'END Invalid selection.';
    }

    const rec = recommendations[index];
    const desc = lang === 'rw' && rec.description_rw ? rec.description_rw : rec.description;
    
    return `CON ${desc.substring(0, 100)}...\n\n1. Accept\n2. Reject\n3. Defer`;
  }

  if (inputs.length === 2) {
    // Handle response
    const recommendations = await getPendingRecommendations(userId, 3);
    const index = parseInt(inputs[0]) - 1;
    const action = inputs[1];

    if (index < 0 || index >= recommendations.length) {
      return 'END Invalid selection.';
    }

    const rec = recommendations[index];
    const statusMap = { '1': 'accepted', '2': 'rejected', '3': 'deferred' };
    const status = statusMap[action];

    if (!status) {
      return 'END Invalid action.';
    }

    await updateRecommendationStatus(rec._id, status, {
      deferredUntil: status === 'deferred' 
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() 
        : null
    });

    return lang === 'rw'
      ? `END Inama ${status === 'accepted' ? 'yemewe' : status === 'rejected' ? 'yanzwe' : 'yasubirijwe'}. Murakoze!`
      : `END Recommendation ${status}. Thank you!`;
  }

  return 'END Invalid input.';
};

/**
 * Handle farms USSD menu
 */
const handleFarmsMenu = async (userId, inputs, lang) => {
  const { getUserFarms, getFarmSummary } = await import('./farmService.js');

  if (inputs.length === 0) {
    const { farms } = await getUserFarms(userId, { limit: 5 });
    
    if (farms.length === 0) {
      return lang === 'rw' ? 'END Ntabwo ufite imirima.' : 'END No farms found.';
    }

    let response = 'CON ' + (lang === 'rw' ? 'Imirima yawe:\n' : 'Your farms:\n');
    farms.forEach((farm, i) => {
      response += `${i + 1}. ${farm.name}\n`;
    });
    return response;
  }

  // Show farm details
  const { farms } = await getUserFarms(userId, { limit: 5 });
  const index = parseInt(inputs[0]) - 1;

  if (index < 0 || index >= farms.length) {
    return 'END Invalid selection.';
  }

  const summary = await getFarmSummary(farms[index]._id || farms[index].id);
  const moisture = summary.latestReadings?.soil_moisture || '--';
  const temp = summary.latestReadings?.air_temperature || '--';

  return `END ${summary.farm.name}\n` +
    `${lang === 'rw' ? 'Ubuhehere' : 'Moisture'}: ${moisture}%\n` +
    `${lang === 'rw' ? 'Ubushyuhe' : 'Temp'}: ${temp}°C\n` +
    `${lang === 'rw' ? 'Inama' : 'Pending'}: ${summary.pendingRecommendations}`;
};

/**
 * Handle sensor data USSD menu
 */
const handleSensorMenu = async (userId, inputs, lang) => {
  const { getUserFarms } = await import('./farmService.js');
  const { getLatestReadings } = await import('./sensorService.js');

  const { farms } = await getUserFarms(userId, { limit: 3 });

  if (farms.length === 0) {
    return lang === 'rw' ? 'END Ntabwo ufite imirima.' : 'END No farms found.';
  }

  if (inputs.length === 0) {
    let response = 'CON ' + (lang === 'rw' ? 'Hitamo umurima:\n' : 'Select farm:\n');
    farms.forEach((farm, i) => {
      response += `${i + 1}. ${farm.name}\n`;
    });
    return response;
  }

  const index = parseInt(inputs[0]) - 1;
  if (index < 0 || index >= farms.length) {
    return 'END Invalid selection.';
  }

  const readings = await getLatestReadings(farms[index]._id || farms[index].id);
  
  if (!readings) {
    return lang === 'rw' ? 'END Ntabyo bihari.' : 'END No sensor data available.';
  }

  return `END ${farms[index].name}\n` +
    `${lang === 'rw' ? 'Ubuhehere' : 'Soil Moisture'}: ${readings.soil_moisture || '--'}%\n` +
    `${lang === 'rw' ? 'Ubushyuhe bw\'ubutaka' : 'Soil Temp'}: ${readings.soil_temperature || '--'}°C\n` +
    `${lang === 'rw' ? 'Ubushyuhe bw\'umwuka' : 'Air Temp'}: ${readings.air_temperature || '--'}°C\n` +
    `${lang === 'rw' ? 'Umwuka unyerera' : 'Humidity'}: ${readings.humidity || '--'}%`;
};

/**
 * Handle weather USSD menu
 */
const handleWeatherMenu = async (userId, inputs, lang) => {
  const { getUserFarms } = await import('./farmService.js');
  const { getWeatherForFarm } = await import('./weatherService.js');

  const { farms } = await getUserFarms(userId, { limit: 1 });

  if (farms.length === 0) {
    return lang === 'rw' ? 'END Ntabwo ufite imirima.' : 'END No farms found.';
  }

  try {
    const weather = await getWeatherForFarm(farms[0]._id || farms[0].id, 3);
    const current = weather.current;

    let response = `END ${lang === 'rw' ? 'Ikirere Ubu' : 'Current Weather'}\n`;
    response += `${lang === 'rw' ? 'Ubushyuhe' : 'Temp'}: ${Math.round(current.temperature)}°C\n`;
    response += `${lang === 'rw' ? 'Umwuka' : 'Humidity'}: ${current.humidity}%\n`;
    response += `${current.condition}\n\n`;

    if (weather.forecast.length > 0) {
      response += lang === 'rw' ? 'Ejo: ' : 'Tomorrow: ';
      response += `${Math.round(weather.forecast[0].temperatureAvg)}°C, ${weather.forecast[0].condition}`;
    }

    return response;
  } catch (error) {
    logger.error('Weather fetch error:', error);
    return lang === 'rw' 
      ? 'END Amakuru y\'ikirere ntabwo aboneka.' 
      : 'END Weather data unavailable.';
  }
};

/**
 * Retry failed messages
 * @param {number} maxRetries - Maximum retry attempts
 */
export const retryFailedMessages = async (maxRetries = 3) => {
  const failedMessages = await db.messages.getFailed({ maxRetries, limit: 50 });

  if (!failedMessages || failedMessages.length === 0) {
    return { retried: 0 };
  }

  logger.info(`Retrying ${failedMessages.length} failed messages`);

  let retried = 0;

  for (const msg of failedMessages) {
    try {
      await sendSMS(msg.recipient, msg.content, {
        userId: msg.user_id,
        recommendationId: msg.recommendation_id
      });

      // Update original message status
      await db.messages.update(msg._id, {
        status: 'sent',
        sent_at: Date.now(),
        retry_count: (msg.retry_count || 0) + 1
      });

      retried++;
    } catch (retryError) {
      // Update retry count
      await db.messages.update(msg._id, {
        retry_count: (msg.retry_count || 0) + 1
      });
    }

    // Delay between retries
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { retried };
};

/**
 * Get message statistics
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Message statistics
 */
export const getMessageStats = async (options = {}) => {
  const { userId, startDate, endDate } = options;

  const stats = await db.messages.getStats({ userId, startDate, endDate });

  return stats;
};

/**
 * Process queued messages (called by scheduled task)
 * Sends batched routine notifications and retries failed messages
 * @returns {Promise<Object>} Processing results
 */
export const processQueuedMessages = async () => {
  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    retried: 0
  };

  try {
    // Process any messages in the local queue
    if (messageQueue.length > 0) {
      const messages = [...messageQueue];
      messageQueue.length = 0; // Clear queue

      for (const msg of messages) {
        try {
          await sendSMS(msg.phoneNumber, msg.message, msg.options);
          results.sent++;
        } catch (error) {
          logger.error('Failed to send queued message:', { error: error.message });
          results.failed++;
        }
        results.processed++;
      }
    }

    // Retry failed messages from the last hour
    const retryResults = await retryFailedMessages(60);
    results.retried = retryResults?.retried || 0;

    logger.info('Processed queued messages', results);
    return results;
  } catch (error) {
    logger.error('Error processing queued messages:', { error: error.message });
    throw error;
  }
};

export default {
  sendSMS,
  sendBulkSMS,
  sendRecommendationNotification,
  handleUSSDCallback,
  retryFailedMessages,
  getMessageStats,
  processQueuedMessages
};
