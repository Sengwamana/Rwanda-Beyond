// =====================================================
// WebSocket React Hook - Smart Maize Farming System
// React integration for real-time WebSocket communication
// =====================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import wsManager, {
  WebSocketStatus,
  WS_EVENTS,
  SensorDataUpdate,
  AlertNotification,
  RecommendationUpdate,
} from '../services/websocket';

// =====================================================
// Main WebSocket Hook
// =====================================================

export function useWebSocket() {
  const { getToken, userId, isSignedIn } = useAuth();
  const [status, setStatus] = useState<WebSocketStatus>(wsManager.getStatus());
  const [isConnected, setIsConnected] = useState(false);
  const userRoleRef = useRef<string>('farmer');

  // Connect to WebSocket when authenticated
  useEffect(() => {
    if (!isSignedIn || !userId) {
      wsManager.disconnect();
      return;
    }

    const connect = async () => {
      try {
        const token = await getToken();
        if (token) {
          wsManager.connect(token, userId, userRoleRef.current);
        }
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
      }
    };

    connect();

    // Cleanup on unmount
    return () => {
      // Don't disconnect on unmount - let app manage lifecycle
    };
  }, [isSignedIn, userId, getToken]);

  // Subscribe to status changes
  useEffect(() => {
    const unsubscribe = wsManager.onStatusChange((newStatus) => {
      setStatus(newStatus);
      setIsConnected(newStatus === 'connected');
    });

    return unsubscribe;
  }, []);

  // Set user role
  const setUserRole = useCallback((role: string) => {
    userRoleRef.current = role;
  }, []);

  // Subscribe to farm
  const subscribeFarm = useCallback((farmId: string) => {
    wsManager.subscribeFarm(farmId);
  }, []);

  // Unsubscribe from farm
  const unsubscribeFarm = useCallback((farmId: string) => {
    wsManager.unsubscribeFarm(farmId);
  }, []);

  // Manual reconnect
  const reconnect = useCallback(async () => {
    if (!isSignedIn || !userId) return;

    try {
      const token = await getToken();
      if (token) {
        wsManager.disconnect();
        wsManager.connect(token, userId, userRoleRef.current);
      }
    } catch (error) {
      console.error('Failed to reconnect:', error);
    }
  }, [isSignedIn, userId, getToken]);

  return {
    status,
    isConnected,
    setUserRole,
    subscribeFarm,
    unsubscribeFarm,
    reconnect,
    disconnect: wsManager.disconnect.bind(wsManager),
  };
}

// =====================================================
// Sensor Data Hook
// =====================================================

export function useSensorData(farmId: string | null) {
  const [sensorData, setSensorData] = useState<Map<string, SensorDataUpdate>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!farmId) return;

    // Subscribe to farm
    wsManager.subscribeFarm(farmId);

    // Listen for sensor data updates
    const handleSensorData = (data: SensorDataUpdate) => {
      if (data.farmId === farmId) {
        setSensorData((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.sensorId, data);
          return newMap;
        });
        setLastUpdate(new Date());
      }
    };

    const unsubscribe = wsManager.on(WS_EVENTS.SENSOR_DATA, handleSensorData);

    return () => {
      unsubscribe();
      wsManager.unsubscribeFarm(farmId);
    };
  }, [farmId]);

  // Get sensor by ID
  const getSensor = useCallback(
    (sensorId: string): SensorDataUpdate | undefined => {
      return sensorData.get(sensorId);
    },
    [sensorData]
  );

  // Get all sensors as array
  const getAllSensors = useCallback((): SensorDataUpdate[] => {
    return Array.from(sensorData.values());
  }, [sensorData]);

  // Get sensors by type
  const getSensorsByType = useCallback(
    (type: string): SensorDataUpdate[] => {
      return Array.from(sensorData.values()).filter((s) => s.sensorType === type);
    },
    [sensorData]
  );

  return {
    sensorData,
    lastUpdate,
    getSensor,
    getAllSensors,
    getSensorsByType,
  };
}

