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

const runWithConcurrency = async (items, concurrency, worker) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(concurrency || 1, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  const executeWorker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  };

  await Promise.all(Array.from({ length: limit }, () => executeWorker()));
  return results;
};

const sendSmsThroughProvider = async (phoneNumber, message) => {
  const formattedNumber = formatPhoneNumber(phoneNumber);
  const truncatedMessage = message.length > 480
    ? message.substring(0, 477) + '...'
    : message;

  const smsOptions = {
    to: [formattedNumber],
    message: truncatedMessage
  };

  if (config.africasTalking.username !== 'sandbox' && config.africasTalking.senderId) {
    smsOptions.from = config.africasTalking.senderId;
  }

  const response = await sms.send(smsOptions);
  const recipient = response.SMSMessageData?.Recipients?.[0] || {};

  return {
    formattedNumber,
    truncatedMessage,
    providerStatus: recipient.status,
    externalMessageId: recipient.messageId,
    failedReason: recipient.status !== 'Success' ? recipient.status : null,
    costUnits: recipient.cost,
    succeeded: recipient.status === 'Success',
  };
};

const resolveUserDistrictId = (user) => {
  if (!user || typeof user !== 'object') return null;

  const metadata = user.metadata && typeof user.metadata === 'object' ? user.metadata : {};

  return (
    user.district_id
    || user.districtId
    || metadata.districtId
    || metadata.district_id
    || metadata.coverageDistrictId
    || null
  );
};

const getRecipientAddress = (user) =>
  user?.phone_number
  || user?.email
  || `user:${user?._id || user?.id || 'unknown'}`;

const formatSensorMetric = (label, value, suffix = '') => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }

  return `${label} ${Number(value).toFixed(Number.isInteger(Number(value)) ? 0 : 1)}${suffix}`;
};

const buildReadingSummary = (analysis) => {
  const readings = analysis?.irrigation?.currentReadings || {};
  const parts = [
    formatSensorMetric('Soil moisture', readings.soilMoisture, '%'),
    formatSensorMetric('Temperature', readings.temperature, 'C'),
    formatSensorMetric('Humidity', readings.humidity, '%'),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
};

const buildIrrigationSummary = (analysis) => {
  const irrigation = analysis?.irrigation;

  if (!irrigation) {
    return 'not available';
  }

  if (irrigation.error) {
    return 'analysis unavailable';
  }

  if (irrigation.needsIrrigation === true) {
    return `recommended${irrigation.urgency ? ` (${irrigation.urgency})` : ''}`;
  }

  if (irrigation.needsIrrigation === false) {
    return 'not needed right now';
  }

  return irrigation.message || 'no clear action';
};

const buildNutrientSummary = (analysis) => {
  const nutrients = analysis?.nutrients;

  if (!nutrients) {
    return 'not available';
  }

  if (nutrients.error) {
    return 'analysis unavailable';
  }

  if (nutrients.needsFertilization === true) {
    return `fertilization recommended${nutrients.urgency ? ` (${nutrients.urgency})` : ''}`;
  }

  if (nutrients.needsFertilization === false) {
    return 'no fertilization needed right now';
  }

  return nutrients.message || 'no clear action';
};

const buildSensorAnalysisStartedContent = ({ farmName, deviceId, insertedCount }) => ({
  en: `New sensor data from ${farmName} was received from ${deviceId} and sent for AI farm analysis. ${insertedCount} reading${insertedCount === 1 ? '' : 's'} stored.`,
  rw: `Amakuru mashya ya sensor yo ku murima ${farmName} yakiriwe kuri ${deviceId} kandi yoherejwe kuri AI ngo asesengurwe. Ibisomwa ${insertedCount} byabitswe.`,
});

const buildSensorAnalysisCompletedContent = ({ farmName, analysis }) => {
  const readingSummary = buildReadingSummary(analysis);
  const irrigationSummary = buildIrrigationSummary(analysis);
  const nutrientSummary = buildNutrientSummary(analysis);

  const englishSegments = [
    `AI analysis for ${farmName}:`,
    readingSummary ? `${readingSummary}.` : null,
    `Irrigation: ${irrigationSummary}.`,
    `Nutrients: ${nutrientSummary}.`,
    'Check the dashboard for full farm details.',
  ].filter(Boolean);

  const kinyarwandaSegments = [
    `AI yamaze gusesengura umurima ${farmName}:`,
    readingSummary ? `${readingSummary}.` : null,
    `Kuhira: ${irrigationSummary}.`,
    `Ifumbire: ${nutrientSummary}.`,
    'Reba kuri dashboard ibisobanuro byose byumurima.',
  ].filter(Boolean);

  return {
    en: englishSegments.join(' '),
    rw: kinyarwandaSegments.join(' '),
  };
};

const buildSensorAnalysisFailedContent = ({ farmName }) => ({
  en: `Sensor data from ${farmName} was stored, but AI farm analysis could not complete right now. Check the dashboard for the latest readings.`,
  rw: `Amakuru ya sensor yo ku murima ${farmName} yarabitswe, ariko isesengura rya AI ntiryashoboye kurangira ubu. Reba dashboard urebe ibisomwa biheruka.`,
});

const createStoredNotificationBatch = async (recipients, { subject, content, metadata }) => {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { count: 0, ids: [] };
  }

  const createdAt = Date.now();
  const messages = recipients.map((user) => {
    const prefersKinyarwanda = (user?.preferred_language || 'rw') === 'rw';

    return {
      user_id: user._id || user.id,
      channel: 'push',
      recipient: getRecipientAddress(user),
      subject,
      content: prefersKinyarwanda ? content.rw : content.en,
      content_rw: content.rw,
      status: 'sent',
      sent_at: createdAt,
      metadata,
      created_at: createdAt,
    };
  });

  const result = await db.messages.createBatch(messages);
  return {
    count: result?.count ?? messages.length,
    ids: result?.ids ?? [],
  };
};

