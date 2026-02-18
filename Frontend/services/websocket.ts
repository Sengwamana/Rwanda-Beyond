// =====================================================
// WebSocket Service - Smart Maize Farming System
// Real-time data synchronization between frontend and backend
// =====================================================

import { WS_BASE_URL } from './apiClient';

// =====================================================
// Types and Interfaces
// =====================================================

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
  correlationId?: string;
}

export interface SensorDataUpdate {
  farmId: string;
  sensorId: string;
  sensorType: string;
  value: number;
  unit: string;
  timestamp: string;
}

export interface AlertNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  category: 'pest' | 'irrigation' | 'weather' | 'sensor' | 'system';
  title: string;
  message: string;
  farmId?: string;
  timestamp: string;
  requiresAction?: boolean;
}

export interface RecommendationUpdate {
  id: string;
  farmId: string;
  type: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: string;
}

export interface SystemHealthUpdate {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, 'up' | 'down' | 'degraded'>;
  timestamp: string;
}

// Event types
export const WS_EVENTS = {
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
} as const;

type EventCallback<T = unknown> = (data: T) => void;
type EventMap = Map<string, Set<EventCallback>>;

// =====================================================
// WebSocket Manager Class
// =====================================================

class WebSocketManager {
  private socket: WebSocket | null = null;
  private status: WebSocketStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private heartbeatInterval: number | null = null;
  private heartbeatTimeout: number | null = null;
  private eventListeners: EventMap = new Map();
  private statusListeners: Set<(status: WebSocketStatus) => void> = new Set();
  private pendingMessages: WebSocketMessage[] = [];
  private authToken: string | null = null;
  private userId: string | null = null;
  private userRole: string | null = null;
  private subscribedFarms: Set<string> = new Set();

  /**
   * Connect to WebSocket server
   */
  connect(token: string, userId: string, userRole: string): void {
    this.authToken = token;
    this.userId = userId;
    this.userRole = userRole;

    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }

    this.setStatus('connecting');
    
    try {
      const wsUrl = `${WS_BASE_URL}?token=${encodeURIComponent(token)}`;
      this.socket = new WebSocket(wsUrl);
      this.setupSocketHandlers();
    } catch (error) {
      console.error('[WS] Connection error:', error);
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.clearHeartbeat();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
    
    this.setStatus('disconnected');
    this.subscribedFarms.clear();
    this.authToken = null;
    this.userId = null;
    this.userRole = null;
  }

