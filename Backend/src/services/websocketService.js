/**
 * WebSocket Service - Smart Maize Farming System
 * 
 * Provides real-time communication between backend and frontend clients.
 * Handles sensor data streaming, alerts, and system notifications.
 * 
 * @module services/websocketService
 */

import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '@clerk/clerk-sdk-node';
import { URL } from 'url';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// =====================================================
// Types and Constants
// =====================================================

const WS_EVENTS = {
  // Sensor events
  SENSOR_DATA: 'sensor:data',
  SENSOR_STATUS: 'sensor:status',
  SENSOR_ALERT: 'sensor:alert',
  
  // Farm events
  FARM_UPDATE: 'farm:update',
  FARM_HEALTH: 'farm:health',
  
  // Recommendation events
  RECOMMENDATION_NEW: 'recommendation:new',
  RECOMMENDATION_UPDATE: 'recommendation:update',
  
  // Alert events
  ALERT_NEW: 'alert:new',
  ALERT_DISMISSED: 'alert:dismissed',
  
  // Pest detection events
  PEST_DETECTION_COMPLETE: 'pest:detection:complete',
  PEST_DETECTION_ALERT: 'pest:detection:alert',
  
  // Weather events
  WEATHER_UPDATE: 'weather:update',
  WEATHER_ALERT: 'weather:alert',
  
  // System events
  SYSTEM_HEALTH: 'system:health',
  MAINTENANCE_NOTICE: 'system:maintenance',
  
  // Connection events
  CONNECTED: 'connection:established',
  AUTHENTICATED: 'connection:authenticated',
  ERROR: 'connection:error',
};

/**
 * Client connection tracking
 * @typedef {Object} ClientConnection
 * @property {WebSocket} ws - WebSocket connection
 * @property {string} userId - Authenticated user ID
 * @property {string} role - User role (farmer/expert/admin)
 * @property {Set<string>} subscribedFarms - Farm IDs subscribed to
 * @property {boolean} isAuthenticated - Authentication status
 * @property {Date} connectedAt - Connection timestamp
 * @property {Date} lastActivity - Last activity timestamp
 */

// =====================================================
// WebSocket Manager Class
// =====================================================

class WebSocketManager {
  constructor() {
    /** @type {WebSocketServer|null} */
    this.wss = null;
    
    /** @type {Map<WebSocket, ClientConnection>} */
    this.clients = new Map();
    
    /** @type {Map<string, Set<WebSocket>>} */
    this.farmSubscriptions = new Map();
    
    /** @type {Map<string, Set<WebSocket>>} */
    this.userConnections = new Map();
    
    this.heartbeatInterval = null;
  }

