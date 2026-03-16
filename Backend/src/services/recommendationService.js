/**
 * Recommendation Service
 * 
 * Handles creation, management, and lifecycle of farm recommendations
 * including irrigation, fertilization, and pest alerts.
 * 
 * @module services/recommendationService
 */

import { db } from '../database/convex.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import * as notificationService from './notificationService.js';

const pickRecommendationFields = (source, fields) => {
  if (!source || typeof source !== 'object') {
    return {};
  }

  return fields.reduce((acc, field) => {
    if (source[field] !== undefined) {
      acc[field] = source[field];
    }
    return acc;
  }, {});
};

const logRecommendationAuditEvent = async (entry) => {
  try {
    await db.auditLogs.create(entry);
  } catch (error) {
    logger.warn('Failed to write recommendation audit log:', error?.message || error);
  }
};

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

/**
 * Get recommendation by ID
 * @param {string} recommendationId - Recommendation UUID
 * @returns {Promise<Object>} Recommendation object
 */
export const getRecommendationById = async (recommendationId) => {
  const data = await db.recommendations.getById(recommendationId);

  if (!data) {
    throw new NotFoundError('Recommendation not found');
  }

  // Resolve farm relation
  if (data.farm_id) {
    const farm = await db.farms.getById(data.farm_id);
    data.farm = farm ? { id: farm._id, name: farm.name, user_id: farm.user_id } : null;
  }

  // Resolve user relation
  if (data.user_id) {
    const user = await db.users.getById(data.user_id);
    data.user = user ? { id: user._id, first_name: user.first_name, last_name: user.last_name, phone_number: user.phone_number } : null;
  }

  return data;
};

/**
 * Get recommendations for a user
 * @param {string} userId - User UUID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Recommendations with pagination
 */