// =====================================================
// Alerts Hook
// =====================================================

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Listen for new alerts
    const handleNewAlert = (alert: AlertNotification) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 100)); // Keep last 100 alerts
      setUnreadCount((prev) => prev + 1);
    };

    // Listen for dismissed alerts
    const handleDismissed = (data: { id: string }) => {
      setAlerts((prev) => prev.filter((a) => a.id !== data.id));
    };

    const unsubscribeNew = wsManager.on(WS_EVENTS.ALERT_NEW, handleNewAlert);
    const unsubscribeDismissed = wsManager.on(WS_EVENTS.ALERT_DISMISSED, handleDismissed);

    return () => {
      unsubscribeNew();
      unsubscribeDismissed();
    };
  }, []);

  // Mark all as read
  const markAllRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Dismiss alert
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    wsManager.send({
      type: 'alert:dismiss',
      payload: { id: alertId },
      timestamp: new Date().toISOString(),
    });
  }, []);

  // Get alerts by category
  const getAlertsByCategory = useCallback(
    (category: AlertNotification['category']): AlertNotification[] => {
      return alerts.filter((a) => a.category === category);
    },
    [alerts]
  );

  // Get urgent alerts
  const getUrgentAlerts = useCallback((): AlertNotification[] => {
    return alerts.filter((a) => a.requiresAction);
  }, [alerts]);

  return {
    alerts,
    unreadCount,
    markAllRead,
    dismissAlert,
    getAlertsByCategory,
    getUrgentAlerts,
  };
}

// =====================================================
// Recommendations Hook
// =====================================================

export function useRecommendationUpdates(farmId: string | null) {
  const [updates, setUpdates] = useState<RecommendationUpdate[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!farmId) return;

    const handleNewRec = (rec: RecommendationUpdate) => {
      if (rec.farmId === farmId) {
        setUpdates((prev) => [rec, ...prev].slice(0, 50));
        if (rec.status === 'pending') {
          setPendingCount((prev) => prev + 1);
        }
      }
    };

    const handleUpdateRec = (rec: RecommendationUpdate) => {
      if (rec.farmId === farmId) {
        setUpdates((prev) => {
          const index = prev.findIndex((r) => r.id === rec.id);
          if (index >= 0) {
            const newUpdates = [...prev];
            newUpdates[index] = rec;
            return newUpdates;
          }
          return [rec, ...prev];
        });

        // Update pending count
        if (rec.status !== 'pending') {
          setPendingCount((prev) => Math.max(0, prev - 1));
        }
      }
    };

    const unsubscribeNew = wsManager.on(WS_EVENTS.RECOMMENDATION_NEW, handleNewRec);
    const unsubscribeUpdate = wsManager.on(WS_EVENTS.RECOMMENDATION_UPDATE, handleUpdateRec);

    return () => {
      unsubscribeNew();
      unsubscribeUpdate();
    };
  }, [farmId]);

  return {
    updates,
    pendingCount,
  };
}

// =====================================================
// Weather Updates Hook
// =====================================================

interface WeatherUpdate {
  farmId?: string;
  location: string;
  temperature: number;
  humidity: number;
  condition: string;
  forecast: unknown[];
  timestamp: string;
}

