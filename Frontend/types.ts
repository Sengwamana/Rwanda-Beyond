// =====================================================
// Smart Maize Farming System - TypeScript Types
// =====================================================

// User & Authentication Types
export type UserRole = 'farmer' | 'expert' | 'admin';
export type Language = 'en' | 'rw' | 'fr';

export interface User {
  id: string;
  clerkId: string;
  email?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  preferredLanguage: Language;
  profileImageUrl?: string;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Farm Types
export interface Farm {
  id: string;
  userId: string;
  name: string;
  districtId?: string;
  locationName?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  sizeHectares?: number;
  soilType?: string;
  cropVariety: string;
  plantingDate?: string;
  expectedHarvestDate?: string;
  currentGrowthStage?: GrowthStage;
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  // Joined data
  user?: User;
  district?: District;
  sensors?: Sensor[];
}

export type GrowthStage = 'germination' | 'vegetative' | 'flowering' | 'grain_filling' | 'maturity';

export interface District {
  id: string;
  name: string;
  province: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

// Sensor Types
export type SensorType = 'soil_moisture' | 'temperature' | 'humidity' | 'npk' | 'rainfall' | 'light';
export type SensorStatus = 'active' | 'inactive' | 'maintenance' | 'faulty';

export interface Sensor {
  id: string;
  farmId: string;
  deviceId: string;
  sensorType: SensorType;
  name?: string;
  locationDescription?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  status: SensorStatus;
  batteryLevel?: number;
  firmwareVersion?: string;
  lastReadingAt?: string;
  calibrationDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SensorData {
  id: string;
  sensorId: string;
  farmId: string;
  readingTimestamp: string;
  soilMoisture?: number;
  soilTemperature?: number;
  airTemperature?: number;
  humidity?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  phLevel?: number;
  lightIntensity?: number;
  rainfallMm?: number;
  isValid: boolean;
  validationFlags?: Record<string, any>;
  createdAt: string;
}

// Weather Types
export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection?: number;
  condition: string;
  description: string;
  cloudCover?: number;
  visibility?: number;
  timestamp: string;
}

export interface WeatherForecast {
  date: string;
  temperatureMin: number;
  temperatureMax: number;
  temperatureAvg: number;
  humidityAvg: number;
  precipitationProbability: number;
  rainMm: number;
  condition: string;
  windSpeedAvg: number;
}

export interface FarmingConditions {
  irrigationRecommendation: 'proceed' | 'delay' | 'early_morning';
  delayDays: number;
  reasons: string[];
}

// Recommendation Types
export type RecommendationType = 'irrigation' | 'fertilization' | 'pest_alert' | 'weather_alert' | 'general';
export type RecommendationStatus = 'pending' | 'accepted' | 'rejected' | 'deferred' | 'executed' | 'expired';
export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Recommendation {
  id: string;
  farmId: string;
  userId: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  status: RecommendationStatus;
  title: string;
  titleRw?: string;
  description: string;
  descriptionRw?: string;
  recommendedAction?: string;
  actionDeadline?: string;
  supportingData?: Record<string, any>;
  confidenceScore?: number;
  modelVersion?: string;
  respondedAt?: string;
  responseNotes?: string;
  deferredUntil?: string;
  notificationSent: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  // Joined data
  farm?: Farm;
}

// Pest Detection Types
export type PestSeverity = 'none' | 'low' | 'moderate' | 'high' | 'severe';

export interface PestDetection {
  id: string;
  farmId: string;
  reportedBy: string;
  imageUrl: string;
  cloudinaryPublicId?: string;
  thumbnailUrl?: string;
  pestDetected: boolean;
  pestType?: string;
  severity: PestSeverity;
  confidenceScore?: number;
  affectedAreaPercentage?: number;
  modelVersion?: string;
  detectionMetadata?: Record<string, any>;
  locationDescription?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  reviewedBy?: string;
  reviewedAt?: string;
  expertNotes?: string;
  isConfirmed?: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined data
  farm?: Farm;
  reporter?: User;
  reviewer?: User;
}

// Irrigation Types
export interface IrrigationSchedule {
  id: string;
  farmId: string;
  recommendationId?: string;
  scheduledDate: string;
  scheduledTime?: string;
  durationMinutes: number;
  waterVolumeLiters?: number;
  isExecuted: boolean;
  executedAt?: string;
  actualDurationMinutes?: number;
  actualWaterVolume?: number;
  triggerSource: 'manual' | 'auto' | 'recommendation';
  soilMoistureAtScheduling?: number;
  targetSoilMoisture?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Fertilization Types
export interface FertilizationSchedule {
  id: string;
  farmId: string;
  recommendationId?: string;
  scheduledDate: string;
  fertilizerType: string;
  applicationMethod?: string;
  nitrogenKg?: number;
  phosphorusKg?: number;
  potassiumKg?: number;
  totalQuantityKg?: number;
  isExecuted: boolean;
  executedAt?: string;
  actualQuantityKg?: number;
  growthStage?: GrowthStage;
  soilNpkAtScheduling?: {
    nitrogen: number;
    phosphorus: number;
    potassium: number;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Message Types
export type MessageChannel = 'sms' | 'ussd' | 'push' | 'email';
export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'read';

export interface Message {
  id: string;
  userId: string;
  recommendationId?: string;
  channel: MessageChannel;
  recipient: string;
  subject?: string;
  content: string;
  contentRw?: string;
  status: MessageStatus;
  externalMessageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedReason?: string;
  retryCount: number;
  createdAt: string;
}

// Analytics Types
export interface FarmDashboardData {
  farm: Farm;
  latestSensorData: SensorData[];
  activeRecommendations: Recommendation[];
  recentAlerts: Recommendation[];
  irrigationSchedule: IrrigationSchedule[];
  recentPestDetections: PestDetection[];
}

export interface SystemOverview {
  totalFarms: number;
  activeSensors: number;
  criticalAlerts: number;
  avgEfficiency: number;
  farmsByDistrict: { district: string; count: number }[];
  recentActivity: AuditLog[];
}

export interface SensorTrends {
  date: string;
  avgSoilMoisture?: number;
  minSoilMoisture?: number;
  maxSoilMoisture?: number;
  avgSoilTemperature?: number;
  avgTemperature?: number;
  avgHumidity?: number;
  avgNitrogen?: number;
  avgPhosphorus?: number;
  avgPotassium?: number;
  readingCount: number;
}

// Audit & Admin Types
export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface SystemConfig {
  key: string;
  value: any;
  description?: string;
  isActive: boolean;
  updatedAt: string;
  updatedBy?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  timestamp: string;
}

export interface ApiError {
  success: false;
  message: string;
  code: string;
  errors?: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
  timestamp: string;
}

// UI/Component Types
export interface NavItem {
  label: string;
  icon: any;
  path: string;
}

export interface ChartData {
  day: string;
  moisture: number;
  nitrogen?: number;
  phosphorus?: number;
  fullDate?: string;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface Alert {
  id: number | string;
  message: string;
  type: 'warning' | 'info' | 'success' | 'critical';
  time: string;
  date?: string;
  isRead?: boolean;
}

// Legacy compatibility types
export interface SensorReading {
  id: string;
  label: string;
  value: string | number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}

export interface Device {
  id: string;
  type: 'Gateway' | 'Sensor Node' | 'Pump Controller';
  location: string;
  battery: number;
  signal: 'Strong' | 'Good' | 'Weak' | 'Lost';
  status: 'Online' | 'Offline' | 'Maintenance';
  lastSeen: string;
}

export interface FarmerProfile {
  id: string;
  name: string;
  location: string;
  phone: string;
  plotSize: string;
  crop: string;
}

export interface AuditItem {
  id: string;
  image: string;
  aiDetection: string;
  confidence: number;
  timestamp: string;
  location: string;
  status: 'pending' | 'verified' | 'rejected';
}

// Store Types
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export interface AppState {
  theme: 'light' | 'dark';
  language: Language;
  sidebarCollapsed: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: Language) => void;
  toggleSidebar: () => void;
}

export interface FarmState {
  farms: Farm[];
  selectedFarm: Farm | null;
  isLoading: boolean;
  error: string | null;
  setFarms: (farms: Farm[]) => void;
  setSelectedFarm: (farm: Farm | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}
