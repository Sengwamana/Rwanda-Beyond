/**
 * IoT Device Authentication Middleware
 * 
 * Provides secure authentication for IoT sensor devices
 * using device tokens and shared secrets.
 * 
 * @module middleware/deviceAuth
 */

import crypto from 'crypto';
import config from '../config/index.js';
import { db } from '../database/convex.js';
import { DeviceAuthError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * Generate a secure device token
 * @param {string} deviceId - Unique device identifier
 * @returns {Promise<string>} Generated token
 */
export const generateDeviceToken = async (deviceId) => {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto
    .createHmac('sha256', config.iot.deviceSecret)
    .update(token)
    .digest('hex');

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + config.iot.tokenExpiry);

  // Store token hash in database
  try {
    await db.iotDeviceTokens.create({
      device_id: deviceId,
      token_hash: tokenHash,
      expires_at: expiresAt.getTime()
    });
  } catch (error) {
    logger.error('Failed to store device token:', error);
    throw new Error('Failed to generate device token');
  }

  return token;
};

/**
 * Verify device token
 * @param {string} deviceId - Device identifier
 * @param {string} token - Token to verify
 * @returns {Promise<boolean>} Verification result
 */
const verifyDeviceToken = async (deviceId, token) => {
  const tokenHash = crypto
    .createHmac('sha256', config.iot.deviceSecret)
    .update(token)
    .digest('hex');

  const data = await db.iotDeviceTokens.verify(deviceId, tokenHash);

  if (!data) {
    return false;
  }

  const lastUsedAt = data.last_used_at || 0;
  const shouldUpdateLastUsed =
    Date.now() - lastUsedAt >= config.iot.tokenLastUsedWriteIntervalMs;

  if (shouldUpdateLastUsed) {
    try {
      await db.iotDeviceTokens.updateLastUsed(data._id);
    } catch (error) {
      logger.warn('Failed to update device token last-used timestamp:', error?.message || error);
    }
  }

  return true;
};

/**
 * Verify HMAC signature for device requests
 * @param {string} payload - Request payload
 * @param {string} signature - HMAC signature
 * @param {string} timestamp - Request timestamp
 * @returns {boolean} Verification result
 */
const verifyHmacSignature = (payload, signature, timestamp) => {
  // Check timestamp is within 5 minutes
  const parsedTimestamp = Number(timestamp);
  if (!Number.isFinite(parsedTimestamp)) {
    return false;
  }

  const requestTimeSeconds =
    parsedTimestamp > 1e12
      ? Math.floor(parsedTimestamp / 1000)
      : Math.floor(parsedTimestamp);
  const currentTime = Math.floor(Date.now() / 1000);
  
  if (Math.abs(currentTime - requestTimeSeconds) > 300) {
    logger.warn('Device request timestamp out of range');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', config.iot.deviceSecret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  if (
    typeof signature !== 'string' ||
    signature.length !== expectedSignature.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

/**
 * IoT device authentication middleware
 * Supports both token-based and HMAC-based authentication
 */
export const authenticateDevice = async (req, res, next) => {
  try {
    const deviceId = req.headers['x-device-id'];
    const authorizationHeader = req.headers.authorization;
    const bearerToken =
      typeof authorizationHeader === 'string'
        ? authorizationHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null
        : null;
    const deviceToken = req.headers['x-device-token'] || bearerToken;
    const hmacSignature = req.headers['x-hmac-signature'];
    const timestamp = req.headers['x-timestamp'];

    if (!deviceId) {
      throw new DeviceAuthError('Missing device ID');
    }

    // Method 1: Token-based authentication
    if (deviceToken) {
      const isValid = await verifyDeviceToken(deviceId, deviceToken);
      if (!isValid) {
        throw new DeviceAuthError('Invalid or expired device token');
      }
    }
    // Method 2: HMAC signature authentication
    else if (hmacSignature && timestamp) {
      const payload = JSON.stringify(req.body);
      const isValid = verifyHmacSignature(payload, hmacSignature, timestamp);
      if (!isValid) {
        throw new DeviceAuthError('Invalid HMAC signature');
      }
    }
    // No authentication provided
    else {
      throw new DeviceAuthError('Missing authentication credentials');
    }

    // Only hit the sensor/device lookup after authentication passes.
    const sensor = await db.sensors.getDeviceInfo(deviceId);

    if (!sensor) {
      throw new DeviceAuthError('Unknown device');
    }

    if (sensor.status !== 'active') {
      throw new DeviceAuthError(`Device is ${sensor.status}`);
    }

    // Attach device info to request
    req.device = {
      id: deviceId,
      sensorId: sensor.id || sensor._id,
      farmId: sensor.farm_id
    };

    next();
  } catch (error) {
    logger.warn('Device authentication failed:', error.message);
    
    const statusCode = error.statusCode || 401;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Device authentication failed',
      code: error.code || 'DEVICE_AUTH_FAILED'
    });
  }
};

/**
 * Optional device authentication middleware
 * Allows requests without device credentials but validates if provided
 */
export const optionalDeviceAuth = async (req, res, next) => {
  const deviceId = req.headers['x-device-id'];
  
  if (!deviceId) {
    return next();
  }

  return authenticateDevice(req, res, next);
};

/**
 * Revoke device token
 * @param {string} deviceId - Device identifier
 * @param {string} token - Token to revoke (optional, revokes all if not provided)
 */
export const revokeDeviceToken = async (deviceId, token = null) => {
  try {
    if (token) {
      const tokenHash = crypto
        .createHmac('sha256', config.iot.deviceSecret)
        .update(token)
        .digest('hex');
      await db.iotDeviceTokens.revoke(deviceId, tokenHash);
    } else {
      await db.iotDeviceTokens.revoke(deviceId, null);
    }
  } catch (error) {
    logger.error('Failed to revoke device token:', error);
    throw error;
  }

  logger.info(`Device token(s) revoked for device: ${deviceId}`);
};

export default {
  authenticateDevice,
  optionalDeviceAuth,
  generateDeviceToken,
  revokeDeviceToken
};