export function useWeatherUpdates(farmId: string | null) {
  const [weather, setWeather] = useState<WeatherUpdate | null>(null);
  const [weatherAlert, setWeatherAlert] = useState<AlertNotification | null>(null);

  useEffect(() => {
    const handleWeatherUpdate = (data: WeatherUpdate) => {
      if (!farmId || data.farmId === farmId) {
        setWeather(data);
      }
    };

    const handleWeatherAlert = (alert: AlertNotification) => {
      if (alert.category === 'weather' && (!farmId || alert.farmId === farmId)) {
        setWeatherAlert(alert);
      }
    };

    const unsubscribeUpdate = wsManager.on(WS_EVENTS.WEATHER_UPDATE, handleWeatherUpdate);
    const unsubscribeAlert = wsManager.on(WS_EVENTS.WEATHER_ALERT, handleWeatherAlert);

    return () => {
      unsubscribeUpdate();
      unsubscribeAlert();
    };
  }, [farmId]);

  // Clear weather alert
  const clearWeatherAlert = useCallback(() => {
    setWeatherAlert(null);
  }, []);

  return {
    weather,
    weatherAlert,
    clearWeatherAlert,
  };
}

// =====================================================
// Pest Detection Hook
// =====================================================

interface PestDetectionResult {
  id: string;
  farmId: string;
  imageUrl: string;
  detections: Array<{
    pest: string;
    confidence: number;
    severity: 'low' | 'medium' | 'high';
    boundingBox?: { x: number; y: number; width: number; height: number };
  }>;
  timestamp: string;
}

export function usePestDetectionUpdates(farmId: string | null) {
  const [latestResult, setLatestResult] = useState<PestDetectionResult | null>(null);
  const [pestAlert, setPestAlert] = useState<AlertNotification | null>(null);

  useEffect(() => {
    if (!farmId) return;

    const handleDetectionComplete = (result: PestDetectionResult) => {
      if (result.farmId === farmId) {
        setLatestResult(result);
      }
    };

    const handlePestAlert = (alert: AlertNotification) => {
      if (alert.category === 'pest' && alert.farmId === farmId) {
        setPestAlert(alert);
      }
    };

    const unsubscribeComplete = wsManager.on(WS_EVENTS.PEST_DETECTION_COMPLETE, handleDetectionComplete);
    const unsubscribeAlert = wsManager.on(WS_EVENTS.PEST_DETECTION_ALERT, handlePestAlert);

    return () => {
      unsubscribeComplete();
      unsubscribeAlert();
    };
  }, [farmId]);

  // Clear pest alert
  const clearPestAlert = useCallback(() => {
    setPestAlert(null);
  }, []);

  return {
    latestResult,
    pestAlert,
    clearPestAlert,
  };
}

// =====================================================
// System Health Hook
// =====================================================

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, 'up' | 'down' | 'degraded'>;
  timestamp: string;
}

export function useSystemHealth() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [maintenanceNotice, setMaintenanceNotice] = useState<string | null>(null);

  useEffect(() => {
    const handleHealthUpdate = (data: SystemHealth) => {
      setHealth(data);
    };

    const handleMaintenanceNotice = (notice: { message: string; scheduledTime?: string }) => {
      setMaintenanceNotice(notice.message);
    };

    const unsubscribeHealth = wsManager.on(WS_EVENTS.SYSTEM_HEALTH, handleHealthUpdate);
    const unsubscribeMaintenance = wsManager.on(WS_EVENTS.MAINTENANCE_NOTICE, handleMaintenanceNotice);

    return () => {
      unsubscribeHealth();
      unsubscribeMaintenance();
    };
  }, []);

  // Clear maintenance notice
  const clearMaintenanceNotice = useCallback(() => {
    setMaintenanceNotice(null);
  }, []);

  return {
    health,
    maintenanceNotice,
    clearMaintenanceNotice,
  };
}

// =====================================================
// Generic Event Hook
// =====================================================

export function useWebSocketEvent<T>(event: string, initialValue: T | null = null) {
  const [data, setData] = useState<T | null>(initialValue);
  const [lastReceived, setLastReceived] = useState<Date | null>(null);

  useEffect(() => {
    const handleEvent = (eventData: T) => {
      setData(eventData);
      setLastReceived(new Date());
    };

    const unsubscribe = wsManager.on(event, handleEvent);

    return unsubscribe;
  }, [event]);

  return { data, lastReceived };
}