export const getUserRecommendations = async (userId, options = {}) => {
  const {
    page = 1,
    limit = 20,
    status,
    type,
    farmId,
    priority
  } = options;

  const result = await db.recommendations.getByUser(userId, {
    page,
    limit,
    status,
    type,
    farmId,
    priority
  });

  const data = result?.data || result || [];
  const total = result?.total ?? data.length;

  return {
    recommendations: data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};

/**
 * Get recommendations for a farm with pagination.
 * @param {string} farmId - Farm ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Recommendations with pagination
 */
export const getFarmRecommendations = async (farmId, options = {}) => {
  const {
    page = 1,
    limit = 20,
    status,
    type,
    priority,
    since,
    until,
  } = options;

  const result = await db.recommendations.list({
    page,
    limit,
    farmId,
    status,
    type,
    priority,
    since,
    until,
  });

  const data = result?.data || result || [];
  const total = result?.count ?? result?.total ?? data.length;

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get active recommendations for a farm.
 * @param {string} farmId - Farm ID
 * @returns {Promise<Array>} Active recommendations
 */
export const getActiveRecommendations = async (farmId) => {
  const data = await db.recommendations.getByFarm(farmId, {
    statuses: ['pending', 'accepted'],
    limit: 50,
  });

  return data || [];
};

/**
 * Get pending recommendations for a user (for USSD/SMS)
 * @param {string} userId - User UUID
 * @param {number} limit - Maximum number to return
 * @returns {Promise<Array>} Pending recommendations
 */
export const getPendingRecommendations = async (userId, limit = 5) => {
  const data = await db.recommendations.getPending({ userId, limit });

  return data || [];
};

/**
 * Create a new recommendation
 * @param {Object} recommendationData - Recommendation data
 * @returns {Promise<Object>} Created recommendation
 */
export const createRecommendation = async (recommendationData) => {
  const {
    farmId,
    userId,
    type,
    priority = 'medium',
    title,
    titleRw,
    description,
    descriptionRw,
    recommendedAction,
    actionDeadline,
    supportingData = {},
    confidenceScore,
    modelVersion,
    irrigationScheduleId,
    fertilizationScheduleId,
    pestDetectionId,
    expiresAt,
    resolvedFarm,
    resolvedUser,
  } = recommendationData;

  const data = await db.recommendations.create({
    farm_id: farmId,
    user_id: userId,
    type,
    priority,
    status: 'pending',
    title,
    title_rw: titleRw,
    description,
    description_rw: descriptionRw,
    recommended_action: recommendedAction,
    action_deadline: actionDeadline ? new Date(actionDeadline).getTime() : undefined,
    supporting_data: supportingData,
    confidence_score: confidenceScore,
    model_version: modelVersion,
    irrigation_schedule_id: irrigationScheduleId,
    fertilization_schedule_id: fertilizationScheduleId,
    pest_detection_id: pestDetectionId,
    expires_at: expiresAt ? new Date(expiresAt).getTime() : undefined
  });

  logger.info(`Recommendation created: ${data._id} (${type}) for farm ${farmId}`);

  const [farm, user] = await Promise.all([
    resolvedFarm
      ? resolvedFarm
      : data.farm_id
        ? db.farms.getById(data.farm_id)
        : null,
    resolvedUser
      ? resolvedUser
      : data.user_id
        ? db.users.getById(data.user_id)
        : null,
  ]);

  data.farm = farm ? { id: farm._id, name: farm.name } : null;
  data.user = user || null;

  await logRecommendationAuditEvent({
    user_id: userId || undefined,
    action: 'CREATE_RECOMMENDATION',
    entity_type: 'recommendations',
    entity_id: data._id,
    new_values: pickRecommendationFields(data, [
      'farm_id',
      'user_id',
      'type',
      'priority',
      'status',
      'title',
      'title_rw',
      'description',
      'description_rw',
      'recommended_action',
      'action_deadline',
      'confidence_score',
      'model_version',
      'expires_at',
    ]),
  });

  // Notifications should not block recommendation creation latency.
  Promise.resolve()
    .then(() => triggerRecommendationNotification(data))
    .catch((error) => {
      logger.error('Failed to trigger recommendation notification:', error);
    });

  return data;
};

/**
 * Trigger notification for a recommendation
 * @param {Object} recommendation - Recommendation object with user data
 */
const triggerRecommendationNotification = async (recommendation) => {
  try {
    const { priority, type, title, title_rw, description, description_rw, farm } = recommendation;

    await notificationService.sendRecommendationNotification(
      recommendation.user_id,
      recommendation._id,
      {
        priority,
        type,
        title,
        titleRw: title_rw,
        description,
        descriptionRw: description_rw,
        farmName: farm?.name
      }
    );
  } catch (error) {
    logger.error('Failed to trigger recommendation notification:', error);
    // Don't throw - notification failure shouldn't fail recommendation creation
  }
};

/**
 * Update recommendation status
 * @param {string} recommendationId - Recommendation UUID
 * @param {string} status - New status
 * @param {Object} responseData - Additional response data
 * @returns {Promise<Object>} Updated recommendation
 */
export const updateRecommendationStatus = async (recommendationId, status, responseData = {}) => {
  const validStatuses = ['pending', 'accepted', 'rejected', 'deferred', 'executed', 'expired'];
  
  if (!validStatuses.includes(status)) {
    throw new BadRequestError('Invalid status');
  }

  const existing = await db.recommendations.getById(recommendationId);
  if (!existing) {
    throw new NotFoundError('Recommendation not found');
  }

  const updates = {
    status,
    responded_at: Date.now()
  };

  if (responseData.responseNotes) {
    updates.response_notes = responseData.responseNotes;
  }

  if (responseData.respondedBy) {
    updates.responded_by = responseData.respondedBy;
  }

  if (responseData.channel) {
    updates.response_channel = responseData.channel;
  }

  if (status === 'deferred' && responseData.deferredUntil) {
    updates.deferred_until = new Date(responseData.deferredUntil).getTime();
  }

  const data = await db.recommendations.update(recommendationId, updates);

  if (!data) {
    throw new NotFoundError('Recommendation not found');
  }

  logger.info(`Recommendation ${recommendationId} status updated to ${status}`);

  let finalRecommendation = data;

  // Recommendations backed by real operational schedules should remain visible
  // until the farmer completes the field action.
  if (status === 'accepted' && !['irrigation', 'pest_alert'].includes(existing.type)) {
    finalRecommendation = await executeRecommendation(data);
  }

  const responseAction =
    responseData.respondedBy || responseData.channel || responseData.responseNotes || responseData.deferredUntil
      ? 'RESPOND_RECOMMENDATION'
      : 'UPDATE_RECOMMENDATION_STATUS';

  await logRecommendationAuditEvent({
    user_id: responseData.respondedBy || existing.user_id || undefined,
    action: responseAction,
    entity_type: 'recommendations',
    entity_id: recommendationId,
    old_values: pickRecommendationFields(existing, [
      'status',
      'response_notes',
      'deferred_until',
      'responded_at',
    ]),
    new_values: {
      ...pickRecommendationFields(finalRecommendation, [
        'status',
        'responded_by',
        'response_channel',
        'response_notes',
        'deferred_until',
        'responded_at',
      ]),
      requested_status: status,
      responded_by: responseData.respondedBy || undefined,
      response_channel: responseData.channel || finalRecommendation.response_channel || undefined,
      channel: responseData.channel || undefined,
    },
  });

  return finalRecommendation;
};

/**
 * Respond to a recommendation using action aliases from the API.
 * @param {string} recommendationId - Recommendation ID
 * @param {string} action - accept, reject, or defer
 * @param {Object} responseData - Response metadata
 * @returns {Promise<Object>} Updated recommendation
 */
export const respondToRecommendation = async (recommendationId, action, responseData = {}) => {
  const statusByAction = {
    accept: 'accepted',
    reject: 'rejected',
    defer: 'deferred',
  };

  const normalizedStatus = statusByAction[action] || action;

  return updateRecommendationStatus(recommendationId, normalizedStatus, {
    responseNotes: responseData.reason || responseData.responseNotes,
    deferredUntil: responseData.deferUntil || responseData.deferredUntil,
    respondedBy: responseData.respondedBy,
    channel: responseData.channel,
  });
};

/**
 * Mark recommendation as completed.
 * @param {string} recommendationId - Recommendation ID
 * @param {Object} completionData - Completion details
 * @returns {Promise<Object>} Updated recommendation
 */
export const markCompleted = async (recommendationId, completionData = {}) => {
  const existing = await db.recommendations.getById(recommendationId);
  if (!existing) {
    throw new NotFoundError('Recommendation not found');
  }

  const updates = {
    status: 'executed',
    completed_at: Date.now(),
    updated_at: Date.now(),
  };

  if (completionData.notes) {
    updates.response_notes = completionData.notes;
  }

  if (completionData.outcome) {
    updates.outcome = completionData.outcome;
  }

  if (completionData.completedBy) {
    updates.completed_by = completionData.completedBy;
  }

  const data = await db.recommendations.update(recommendationId, updates);

  if (!data) {
    throw new NotFoundError('Recommendation not found');
  }

  await logRecommendationAuditEvent({
    user_id: completionData.completedBy || existing.user_id || undefined,
    action: 'COMPLETE_RECOMMENDATION',
    entity_type: 'recommendations',
    entity_id: recommendationId,
    old_values: pickRecommendationFields(existing, [
      'status',
      'response_notes',
      'completed_at',
      'completed_by',
      'outcome',
    ]),
    new_values: {
      ...pickRecommendationFields(data, [
        'status',
        'response_notes',
        'completed_at',
        'completed_by',
        'outcome',
      ]),
      completed_by: completionData.completedBy || data.completed_by || undefined,
    },
  });

  return data;
};

/**
 * Execute an accepted recommendation
 * @param {Object} recommendation - Recommendation object
 */
const executeRecommendation = async (recommendation) => {
  try {
    switch (recommendation.type) {
      case 'irrigation':
        if (recommendation.irrigation_schedule_id) {
          await db.irrigationSchedules.update(recommendation.irrigation_schedule_id, {
            is_executed: true,
            executed_at: Date.now()
          });
          
          logger.info(`Irrigation schedule ${recommendation.irrigation_schedule_id} marked as executed`);
        }
        break;

      case 'fertilization':
        if (recommendation.fertilization_schedule_id) {
          await db.fertilizationSchedules.update(recommendation.fertilization_schedule_id, {
            is_executed: true,
            executed_at: Date.now()
          });
          
          logger.info(`Fertilization schedule ${recommendation.fertilization_schedule_id} marked as executed`);
        }
        break;

      case 'pest_alert':
        // Mark as acknowledged
        logger.info(`Pest alert ${recommendation._id} acknowledged`);
        break;

      default:
        logger.debug(`No specific execution for recommendation type: ${recommendation.type}`);
    }

    // Update recommendation to executed
    const executedRecommendation = await db.recommendations.update(recommendation._id, { status: 'executed' });

    if (executedRecommendation) {
      await logRecommendationAuditEvent({
        user_id: recommendation.user_id || undefined,
        action: 'EXECUTE_RECOMMENDATION',
        entity_type: 'recommendations',
        entity_id: recommendation._id,
        old_values: pickRecommendationFields(recommendation, [
          'status',
          'irrigation_schedule_id',
          'fertilization_schedule_id',
        ]),
        new_values: {
          ...pickRecommendationFields(executedRecommendation, [
            'status',
            'irrigation_schedule_id',
            'fertilization_schedule_id',
          ]),
          execution_source: 'auto_accept',
        },
      });
    }

    return executedRecommendation || recommendation;

  } catch (error) {
    logger.error('Failed to execute recommendation:', error);
    throw error;
  }
};

/**
 * Create irrigation recommendation
 * @param {string} farmId - Farm UUID
 * @param {Object} analysisData - Irrigation analysis data
 * @returns {Promise<Object>} Created recommendation
 */
export const createIrrigationRecommendation = async (farmId, analysisData) => {
  const {
    currentSoilMoisture,
    targetSoilMoisture,
    waterVolume,
    duration,
    scheduledDate,
    scheduledTime,
    weatherImpact,
    confidence
  } = analysisData;

  const farm = await db.farms.getById(farmId);

  // Create irrigation schedule
  const schedule = await db.irrigationSchedules.create({
    farm_id: farmId,
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
    duration_minutes: duration,
    water_volume_liters: waterVolume,
    trigger_source: 'auto',
    soil_moisture_at_scheduling: currentSoilMoisture,
    target_soil_moisture: targetSoilMoisture
  });

  // Determine priority based on moisture level
  let priority = 'medium';
  if (currentSoilMoisture < 20) {
    priority = 'critical';
  } else if (currentSoilMoisture < 30) {
    priority = 'high';
  }

  // Create recommendation
  return createRecommendation({
    farmId,
    userId: farm.user_id,
    type: 'irrigation',
    priority,
    title: `Irrigation Needed - ${farm.name}`,
    titleRw: `Kuhira Bikenewe - ${farm.name}`,
    description: `Soil moisture is at ${currentSoilMoisture}%. Recommended irrigation: ${duration} minutes with ${waterVolume}L of water.`,
    descriptionRw: `Ubuhehere bw'ubutaka buri kuri ${currentSoilMoisture}%. Kuhira bisabwa: iminota ${duration} n'amazi ${waterVolume}L.`,
    recommendedAction: weatherImpact?.irrigationRecommendation === 'delay' 
      ? `Delay irrigation for ${weatherImpact.delayDays} day(s) due to expected rain`
      : `Irrigate for ${duration} minutes`,
    actionDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    supportingData: {
      currentSoilMoisture,
      targetSoilMoisture,
      waterVolume,
      duration,
      weatherImpact
    },
    confidenceScore: confidence,
    irrigationScheduleId: schedule._id,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    resolvedFarm: farm,
  });
};

/**
 * Create pest alert recommendation
 * @param {string} farmId - Farm UUID
 * @param {Object} detectionData - Pest detection data
 * @returns {Promise<Object>} Created recommendation
 */
export const createPestAlertRecommendation = async (farmId, detectionData) => {
  const {
    pestDetectionId,
    pestType,
    severity,
    confidence,
    affectedArea,
    imageUrl,
    expertVerified = false,
    expertId = null,
  } = detectionData;

  // Get farm and user info
  const farm = await db.farms.getById(farmId);

  // Determine priority based on severity
  const priorityMap = {
    'low': 'low',
    'moderate': 'medium',
    'high': 'high',
    'severe': 'critical'
  };
  const priority = priorityMap[severity] || 'medium';

  // Action recommendations based on severity
  const actionMap = {
    'low': 'Monitor affected area. Consider preventive measures.',
    'moderate': 'Apply recommended pesticides. Scout surrounding areas.',
    'high': 'Immediate pesticide application required. Isolate affected area.',
    'severe': 'Emergency response needed. Contact agricultural expert immediately.'
  };

  const actionMapRw = {
    'low': 'Kurikirana ahantu hahatiwe. Tekereza uburyo bwo kurinda.',
    'moderate': 'Koresha imiti isaba. Reba ahantu hakikije.',
    'high': 'Gukoresha imiti byihutirwa. Tondeka ahantu hahatiwe.',
    'severe': 'Igisubizo cy\'ihutirwa girakenewe. Vugana n\'umuhanga mu buhinzi vuba.'
  };

  return createRecommendation({
    farmId,
    userId: farm.user_id,
    type: 'pest_alert',
    priority,
    title: `${expertVerified ? 'Expert Confirmed' : 'Preliminary AI Screening'} - Fall Armyworm ${severity.toUpperCase()}`,
    titleRw: `${expertVerified ? 'Byemejwe n\'Umuhanga' : 'Isuzuma rya AI ryo Mbere'} - Inzuki z'Intambara ${severity.toUpperCase()}`,
    description: `${expertVerified ? 'Expert-confirmed' : 'Preliminary AI screening'} detected Fall Armyworm with ${Math.round(confidence * 100)}% confidence. Severity: ${severity}. Affected area: approximately ${affectedArea}%.`,
    descriptionRw: `${expertVerified ? 'Byemejwe n\'umuhanga' : 'Isuzuma rya AI ryo mbere'} ryabonye Inzuki z'Intambara n'icyizere cya ${Math.round(confidence * 100)}%. Uburemere: ${severity}. Ahantu hahatiwe: hafi ${affectedArea}%.`,
    recommendedAction: actionMap[severity],
    actionDeadline: priority === 'critical' 
      ? new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    supportingData: {
      pestType,
      severity,
      confidence,
      affectedArea,
      imageUrl,
      expertVerified,
      expertId,
    },
    confidenceScore: confidence,
    pestDetectionId,
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
  });
};

/**
 * Create fertilization recommendation
 * @param {string} farmId - Farm UUID
 * @param {Object} analysisData - Nutrient analysis data
 * @returns {Promise<Object>} Created recommendation
 */
export const createFertilizationRecommendation = async (farmId, analysisData) => {
  const {
    currentNutrients,
    targetNutrients,
    deficiencies,
    fertilizerType,
    quantities,
    growthStage,
    scheduledDate,
    resolvedFarm,
  } = analysisData;

  // Get farm and user info
  const farm = resolvedFarm || await db.farms.getById(farmId);

  // Create fertilization schedule
  const schedule = await db.fertilizationSchedules.create({
    farm_id: farmId,
    scheduled_date: scheduledDate || new Date().toISOString().split('T')[0],
    fertilizer_type: fertilizerType,
    nitrogen_kg: quantities.nitrogen,
    phosphorus_kg: quantities.phosphorus,
    potassium_kg: quantities.potassium,
    total_quantity_kg: quantities.total,
    growth_stage: growthStage,
    soil_npk_at_scheduling: currentNutrients
  });

  // Determine priority based on deficiency severity
  let priority = 'low';
  const hasModerateDeficiency = deficiencies.some(d => d.level === 'moderate');
  const hasSevereDeficiency = deficiencies.some(d => d.level === 'severe');
  
  if (hasSevereDeficiency) {
    priority = 'high';
  } else if (hasModerateDeficiency) {
    priority = 'medium';
  }

  const deficiencyList = deficiencies.map(d => d.nutrient).join(', ');

  return createRecommendation({
    farmId,
    userId: farm.user_id,
    type: 'fertilization',
    priority,
    title: `Fertilization Needed - ${deficiencyList}`,
    titleRw: `Ifumbire Ikenewe - ${deficiencyList}`,
    description: `Nutrient deficiencies detected: ${deficiencyList}. Apply ${quantities.total}kg of ${fertilizerType}.`,
    descriptionRw: `Ibura ry'intungamubiri ryabonetse: ${deficiencyList}. Shyira ${quantities.total}kg ya ${fertilizerType}.`,
    recommendedAction: `Apply ${fertilizerType}: N-${quantities.nitrogen}kg, P-${quantities.phosphorus}kg, K-${quantities.potassium}kg`,
    actionDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    supportingData: {
      currentNutrients,
      targetNutrients,
      deficiencies,
      fertilizerType,
      quantities,
      growthStage
    },
    fertilizationScheduleId: schedule._id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    resolvedFarm: farm,
  });
};

/**
 * Create a manual expert/admin recommendation for a farm.
 * @param {Object} input - Manual recommendation payload
 * @returns {Promise<Object>} Created recommendation
 */
export const createManualRecommendation = async (input = {}) => {
  const {
    farmId,
    type = 'general',
    priority = 'medium',
    title,
    description,
    actionRequired,
    validUntil,
    createdBy,
    metadata = {},
  } = input;

  if (!farmId) {
    throw new BadRequestError('Farm ID is required');
  }

  if (!title || !description || !actionRequired) {
    throw new BadRequestError('Title, description, and actionRequired are required');
  }

  const farm = await db.farms.getById(farmId);
  if (!farm) {
    throw new NotFoundError('Farm not found');
  }

  const [recipientUser, creator] = await Promise.all([
    farm.user_id ? db.users.getById(farm.user_id) : null,
    createdBy ? db.users.getById(createdBy) : null,
  ]);

  const recommendation = await createRecommendation({
    farmId,
    userId: farm.user_id,
    type,
    priority,
    title,
    description,
    recommendedAction: actionRequired,
    actionDeadline: validUntil || undefined,
    supportingData: {
      ...metadata,
      source: 'expert_manual',
      createdBy: createdBy || undefined,
      creatorRole: creator?.role || undefined,
      creatorName: [creator?.first_name, creator?.last_name].filter(Boolean).join(' ') || undefined,
    },
    expiresAt: validUntil || undefined,
    resolvedFarm: farm,
    resolvedUser: recipientUser,
  });

  await logRecommendationAuditEvent({
    user_id: createdBy || undefined,
    action: 'CREATE_MANUAL_RECOMMENDATION',
    entity_type: 'recommendations',
    entity_id: recommendation._id,
    new_values: {
      farm_id: recommendation.farm_id,
      user_id: recommendation.user_id,
      type: recommendation.type,
      priority: recommendation.priority,
      status: recommendation.status,
      title: recommendation.title,
      description: recommendation.description,
      recommended_action: recommendation.recommended_action,
      created_by: createdBy || undefined,
    },
  });

  return recommendation;
};

/**
 * Expire old pending recommendations
 */
export const expireOldRecommendations = async () => {
  const expired = await db.recommendations.expirePending(
    Date.now(),
    7 * 24 * 60 * 60 * 1000 // 7 days max age for recommendations without deadline
  );

  if (expired && expired.length > 0) {
    logger.info(`Expired ${expired.length} recommendations`);
  }
};

/**
 * Get recommendation statistics
 * @param {string} farmId - Optional farm ID for filtering
 * @param {string} userId - Optional user ID for filtering
 * @returns {Promise<Object>} Recommendation statistics
 */
export const getRecommendationStats = async (farmIdOrOptions = null, userIdArg = null) => {
  let farmId = null;
  let userId = null;
  let since;
  let until;

  if (farmIdOrOptions && typeof farmIdOrOptions === 'object' && !Array.isArray(farmIdOrOptions)) {
    farmId = farmIdOrOptions.farmId || null;
    userId = farmIdOrOptions.userId || null;

    const startDate = farmIdOrOptions.startDate || farmIdOrOptions.since;
    const endDate = farmIdOrOptions.endDate || farmIdOrOptions.until;

    if (startDate) {
      const parsedStart = new Date(startDate).getTime();
      if (Number.isFinite(parsedStart)) {
        since = parsedStart;
      }
    }

    if (endDate) {
      const parsedEnd = new Date(endDate).getTime();
      if (Number.isFinite(parsedEnd)) {
        until = parsedEnd;
      }
    }
  } else {
    farmId = farmIdOrOptions;
    userId = userIdArg;
  }

  const query = {
    farmId: farmId || undefined,
    userId: userId || undefined,
    since,
    until,
  };

  const stats = await db.recommendations.getStats(query);
  const summary = {
    total: stats.length,
    byType: {},
    byStatus: {},
    byPriority: {},
    byChannel: {},
    responseRate: 0,
    acceptanceRate: 0,
    avgResponseTime: null,
    averageResponseTime: null,
  };

  let respondedCount = 0;
  let acceptedCount = 0;
  let totalResponseTime = 0;

  for (const rec of stats) {
    summary.byType[rec.type] = (summary.byType[rec.type] || 0) + 1;
    summary.byStatus[rec.status] = (summary.byStatus[rec.status] || 0) + 1;
    summary.byPriority[rec.priority] = (summary.byPriority[rec.priority] || 0) + 1;

    if (rec.response_channel) {
      summary.byChannel[rec.response_channel] = (summary.byChannel[rec.response_channel] || 0) + 1;
    }

    if (rec.status === 'accepted' || rec.status === 'executed') {
      acceptedCount += 1;
    }

    if (rec.responded_at && rec.created_at) {
      respondedCount += 1;
      totalResponseTime += rec.responded_at - rec.created_at;
    }
  }

  if (summary.total > 0) {
    summary.responseRate = (respondedCount / summary.total) * 100;
    summary.acceptanceRate = (acceptedCount / summary.total) * 100;
  }

  if (respondedCount > 0) {
    const avgHours = Math.round(totalResponseTime / respondedCount / (1000 * 60 * 60));
    summary.avgResponseTime = avgHours;
    summary.averageResponseTime = avgHours;
  }

  return summary;
};

/**
 * Generate recommendations in bulk by running farm analysis.
 * @param {Object} options - Generation scope
 * @returns {Promise<Object>} Generation summary
 */
export const bulkGenerateRecommendations = async (options = {}) => {
  const {
    district,
    type,
    farmIds = [],
  } = options;

  let targetFarmIds = Array.isArray(farmIds) ? farmIds.filter(Boolean) : [];

  if (targetFarmIds.length === 0) {
    const farms = district
      ? (await db.farms.list({ page: 1, limit: 1000 })).data?.filter((farm) => String(farm?.district?.name || farm?.district || farm?.district_id || '') === String(district))
      : await db.farms.listActive();

    targetFarmIds = (farms || []).map((farm) => String(farm.id || farm._id)).filter(Boolean);
  }

  const aiService = await import('./aiService.js');
  const errors = [];
  let generated = 0;

  await runWithConcurrency(
    targetFarmIds,
    config.ai.recommendationGenerationConcurrency,
    async (farmId) => {
      try {
        if (type === 'irrigation') {
          await aiService.analyzeIrrigationNeeds(farmId);
        } else if (type === 'fertilization') {
          await aiService.analyzeNutrientNeeds(farmId);
        } else {
          await aiService.runComprehensiveAnalysis(farmId);
        }
        generated += 1;
      } catch (error) {
        errors.push({
          farmId,
          error: error.message || 'Generation failed',
        });
      }
    }
  );

  return {
    generated,
    farms: targetFarmIds,
    errors,
  };
};

export default {
  getRecommendationById,
  getUserRecommendations,
  getFarmRecommendations,
  getActiveRecommendations,
  getPendingRecommendations,
  createRecommendation,
  updateRecommendationStatus,
  respondToRecommendation,
  markCompleted,
  createIrrigationRecommendation,
  createPestAlertRecommendation,
  createFertilizationRecommendation,
  createManualRecommendation,
  expireOldRecommendations,
  getRecommendationStats,
  bulkGenerateRecommendations,
};