  /**
   * Initialize WebSocket server
   * @param {import('http').Server} server - HTTP server instance
   */
  initialize(server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      clientTracking: true,
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });

    // Start heartbeat monitoring
    this.startHeartbeat();

    logger.info('WebSocket server initialized');
    return this;
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {import('http').IncomingMessage} req - HTTP request
   */
  async handleConnection(ws, req) {
    const clientIp = req.socket.remoteAddress;
    logger.info(`New WebSocket connection from ${clientIp}`);

    // Extract token from query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    // Initialize client tracking
    const client = {
      ws,
      userId: null,
      role: null,
      subscribedFarms: new Set(),
      isAuthenticated: false,
      connectedAt: new Date(),
      lastActivity: new Date(),
    };

    this.clients.set(ws, client);

    // Authenticate if token provided
    if (token) {
      await this.authenticateClient(ws, token);
    }

    // Send connection established message
    this.sendToClient(ws, {
      type: WS_EVENTS.CONNECTED,
      payload: { 
        message: 'Connected to Smart Maize Farming System',
        requiresAuth: !client.isAuthenticated,
      },
    });

    // Set up message handler
    ws.on('message', (data) => this.handleMessage(ws, data));
    
    // Set up close handler
    ws.on('close', (code, reason) => this.handleClose(ws, code, reason));
    
    // Set up error handler
    ws.on('error', (error) => {
      logger.error('WebSocket client error:', error);
    });

    // Set up pong handler for heartbeat
    ws.on('pong', () => {
      const client = this.clients.get(ws);
      if (client) {
        client.lastActivity = new Date();
      }
    });
  }

  /**
   * Authenticate client using JWT token
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} token - JWT token
   */
  async authenticateClient(ws, token) {
    const client = this.clients.get(ws);
    if (!client) return;

    try {
      const payload = await verifyToken(token, {
        secretKey: config.clerk.secretKey,
      });

      client.userId = payload.sub;
      client.isAuthenticated = true;
      
      // Get user role from token metadata or default to farmer
      client.role = payload.metadata?.role || 'farmer';

      // Track user connection
      if (!this.userConnections.has(client.userId)) {
        this.userConnections.set(client.userId, new Set());
      }
      this.userConnections.get(client.userId).add(ws);

      logger.info(`Client authenticated: ${client.userId} (${client.role})`);

      this.sendToClient(ws, {
        type: WS_EVENTS.AUTHENTICATED,
        payload: { 
          userId: client.userId,
          role: client.role,
        },
      });
    } catch (error) {
      logger.warn('WebSocket authentication failed:', error.message);
      this.sendToClient(ws, {
        type: WS_EVENTS.ERROR,
        payload: { 
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
        },
      });
    }
  }

  /**
   * Handle incoming message from client
   * @param {WebSocket} ws - WebSocket connection
   * @param {Buffer} data - Raw message data
   */
  async handleMessage(ws, data) {
    const client = this.clients.get(ws);
    if (!client) return;

    client.lastActivity = new Date();

    try {
      const message = JSON.parse(data.toString());
      const { type, payload } = message;

      switch (type) {
        case 'authenticate':
          if (payload.token) {
            await this.authenticateClient(ws, payload.token);
          }
          break;

        case 'ping':
          this.sendToClient(ws, { type: 'pong', payload: {}, timestamp: new Date().toISOString() });
          break;

        case 'subscribe:farm':
          if (client.isAuthenticated && payload.farmId) {
            this.subscribeFarm(ws, payload.farmId);
          }
          break;

        case 'unsubscribe:farm':
          if (payload.farmId) {
            this.unsubscribeFarm(ws, payload.farmId);
          }
          break;

        case 'alert:dismiss':
          // Broadcast to other connections of same user
          if (client.userId && payload.id) {
            this.broadcastToUser(client.userId, {
              type: WS_EVENTS.ALERT_DISMISSED,
              payload: { id: payload.id },
            }, ws);
          }
          break;

        default:
          logger.debug(`Unknown WebSocket message type: ${type}`);
      }
    } catch (error) {
      logger.error('Error handling WebSocket message:', error);
      this.sendToClient(ws, {
        type: WS_EVENTS.ERROR,
        payload: { message: 'Invalid message format' },
      });
    }
  }

  /**
   * Handle client disconnection
   * @param {WebSocket} ws - WebSocket connection
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  handleClose(ws, code, reason) {
    const client = this.clients.get(ws);
    
    if (client) {
      logger.info(`Client disconnected: ${client.userId || 'anonymous'} (code: ${code})`);

      // Remove from farm subscriptions
      for (const farmId of client.subscribedFarms) {
        const farmSubs = this.farmSubscriptions.get(farmId);
        if (farmSubs) {
          farmSubs.delete(ws);
          if (farmSubs.size === 0) {
            this.farmSubscriptions.delete(farmId);
          }
        }
      }

      // Remove from user connections
      if (client.userId && this.userConnections.has(client.userId)) {
        const userConns = this.userConnections.get(client.userId);
        userConns.delete(ws);
        if (userConns.size === 0) {
          this.userConnections.delete(client.userId);
        }
      }

      this.clients.delete(ws);
    }
  }

  /**
   * Subscribe client to farm updates
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} farmId - Farm ID
   */
  subscribeFarm(ws, farmId) {
    const client = this.clients.get(ws);
    if (!client) return;

    // TODO: Verify client has access to this farm

    client.subscribedFarms.add(farmId);

    if (!this.farmSubscriptions.has(farmId)) {
      this.farmSubscriptions.set(farmId, new Set());
    }
    this.farmSubscriptions.get(farmId).add(ws);

    logger.debug(`Client ${client.userId} subscribed to farm ${farmId}`);
  }

  /**
   * Unsubscribe client from farm updates
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} farmId - Farm ID
   */
  unsubscribeFarm(ws, farmId) {
    const client = this.clients.get(ws);
    if (!client) return;

    client.subscribedFarms.delete(farmId);

    const farmSubs = this.farmSubscriptions.get(farmId);
    if (farmSubs) {
      farmSubs.delete(ws);
      if (farmSubs.size === 0) {
        this.farmSubscriptions.delete(farmId);
      }
    }

    logger.debug(`Client ${client.userId} unsubscribed from farm ${farmId}`);
  }

  // =====================================================
  // Broadcasting Methods
  // =====================================================

  /**
   * Send message to specific client
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} message - Message to send
   */
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({
          ...message,
          timestamp: message.timestamp || new Date().toISOString(),
        }));
      } catch (error) {
        logger.error('Error sending message to client:', error);
      }
    }
  }

  /**
   * Broadcast message to all clients subscribed to a farm
   * @param {string} farmId - Farm ID
   * @param {Object} message - Message to send
   */
  broadcastToFarm(farmId, message) {
    const subscribers = this.farmSubscriptions.get(farmId);
    if (!subscribers) return;

    const messageWithTimestamp = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    subscribers.forEach((ws) => {
      this.sendToClient(ws, messageWithTimestamp);
    });

    logger.debug(`Broadcast to farm ${farmId}: ${message.type} (${subscribers.size} clients)`);
  }

  /**
   * Broadcast message to all connections of a user
   * @param {string} userId - User ID
   * @param {Object} message - Message to send
   * @param {WebSocket} exclude - Optional connection to exclude
   */
  broadcastToUser(userId, message, exclude = null) {
    const userConns = this.userConnections.get(userId);
    if (!userConns) return;

    const messageWithTimestamp = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    userConns.forEach((ws) => {
      if (ws !== exclude) {
        this.sendToClient(ws, messageWithTimestamp);
      }
    });
  }

  /**
   * Broadcast message to all clients with specific role
   * @param {string} role - User role
   * @param {Object} message - Message to send
   */
  broadcastToRole(role, message) {
    const messageWithTimestamp = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    this.clients.forEach((client, ws) => {
      if (client.isAuthenticated && client.role === role) {
        this.sendToClient(ws, messageWithTimestamp);
      }
    });
  }

  /**
   * Broadcast message to all authenticated clients
   * @param {Object} message - Message to send
   */
  broadcastToAll(message) {
    const messageWithTimestamp = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    this.clients.forEach((client, ws) => {
      if (client.isAuthenticated) {
        this.sendToClient(ws, messageWithTimestamp);
      }
    });
  }

  // =====================================================
  // Event Emission Methods (Called by other services)
  // =====================================================

  /**
   * Emit sensor data update
   */
  emitSensorData(farmId, sensorData) {
    this.broadcastToFarm(farmId, {
      type: WS_EVENTS.SENSOR_DATA,
      payload: { farmId, ...sensorData },
    });
  }

  /**
   * Emit new alert
   */
  emitAlert(alert) {
    // Send to farm subscribers if farm-specific
    if (alert.farmId) {
      this.broadcastToFarm(alert.farmId, {
        type: WS_EVENTS.ALERT_NEW,
        payload: alert,
      });
    }

    // Also send to admins and experts
    this.broadcastToRole('admin', {
      type: WS_EVENTS.ALERT_NEW,
      payload: alert,
    });

    this.broadcastToRole('expert', {
      type: WS_EVENTS.ALERT_NEW,
      payload: alert,
    });
  }

  /**
   * Emit new recommendation
   */
  emitRecommendation(recommendation) {
    if (recommendation.farmId) {
      this.broadcastToFarm(recommendation.farmId, {
        type: WS_EVENTS.RECOMMENDATION_NEW,
        payload: recommendation,
      });
    }
  }

  /**
   * Emit recommendation update
   */
  emitRecommendationUpdate(recommendation) {
    if (recommendation.farmId) {
      this.broadcastToFarm(recommendation.farmId, {
        type: WS_EVENTS.RECOMMENDATION_UPDATE,
        payload: recommendation,
      });
    }
  }

  /**
   * Emit pest detection result
   */
  emitPestDetectionResult(result) {
    if (result.farmId) {
      this.broadcastToFarm(result.farmId, {
        type: WS_EVENTS.PEST_DETECTION_COMPLETE,
        payload: result,
      });
    }

    // If pests detected, also emit alert
    if (result.detections && result.detections.length > 0) {
      this.broadcastToFarm(result.farmId, {
        type: WS_EVENTS.PEST_DETECTION_ALERT,
        payload: {
          id: result.id,
          farmId: result.farmId,
          type: 'warning',
          category: 'pest',
          title: 'Pest Detected',
          message: `${result.detections[0].pest} detected with ${(result.detections[0].confidence * 100).toFixed(0)}% confidence`,
          requiresAction: true,
        },
      });
    }
  }

  /**
   * Emit weather update
   */
  emitWeatherUpdate(farmId, weatherData) {
    this.broadcastToFarm(farmId, {
      type: WS_EVENTS.WEATHER_UPDATE,
      payload: { farmId, ...weatherData },
    });
  }

  /**
   * Emit weather alert
   */
  emitWeatherAlert(farmId, alert) {
    this.broadcastToFarm(farmId, {
      type: WS_EVENTS.WEATHER_ALERT,
      payload: { farmId, ...alert },
    });
  }

  /**
   * Emit system health update
   */
  emitSystemHealth(health) {
    this.broadcastToRole('admin', {
      type: WS_EVENTS.SYSTEM_HEALTH,
      payload: health,
    });
  }

  /**
   * Emit maintenance notice
   */
  emitMaintenanceNotice(notice) {
    this.broadcastToAll({
      type: WS_EVENTS.MAINTENANCE_NOTICE,
      payload: notice,
    });
  }

  // =====================================================
  // Heartbeat and Cleanup
  // =====================================================

  /**
   * Start heartbeat monitoring
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      
      this.wss.clients.forEach((ws) => {
        const client = this.clients.get(ws);
        
        if (!client) {
          ws.terminate();
          return;
        }

        // Check for stale connections (no activity in 2 minutes)
        const inactiveMs = now - client.lastActivity;
        if (inactiveMs > 120000) {
          logger.info(`Terminating inactive connection: ${client.userId}`);
          ws.terminate();
          return;
        }

        // Send ping
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const stats = {
      totalConnections: this.clients.size,
      authenticatedConnections: 0,
      roleDistribution: { farmer: 0, expert: 0, admin: 0 },
      farmSubscriptions: this.farmSubscriptions.size,
    };

    this.clients.forEach((client) => {
      if (client.isAuthenticated) {
        stats.authenticatedConnections++;
        if (client.role && stats.roleDistribution[client.role] !== undefined) {
          stats.roleDistribution[client.role]++;
        }
      }
    });

    return stats;
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown() {
    this.stopHeartbeat();
    
    // Close all connections
    this.clients.forEach((client, ws) => {
      ws.close(1001, 'Server shutting down');
    });

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    logger.info('WebSocket server shutdown complete');
  }
}

// =====================================================
// Singleton Instance
// =====================================================

const wsManager = new WebSocketManager();

export { wsManager, WS_EVENTS };
export default wsManager;