  /**
   * Subscribe to events for a specific farm
   */
  subscribeFarm(farmId: string): void {
    if (!this.subscribedFarms.has(farmId)) {
      this.subscribedFarms.add(farmId);
      this.send({
        type: 'subscribe:farm',
        payload: { farmId },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Unsubscribe from farm events
   */
  unsubscribeFarm(farmId: string): void {
    if (this.subscribedFarms.has(farmId)) {
      this.subscribedFarms.delete(farmId);
      this.send({
        type: 'unsubscribe:farm',
        payload: { farmId },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Add event listener
   */
  on<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback as EventCallback);

    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Remove event listener
   */
  off<T>(event: string, callback: EventCallback<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback as EventCallback);
    }
  }

  /**
   * Add status change listener
   */
  onStatusChange(callback: (status: WebSocketStatus) => void): () => void {
    this.statusListeners.add(callback);
    // Immediately notify of current status
    callback(this.status);
    
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  /**
   * Get current connection status
   */
  getStatus(): WebSocketStatus {
    return this.status;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.status === 'connected' && this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Send message to server
   */
  send(message: WebSocketMessage): void {
    if (this.isConnected()) {
      this.socket!.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is established
      this.pendingMessages.push(message);
    }
  }

  // =====================================================
  // Private Methods
  // =====================================================

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.log('[WS] Connection established');
      this.setStatus('connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.sendAuthentication();
      this.resubscribeFarms();
      this.flushPendingMessages();
    };

    this.socket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('[WS] Failed to parse message:', error);
      }
    };

    this.socket.onerror = (event) => {
      console.error('[WS] Socket error:', event);
      this.setStatus('error');
    };

    this.socket.onclose = (event) => {
      console.log(`[WS] Connection closed: ${event.code} - ${event.reason}`);
      this.clearHeartbeat();
      
      if (event.code !== 1000) {
        // Abnormal closure - attempt reconnect
        this.scheduleReconnect();
      } else {
        this.setStatus('disconnected');
      }
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    const { type, payload } = message;

    // Handle system messages
    if (type === 'pong') {
      this.resetHeartbeatTimeout();
      return;
    }

    if (type === WS_EVENTS.AUTHENTICATED) {
      console.log('[WS] Authentication successful');
      return;
    }

    if (type === WS_EVENTS.ERROR) {
      console.error('[WS] Server error:', payload);
      this.emit(WS_EVENTS.ERROR, payload);
      return;
    }

    // Emit to registered listeners
    this.emit(type, payload);
  }

  private emit(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WS] Error in event handler for ${event}:`, error);
        }
      });
    }

    // Also emit to wildcard listeners
    const wildcardListeners = this.eventListeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach((callback) => {
        try {
          callback({ event, data });
        } catch (error) {
          console.error('[WS] Error in wildcard handler:', error);
        }
      });
    }
  }

  private setStatus(status: WebSocketStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.statusListeners.forEach((callback) => callback(status));
    }
  }

  private sendAuthentication(): void {
    if (this.authToken && this.userId) {
      this.send({
        type: 'authenticate',
        payload: {
          token: this.authToken,
          userId: this.userId,
          role: this.userRole,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  private resubscribeFarms(): void {
    this.subscribedFarms.forEach((farmId) => {
      this.send({
        type: 'subscribe:farm',
        payload: { farmId },
        timestamp: new Date().toISOString(),
      });
    });
  }

  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnection attempts reached');
      this.setStatus('error');
      return;
    }

    this.setStatus('reconnecting');
    this.reconnectAttempts++;

    // Exponential backoff with jitter
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) + Math.random() * 1000,
      this.maxReconnectDelay
    );

    console.log(`[WS] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (this.authToken && this.userId && this.userRole) {
        this.connect(this.authToken, this.userId, this.userRole);
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    
    // Send ping every 30 seconds
    this.heartbeatInterval = window.setInterval(() => {
      if (this.isConnected()) {
        this.send({
          type: 'ping',
          payload: {},
          timestamp: new Date().toISOString(),
        });
        this.setHeartbeatTimeout();
      }
    }, 30000);
  }

  private setHeartbeatTimeout(): void {
    this.clearHeartbeatTimeout();
    
    // If no pong received within 10 seconds, reconnect
    this.heartbeatTimeout = window.setTimeout(() => {
      console.warn('[WS] Heartbeat timeout - reconnecting');
      this.socket?.close();
      this.scheduleReconnect();
    }, 10000);
  }

  private resetHeartbeatTimeout(): void {
    this.clearHeartbeatTimeout();
  }

  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.clearHeartbeatTimeout();
  }

  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }
}

// =====================================================
// Singleton Instance
// =====================================================

export const wsManager = new WebSocketManager();

// =====================================================
// React Hook for WebSocket
// =====================================================

export const createWebSocketHook = () => {
  return {
    connect: wsManager.connect.bind(wsManager),
    disconnect: wsManager.disconnect.bind(wsManager),
    subscribe: wsManager.on.bind(wsManager),
    unsubscribe: wsManager.off.bind(wsManager),
    subscribeFarm: wsManager.subscribeFarm.bind(wsManager),
    unsubscribeFarm: wsManager.unsubscribeFarm.bind(wsManager),
    send: wsManager.send.bind(wsManager),
    getStatus: wsManager.getStatus.bind(wsManager),
    onStatusChange: wsManager.onStatusChange.bind(wsManager),
    isConnected: wsManager.isConnected.bind(wsManager),
  };
};

export default wsManager;