const resolveFarmAnalysisRecipients = async (farmId) => {
  const farm = await db.farms.getById(farmId);
  if (!farm) {
    return { farm: null, recipients: [] };
  }

  const activeUsers = await db.users.listActive();
  const farmOwnerId = farm.user_id ? String(farm.user_id) : null;
  const farmDistrictId = farm.district_id ? String(farm.district_id) : null;
  const uniqueRecipients = new Map();

  for (const user of activeUsers || []) {
    const userId = user?._id || user?.id;
    if (!userId) {
      continue;
    }

    const role = user.role || 'farmer';
    const isFarmOwner = farmOwnerId && String(userId) === farmOwnerId;
    const isAdmin = role === 'admin';
    const isDistrictExpert =
      role === 'expert'
      && farmDistrictId
      && String(resolveUserDistrictId(user) || '') === farmDistrictId;

    if (isFarmOwner || isAdmin || isDistrictExpert) {
      uniqueRecipients.set(String(userId), user);
    }
  }

  return {
    farm,
    recipients: Array.from(uniqueRecipients.values()),
  };
};

export const sendSensorAnalysisLifecycleNotifications = async ({
  farmId,
  sensorId,
  deviceId,
  insertedCount,
  latestReadingTimestamp,
  runAnalysis,
}) => {
  const { farm, recipients } = await resolveFarmAnalysisRecipients(farmId);
  const farmName = farm?.name || 'this farm';

  if (!farm || recipients.length === 0) {
    logger.warn(`No recipients available for sensor AI analysis notifications on farm ${farmId}`);
    return {
      targetedUsers: recipients.length,
      started: 0,
      completed: 0,
      failed: 0,
    };
  }

  const metadataBase = {
    type: 'sensor_ai_analysis',
    farm_id: farmId,
    sensor_id: sensorId,
    device_id: deviceId,
    inserted_count: insertedCount,
    latest_reading_at: latestReadingTimestamp,
  };

  const started = await createStoredNotificationBatch(recipients, {
    subject: `Sensor data received for ${farmName}`,
    content: buildSensorAnalysisStartedContent({
      farmName,
      deviceId,
      insertedCount,
    }),
    metadata: {
      ...metadataBase,
      stage: 'started',
    },
  });

  try {
    const analysis = typeof runAnalysis === 'function'
      ? await runAnalysis()
      : null;

    const completed = await createStoredNotificationBatch(recipients, {
      subject: `AI farm analysis ready for ${farmName}`,
      content: buildSensorAnalysisCompletedContent({
        farmName,
        analysis,
      }),
      metadata: {
        ...metadataBase,
        stage: 'completed',
        analysis_timestamp: Date.now(),
      },
    });

    return {
      targetedUsers: recipients.length,
      started: started.count,
      completed: completed.count,
      failed: 0,
    };
  } catch (error) {
    logger.warn('Failed to complete AI farm analysis notification flow:', error?.message || error);

    const failed = await createStoredNotificationBatch(recipients, {
      subject: `AI farm analysis delayed for ${farmName}`,
      content: buildSensorAnalysisFailedContent({ farmName }),
      metadata: {
        ...metadataBase,
        stage: 'failed',
        failed_reason: error?.message || String(error),
      },
    });

    return {
      targetedUsers: recipients.length,
      started: started.count,
      completed: 0,
      failed: failed.count,
    };
  }
};

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
    const delivery = await sendSmsThroughProvider(phoneNumber, message);

    // Log message to database
    const messageRecord = await logMessage({
      userId,
      recommendationId,
      channel: 'sms',
      recipient: delivery.formattedNumber,
      content: delivery.truncatedMessage,
      status: delivery.succeeded ? 'sent' : 'failed',
      externalMessageId: delivery.externalMessageId,
      failedReason: delivery.failedReason,
      costUnits: delivery.costUnits
    });

    logger.info(`SMS sent to ${delivery.formattedNumber}: ${messageRecord._id}`);
    return {
      success: delivery.succeeded,
      messageId: messageRecord._id,
      externalId: delivery.externalMessageId
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

const deliverPersistedMessage = async (messageRecord, options = {}) => {
  const delivery = await sendSmsThroughProvider(messageRecord.recipient, messageRecord.content);
  const retryCount = (messageRecord.retry_count || 0) + (options.incrementRetry === false ? 0 : 1);

  await db.messages.update(messageRecord._id, {
    status: delivery.succeeded ? 'sent' : 'failed',
    recipient: delivery.formattedNumber,
    content: delivery.truncatedMessage,
    sent_at: delivery.succeeded ? Date.now() : messageRecord.sent_at,
    external_message_id: delivery.externalMessageId,
    failed_reason: delivery.failedReason,
    cost_units: delivery.costUnits,
    retry_count: retryCount,
  });

  return delivery;
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
export const sendRecommendationNotification = async (_userId, recommendationId, notificationData) => {
  const {
    priority,
    type,
    title,
    titleRw,
    description,
    descriptionRw,
    farmName
  } = notificationData;
  const activeUsers = await db.users.listActive();
  const deliverableUsers = (activeUsers || []).filter((user) => user.phone_number);

  if (deliverableUsers.length === 0) {
    logger.warn(`No active users with phone numbers available for recommendation ${recommendationId}, skipping notification`);
    return {
      targetedUsers: activeUsers?.length || 0,
      deliverableUsers: 0,
      sent: 0,
      queued: 0,
    };
  }

  // Determine delivery timing based on priority
  const delay = getDeliveryDelay(priority);

  if (delay === 0) {
    let sent = 0;

    await runWithConcurrency(
      deliverableUsers,
      config.notifications.deliveryConcurrency,
      async (user) => {
        const language = user.preferred_language || 'rw';
        const message = buildNotificationMessage(type, {
          title: language === 'rw' && titleRw ? titleRw : title,
          description: language === 'rw' && descriptionRw ? descriptionRw : description,
          farmName,
          priority,
        });

        await sendSMS(user.phone_number, message, {
          userId: user._id || user.id,
          recommendationId,
          priority,
          language,
        });
        sent += 1;
      }
    );

    await db.recommendations.update(recommendationId, {
      notification_sent: true,
      notification_sent_at: Date.now(),
      notification_channel: 'sms'
    });

    return {
      targetedUsers: activeUsers.length,
      deliverableUsers: deliverableUsers.length,
      sent,
      queued: 0,
    };
  } else {
    deliverableUsers.forEach((user) => {
      const language = user.preferred_language || 'rw';
      const message = buildNotificationMessage(type, {
        title: language === 'rw' && titleRw ? titleRw : title,
        description: language === 'rw' && descriptionRw ? descriptionRw : description,
        farmName,
        priority,
      });

      queueMessage({
        phoneNumber: user.phone_number,
        message,
        userId: user._id || user.id,
        recommendationId,
        priority,
        delay
      });
    });
  }

  // Update recommendation notification status
  await db.recommendations.update(recommendationId, {
    notification_sent: true,
    notification_sent_at: Date.now(),
    notification_channel: 'sms'
  });

  return {
    targetedUsers: activeUsers.length,
    deliverableUsers: deliverableUsers.length,
    sent: 0,
    queued: deliverableUsers.length,
  };
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

  batchTimeout = null;

  await runWithConcurrency(
    messagesToSend,
    config.notifications.deliveryConcurrency,
    async (msg) => {
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
  );

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

  await runWithConcurrency(
    recipients,
    config.notifications.deliveryConcurrency,
    async (recipient) => {
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
    }
  );

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
      respondedBy: userId,
      channel: 'ussd',
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

  await runWithConcurrency(
    failedMessages,
    config.notifications.retryConcurrency,
    async (msg) => {
      try {
        const delivery = await deliverPersistedMessage(msg);
        if (delivery.succeeded) {
          retried++;
        }
      } catch (retryError) {
        await db.messages.update(msg._id, {
          retry_count: (msg.retry_count || 0) + 1
        });
      }
    }
  );

  return { retried };
};

/**
 * Get message statistics
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Message statistics
 */
export const getMessageStats = async (options = {}) => {
  const { userId, startDate, endDate } = options;

  const stats = await db.messages.getStats({
    ...(userId ? { userId } : {}),
    ...(startDate ? { since: new Date(startDate).getTime() } : {}),
    ...(endDate ? { until: new Date(endDate).getTime() } : {}),
    ...(options.channel ? { channel: options.channel } : {}),
    ...(options.limit !== undefined ? { limit: options.limit } : {}),
  });

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
    const persistedQueuedMessages = await db.messages.getQueued({ limit: 100 });

    if (persistedQueuedMessages?.length > 0) {
      await runWithConcurrency(
        persistedQueuedMessages,
        config.notifications.deliveryConcurrency,
        async (msg) => {
          try {
            const delivery = await deliverPersistedMessage(msg, { incrementRetry: false });
            if (delivery.succeeded) {
              results.sent++;
            } else {
              results.failed++;
            }
          } catch (error) {
            logger.error('Failed to deliver persisted queued message:', { error: error.message, messageId: msg._id });
            results.failed++;
          }
          results.processed++;
        }
      );
    }

    // Process any messages in the local queue
    if (messageQueue.length > 0) {
      const messages = [...messageQueue];
      messageQueue.length = 0; // Clear queue

      await runWithConcurrency(
        messages,
        config.notifications.deliveryConcurrency,
        async (msg) => {
          try {
            await sendSMS(msg.phoneNumber, msg.message, msg.options);
            results.sent++;
          } catch (error) {
            logger.error('Failed to send queued message:', { error: error.message });
            results.failed++;
          }
          results.processed++;
        }
      );
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
  sendSensorAnalysisLifecycleNotifications,
  handleUSSDCallback,
  retryFailedMessages,
  getMessageStats,
  processQueuedMessages
};
