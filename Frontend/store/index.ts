// =====================================================
// Auth Store - Smart Maize Farming System
// =====================================================

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { User, Language } from '../types';

// =====================================================
// Auth Store
// =====================================================

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  clearAuth: () => void;
  updateUserProfile: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        token: null,
        isLoading: true,
        isAuthenticated: false,
        error: null,

        setUser: (user) =>
          set({
            user,
            isAuthenticated: !!user,
            isLoading: false,
            error: null,
          }),

        setToken: (token) => set({ token }),

        setLoading: (isLoading) => set({ isLoading }),

        setError: (error) => set({ error, isLoading: false }),

        logout: () =>
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          }),

        clearAuth: () =>
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          }),

        updateUserProfile: (updates) =>
          set((state) => ({
            user: state.user ? { ...state.user, ...updates } : null,
          })),
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({ user: state.user }),
      }
    ),
    { name: 'AuthStore' }
  )
);

// App-wide settings store
interface AppState {
  theme: 'light' | 'dark';
  language: Language;
  sidebarCollapsed: boolean;
  
  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      language: 'en',
      sidebarCollapsed: false,

      setTheme: (theme) => set({ theme }),
      
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

      setLanguage: (language) => set({ language }),

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'app-settings',
    }
  )
);

// Farm state store
interface FarmState {
  farms: import('../types').Farm[];
  selectedFarm: import('../types').Farm | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setFarms: (farms: import('../types').Farm[]) => void;
  addFarm: (farm: import('../types').Farm) => void;
  updateFarm: (id: string, updates: Partial<import('../types').Farm>) => void;
  removeFarm: (id: string) => void;
  setSelectedFarm: (farm: import('../types').Farm | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useFarmStore = create<FarmState>()((set) => ({
  farms: [],
  selectedFarm: null,
  isLoading: false,
  error: null,

  setFarms: (farms) => set({ farms, isLoading: false, error: null }),

  addFarm: (farm) =>
    set((state) => ({ farms: [...state.farms, farm] })),

  updateFarm: (id, updates) =>
    set((state) => ({
      farms: state.farms.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      selectedFarm:
        state.selectedFarm?.id === id
          ? { ...state.selectedFarm, ...updates }
          : state.selectedFarm,
    })),

  removeFarm: (id) =>
    set((state) => ({
      farms: state.farms.filter((f) => f.id !== id),
      selectedFarm: state.selectedFarm?.id === id ? null : state.selectedFarm,
    })),

  setSelectedFarm: (farm) => set({ selectedFarm: farm }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),
}));

// =====================================================
// Notification store
// =====================================================

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface NotificationState {
  notifications: Notification[];
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set) => ({
      notifications: [],

      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            ...state.notifications,
            { ...notification, id: Date.now().toString() },
          ],
        })),

      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      clearNotifications: () => set({ notifications: [] }),
    }),
    { name: 'NotificationStore' }
  )
);

// =====================================================
// Sensor Data Store (Real-time updates)
// =====================================================

interface SensorReading {
  sensorId: string;
  farmId: string;
  type: string;
  value: number;
  unit: string;
  timestamp: string;
  batteryLevel?: number;
}

interface SensorDataState {
  latestReadings: Record<string, SensorReading>; // keyed by sensorId
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  lastUpdated: string | null;
  
  // Actions
  updateReading: (reading: SensorReading) => void;
  updateMultipleReadings: (readings: SensorReading[]) => void;
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
  clearReadings: () => void;
}

export const useSensorDataStore = create<SensorDataState>()(
  devtools(
    (set) => ({
      latestReadings: {},
      connectionStatus: 'disconnected',
      lastUpdated: null,

      updateReading: (reading) =>
        set((state) => ({
          latestReadings: {
            ...state.latestReadings,
            [reading.sensorId]: reading,
          },
          lastUpdated: new Date().toISOString(),
        })),

      updateMultipleReadings: (readings) =>
        set((state) => {
          const updated = { ...state.latestReadings };
          readings.forEach((reading) => {
            updated[reading.sensorId] = reading;
          });
          return {
            latestReadings: updated,
            lastUpdated: new Date().toISOString(),
          };
        }),

      setConnectionStatus: (status) => set({ connectionStatus: status }),

      clearReadings: () => set({ latestReadings: {}, lastUpdated: null }),
    }),
    { name: 'SensorDataStore' }
  )
);

// =====================================================
// Alert Store (Real-time alerts)
// =====================================================

interface Alert {
  id: string;
  farmId: string;
  type: 'warning' | 'error' | 'info' | 'success';
  category: 'sensor' | 'weather' | 'pest' | 'irrigation' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface AlertState {
  alerts: Alert[];
  unreadCount: number;
  
  // Actions
  addAlert: (alert: Alert) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeAlert: (id: string) => void;
  setAlerts: (alerts: Alert[]) => void;
  clearAlerts: () => void;
}

export const useAlertStore = create<AlertState>()(
  devtools(
    persist(
      (set) => ({
        alerts: [],
        unreadCount: 0,

        addAlert: (alert) =>
          set((state) => ({
            alerts: [alert, ...state.alerts].slice(0, 100), // Keep max 100 alerts
            unreadCount: state.unreadCount + (alert.isRead ? 0 : 1),
          })),

        markAsRead: (id) =>
          set((state) => {
            const alert = state.alerts.find((a) => a.id === id);
            const wasUnread = alert && !alert.isRead;
            return {
              alerts: state.alerts.map((a) =>
                a.id === id ? { ...a, isRead: true } : a
              ),
              unreadCount: wasUnread ? state.unreadCount - 1 : state.unreadCount,
            };
          }),

        markAllAsRead: () =>
          set((state) => ({
            alerts: state.alerts.map((a) => ({ ...a, isRead: true })),
            unreadCount: 0,
          })),

        removeAlert: (id) =>
          set((state) => {
            const alert = state.alerts.find((a) => a.id === id);
            const wasUnread = alert && !alert.isRead;
            return {
              alerts: state.alerts.filter((a) => a.id !== id),
              unreadCount: wasUnread ? state.unreadCount - 1 : state.unreadCount,
            };
          }),

        setAlerts: (alerts) =>
          set({
            alerts,
            unreadCount: alerts.filter((a) => !a.isRead).length,
          }),

        clearAlerts: () => set({ alerts: [], unreadCount: 0 }),
      }),
      {
        name: 'alert-storage',
        partialize: (state) => ({
          alerts: state.alerts.slice(0, 50), // Persist max 50 alerts
        }),
      }
    ),
    { name: 'AlertStore' }
  )
);
