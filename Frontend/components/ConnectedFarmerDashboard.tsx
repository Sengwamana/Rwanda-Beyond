// =====================================================
// Connected Farmer Dashboard - Smart Maize Farming System
// With real API integration and actionable frontend interactions
// =====================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Droplets,
  Thermometer,
  Wind,
  Sprout,
  Sun,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  MapPin,
  Calendar,
  Cloud,
  CloudRain,
  RefreshCw,
  Camera,
  Plus,
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Spinner, LoadingState, ErrorState, EmptyState } from './ui/Spinner';
import { FormattedAiResponse } from './ui/FormattedAiResponse';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

import {
  useFarms,
  useFarm,
  useFarmDashboard,
  useFarmStats,
  useFarmSensorData,
  useWeather,
  useForecast,
  useWeatherAlerts,
  useHistoricalWeather,
  useIrrigationWindow,
  useRecommendations,
  usePestDetections,
  useActiveRecommendations,
  useRespondToRecommendation,
  useCompleteRecommendation,
  useCreateIrrigation,
  useAnalyzePest,
  useCreateFarm,
  useCreateFarmIssue,
  useGenerateRecommendations,
  useIrrigationSchedules,
  useExecuteIrrigation,
  useUpdateIrrigation,
  useUpdateFarm,
  useUpdateFarmGrowthStage,
  useDeleteFarm,
  useFarmingConditions,
  useFertilizationSchedules,
  useCreateFertilization,
  useUpdateFertilization,
  useDeleteFertilization,
  useExecuteFertilization,
  useSensorsByFarm,
  useSensor,
  useCreateSensor,
  useUpdateSensor,
  useDeleteSensor,
  useFarmLatestReadings,
  usePestScans,
  usePestScan,
  usePestTreatmentRecommendations,
  useDeletePestDetection,
  usePestControlSchedules,
  useCreatePestControl,
  useExecutePestControl,
  useFarmIssues,
  useAnalyticsDashboard,
  useFarmSensorTrendsAnalytics,
  useRecommendationHistoryAnalytics,
  useFarmActivityAnalytics,
  useExportFarmActivity,
  useAiChat,
  useAiAdvice,
  useAiImageAnalysis,
  useAiTranslate,
  useAiCapabilities,
  useSaveFarmImage,
} from '../hooks/useApi';
import { useAuthStore, useFarmStore } from '../store';
import { Language } from '../utils/translations';
import { Farm, Recommendation, WeatherData, WeatherForecast, RecommendationPriority, GrowthStage, Sensor, SensorLatestReadingsPayload, FertilizationSchedule, PestDetection, IrrigationSchedule, WeatherAlert, HistoricalWeatherRecord, IrrigationWindowPayload } from '../types';

interface ConnectedFarmerDashboardProps {
  language: Language;
  searchQuery?: string;
  activeTab?: string;
}

const localeByLanguage: Record<Language, string> = {
  en: 'en-US',
  rw: 'rw-RW',
  fr: 'fr-FR',
};

const formatDate = (dateString: string, locale: string) =>
  new Date(dateString).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });

const formatTime = (dateString: string, locale: string) =>
  new Date(dateString).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

const priorityColors: Record<RecommendationPriority, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

const growthStages: GrowthStage[] = ['germination', 'vegetative', 'flowering', 'grain_filling', 'maturity'];

const farmerTabCopy: Record<string, { title: string; description: string }> = {
  overview: {
    title: 'Farm Dashboard',
    description: 'Monitor your farm health and run quick actions directly from this page.',
  },
  sensors: {
    title: 'Sensors',
    description: 'Review registered devices and the latest readings for the selected farm.',
  },
  fertilization: {
    title: 'Fertilization',
    description: 'Track planned and completed fertilization events for the selected farm.',
  },
  'pest-history': {
    title: 'Pest History',
    description: 'Review previous pest scans, findings, and follow-up recommendations.',
  },
  analytics: {
    title: 'District Analytics',
    description: 'Inspect trends, forecasts, and farm performance metrics.',
  },
  'ai-chat': {
    title: 'AI Advice',
    description: 'Ask questions about the selected farm and get contextual guidance.',
  },
};

function SensorCard({
  icon: Icon,
  label,
  value,
  unit,
  status,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}) {
  const statusColors = {
    normal: 'text-green-500',
    warning: 'text-green-500',
    critical: 'text-red-500',
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-primary/10 ${statusColors[status]}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-xl font-bold">
                {value}
                <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
              </p>
            </div>
          </div>
          {TrendIcon && (
            <TrendIcon size={16} className={trend === 'up' ? 'text-green-500' : 'text-red-500'} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendationCard({
  recommendation,
  linkedIrrigationSchedule,
  onAccept,
  onReject,
  onDefer,
  onComplete,
  onOpenSchedule,
  onExecuteSchedule,
  onAdjustSchedule,
  isLoading,
}: {
  recommendation: Recommendation;
  linkedIrrigationSchedule?: IrrigationSchedule | null;
  onAccept: () => void;
  onReject: () => void;
  onDefer: () => void;
  onComplete?: () => void;
  onOpenSchedule?: () => void;
  onExecuteSchedule?: () => void;
  onAdjustSchedule?: () => void;
  isLoading: boolean;
}) {
  const getIcon = () => {
    switch (recommendation.type) {
      case 'irrigation':
        return Droplets;
      case 'fertilization':
        return Sprout;
      case 'pest_alert':
        return AlertTriangle;
      case 'weather_alert':
        return Cloud;
      default:
        return CheckCircle;
    }
  };

  const Icon = getIcon();
  const isPreliminaryPestAlert =
    recommendation.type === 'pest_alert' && recommendation.supportingData?.expertVerified !== true;
  const isAcceptedIrrigation = recommendation.type === 'irrigation' && recommendation.status === 'accepted';
  const hasLinkedIrrigationSchedule = isAcceptedIrrigation && !!linkedIrrigationSchedule;
  const canMarkComplete = recommendation.status === 'accepted' && !hasLinkedIrrigationSchedule;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">{recommendation.title}</h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{recommendation.status}</Badge>
                <Badge className={priorityColors[recommendation.priority]}>{recommendation.priority}</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{recommendation.description}</p>
            {recommendation.recommendedAction && (
              <p className="text-xs text-muted-foreground mt-2">
                Recommended action: {recommendation.recommendedAction}
              </p>
            )}
            {hasLinkedIrrigationSchedule && (
              <div className="mt-2 rounded-md bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                Approved irrigation is scheduled for{' '}
                {new Date(linkedIrrigationSchedule.scheduledDate).toLocaleDateString()}
                {linkedIrrigationSchedule.scheduledTime ? ` at ${linkedIrrigationSchedule.scheduledTime}` : ''}.
              </div>
            )}
            {isPreliminaryPestAlert && (
              <p className="text-xs text-green-700 mt-2">
                Preliminary AI screening. Confirm with an agricultural expert before treatment decisions.
              </p>
            )}
            {recommendation.actionDeadline && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Clock size={12} />
                Action needed by {new Date(recommendation.actionDeadline).toLocaleDateString()}
              </p>
            )}
            {hasLinkedIrrigationSchedule ? (
              <div className="flex gap-2 mt-3 flex-wrap">
                <Button size="sm" variant="outline" onClick={onOpenSchedule} disabled={isLoading}>
                  View Schedule
                </Button>
                <Button size="sm" variant="outline" onClick={onAdjustSchedule} disabled={isLoading}>
                  Adjust Timing
                </Button>
                <Button size="sm" onClick={onExecuteSchedule} disabled={isLoading}>
                  {isLoading ? <Spinner size="sm" /> : 'Mark Executed'}
                </Button>
              </div>
            ) : canMarkComplete ? (
              <div className="flex gap-2 mt-3 flex-wrap">
                <Button size="sm" onClick={onComplete} disabled={isLoading}>
                  {isLoading ? <Spinner size="sm" /> : 'Mark Complete'}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={onAccept} disabled={isLoading}>
                  {isLoading ? <Spinner size="sm" /> : recommendation.type === 'irrigation' ? 'Approve Plan' : 'Accept'}
                </Button>
                <Button size="sm" variant="outline" onClick={onReject} disabled={isLoading}>
                  Dismiss
                </Button>
                <Button size="sm" variant="outline" onClick={onDefer} disabled={isLoading}>
                  Defer
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WeatherCard({
  weather,
  forecast,
}: {
  weather?: WeatherData;
  forecast?: WeatherForecast[];
}) {
  if (!weather) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Cloud size={20} />
            Weather
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState text="Loading weather..." size="sm" />
        </CardContent>
      </Card>
    );
  }

  const getWeatherIcon = (condition: string) => {
    const normalized = condition.toLowerCase();
    if (normalized.includes('rain')) return CloudRain;
    if (normalized.includes('cloud')) return Cloud;
    return Sun;
  };

  const WeatherIcon = getWeatherIcon(weather.condition);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <WeatherIcon size={20} className="text-primary" />
          Weather
        </CardTitle>
        <CardDescription>Current conditions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{Math.round(weather.temperature)} C</p>
              <p className="text-sm text-muted-foreground capitalize">{weather.description}</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Humidity: {weather.humidity}%</p>
              <p>Wind: {weather.windSpeed} m/s</p>
            </div>
          </div>

          {forecast && forecast.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">5-Day Forecast</p>
              <div className="flex justify-between">
                {forecast.slice(0, 5).map((day, index) => {
                  const DayIcon = getWeatherIcon(day.condition);
                  return (
                    <div key={index} className="text-center">
                      <p className="text-xs text-muted-foreground">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </p>
                      <DayIcon size={16} className="mx-auto my-1" />
                      <p className="text-xs">{Math.round(day.temperatureMax)} C</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WeatherAlertsCard({
  alerts,
}: {
  alerts?: WeatherAlert[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle size={20} className="text-primary" />
          Weather Alerts
        </CardTitle>
        <CardDescription>Live warning conditions that may affect your farm</CardDescription>
      </CardHeader>
      <CardContent>
        {!alerts ? (
          <LoadingState text="Loading weather alerts..." size="sm" />
        ) : alerts.length === 0 ? (
          <EmptyState title="No active alerts" message="No weather risks are currently flagged for this farm." />
        ) : (
          <div className="space-y-3">
            {alerts.slice(0, 3).map((alert, index) => (
              <div key={`${alert.title}-${index}`} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{alert.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {alert.type.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {alert.severity}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{alert.description}</p>
                {alert.startTime && (
                  <p className="text-xs text-muted-foreground">
                    Starts: {new Date(alert.startTime).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IrrigationWindowCard({
  data,
}: {
  data?: IrrigationWindowPayload;
}) {
  const nextWindow = data?.nextBestWindow || null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Droplets size={20} className="text-primary" />
          Irrigation Window
        </CardTitle>
        <CardDescription>Best weather-backed time to irrigate next</CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <LoadingState text="Loading irrigation window..." size="sm" />
        ) : !nextWindow ? (
          <EmptyState title="No clear window yet" message="The forecast does not currently show a preferred irrigation slot." />
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{new Date(nextWindow.date).toLocaleDateString()}</p>
                  <p className="text-sm text-muted-foreground">{nextWindow.recommendation}</p>
                </div>
                <Badge variant="outline">Next Best</Badge>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-muted-foreground">Temp</p>
                <p className="font-semibold">{nextWindow.conditions.temperature ?? '--'} C</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-muted-foreground">Humidity</p>
                <p className="font-semibold">{nextWindow.conditions.humidity ?? '--'}%</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-muted-foreground">Weather</p>
                <p className="font-semibold">{nextWindow.conditions.weather || '--'}</p>
              </div>
            </div>
            {data.optimalWindows.length > 1 && (
              <p className="text-xs text-muted-foreground">
                {data.optimalWindows.length} potential irrigation windows available in the current forecast.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WeatherHistoryCard({
  rows,
}: {
  rows?: HistoricalWeatherRecord[];
}) {
  const historyRows = rows || [];
  const avgTemperature =
    historyRows.length > 0
      ? historyRows.reduce((sum, row) => sum + (row.temperature || 0), 0) / historyRows.length
      : null;
  const totalRain = historyRows.reduce((sum, row) => sum + (row.rainMm || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar size={20} className="text-primary" />
          Weather History
        </CardTitle>
        <CardDescription>Stored forecast snapshots for the last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        {!rows ? (
          <LoadingState text="Loading weather history..." size="sm" />
        ) : historyRows.length === 0 ? (
          <EmptyState title="No history yet" message="Historical weather records are not available for this farm yet." />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-sm text-muted-foreground">Average temperature</p>
                <p className="font-semibold">{avgTemperature !== null ? `${avgTemperature.toFixed(1)} C` : '--'}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-sm text-muted-foreground">Total rainfall</p>
                <p className="font-semibold">{totalRain.toFixed(1)} mm</p>
              </div>
            </div>
            <div className="space-y-2">
              {historyRows.slice(-4).reverse().map((row, index) => (
                <div key={`${row.forecastDate}-${row.forecastTime || index}`} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{new Date(row.forecastDate).toLocaleDateString()}</p>
                    <p className="text-muted-foreground">{row.weatherCondition || 'Weather snapshot'}</p>
                  </div>
                  <div className="text-right text-muted-foreground">
                    <p>{row.temperature ?? '--'} C</p>
                    <p>{row.rainMm ?? 0} mm rain</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FarmSelector({
  farms,
  selectedFarm,
  onSelect,
  onAddFarm,
  isAddingFarm,
  emptyTitle = 'No Farms Yet',
  emptyMessage = 'Register your first farm to start monitoring',
}: {
  farms: Farm[];
  selectedFarm: Farm | null;
  onSelect: (farm: Farm) => void;
  onAddFarm: () => void;
  isAddingFarm: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  if (farms.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Sprout className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">{emptyTitle}</h3>
          <p className="text-sm text-muted-foreground mb-4">{emptyMessage}</p>
          <Button onClick={onAddFarm} disabled={isAddingFarm}>
            {isAddingFarm ? (
              <Spinner size="sm" />
            ) : (
              <>
                <Plus size={16} className="mr-2" />
                Add Farm
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {farms.map((farm) => (
        <button
          key={farm.id}
          onClick={() => onSelect(farm)}
          className={`flex-shrink-0 px-4 py-2 rounded-lg border transition-colors ${
            selectedFarm?.id === farm.id
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card hover:bg-muted border-border'
          }`}
        >
          <div className="flex items-center gap-2">
            <MapPin size={14} />
            <span className="font-medium">{farm.name}</span>
          </div>
          {farm.sizeHectares && <p className="text-xs opacity-80">{farm.sizeHectares} ha</p>}
        </button>
      ))}
      <Button variant="outline" size="sm" className="flex-shrink-0" onClick={onAddFarm} disabled={isAddingFarm}>
        {isAddingFarm ? (
          <Spinner size="sm" />
        ) : (
          <>
            <Plus size={14} className="mr-1" />
            Add Farm
          </>
        )}
      </Button>
    </div>
  );
}

export function ConnectedFarmerDashboard({
  language,
  searchQuery = '',
  activeTab = 'overview',
}: ConnectedFarmerDashboardProps) {
  const locale = localeByLanguage[language] || 'en-US';
  const pestFileInputRef = useRef<HTMLInputElement | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showAddFarmForm, setShowAddFarmForm] = useState(false);
  const [showIrrigationPlanner, setShowIrrigationPlanner] = useState(false);
  const [farmNameInput, setFarmNameInput] = useState('');
  const [farmCropInput, setFarmCropInput] = useState('Maize');
  const [farmLocationInput, setFarmLocationInput] = useState('');
  const [farmSizeInput, setFarmSizeInput] = useState('');
  const [irrigationDateInput, setIrrigationDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [irrigationTimeInput, setIrrigationTimeInput] = useState('06:00');
  const [irrigationDurationInput, setIrrigationDurationInput] = useState('30');
  const [irrigationVolumeInput, setIrrigationVolumeInput] = useState('');
  const [postponeScheduleId, setPostponeScheduleId] = useState<string | null>(null);
  const [postponeDateInput, setPostponeDateInput] = useState('');
  const [postponeTimeInput, setPostponeTimeInput] = useState('06:00');
  const [farmEditName, setFarmEditName] = useState('');
  const [farmEditStage, setFarmEditStage] = useState<GrowthStage>('vegetative');
  const [farmEditSize, setFarmEditSize] = useState('');
  const [latestPestAnalysis, setLatestPestAnalysis] = useState<any>(null);
  const [issueTitleInput, setIssueTitleInput] = useState('');
  const [issueDescriptionInput, setIssueDescriptionInput] = useState('');
  const [issueCategoryInput, setIssueCategoryInput] = useState<'general' | 'irrigation' | 'fertilization' | 'pest' | 'sensor' | 'weather'>('general');
  const [issueSeverityInput, setIssueSeverityInput] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');

  const { user } = useAuthStore();
  const { farms, selectedFarm, setFarms, addFarm, updateFarm, removeFarm, setSelectedFarm } = useFarmStore();
  const selectedFarmId = selectedFarm?.id || null;

  const {
    data: farmsData,
    isLoading: farmsLoading,
    error: farmsError,
    refetch: refetchFarms,
  } = useFarms({ isActive: true });
  const {
    data: selectedFarmDetail,
    isLoading: selectedFarmDetailLoading,
    refetch: refetchSelectedFarmDetail,
  } = useFarm(selectedFarm?.id || '', { enabled: !!selectedFarm?.id && activeTab === 'overview' });
  const {
    data: farmSummary,
    isLoading: farmSummaryLoading,
    refetch: refetchFarmSummary,
  } = useFarmDashboard(activeTab === 'overview' ? selectedFarm?.id || '' : '');
  const {
    data: farmStats,
    refetch: refetchFarmStats,
  } = useFarmStats(activeTab === 'overview');
  const weatherHistoryRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);

    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }, []);
  const { data: sensorData, refetch: refetchSensorData } = useFarmSensorData(selectedFarm?.id || '', { limit: 50 });
  const { data: weather, refetch: refetchWeather } = useWeather(selectedFarm?.id || '');
  const { data: forecast, refetch: refetchForecast } = useForecast(selectedFarm?.id || '', 5);
  const { data: farmingConditions, refetch: refetchFarmingConditions } = useFarmingConditions(selectedFarm?.id || '');
  const { data: weatherAlerts, refetch: refetchWeatherAlerts } = useWeatherAlerts(selectedFarm?.id || '');
  const { data: weatherHistory, refetch: refetchWeatherHistory } = useHistoricalWeather(selectedFarm?.id || '', weatherHistoryRange);
  const { data: irrigationWindow, refetch: refetchIrrigationWindow } = useIrrigationWindow(selectedFarm?.id || '');
  const {
    data: farmRecommendationLedgerResponse,
    isLoading: farmRecommendationLedgerLoading,
  } = useRecommendations(
    selectedFarm?.id
      ? {
          farmId: selectedFarm.id,
          page: 1,
          limit: 6,
        }
      : undefined,
    !!selectedFarm && activeTab === 'overview'
  );
  const {
    data: farmPestLedgerResponse,
    isLoading: farmPestLedgerLoading,
  } = usePestDetections(
    selectedFarm?.id
      ? {
          farmId: selectedFarm.id,
          page: 1,
          limit: 6,
        }
      : undefined,
    !!selectedFarm && activeTab === 'overview'
  );
  const { data: recommendations, refetch: refetchRecommendations } = useActiveRecommendations(selectedFarm?.id);
  const {
    data: farmIssuesResponse,
    isLoading: farmIssuesLoading,
    refetch: refetchFarmIssues,
  } = useFarmIssues(selectedFarm?.id || '', { page: 1, limit: 3 }, !!selectedFarm && activeTab === 'overview');
  const { data: irrigationSchedules, refetch: refetchSchedules } = useIrrigationSchedules(
    selectedFarm?.id || '',
    { isExecuted: false }
  );

  const createFarmMutation = useCreateFarm();
  const updateFarmMutation = useUpdateFarm();
  const updateFarmGrowthStageMutation = useUpdateFarmGrowthStage();
  const deleteFarmMutation = useDeleteFarm();
  const respondMutation = useRespondToRecommendation();
  const completeRecommendationMutation = useCompleteRecommendation();
  const irrigationMutation = useCreateIrrigation();
  const updateIrrigationMutation = useUpdateIrrigation();
  const createFarmIssueMutation = useCreateFarmIssue();
  const executeIrrigationMutation = useExecuteIrrigation();
  const analyzePestMutation = useAnalyzePest();
  const generateRecommendationsMutation = useGenerateRecommendations();
  const farmRecommendationLedger = farmRecommendationLedgerResponse?.data || [];
  const farmPestLedger = farmPestLedgerResponse?.data || [];

  useEffect(() => {
    if (!farmsData?.data) return;

    setFarms(farmsData.data);

    if (!selectedFarm && farmsData.data.length > 0) {
      setSelectedFarm(farmsData.data[0]);
      return;
    }

    if (selectedFarm && !farmsData.data.some((farm) => farm.id === selectedFarm.id)) {
      setSelectedFarm(farmsData.data[0] || null);
    }
  }, [farmsData, selectedFarm, setFarms, setSelectedFarm]);

  useEffect(() => {
    if (!selectedFarm) return;
    setFarmEditName(selectedFarm.name || '');
    setFarmEditStage(selectedFarm.currentGrowthStage || 'vegetative');
    setFarmEditSize(
      typeof selectedFarm.sizeHectares === 'number' && !Number.isNaN(selectedFarm.sizeHectares)
        ? String(selectedFarm.sizeHectares)
        : ''
    );
  }, [selectedFarm?.id]);

  useEffect(() => {
    setLatestPestAnalysis(null);
  }, [selectedFarm?.id]);

  const chartData = useMemo(
    () =>
      (sensorData || [])
        .map((reading) => ({
          time: formatTime(reading.readingTimestamp, locale),
          date: formatDate(reading.readingTimestamp, locale),
          moisture: reading.soilMoisture || 0,
          temperature: reading.airTemperature || reading.soilTemperature || 0,
          humidity: reading.humidity || 0,
        }))
        .reverse(),
    [sensorData, locale]
  );

  const upcomingSchedules = useMemo(
    () =>
      [...(irrigationSchedules || [])].sort(
        (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
      ),
    [irrigationSchedules]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredRecommendations = useMemo(() => {
    if (!recommendations) return [];
    if (!normalizedSearch) return recommendations;

    return recommendations.filter((recommendation) => {
      const haystack = [
        recommendation.title,
        recommendation.description,
        recommendation.type,
        recommendation.priority,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [recommendations, normalizedSearch]);

  const farmIssues = farmIssuesResponse?.data || [];
  const farmPortfolioStages = useMemo(
    () => Object.entries(farmStats?.byGrowthStage || {}).sort((left, right) => right[1] - left[1]).slice(0, 3),
    [farmStats]
  );
  const farmPortfolioCrops = useMemo(
    () => Object.entries(farmStats?.byCropVariety || {}).sort((left, right) => right[1] - left[1]).slice(0, 3),
    [farmStats]
  );

  const filteredFarms = useMemo(() => {
    if (!normalizedSearch) return farms;

    return farms.filter((farm) => {
      const haystack = [farm.name, farm.locationName, farm.district?.name, farm.cropVariety]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [farms, normalizedSearch]);

  const filteredSchedules = useMemo(() => {
    if (!normalizedSearch) return upcomingSchedules;

    return upcomingSchedules.filter((schedule) => {
      const haystack = [
        schedule.triggerSource,
        schedule.notes,
        schedule.scheduledDate,
        schedule.scheduledTime,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [upcomingSchedules, normalizedSearch]);

  const dueSchedules = useMemo(() => {
    const now = Date.now();
    return upcomingSchedules.filter((schedule) => {
      if (schedule.isExecuted) return false;
      const scheduleTime = new Date(schedule.scheduledDate).getTime();
      return Number.isFinite(scheduleTime) && scheduleTime <= now;
    });
  }, [upcomingSchedules]);

  const irrigationSchedulesByRecommendationId = useMemo(() => {
    const map = new Map<string, IrrigationSchedule>();
    upcomingSchedules.forEach((schedule) => {
      if (schedule.recommendationId) {
        map.set(schedule.recommendationId, schedule);
      }
    });
    return map;
  }, [upcomingSchedules]);

  const irrigationActionPending = executeIrrigationMutation.isPending || updateIrrigationMutation.isPending;

  const handleRecommendationResponse = (recommendation: Recommendation, status: 'accepted' | 'rejected') => {
    respondMutation.mutate(
      { id: recommendation.id, data: { status } },
      {
        onSuccess: () => {
          if (recommendation.type === 'irrigation' && status === 'accepted') {
            setShowSchedule(true);
            refetchSchedules();
          }
        },
      }
    );
  };

  const handleCompleteRecommendation = (recommendationId: string) => {
    completeRecommendationMutation.mutate({ id: recommendationId });
  };

  const handleRefreshAll = () => {
    refetchFarms();
    if (selectedFarm?.id) {
      refetchSelectedFarmDetail();
      refetchFarmSummary();
    }
    refetchFarmStats();
    refetchSensorData();
    refetchWeather();
    refetchForecast();
    refetchFarmingConditions();
    refetchWeatherAlerts();
    refetchWeatherHistory();
    refetchIrrigationWindow();
    refetchRecommendations();
    refetchFarmIssues();
    refetchSchedules();
  };

  const handleExportSensorCsv = () => {
    if (!sensorData || sensorData.length === 0) return;

    const headers = [
      'timestamp',
      'soilMoisture',
      'soilTemperature',
      'airTemperature',
      'humidity',
      'nitrogen',
      'phosphorus',
      'potassium',
      'rainfallMm',
    ];
    const rows = sensorData.map((reading) => [
      reading.readingTimestamp,
      reading.soilMoisture ?? '',
      reading.soilTemperature ?? '',
      reading.airTemperature ?? '',
      reading.humidity ?? '',
      reading.nitrogen ?? '',
      reading.phosphorus ?? '',
      reading.potassium ?? '',
      reading.rainfallMm ?? '',
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `farm-${selectedFarm?.id || 'sensors'}-readings.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleDeferRecommendation = (id: string) => {
    const deferUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    respondMutation.mutate({ id, data: { status: 'deferred', deferredUntil: deferUntil } });
  };

  const handleAddFarm = async () => {
    setShowAddFarmForm(true);
  };

  const handleCreateFarmSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!farmNameInput.trim()) return;

    const parsedSize = farmSizeInput.trim() ? Number(farmSizeInput) : undefined;

    try {
      const response = await createFarmMutation.mutateAsync({
        name: farmNameInput.trim(),
        cropVariety: farmCropInput.trim() || 'Maize',
        locationName: farmLocationInput.trim() || undefined,
        sizeHectares: typeof parsedSize === 'number' && !Number.isNaN(parsedSize) ? parsedSize : undefined,
      });

      if (response?.data) {
        addFarm(response.data);
        setSelectedFarm(response.data);
        setShowAddFarmForm(false);
        setFarmNameInput('');
        setFarmCropInput('Maize');
        setFarmLocationInput('');
        setFarmSizeInput('');
      }
    } catch {
      // Error notifications are already handled by the mutation hook.
    }
  };

  const handleScheduleIrrigation = async () => {
    if (!selectedFarm) return;

    const moisture = sensorData?.[0]?.soilMoisture;
    const suggestedDuration =
      typeof moisture === 'number' ? (moisture < 30 ? 45 : moisture < 50 ? 30 : 20) : 30;

    try {
      await irrigationMutation.mutateAsync({
        farmId: selectedFarm.id,
        data: {
          scheduledDate: new Date().toISOString(),
          durationMinutes: suggestedDuration,
          triggerSource: 'manual',
          notes: 'Created from farmer dashboard quick action',
        },
      });

      setShowSchedule(true);
      refetchSchedules();
    } catch {
      // Error notifications are already handled by the mutation hook.
    }
  };

  const handleCreateIrrigationPlan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFarm) return;

    const duration = Number(irrigationDurationInput);
    if (!Number.isFinite(duration) || duration <= 0) return;

    const scheduledDate = new Date(`${irrigationDateInput}T${irrigationTimeInput || '06:00'}`);
    const volume = irrigationVolumeInput.trim() ? Number(irrigationVolumeInput) : undefined;

    try {
      await irrigationMutation.mutateAsync({
        farmId: selectedFarm.id,
        data: {
          scheduledDate: scheduledDate.toISOString(),
          scheduledTime: irrigationTimeInput || undefined,
          durationMinutes: duration,
          waterVolumeLiters:
            typeof volume === 'number' && Number.isFinite(volume) ? volume : undefined,
          triggerSource: 'manual',
          notes: 'Planned from farmer irrigation planner',
        },
      });

      setShowSchedule(true);
      setShowIrrigationPlanner(false);
      setIrrigationDurationInput('30');
      setIrrigationVolumeInput('');
      refetchSchedules();
    } catch {
      // Error notifications are already handled by the mutation hook.
    }
  };

  const handleReportFarmIssue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFarm) return;

    try {
      await createFarmIssueMutation.mutateAsync({
        farmId: selectedFarm.id,
        data: {
          title: issueTitleInput.trim(),
          description: issueDescriptionInput.trim(),
          category: issueCategoryInput,
          severity: issueSeverityInput,
          locationDescription: selectedFarm.locationName || selectedFarm.name,
        },
      });

      setIssueTitleInput('');
      setIssueDescriptionInput('');
      setIssueCategoryInput('general');
      setIssueSeverityInput('medium');
    } catch {
      // Notifications are handled in the mutation hook.
    }
  };

  const handleGenerateRecommendations = () => {
    if (!selectedFarm) return;
    generateRecommendationsMutation.mutate(selectedFarm.id);
  };

  const handleSaveFarmProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFarm) return;

    const parsedSize = farmEditSize.trim() ? Number(farmEditSize) : undefined;
    const trimmedName = farmEditName.trim() || selectedFarm.name;
    const normalizedSize =
      typeof parsedSize === 'number' && !Number.isNaN(parsedSize) ? parsedSize : undefined;
    const detailsChanged =
      trimmedName !== selectedFarm.name || normalizedSize !== selectedFarm.sizeHectares;
    const growthStageChanged = farmEditStage !== (selectedFarm.currentGrowthStage || 'vegetative');
    try {
      let nextFarmState: Partial<Farm> | null = null;

      if (detailsChanged) {
        const response = await updateFarmMutation.mutateAsync({
          id: selectedFarm.id,
          data: {
            name: trimmedName,
            sizeHectares: normalizedSize,
          },
        });
        if (response?.data) {
          nextFarmState = { ...(nextFarmState || {}), ...response.data };
        }
      }

      if (growthStageChanged) {
        const stageResponse = await updateFarmGrowthStageMutation.mutateAsync({
          id: selectedFarm.id,
          stage: farmEditStage,
        });
        if (stageResponse?.data) {
          nextFarmState = { ...(nextFarmState || {}), ...stageResponse.data };
        }
      }

      if (nextFarmState) {
        updateFarm(selectedFarm.id, nextFarmState);
      }
    } catch {
      // Error notifications are already handled by the mutation hook.
    }
  };

  const handleDeleteSelectedFarm = async () => {
    if (!selectedFarm) return;
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Delete farm "${selectedFarm.name}"?`);
    if (!confirmed) return;

    try {
      await deleteFarmMutation.mutateAsync(selectedFarm.id);
      removeFarm(selectedFarm.id);
    } catch {
      // Error notifications are already handled by the mutation hook.
    }
  };

  const handleExecuteIrrigation = async (scheduleId: string) => {
    if (!selectedFarm) return;
    try {
      await executeIrrigationMutation.mutateAsync({
        farmId: selectedFarm.id,
        scheduleId,
      });
      refetchSchedules();
    } catch {
      // Error notifications are already handled by the mutation hook.
    }
  };

  const handleOpenPostponeSchedule = (schedule: IrrigationSchedule) => {
    const scheduledAt = schedule.scheduledDate
      ? new Date(
          schedule.scheduledDate.includes('T')
            ? schedule.scheduledDate
            : `${schedule.scheduledDate}T${schedule.scheduledTime || '06:00'}`
        )
      : new Date();

    const nextDate = Number.isFinite(scheduledAt.getTime()) ? new Date(scheduledAt) : new Date();
    nextDate.setDate(nextDate.getDate() + 1);

    setPostponeScheduleId(schedule.id);
    setPostponeDateInput(nextDate.toISOString().slice(0, 10));
    setPostponeTimeInput(schedule.scheduledTime || nextDate.toISOString().slice(11, 16));
  };

  const handlePostponeIrrigation = async (schedule: IrrigationSchedule) => {
    if (!selectedFarm || !postponeDateInput) return;

    const scheduledAt = new Date(`${postponeDateInput}T${postponeTimeInput || '06:00'}`);
    if (!Number.isFinite(scheduledAt.getTime())) return;

    try {
      await updateIrrigationMutation.mutateAsync({
        farmId: selectedFarm.id,
        scheduleId: schedule.id,
        data: {
          scheduledDate: scheduledAt.toISOString(),
          scheduledTime: postponeTimeInput || undefined,
          durationMinutes: schedule.durationMinutes,
          waterVolumeLiters: schedule.waterVolumeLiters,
          notes: schedule.notes || 'Postponed from farmer dashboard',
        },
      });
      setPostponeScheduleId(null);
      setPostponeDateInput('');
      setPostponeTimeInput('06:00');
      refetchSchedules();
    } catch {
      // Error notifications are already handled by the mutation hook.
    }
  };

  const handleExecuteDueIrrigation = async () => {
    if (!selectedFarm || dueSchedules.length === 0) return;

    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Execute ${dueSchedules.length} due irrigation schedule(s)?`);
    if (!confirmed) return;

    for (const schedule of dueSchedules) {
      try {
        await executeIrrigationMutation.mutateAsync({
          farmId: selectedFarm.id,
          scheduleId: schedule.id,
        });
      } catch {
        // Error notifications are already handled by the mutation hook.
      }
    }
    refetchSchedules();
  };

  const handlePestScanClick = () => {
    if (!selectedFarm) return;
    pestFileInputRef.current?.click();
  };

  const handlePestImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedFarm) return;

    try {
      const response = await analyzePestMutation.mutateAsync({
        farmId: selectedFarm.id,
        image: file,
        locationDescription: `Dashboard upload for ${selectedFarm.name}`,
      });
      setLatestPestAnalysis({
        detection: response.data,
        analysis: (response as any).analysis || response.data?.detectionMetadata?.analysis,
      });
    } catch {
      // Error notifications are already handled by the mutation hook.
    }
  };

  if (farmsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState text="Loading your farms..." />
      </div>
    );
  }

  if (farmsError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ErrorState
          title="Failed to load farms"
          message="We could not load your farm data. Please try again."
          onRetry={() => refetchFarms()}
        />
      </div>
    );
  }

  const latestReading = sensorData?.[0];
  const moistureStatus: 'normal' | 'warning' | 'critical' =
    typeof latestReading?.soilMoisture === 'number'
      ? latestReading.soilMoisture < 30
        ? 'critical'
        : latestReading.soilMoisture < 50
          ? 'warning'
          : 'normal'
      : 'normal';

  const moistureTrend: 'up' | 'down' | 'stable' | undefined =
    chartData.length > 1
      ? chartData[chartData.length - 1].moisture > chartData[chartData.length - 2].moisture
        ? 'up'
        : chartData[chartData.length - 1].moisture < chartData[chartData.length - 2].moisture
          ? 'down'
          : 'stable'
      : undefined;
  const isOverviewTab = activeTab === 'overview';
  const activeTabCopy = farmerTabCopy[activeTab] || farmerTabCopy.overview;
  const farmerQuickStats: Array<{ label: string; value: string | number }> = [
    { label: 'Tracked Farms', value: filteredFarms.length },
    { label: 'Active Advice', value: recommendations?.length || 0 },
    { label: 'Weather Alerts', value: weatherAlerts?.alerts?.length || 0 },
    { label: 'Open Irrigation', value: irrigationSchedules?.length || 0 },
  ];
  const sectionTitleClass = 'text-base md:text-lg font-extrabold tracking-tight';
  const sectionDescriptionClass = 'text-xs md:text-sm text-muted-foreground/90';
  const workspaceGridClass = 'grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-6';
  const workspaceMainClass = 'xl:col-span-8';
  const workspaceRailClass = 'xl:col-span-4 space-y-4 xl:sticky xl:top-24 self-start';

  return (
    <div className="mx-auto w-full max-w-[1500px] p-3 sm:p-4 md:p-6 lg:p-7 space-y-5 md:space-y-6 bg-background min-h-screen animate-fade-in">
      <input
        ref={pestFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePestImageSelected}
      />

      <div className="rounded-3xl border border-emerald-200/50 dark:border-emerald-900/30 bg-gradient-to-br from-emerald-500/10 via-white to-white dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900 p-4 md:p-6 shadow-[0_20px_45px_-32px_rgba(5,150,105,0.65)] animate-fade-in [animation-delay:40ms] [animation-fill-mode:both]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700/80 dark:text-emerald-300/80">Farmer Command Center</p>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
              {isOverviewTab && user?.firstName ? `Hello, ${user.firstName}!` : activeTabCopy.title}
            </h1>
            <p className="text-slate-600 dark:text-slate-300">{activeTabCopy.description}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="h-9 rounded-xl" onClick={() => refetchFarms()}>
              <RefreshCw size={14} className="mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-xl" onClick={handleRefreshAll}>
              <RefreshCw size={14} className="mr-2" />
              Refresh All
            </Button>
            {activeTab === 'sensors' && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl"
                onClick={handleExportSensorCsv}
                disabled={!sensorData || sensorData.length === 0}
              >
                Export Sensors
              </Button>
            )}
            {(isOverviewTab || activeTab === 'pest-history') && (
              <Button
                size="sm"
                className="h-9 rounded-xl"
                onClick={handlePestScanClick}
                disabled={!selectedFarm || analyzePestMutation.isPending}
              >
                {analyzePestMutation.isPending ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Camera size={14} className="mr-2" />
                    Scan for Pests
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {farmerQuickStats.map((stat, index) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-emerald-100/70 dark:border-emerald-900/40 bg-white/85 dark:bg-slate-900/75 px-3 py-2.5 shadow-[0_14px_30px_-26px_rgba(5,150,105,0.6)] animate-fade-in [animation-fill-mode:both]"
              style={{ animationDelay: `${80 + index * 50}ms` }}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{stat.label}</p>
              <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-100/80 dark:border-emerald-900/45 bg-white/85 dark:bg-slate-900/75 px-3 md:px-4 py-3 flex flex-wrap items-center gap-2 md:gap-3 animate-fade-in [animation-delay:90ms] [animation-fill-mode:both]">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300">
          Active View: {activeTabCopy.title}
        </span>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Farm: {selectedFarm?.name || 'Not selected'}
        </span>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Weather Alerts: {weatherAlerts?.alerts?.length || 0}
        </span>
        {normalizedSearch && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] bg-green-100 text-green-800 dark:bg-green-900/35 dark:text-green-300">
            Filter: "{searchQuery.trim()}"
          </span>
        )}
      </div>

      {isOverviewTab && (
        <>
          <div className="animate-fade-in [animation-delay:102ms] [animation-fill-mode:both]">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700/80 dark:text-emerald-300/80">Daily Start Sequence</p>
            <p className="text-sm text-muted-foreground">Run core morning tasks in order before moving to detailed operations.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 animate-fade-in [animation-delay:105ms] [animation-fill-mode:both]">
          <Card className="border-emerald-100/80 dark:border-emerald-900/45 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/20 dark:to-slate-900 shadow-[0_18px_34px_-30px_rgba(5,150,105,0.8)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_40px_-28px_rgba(5,150,105,0.95)] animate-fade-in [animation-delay:120ms] [animation-fill-mode:both]">
            <CardContent className="p-4 h-full flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">Field Sync</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Refresh sensors, weather, and recommendations in one action.</p>
                </div>
                <RefreshCw size={16} className="text-emerald-700 dark:text-emerald-300" />
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Step 1 of daily start - Data sync</p>
              <Button className="mt-auto h-9 w-full rounded-xl focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2" onClick={handleRefreshAll}>
                Refresh All Sources
              </Button>
            </CardContent>
          </Card>

          <Card className="border-emerald-100/80 dark:border-emerald-900/45 bg-gradient-to-br from-cyan-50/80 to-white dark:from-cyan-950/20 dark:to-slate-900 shadow-[0_18px_34px_-30px_rgba(8,145,178,0.8)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_40px_-28px_rgba(8,145,178,0.95)] animate-fade-in [animation-delay:180ms] [animation-fill-mode:both]">
            <CardContent className="p-4 h-full flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-300">Water Planning</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Open the irrigation planner and schedule field-ready runs.</p>
                </div>
                <Droplets size={16} className="text-cyan-700 dark:text-cyan-300" />
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Step 2 of daily start - Water plan</p>
              <Button
                variant="outline"
                className="mt-auto h-9 w-full rounded-xl focus-visible:ring-2 focus-visible:ring-cyan-500/70 focus-visible:ring-offset-2"
                onClick={() => setShowIrrigationPlanner((previous) => !previous)}
              >
                {showIrrigationPlanner ? 'Hide Planner' : 'Open Planner'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-emerald-100/80 dark:border-emerald-900/45 bg-gradient-to-br from-green-50/80 to-white dark:from-green-950/20 dark:to-slate-900 shadow-[0_18px_34px_-30px_rgba(22,163,74,0.8)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_40px_-28px_rgba(22,163,74,0.95)] animate-fade-in [animation-delay:240ms] [animation-fill-mode:both]">
            <CardContent className="p-4 h-full flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-green-700 dark:text-green-300">Pest Triage</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Capture a fresh image and trigger instant detection guidance.</p>
                </div>
                <Camera size={16} className="text-green-700 dark:text-green-300" />
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Step 3 of daily start - Risk scan</p>
              <Button
                variant="outline"
                className="mt-auto h-9 w-full rounded-xl focus-visible:ring-2 focus-visible:ring-green-500/70 focus-visible:ring-offset-2"
                onClick={handlePestScanClick}
                disabled={!selectedFarm || analyzePestMutation.isPending}
              >
                Start Pest Scan
              </Button>
            </CardContent>
          </Card>
          </div>
        </>
      )}

      {isOverviewTab ? (
        <div className={workspaceGridClass}>
          <div className="xl:col-span-7 animate-fade-in [animation-delay:120ms] [animation-fill-mode:both]">
            <FarmSelector
              farms={filteredFarms}
              selectedFarm={selectedFarm}
              onSelect={setSelectedFarm}
              onAddFarm={handleAddFarm}
              isAddingFarm={createFarmMutation.isPending}
              emptyTitle={normalizedSearch ? 'No matching farms' : 'No Farms Yet'}
              emptyMessage={
                normalizedSearch
                  ? `No farms match "${searchQuery}".`
                  : 'Register your first farm to start monitoring'
              }
            />
          </div>

          <Card className="xl:col-span-5 self-start">
            <CardHeader className="pb-3">
              <CardTitle className={sectionTitleClass}>Farm Portfolio</CardTitle>
              <CardDescription className={sectionDescriptionClass}>Backend farm statistics for your registered farms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 lg:space-y-5">
              {!farmStats ? (
                <LoadingState text="Loading farm statistics..." size="sm" />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-2 2xl:grid-cols-4">
                    <div className="rounded-lg border p-3 sm:p-4 text-center">
                      <p className="text-2xl font-bold">{farmStats.totalFarms ?? 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">Registered Farms</p>
                    </div>
                    <div className="rounded-lg border p-3 sm:p-4 text-center">
                      <p className="text-2xl font-bold">{farmStats.activeFarms ?? 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">Active Farms</p>
                    </div>
                    <div className="rounded-lg border p-3 sm:p-4 text-center">
                      <p className="text-2xl font-bold">
                        {typeof farmStats.totalAreaHectares === 'number' ? farmStats.totalAreaHectares.toFixed(1) : '0.0'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Total Area (ha)</p>
                    </div>
                    <div className="rounded-lg border p-3 sm:p-4 text-center">
                      <p className="text-2xl font-bold">
                        {typeof farmStats.avgSizeHectares === 'number' ? farmStats.avgSizeHectares.toFixed(1) : '0.0'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Average Size (ha)</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border p-4 h-full">
                      <p className="font-medium">Top Growth Stages</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {farmPortfolioStages.length > 0 ? (
                          farmPortfolioStages.map(([stage, count]) => (
                            <Badge key={stage} variant="outline">
                              {stage.replace(/_/g, ' ')}: {count}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No growth-stage breakdown recorded yet.</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border p-4 h-full">
                      <p className="font-medium">Crop Varieties</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {farmPortfolioCrops.length > 0 ? (
                          farmPortfolioCrops.map(([crop, count]) => (
                            <Badge key={crop} variant="outline">
                              {crop}: {count}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No crop variety breakdown recorded yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="animate-fade-in [animation-delay:120ms] [animation-fill-mode:both]">
            <FarmSelector
              farms={filteredFarms}
              selectedFarm={selectedFarm}
              onSelect={setSelectedFarm}
              onAddFarm={handleAddFarm}
              isAddingFarm={createFarmMutation.isPending}
              emptyTitle={normalizedSearch ? 'No matching farms' : 'No Farms Yet'}
              emptyMessage={
                normalizedSearch
                  ? `No farms match "${searchQuery}".`
                  : 'Register your first farm to start monitoring'
              }
            />
          </div>

          <Card className="border-l-4 border-l-primary/50">
            <CardContent className="p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">{activeTabCopy.title}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedFarm
                    ? `Viewing ${selectedFarm.name}${selectedFarm.locationName ? ` in ${selectedFarm.locationName}` : ''}.`
                    : 'Select a farm to load this section.'}
                </p>
              </div>
              {selectedFarm && (
                <Badge variant="outline">
                  {selectedFarm.cropVariety || 'Maize'}
                </Badge>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {isOverviewTab && latestPestAnalysis?.detection && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className={`${sectionTitleClass} flex items-center gap-2`}>
              <Camera size={20} className="text-green-600" />
              Latest Pest Scan
            </CardTitle>
            <CardDescription className={sectionDescriptionClass}>
              Result from the most recent uploaded image for {selectedFarm?.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="space-y-1">
                <p className="font-semibold">
                  {latestPestAnalysis.detection.pestType || 'No specific pest identified'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Severity: {latestPestAnalysis.detection.severity || 'none'}
                  {typeof latestPestAnalysis.detection.confidenceScore === 'number'
                    ? ` | Confidence: ${Math.round(latestPestAnalysis.detection.confidenceScore * 100)}%`
                    : ''}
                </p>
                {typeof latestPestAnalysis.detection.affectedAreaPercentage === 'number' && (
                  <p className="text-sm text-muted-foreground">
                    Affected area: {latestPestAnalysis.detection.affectedAreaPercentage}%
                  </p>
                )}
              </div>
              <div className="flex flex-col items-start md:items-end gap-2">
                <Badge variant={latestPestAnalysis.detection.pestDetected ? 'default' : 'secondary'}>
                  {latestPestAnalysis.detection.pestDetected ? 'Pest detected' : 'No pest detected'}
                </Badge>
                <Badge variant={latestPestAnalysis.detection.isConfirmed ? 'default' : 'secondary'}>
                  {latestPestAnalysis.detection.isConfirmed ? 'Expert confirmed' : 'Preliminary AI screening'}
                </Badge>
              </div>
            </div>

            {!latestPestAnalysis.detection.isConfirmed && (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
                This result is a preliminary AI screening. Confirm with an agricultural expert before treatment decisions.
                {latestPestAnalysis.detection.severity === 'severe'
                  ? ' Severe findings are held for expert confirmation before alerts are issued.'
                  : ''}
              </div>
            )}

            {Array.isArray(latestPestAnalysis.analysis?.symptoms) && latestPestAnalysis.analysis.symptoms.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Observed symptoms</p>
                <p className="text-sm text-muted-foreground">
                  {latestPestAnalysis.analysis.symptoms.join(', ')}
                </p>
              </div>
            )}

            {Array.isArray(latestPestAnalysis.analysis?.recommendations) && latestPestAnalysis.analysis.recommendations.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Recommendations</p>
                <div className="space-y-1">
                  {latestPestAnalysis.analysis.recommendations.slice(0, 4).map((item: string, index: number) => (
                    <p key={`${item}-${index}`} className="text-sm text-muted-foreground">
                      {index + 1}. {item}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setLatestPestAnalysis(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showAddFarmForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add Farm</CardTitle>
            <CardDescription>Create a farm profile to start monitoring and recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 md:grid-cols-5 gap-3" onSubmit={handleCreateFarmSubmit}>
              <input
                value={farmNameInput}
                onChange={(event) => setFarmNameInput(event.target.value)}
                placeholder="Farm name"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm md:col-span-2"
                required
              />
              <input
                value={farmCropInput}
                onChange={(event) => setFarmCropInput(event.target.value)}
                placeholder="Crop variety"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
              <input
                value={farmLocationInput}
                onChange={(event) => setFarmLocationInput(event.target.value)}
                placeholder="Location"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
              <input
                value={farmSizeInput}
                onChange={(event) => setFarmSizeInput(event.target.value)}
                placeholder="Size (ha)"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                inputMode="decimal"
              />
              <div className="md:col-span-5 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddFarmForm(false)}
                  disabled={createFarmMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createFarmMutation.isPending || !farmNameInput.trim()}>
                  {createFarmMutation.isPending ? <Spinner size="sm" /> : 'Create Farm'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === 'overview' && selectedFarm && (
        <>
          {showIrrigationPlanner && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Plan Irrigation</CardTitle>
                <CardDescription>Create a scheduled irrigation task with custom timing and volume</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid grid-cols-1 md:grid-cols-5 gap-3" onSubmit={handleCreateIrrigationPlan}>
                  <input
                    type="date"
                    value={irrigationDateInput}
                    onChange={(event) => setIrrigationDateInput(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    required
                  />
                  <input
                    type="time"
                    value={irrigationTimeInput}
                    onChange={(event) => setIrrigationTimeInput(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    required
                  />
                  <input
                    type="number"
                    min={1}
                    value={irrigationDurationInput}
                    onChange={(event) => setIrrigationDurationInput(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    placeholder="Duration (min)"
                    required
                  />
                  <input
                    type="number"
                    min={0}
                    value={irrigationVolumeInput}
                    onChange={(event) => setIrrigationVolumeInput(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    placeholder="Water (L, optional)"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowIrrigationPlanner(false)}
                      disabled={irrigationMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={irrigationMutation.isPending}>
                      {irrigationMutation.isPending ? <Spinner size="sm" /> : 'Save Plan'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className={workspaceGridClass}>
            <div className="xl:col-span-12">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700/80 dark:text-emerald-300/80">Field Configuration</p>
              <p className="text-sm text-muted-foreground">Manage farm profile, verify backend summary, and prepare daily operations.</p>
            </div>
            <Card className={workspaceMainClass}>
              <CardHeader>
                <CardTitle className="text-lg">Farm Profile</CardTitle>
                <CardDescription>Update core farm details and growth stage</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid grid-cols-1 md:grid-cols-4 gap-3" onSubmit={handleSaveFarmProfile}>
                <input
                  value={farmEditName}
                  onChange={(event) => setFarmEditName(event.target.value)}
                  placeholder="Farm name"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm md:col-span-2"
                  required
                />
                <select
                  value={farmEditStage}
                  onChange={(event) => setFarmEditStage(event.target.value as GrowthStage)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {growthStages.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
                <input
                  value={farmEditSize}
                  onChange={(event) => setFarmEditSize(event.target.value)}
                  placeholder="Size (ha)"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  inputMode="decimal"
                />
                <div className="md:col-span-4 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDeleteSelectedFarm}
                    disabled={deleteFarmMutation.isPending}
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    {deleteFarmMutation.isPending ? <Spinner size="sm" /> : 'Delete Farm'}
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      updateFarmMutation.isPending
                      || updateFarmGrowthStageMutation.isPending
                      || !farmEditName.trim()
                    }
                  >
                    {updateFarmMutation.isPending || updateFarmGrowthStageMutation.isPending
                      ? <Spinner size="sm" />
                      : 'Save Farm'}
                  </Button>
                </div>
                </form>
              </CardContent>
            </Card>

          <Card className="xl:col-span-4 xl:sticky xl:top-24 self-start">
            <CardHeader>
              <CardTitle className="text-lg">Selected Farm Detail</CardTitle>
              <CardDescription>Route-backed detail loaded from the single farm backend endpoint</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedFarmDetailLoading ? (
                <LoadingState text="Loading farm detail..." size="sm" />
              ) : selectedFarmDetail ? (
                <div className="grid grid-cols-1 gap-3 xl:max-h-[520px] xl:overflow-y-auto xl:pr-1">
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Farm Name</p>
                    <p className="font-medium">{selectedFarmDetail.name || 'N/A'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">District</p>
                    <p className="font-medium">{selectedFarmDetail.district?.name || 'N/A'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Location</p>
                    <p className="font-medium">{selectedFarmDetail.locationName || 'N/A'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Crop Variety</p>
                    <p className="font-medium">{selectedFarmDetail.cropVariety || 'N/A'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Growth Stage</p>
                    <p className="font-medium">{selectedFarmDetail.currentGrowthStage || 'N/A'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Size</p>
                    <p className="font-medium">
                      {typeof selectedFarmDetail.sizeHectares === 'number'
                        ? `${selectedFarmDetail.sizeHectares.toFixed(1)} ha`
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Planting Date</p>
                    <p className="font-medium">
                      {selectedFarmDetail.plantingDate
                        ? new Date(selectedFarmDetail.plantingDate).toLocaleDateString(locale)
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Expected Harvest</p>
                    <p className="font-medium">
                      {selectedFarmDetail.expectedHarvestDate
                        ? new Date(selectedFarmDetail.expectedHarvestDate).toLocaleDateString(locale)
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Farm detail unavailable"
                  message="We could not load the selected farm detail from the backend route."
                />
              )}
            </CardContent>
          </Card>

          <Card className={workspaceMainClass}>
            <CardHeader>
              <CardTitle className="text-lg">Farm Summary</CardTitle>
              <CardDescription>Route-backed overview loaded from the farm summary backend endpoint</CardDescription>
            </CardHeader>
            <CardContent>
              {farmSummaryLoading ? (
                <LoadingState text="Loading farm summary..." size="sm" />
              ) : farmSummary ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Summary Farm</p>
                    <p className="font-medium">{farmSummary.farm?.name || selectedFarm?.name || 'N/A'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Latest Sensor Packets</p>
                    <p className="font-medium">{farmSummary.latestSensorData?.length ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Latest Reading Time</p>
                    <p className="font-medium">
                      {farmSummary.latestSensorData?.[0]?.readingTimestamp
                        ? new Date(farmSummary.latestSensorData[0].readingTimestamp).toLocaleString(locale)
                        : 'No recent reading'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Active Recommendations</p>
                    <p className="font-medium">{farmSummary.activeRecommendations?.length ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Recent Alerts</p>
                    <p className="font-medium">{farmSummary.recentAlerts?.length ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Upcoming Irrigation</p>
                    <p className="font-medium">{farmSummary.irrigationSchedule?.length ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3 md:col-span-2 xl:col-span-3">
                    <p className="text-xs text-muted-foreground uppercase">Recent Pest Detections</p>
                    <p className="font-medium">{farmSummary.recentPestDetections?.length ?? 0}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {farmSummary.irrigationSchedule?.[0]?.scheduledDate
                        ? `Next irrigation planned for ${new Date(farmSummary.irrigationSchedule[0].scheduledDate).toLocaleDateString(locale)}`
                        : 'No irrigation schedule returned from the summary route'}
                    </p>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Farm summary unavailable"
                  message="We could not load the farm summary from the backend summary route."
                />
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-4 self-start xl:sticky xl:top-24">
            <CardHeader>
              <CardTitle className="text-lg">Operational Snapshot</CardTitle>
              <CardDescription>Quick pulse checks before executing field actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground uppercase">Soil Moisture</p>
                  <p className="font-semibold">
                    {typeof latestReading?.soilMoisture === 'number' ? `${latestReading.soilMoisture.toFixed(1)}%` : '--'}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground uppercase">Temperature</p>
                  <p className="font-semibold">
                    {typeof latestReading?.airTemperature === 'number'
                      ? `${latestReading.airTemperature.toFixed(1)} C`
                      : typeof weather?.temperature === 'number'
                        ? `${weather.temperature.toFixed(1)} C`
                        : '--'}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground uppercase">Open Issues</p>
                  <p className="font-semibold">{farmIssues.length}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground uppercase">Due Irrigation</p>
                  <p className="font-semibold">{dueSchedules.length}</p>
                </div>
              </div>
              <div className="rounded-lg border p-3 flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Weather alerts</p>
                <Badge variant="outline">{weatherAlerts?.alerts?.length || 0}</Badge>
              </div>
              <div className="rounded-lg border p-3 flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Active recommendations</p>
                <Badge variant="outline">{filteredRecommendations.length}</Badge>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleRefreshAll}
              >
                <RefreshCw size={14} className="mr-2" />
                Sync All Data
              </Button>
            </CardContent>
          </Card>

          <div className="xl:col-span-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700/80 dark:text-emerald-300/80">Operational Intelligence</p>
            <p className="text-sm text-muted-foreground">Review history, trends, and recommendation streams before taking action.</p>
          </div>

          <div className="xl:col-span-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700/80 dark:text-emerald-300/80">Record Ledgers</p>
            <p className="text-sm text-muted-foreground">Audit recommendation and pest-detection history from backend routes.</p>
          </div>

          <Card className="xl:col-span-8">
            <CardHeader>
              <CardTitle className="text-lg">Farm Recommendation Ledger</CardTitle>
              <CardDescription>Loaded from the primary farm recommendations backend route</CardDescription>
            </CardHeader>
            <CardContent>
              {farmRecommendationLedgerLoading ? (
                <LoadingState text="Loading farm recommendations..." size="sm" />
              ) : farmRecommendationLedger.length === 0 ? (
                <EmptyState
                  title="No recommendation records"
                  message="No recommendation records have been returned for this farm yet."
                />
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {farmRecommendationLedger.map((recommendation: Recommendation) => (
                    <div key={recommendation.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">{recommendation.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {recommendation.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Created {new Date(recommendation.createdAt).toLocaleString(locale)}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <Badge variant="outline">{recommendation.type}</Badge>
                          <div>
                            <Badge variant={recommendation.status === 'pending' ? 'default' : 'secondary'}>
                              {recommendation.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-4 self-start">
            <CardHeader>
              <CardTitle className="text-lg">Farm Pest Detection Ledger</CardTitle>
              <CardDescription>Loaded from the primary farm pest-detection backend route</CardDescription>
            </CardHeader>
            <CardContent>
              {farmPestLedgerLoading ? (
                <LoadingState text="Loading farm pest detections..." size="sm" />
              ) : farmPestLedger.length === 0 ? (
                <EmptyState
                  title="No pest detection records"
                  message="No pest detection records have been returned for this farm yet."
                />
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {farmPestLedger.map((detection: PestDetection) => (
                    <div key={detection.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">{detection.pestType || 'Unknown pest'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {selectedFarm?.currentGrowthStage || 'Growth stage unavailable'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {detection.createdAt
                              ? `Detected ${new Date(detection.createdAt).toLocaleString(locale)}`
                              : 'Detection time unavailable'}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <Badge variant="outline">{detection.severity || 'none'}</Badge>
                          <div>
                            <Badge variant={detection.isConfirmed ? 'secondary' : 'default'}>
                              {detection.isConfirmed ? 'confirmed' : 'pending'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="xl:col-span-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700/80 dark:text-emerald-300/80">Live Monitoring</p>
            <p className="text-sm text-muted-foreground">Inspect current field telemetry, climate indicators, and short-term recommendations.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4 xl:col-span-12">
            <SensorCard
              icon={Droplets}
              label="Soil Moisture"
              value={
                typeof latestReading?.soilMoisture === 'number'
                  ? latestReading.soilMoisture.toFixed(1)
                  : '--'
              }
              unit="%"
              status={moistureStatus}
              trend={moistureTrend}
            />
            <SensorCard
              icon={Thermometer}
              label="Temperature"
              value={
                typeof latestReading?.airTemperature === 'number'
                  ? latestReading.airTemperature.toFixed(1)
                  : typeof weather?.temperature === 'number'
                    ? weather.temperature.toFixed(1)
                    : '--'
              }
              unit="C"
              status="normal"
            />
            <SensorCard
              icon={Wind}
              label="Humidity"
              value={
                typeof latestReading?.humidity === 'number'
                  ? latestReading.humidity.toFixed(0)
                  : typeof weather?.humidity === 'number'
                    ? weather.humidity.toFixed(0)
                    : '--'
              }
              unit="%"
              status="normal"
            />
            <SensorCard
              icon={Sprout}
              label="N-P-K"
              value={
                typeof latestReading?.nitrogen === 'number'
                  ? `${latestReading.nitrogen}-${latestReading.phosphorus || 0}-${latestReading.potassium || 0}`
                  : '--'
              }
              unit="mg/kg"
              status="normal"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-6 xl:col-span-12">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Soil Moisture Trend</CardTitle>
                <CardDescription>Recent readings</CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorMoisture" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                        <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} className="text-muted-foreground" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="moisture"
                          stroke="hsl(var(--primary))"
                          fillOpacity={1}
                          fill="url(#colorMoisture)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState title="No sensor data" message="Connect sensors to see moisture trends." />
                )}
              </CardContent>
            </Card>

            <WeatherCard weather={weather} forecast={forecast} />
          </div>

          <Card className="xl:col-span-5">
            <CardHeader>
              <CardTitle className="text-lg">Farming Conditions</CardTitle>
              <CardDescription>Current irrigation guidance from weather and field context</CardDescription>
            </CardHeader>
            <CardContent>
              {!farmingConditions ? (
                <LoadingState text="Loading farming conditions..." size="sm" />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Irrigation recommendation</p>
                    <Badge variant="outline">{farmingConditions.irrigationRecommendation}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Suggested delay</p>
                    <p className="text-sm font-semibold">{farmingConditions.delayDays} day(s)</p>
                  </div>
                  {farmingConditions.reasons?.length ? (
                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                      {farmingConditions.reasons.map((reason, index) => (
                        <li key={`${reason}-${index}`}>{reason}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No additional condition notes.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 xl:col-span-7">
            <WeatherAlertsCard alerts={weatherAlerts?.alerts} />
            <IrrigationWindowCard data={irrigationWindow} />
            <WeatherHistoryCard rows={weatherHistory?.data} />
          </div>

          <div className="xl:col-span-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700/80 dark:text-emerald-300/80">Execution Workbench</p>
            <p className="text-sm text-muted-foreground">Review recommendations, capture field issues, and trigger immediate actions.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 xl:col-span-12">
            <div className="rounded-xl border bg-muted/25 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Pending Advice</p>
              <p className="mt-1 text-xl font-black">{filteredRecommendations.length}</p>
            </div>
            <div className="rounded-xl border bg-muted/25 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Open Issues</p>
              <p className="mt-1 text-xl font-black">{farmIssues.length}</p>
            </div>
            <div className="rounded-xl border bg-muted/25 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Irrigation Due</p>
              <p className="mt-1 text-xl font-black">{dueSchedules.length}</p>
            </div>
          </div>

          <div className={workspaceMainClass}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle size={20} className="text-primary" />
                  Active Recommendations
                </CardTitle>
                <CardDescription>AI-powered suggestions for your farm</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredRecommendations.length > 0 ? (
                  <div className="space-y-4 xl:max-h-[760px] xl:overflow-y-auto xl:pr-2">
                    {filteredRecommendations.map((recommendation) => {
                      const linkedIrrigationSchedule = recommendation.irrigationScheduleId
                        ? irrigationSchedulesByRecommendationId.get(recommendation.irrigationScheduleId) || null
                        : null;

                      return (
                        <RecommendationCard
                          key={recommendation.id}
                          recommendation={recommendation}
                          linkedIrrigationSchedule={linkedIrrigationSchedule}
                          onAccept={() => handleRecommendationResponse(recommendation, 'accepted')}
                          onReject={() => handleRecommendationResponse(recommendation, 'rejected')}
                          onDefer={() => handleDeferRecommendation(recommendation.id)}
                          onComplete={() => handleCompleteRecommendation(recommendation.id)}
                          onOpenSchedule={() => setShowSchedule(true)}
                          onExecuteSchedule={() => linkedIrrigationSchedule && handleExecuteIrrigation(linkedIrrigationSchedule.id)}
                          onAdjustSchedule={() => {
                            if (!linkedIrrigationSchedule) return;
                            setShowSchedule(true);
                            handleOpenPostponeSchedule(linkedIrrigationSchedule);
                          }}
                          isLoading={respondMutation.isPending || completeRecommendationMutation.isPending || irrigationActionPending}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    title={normalizedSearch ? 'No matching recommendations' : 'No active recommendations'}
                    message={
                      normalizedSearch
                        ? `No recommendations match "${searchQuery}".`
                        : 'You are all caught up. Check back later for new insights.'
                    }
                    icon={
                      <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full">
                        <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                      </div>
                    }
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className={workspaceRailClass}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Report a Farm Issue</CardTitle>
                <CardDescription>
                  Flag irrigation, sensor, pest, weather, or general farm issues for follow-up and tracking.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form className="space-y-3" onSubmit={handleReportFarmIssue}>
                <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
                  <select
                    value={issueCategoryInput}
                    onChange={(event) => setIssueCategoryInput(event.target.value as typeof issueCategoryInput)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="general">General issue</option>
                    <option value="irrigation">Irrigation</option>
                    <option value="fertilization">Fertilization</option>
                    <option value="pest">Pest / crop health</option>
                    <option value="sensor">Sensor / device</option>
                    <option value="weather">Weather impact</option>
                  </select>
                  <select
                    value={issueSeverityInput}
                    onChange={(event) => setIssueSeverityInput(event.target.value as typeof issueSeverityInput)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="low">Low severity</option>
                    <option value="medium">Medium severity</option>
                    <option value="high">High severity</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <input
                  value={issueTitleInput}
                  onChange={(event) => setIssueTitleInput(event.target.value)}
                  placeholder="Short issue title"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                />
                <textarea
                  value={issueDescriptionInput}
                  onChange={(event) => setIssueDescriptionInput(event.target.value)}
                  placeholder="Describe what happened, where it happened, and what you observed."
                  className="min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={
                      createFarmIssueMutation.isPending
                      || !issueTitleInput.trim()
                      || !issueDescriptionInput.trim()
                    }
                  >
                    {createFarmIssueMutation.isPending ? <Spinner size="sm" /> : 'Submit Issue'}
                  </Button>
                </div>
              </form>

              <div className="space-y-3 border-t pt-4">
                <div>
                  <p className="font-medium">Recent issue reports</p>
                  <p className="text-sm text-muted-foreground">
                    Latest farmer-reported issues for this farm and their current status.
                  </p>
                </div>
                {farmIssuesLoading ? (
                  <LoadingState text="Loading farm issues..." size="sm" />
                ) : farmIssues.length > 0 ? (
                  <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                    {farmIssues.map((issue) => (
                      <div key={issue.id} className="rounded-lg border p-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-medium">{issue.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
                            {issue.expertNotes && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Expert note: {issue.expertNotes}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{issue.status}</Badge>
                            <Badge className={priorityColors[issue.severity === 'urgent' ? 'critical' : issue.severity === 'high' ? 'high' : issue.severity === 'medium' ? 'medium' : 'low']}>
                              {issue.severity}
                            </Badge>
                            <Badge variant="outline">{issue.category}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No reported issues"
                    message="Use the form above when something on the farm needs follow-up from the system or an expert."
                  />
                )}
                </div>
              </CardContent>
            </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Run the most common farmer tasks from a single control panel</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-auto min-h-[88px] py-3 flex-col gap-2"
                  onClick={handleScheduleIrrigation}
                  disabled={irrigationMutation.isPending}
                >
                  {irrigationMutation.isPending ? <Spinner size="sm" /> : <Droplets size={24} />}
                  <span>{irrigationMutation.isPending ? 'Scheduling...' : 'Start Irrigation'}</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto min-h-[88px] py-3 flex-col gap-2"
                  onClick={() => setShowIrrigationPlanner((previous) => !previous)}
                >
                  <Calendar size={24} />
                  <span>{showIrrigationPlanner ? 'Hide Planner' : 'Plan Irrigation'}</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto min-h-[88px] py-3 flex-col gap-2"
                  onClick={handlePestScanClick}
                  disabled={analyzePestMutation.isPending}
                >
                  {analyzePestMutation.isPending ? <Spinner size="sm" /> : <Camera size={24} />}
                  <span>{analyzePestMutation.isPending ? 'Analyzing...' : 'Pest Detection'}</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto min-h-[88px] py-3 flex-col gap-2"
                  onClick={handleGenerateRecommendations}
                  disabled={generateRecommendationsMutation.isPending}
                >
                  {generateRecommendationsMutation.isPending ? <Spinner size="sm" /> : <Sprout size={24} />}
                  <span>{generateRecommendationsMutation.isPending ? 'Generating...' : 'Generate Advice'}</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto min-h-[88px] py-3 flex-col gap-2"
                  onClick={() => setShowSchedule((previous) => !previous)}
                >
                  <Calendar size={24} />
                  <span>{showSchedule ? 'Hide Schedule' : 'View Schedule'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          </div>

          {showSchedule && (
            <Card className="xl:col-span-12">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar size={20} />
                    Irrigation Schedule
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExecuteDueIrrigation}
                    disabled={irrigationActionPending || dueSchedules.length === 0}
                  >
                    {irrigationActionPending ? <Spinner size="sm" /> : `Execute Due (${dueSchedules.length})`}
                  </Button>
                </div>
                <CardDescription>Upcoming manual and automated irrigation plans</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredSchedules.length === 0 ? (
                  <EmptyState
                    title={normalizedSearch ? 'No matching schedules' : 'No upcoming irrigation plans'}
                    message={
                      normalizedSearch
                        ? `No irrigation schedules match "${searchQuery}".`
                        : 'Use Start Irrigation to create your first schedule.'
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredSchedules.map((schedule) => (
                      <div key={schedule.id} className="rounded-lg border p-3">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <div>
                            <p className="font-semibold">
                              {formatDate(schedule.scheduledDate, locale)} at{' '}
                              {schedule.scheduledTime || formatTime(schedule.scheduledDate, locale)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Duration: {schedule.durationMinutes} min
                              {typeof schedule.waterVolumeLiters === 'number'
                                ? ` | Water: ${schedule.waterVolumeLiters} L`
                                : ''}
                              {schedule.triggerSource ? ` | Source: ${schedule.triggerSource}` : ''}
                            </p>
                            {schedule.postponedAt && schedule.previousScheduledDate && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Last postponed from {formatDate(schedule.previousScheduledDate, locale)}
                                {schedule.previousScheduledTime ? ` at ${schedule.previousScheduledTime}` : ''}
                              </p>
                            )}
                          </div>
                          <Badge variant={schedule.isExecuted ? 'secondary' : 'outline'}>
                            {schedule.isExecuted ? 'executed' : 'scheduled'}
                          </Badge>
                        </div>
                        {!schedule.isExecuted && (
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExecuteIrrigation(schedule.id)}
                              disabled={irrigationActionPending}
                            >
                              {executeIrrigationMutation.isPending ? <Spinner size="sm" /> : 'Mark Executed'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenPostponeSchedule(schedule)}
                              disabled={irrigationActionPending}
                            >
                              Postpone
                            </Button>
                          </div>
                        )}
                        {!schedule.isExecuted && postponeScheduleId === schedule.id && (
                          <div className="mt-3 rounded-md border bg-muted/20 p-3 space-y-3">
                            <p className="text-sm font-medium">Postpone irrigation</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input
                                type="date"
                                value={postponeDateInput}
                                onChange={(event) => setPostponeDateInput(event.target.value)}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              />
                              <input
                                type="time"
                                value={postponeTimeInput}
                                onChange={(event) => setPostponeTimeInput(event.target.value)}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPostponeScheduleId(null);
                                  setPostponeDateInput('');
                                  setPostponeTimeInput('06:00');
                                }}
                                disabled={updateIrrigationMutation.isPending}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handlePostponeIrrigation(schedule)}
                                disabled={updateIrrigationMutation.isPending || !postponeDateInput}
                              >
                                {updateIrrigationMutation.isPending ? <Spinner size="sm" /> : 'Save postponement'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          </div>
        </>
      )}

      {/* ===== Sensors Tab ===== */}
      {activeTab === 'sensors' && selectedFarmId && (
        <div className={workspaceGridClass}>
          <div className={workspaceMainClass}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sensor Management</CardTitle>
                <CardDescription>All sensors registered for this farm</CardDescription>
              </CardHeader>
              <CardContent>
                <SensorManagementPanel farmId={selectedFarmId} locale={locale} />
              </CardContent>
            </Card>
          </div>

          <div className={workspaceRailClass}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Field Context</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Live summary for the selected farm workspace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Selected farm</p>
                  <p className="font-semibold">{selectedFarm?.name || 'N/A'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedFarm?.locationName || selectedFarm?.district?.name || 'Location not set'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {farmerQuickStats.slice(0, 4).map((stat) => (
                    <div key={`sensor-${stat.label}`} className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase">{stat.label}</p>
                      <p className="text-lg font-semibold">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'sensors' && !selectedFarmId && (
        <EmptyState title="No farm selected" message="Select a farm to view its sensors and latest readings." />
      )}

      {/* ===== Fertilization Tab ===== */}
      {activeTab === 'fertilization' && selectedFarmId && (
        <div className={workspaceGridClass}>
          <div className={workspaceMainClass}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Droplets size={20} className="text-primary" />
                  Fertilization Schedules
                </CardTitle>
                <CardDescription>Planned and completed fertilization events</CardDescription>
              </CardHeader>
              <CardContent>
                <FertilizationPanel farmId={selectedFarmId} locale={locale} />
              </CardContent>
            </Card>
          </div>

          <div className={workspaceRailClass}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Nutrition Context</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Keep fertilization aligned with field status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Farm</p>
                  <p className="font-semibold">{selectedFarm?.name || 'N/A'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Growth stage</p>
                  <p className="font-semibold capitalize">{selectedFarm?.currentGrowthStage?.replace(/_/g, ' ') || 'Not set'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Open irrigation plans</p>
                  <p className="text-lg font-semibold">{upcomingSchedules.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'fertilization' && !selectedFarmId && (
        <EmptyState title="No farm selected" message="Select a farm to view fertilization schedules." />
      )}

      {/* ===== Pest History Tab ===== */}
      {activeTab === 'pest-history' && selectedFarmId && (
        <div className={workspaceGridClass}>
          <div className={workspaceMainClass}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pest Detection History</CardTitle>
                <CardDescription>All past scans and detection results for this farm</CardDescription>
              </CardHeader>
              <CardContent>
                <PestHistoryPanel farmId={selectedFarmId} />
              </CardContent>
            </Card>
          </div>

          <div className={workspaceRailClass}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Pest Watch</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Track scan outputs and pending issues</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Recent pest records</p>
                  <p className="text-lg font-semibold">{farmPestLedger.length}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Open farm issues</p>
                  <p className="text-lg font-semibold">{farmIssues.length}</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handlePestScanClick}
                  disabled={!selectedFarm || analyzePestMutation.isPending}
                >
                  {analyzePestMutation.isPending ? <Spinner size="sm" /> : 'Run New Pest Scan'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'pest-history' && !selectedFarmId && (
        <EmptyState title="No farm selected" message="Select a farm to review previous pest detections." />
      )}

      {/* ===== Analytics Tab ===== */}
      {activeTab === 'analytics' && selectedFarmId && (
        <div className={workspaceGridClass}>
          <div className={workspaceMainClass}>
            <AnalyticsPanel farmId={selectedFarmId} />
          </div>

          <div className={workspaceRailClass}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Analytics Context</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Current farm and monitoring status at a glance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Farm</p>
                  <p className="font-semibold">{selectedFarm?.name || 'N/A'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Weather alerts</p>
                    <p className="text-lg font-semibold">{weatherAlerts?.alerts?.length || 0}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Advice items</p>
                    <p className="text-lg font-semibold">{recommendations?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && !selectedFarmId && (
        <EmptyState title="No farm selected" message="Select a farm to view analytics and trend summaries." />
      )}

      {/* ===== AI Chat Tab ===== */}
      {activeTab === 'ai-chat' && (
        <div className={workspaceGridClass}>
          <div className={workspaceMainClass}>
            <AiChatPanel farmId={selectedFarmId} />
          </div>

          <div className={workspaceRailClass}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>AI Session Context</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Use this context for better farm-specific guidance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Selected farm</p>
                  <p className="font-semibold">{selectedFarm?.name || 'No farm selected'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Crop variety</p>
                  <p className="font-semibold">{selectedFarm?.cropVariety || 'N/A'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Location</p>
                  <p className="font-semibold">{selectedFarm?.locationName || selectedFarm?.district?.name || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Sub-panels ----------

function SensorManagementPanel({ farmId, locale }: { farmId: string; locale: string }) {
  const { data: sensors, isLoading } = useSensorsByFarm(farmId);
  const { data: readings, isLoading: readingsLoading } = useFarmSensorData(farmId, { limit: 12 });
  const { data: latestSnapshot, isLoading: latestSnapshotLoading } = useFarmLatestReadings(farmId);
  const [selectedSensorId, setSelectedSensorId] = useState<string>('');
  const {
    data: selectedSensor,
    isLoading: selectedSensorLoading,
    refetch: refetchSelectedSensor,
  } = useSensor(selectedSensorId);
  const createSensorMutation = useCreateSensor();
  const updateSensorMutation = useUpdateSensor();
  const deleteSensorMutation = useDeleteSensor();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSensorId, setEditingSensorId] = useState<string | null>(null);
  const [form, setForm] = useState({
    deviceId: '',
    sensorType: 'soil_moisture',
    name: '',
    locationDescription: '',
    latitude: '',
    longitude: '',
  });
  const resetForm = () => {
    setForm({
      deviceId: '',
      sensorType: 'soil_moisture',
      name: '',
      locationDescription: '',
      latitude: '',
      longitude: '',
    });
    setShowCreateForm(false);
    setEditingSensorId(null);
  };

  const toOptionalNumber = (value: string) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const startEditing = (sensor: Sensor) => {
    setEditingSensorId(sensor.id);
    setShowCreateForm(false);
    setForm({
      deviceId: sensor.deviceId || '',
      sensorType: sensor.sensorType || 'soil_moisture',
      name: sensor.name || '',
      locationDescription: sensor.locationDescription || '',
      latitude: sensor.coordinates?.lat !== undefined ? String(sensor.coordinates.lat) : '',
      longitude: sensor.coordinates?.lng !== undefined ? String(sensor.coordinates.lng) : '',
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const latitude = toOptionalNumber(form.latitude);
    const longitude = toOptionalNumber(form.longitude);
    const coordinates =
      latitude !== undefined && longitude !== undefined ? { lat: latitude, lng: longitude } : undefined;

    if (editingSensorId) {
      await updateSensorMutation.mutateAsync({
        id: editingSensorId,
        data: {
          name: form.name.trim() || undefined,
          locationDescription: form.locationDescription.trim() || undefined,
          coordinates,
          status: 'active',
        },
      });
    } else {
      await createSensorMutation.mutateAsync({
        farmId,
        deviceId: form.deviceId.trim(),
        sensorType: form.sensorType as Sensor['sensorType'],
        name: form.name.trim() || undefined,
        locationDescription: form.locationDescription.trim() || undefined,
        coordinates,
      });
    }

    resetForm();
  };

  const handleDelete = async (sensor: Sensor) => {
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Delete sensor "${sensor.name || sensor.deviceId}"?`);
    if (!confirmed) return;

    await deleteSensorMutation.mutateAsync({ id: sensor.id, farmId });
    if (editingSensorId === sensor.id) {
      resetForm();
    }
  };

  const list = Array.isArray(sensors) ? sensors : [];
  const latestReadings = Array.isArray(readings) ? readings : [];
  const latestSnapshotRows = latestSnapshot
    ? (Object.entries((latestSnapshot as SensorLatestReadingsPayload).readings || {}) as Array<[string, any]>)
        .filter(([, value]) => value)
    : [];
  const isSubmitting = createSensorMutation.isPending || updateSensorMutation.isPending;

  useEffect(() => {
    if (!selectedSensorId && list.length > 0) {
      setSelectedSensorId(list[0].id);
      return;
    }
    if (selectedSensorId && list.length > 0 && !list.some((sensor) => sensor.id === selectedSensorId)) {
      setSelectedSensorId(list[0].id);
    }
  }, [list, selectedSensorId]);

  if (isLoading || readingsLoading) return <LoadingState text="Loading sensors..." size="sm" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant={showCreateForm || editingSensorId ? 'outline' : 'default'}
          onClick={() => {
            if (showCreateForm || editingSensorId) {
              resetForm();
              return;
            }
            setShowCreateForm(true);
          }}
        >
          {showCreateForm || editingSensorId ? 'Cancel' : 'Add Sensor'}
        </Button>
      </div>

      {(showCreateForm || editingSensorId) && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleSubmit}>
              <input
                value={form.deviceId}
                onChange={(event) => setForm((current) => ({ ...current, deviceId: event.target.value }))}
                placeholder="Device ID"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                disabled={!!editingSensorId}
                required={!editingSensorId}
              />
              <select
                value={form.sensorType}
                onChange={(event) => setForm((current) => ({ ...current, sensorType: event.target.value }))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                disabled={!!editingSensorId}
              >
                <option value="soil_moisture">Soil moisture</option>
                <option value="temperature">Temperature</option>
                <option value="humidity">Humidity</option>
                <option value="npk">NPK</option>
                <option value="rainfall">Rainfall</option>
                <option value="light">Light</option>
              </select>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Display name"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
              <input
                value={form.locationDescription}
                onChange={(event) => setForm((current) => ({ ...current, locationDescription: event.target.value }))}
                placeholder="Location description"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
              <input
                value={form.latitude}
                onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))}
                placeholder="Latitude"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                inputMode="decimal"
              />
              <input
                value={form.longitude}
                onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))}
                placeholder="Longitude"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                inputMode="decimal"
              />
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || (!editingSensorId && !form.deviceId.trim())}>
                  {isSubmitting ? <Spinner size="sm" /> : editingSensorId ? 'Update Sensor' : 'Create Sensor'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {latestReadings.length > 0 && (
        <div className="rounded-lg border p-3 bg-muted/20">
          <p className="font-medium mb-2">Latest readings</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {latestReadings.slice(0, 6).map((reading: any) => (
              <div key={reading.id} className="rounded-md border bg-background p-3">
                <p className="text-sm font-medium">
                  {reading.sensorId ? `Sensor ${reading.sensorId.slice(0, 8)}` : 'Sensor reading'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {reading.readingTimestamp ? new Date(reading.readingTimestamp).toLocaleString() : 'Unknown time'}
                </p>
                <div className="mt-2 text-sm text-muted-foreground space-y-1">
                  {typeof reading.soilMoisture === 'number' && <p>Soil moisture: {reading.soilMoisture}%</p>}
                  {typeof reading.soilTemperature === 'number' && <p>Soil temperature: {reading.soilTemperature} C</p>}
                  {typeof reading.airTemperature === 'number' && <p>Air temperature: {reading.airTemperature} C</p>}
                  {typeof reading.humidity === 'number' && <p>Humidity: {reading.humidity}%</p>}
                  {typeof reading.rainfallMm === 'number' && <p>Rainfall: {reading.rainfallMm} mm</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Latest Sensor Snapshot</CardTitle>
          <CardDescription>Route-backed snapshot loaded from the dedicated farm latest-readings endpoint</CardDescription>
        </CardHeader>
        <CardContent>
          {latestSnapshotLoading ? (
            <LoadingState text="Loading latest sensor snapshot..." size="sm" />
          ) : latestSnapshotRows.length === 0 ? (
            <EmptyState
              title="No latest snapshot"
              message="The dedicated latest-readings route did not return any sensor packets yet."
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Last updated:{' '}
                  {latestSnapshot?.lastUpdated
                    ? new Date(latestSnapshot.lastUpdated).toLocaleString(locale)
                    : 'Unknown'}
                </p>
                <Badge variant="outline">{latestSnapshotRows.length} channels</Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {latestSnapshotRows.map(([channel, reading]) => (
                  <div key={channel} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{channel}</p>
                      <p className="text-xs text-muted-foreground">
                        {reading.readingTimestamp
                          ? new Date(reading.readingTimestamp).toLocaleString(locale)
                          : 'Unknown time'}
                      </p>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground space-y-1">
                      {typeof reading.soilMoisture === 'number' && <p>Soil moisture: {reading.soilMoisture}%</p>}
                      {typeof reading.soilTemperature === 'number' && <p>Soil temperature: {reading.soilTemperature} C</p>}
                      {typeof reading.airTemperature === 'number' && <p>Air temperature: {reading.airTemperature} C</p>}
                      {typeof reading.humidity === 'number' && <p>Humidity: {reading.humidity}%</p>}
                      {typeof reading.nitrogen === 'number' && (
                        <p>NPK: {reading.nitrogen}-{reading.phosphorus || 0}-{reading.potassium || 0}</p>
                      )}
                      {typeof reading.rainfallMm === 'number' && <p>Rainfall: {reading.rainfallMm} mm</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedSensorId && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Selected Sensor Detail</CardTitle>
            <CardDescription>Route-backed detail loaded from the single sensor backend endpoint</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedSensorLoading ? (
              <LoadingState text="Loading sensor detail..." size="sm" />
            ) : selectedSensor ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{selectedSensor.name || selectedSensor.sensorType}</p>
                    <p className="text-xs text-muted-foreground">{selectedSensor.deviceId || 'Unknown device'}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => refetchSelectedSensor()}>
                    Refresh Detail
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Sensor Type</p>
                    <p className="font-medium">{selectedSensor.sensorType || 'N/A'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Status</p>
                    <p className="font-medium">{selectedSensor.status || 'N/A'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Battery Level</p>
                    <p className="font-medium">
                      {typeof selectedSensor.batteryLevel === 'number' ? `${selectedSensor.batteryLevel}%` : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Firmware</p>
                    <p className="font-medium">{selectedSensor.firmwareVersion || 'N/A'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Last Reading</p>
                    <p className="font-medium">
                      {selectedSensor.lastReadingAt
                        ? new Date(selectedSensor.lastReadingAt).toLocaleString(locale)
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Calibration Date</p>
                    <p className="font-medium">
                      {selectedSensor.calibrationDate
                        ? new Date(selectedSensor.calibrationDate).toLocaleDateString(locale)
                        : 'N/A'}
                    </p>
                  </div>
                </div>
                {selectedSensor.locationDescription && (
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase">Location Description</p>
                    <p className="font-medium">{selectedSensor.locationDescription}</p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState title="Sensor detail unavailable" message="We could not load the selected sensor detail from the backend route." />
            )}
          </CardContent>
        </Card>
      )}

      {list.length === 0 ? (
        <EmptyState
          title="No registered sensors"
          message="Create a sensor to start organizing hardware attached to this farm."
        />
      ) : (
        <>
          <p className="font-medium">Registered sensors</p>
          {list.map((sensor) => (
            <div key={sensor.id} className="rounded-lg border p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{sensor.name || sensor.sensorType}</p>
                <p className="text-xs text-muted-foreground">
                  {sensor.sensorType} | Device: {sensor.deviceId}
                </p>
                {sensor.locationDescription && (
                  <p className="text-xs text-muted-foreground mt-1">{sensor.locationDescription}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={sensor.status === 'active' ? 'default' : 'secondary'}>
                  {sensor.status === 'active' ? 'Active' : sensor.status}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => setSelectedSensorId(sensor.id)}>
                  {selectedSensorId === sensor.id ? 'Viewing Detail' : 'View Detail'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => startEditing(sensor)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(sensor)}
                  disabled={deleteSensorMutation.isPending}
                >
                  {deleteSensorMutation.isPending ? <Spinner size="sm" /> : 'Delete'}
                </Button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function FertilizationPanel({ farmId, locale }: { farmId: string; locale: string }) {
  const { data: schedules, isLoading } = useFertilizationSchedules(farmId);
  const createFertilizationMutation = useCreateFertilization();
  const updateFertilizationMutation = useUpdateFertilization();
  const deleteFertilizationMutation = useDeleteFertilization();
  const executeFertilizationMutation = useExecuteFertilization();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [form, setForm] = useState({
    scheduledDate: new Date().toISOString().slice(0, 10),
    fertilizerType: '',
    applicationMethod: 'manual',
    totalQuantityKg: '',
    nitrogenKg: '',
    phosphorusKg: '',
    potassiumKg: '',
    notes: '',
  });

  const resetForm = () => {
    setForm({
      scheduledDate: new Date().toISOString().slice(0, 10),
      fertilizerType: '',
      applicationMethod: 'manual',
      totalQuantityKg: '',
      nitrogenKg: '',
      phosphorusKg: '',
      potassiumKg: '',
      notes: '',
    });
    setShowCreateForm(false);
    setEditingScheduleId(null);
  };

  const toOptionalNumber = (value: string) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const startEditing = (schedule: FertilizationSchedule) => {
    setEditingScheduleId(schedule.id);
    setShowCreateForm(false);
    setForm({
      scheduledDate: schedule.scheduledDate ? schedule.scheduledDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      fertilizerType: schedule.fertilizerType || '',
      applicationMethod: schedule.applicationMethod || 'manual',
      totalQuantityKg: schedule.totalQuantityKg !== undefined ? String(schedule.totalQuantityKg) : '',
      nitrogenKg: schedule.nitrogenKg !== undefined ? String(schedule.nitrogenKg) : '',
      phosphorusKg: schedule.phosphorusKg !== undefined ? String(schedule.phosphorusKg) : '',
      potassiumKg: schedule.potassiumKg !== undefined ? String(schedule.potassiumKg) : '',
      notes: schedule.notes || '',
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const payload = {
      scheduledDate: form.scheduledDate,
      fertilizerType: form.fertilizerType.trim(),
      applicationMethod: form.applicationMethod.trim() || undefined,
      totalQuantityKg: toOptionalNumber(form.totalQuantityKg),
      nitrogenKg: toOptionalNumber(form.nitrogenKg),
      phosphorusKg: toOptionalNumber(form.phosphorusKg),
      potassiumKg: toOptionalNumber(form.potassiumKg),
      notes: form.notes.trim() || undefined,
    };

    if (editingScheduleId) {
      await updateFertilizationMutation.mutateAsync({
        farmId,
        scheduleId: editingScheduleId,
        data: payload,
      });
    } else {
      await createFertilizationMutation.mutateAsync({
        farmId,
        data: payload,
      });
    }

    resetForm();
  };

  const handleDelete = async (schedule: FertilizationSchedule) => {
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Delete fertilization schedule "${schedule.fertilizerType}"?`);
    if (!confirmed) return;

    await deleteFertilizationMutation.mutateAsync({ farmId, scheduleId: schedule.id });
    if (editingScheduleId === schedule.id) {
      resetForm();
    }
  };

  const handleExecute = async (schedule: FertilizationSchedule) => {
    await executeFertilizationMutation.mutateAsync({
      farmId,
      scheduleId: schedule.id,
      data: {
        actualQuantityKg: schedule.totalQuantityKg,
      },
    });
  };

  if (isLoading) return <LoadingState text="Loading fertilization schedules..." size="sm" />;
  const list = Array.isArray(schedules) ? schedules : [];
  const isSubmitting = createFertilizationMutation.isPending || updateFertilizationMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant={showCreateForm || editingScheduleId ? 'outline' : 'default'}
          onClick={() => {
            if (showCreateForm || editingScheduleId) {
              resetForm();
              return;
            }
            setShowCreateForm(true);
          }}
        >
          {showCreateForm || editingScheduleId ? 'Cancel' : 'Add Schedule'}
        </Button>
      </div>

      {(showCreateForm || editingScheduleId) && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleSubmit}>
              <input
                type="date"
                value={form.scheduledDate}
                onChange={(event) => setForm((current) => ({ ...current, scheduledDate: event.target.value }))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                required
              />
              <input
                value={form.fertilizerType}
                onChange={(event) => setForm((current) => ({ ...current, fertilizerType: event.target.value }))}
                placeholder="Fertilizer type"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                required
              />
              <input
                value={form.applicationMethod}
                onChange={(event) => setForm((current) => ({ ...current, applicationMethod: event.target.value }))}
                placeholder="Application method"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
              <input
                value={form.totalQuantityKg}
                onChange={(event) => setForm((current) => ({ ...current, totalQuantityKg: event.target.value }))}
                placeholder="Total quantity (kg)"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                inputMode="decimal"
              />
              <input
                value={form.nitrogenKg}
                onChange={(event) => setForm((current) => ({ ...current, nitrogenKg: event.target.value }))}
                placeholder="Nitrogen (kg)"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                inputMode="decimal"
              />
              <input
                value={form.phosphorusKg}
                onChange={(event) => setForm((current) => ({ ...current, phosphorusKg: event.target.value }))}
                placeholder="Phosphorus (kg)"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                inputMode="decimal"
              />
              <input
                value={form.potassiumKg}
                onChange={(event) => setForm((current) => ({ ...current, potassiumKg: event.target.value }))}
                placeholder="Potassium (kg)"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                inputMode="decimal"
              />
              <input
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Notes"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !form.fertilizerType.trim()}>
                  {isSubmitting ? <Spinner size="sm" /> : editingScheduleId ? 'Update Schedule' : 'Create Schedule'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {list.length === 0 ? (
        <EmptyState title="No schedules" message="No fertilization schedules found for this farm." />
      ) : (
        list.map((schedule) => (
          <div key={schedule.id} className="rounded-lg border p-3 space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{schedule.fertilizerType || 'Fertilizer'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Scheduled: {schedule.scheduledDate ? new Date(schedule.scheduledDate).toLocaleDateString(locale) : 'TBD'}
                  {schedule.totalQuantityKg ? ` | ${schedule.totalQuantityKg} kg` : ''}
                  {schedule.applicationMethod ? ` | ${schedule.applicationMethod}` : ''}
                </p>
                {schedule.notes && <p className="text-sm text-muted-foreground mt-1">{schedule.notes}</p>}
              </div>
              <Badge variant={schedule.isExecuted ? 'secondary' : 'outline'}>
                {schedule.isExecuted ? 'Executed' : 'Scheduled'}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              {!schedule.isExecuted && (
                <>
                  <Button size="sm" variant="outline" onClick={() => startEditing(schedule)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExecute(schedule)}
                    disabled={executeFertilizationMutation.isPending}
                  >
                    {executeFertilizationMutation.isPending ? <Spinner size="sm" /> : 'Mark Executed'}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDelete(schedule)}
                disabled={deleteFertilizationMutation.isPending}
              >
                {deleteFertilizationMutation.isPending ? <Spinner size="sm" /> : 'Delete'}
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function PestHistoryPanel({ farmId }: { farmId: string }) {
  const deletePestDetectionMutation = useDeletePestDetection();
  const [expandedDetectionId, setExpandedDetectionId] = useState<string | null>(null);
  const { data: response, isLoading } = usePestScans(farmId, { limit: 20 });
  const {
    data: selectedScan,
    isLoading: selectedScanLoading,
    isError: selectedScanError,
  } = usePestScan(expandedDetectionId || '', !!expandedDetectionId);

  if (isLoading) return <LoadingState text="Loading pest history..." size="sm" />;
  const items: PestDetection[] = (response as any)?.data ?? [];
  if (items.length === 0)
    return <EmptyState title="No detections" message="No pest scans recorded for this farm yet." />;

  const handleDelete = async (detection: PestDetection) => {
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Delete pest detection "${detection.pestType || 'unknown pest'}"?`);
    if (!confirmed) return;

    await deletePestDetectionMutation.mutateAsync(detection.id);
    if (expandedDetectionId === detection.id) {
      setExpandedDetectionId(null);
    }
  };

  return (
    <div className="space-y-3">
      {items.map((d) => (
        <div key={d.id} className="rounded-lg border p-3 space-y-3">
          <div className="flex items-start gap-3">
            {d.imageUrl && (
              <img src={d.imageUrl} alt="pest" className="w-16 h-16 rounded object-cover flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{d.pestType || 'Unknown pest'}</p>
              <p className="text-xs text-muted-foreground">
                {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ''}
                {d.severity ? ` | Severity: ${d.severity}` : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {d.isConfirmed ? 'Expert-confirmed detection.' : 'Preliminary AI screening pending expert review.'}
              </p>
              {d.expertNotes && <p className="text-sm mt-1 line-clamp-2">{d.expertNotes}</p>}
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <Badge variant={d.isConfirmed ? 'default' : 'secondary'}>
                {d.isConfirmed ? 'Expert confirmed' : 'Pending expert review'}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setExpandedDetectionId((current) => current === d.id ? null : d.id)}
              >
                {expandedDetectionId === d.id
                  ? 'Hide guidance'
                  : d.isConfirmed
                    ? 'View control plan'
                    : 'View AI guidance'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDelete(d)}
                disabled={deletePestDetectionMutation.isPending}
              >
                {deletePestDetectionMutation.isPending ? <Spinner size="sm" /> : 'Delete'}
              </Button>
            </div>
          </div>
          {expandedDetectionId === d.id && (
            <div className="space-y-3">
              <div className="rounded-lg border border-dashed p-3 text-sm">
                {selectedScanLoading ? (
                  <LoadingState text="Loading scan detail..." size="sm" />
                ) : selectedScanError ? (
                  <p className="text-muted-foreground">
                    We could not load the route-backed scan detail. Showing the list entry data instead.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="font-medium">Selected Scan Detail</p>
                    <p className="text-xs text-muted-foreground">
                      Loaded from the dedicated pest scan detail route for this record.
                    </p>
                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="rounded-md bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Detected pest</p>
                        <p className="font-medium">{selectedScan?.pestType || 'Unknown pest'}</p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Confidence</p>
                        <p className="font-medium">
                          {typeof selectedScan?.confidenceScore === 'number'
                            ? `${Math.round(selectedScan.confidenceScore * 100)}%`
                            : 'Not available'}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Affected area</p>
                        <p className="font-medium">
                          {typeof selectedScan?.affectedAreaPercentage === 'number'
                            ? `${selectedScan.affectedAreaPercentage}%`
                            : 'Not available'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <PestGuidancePanel detection={selectedScan || d} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PestGuidancePanel({ detection }: { detection: PestDetection }) {
  const { data, isLoading, isError } = usePestTreatmentRecommendations(detection.id);
  const { data: pestControlSchedules = [], isLoading: schedulesLoading } = usePestControlSchedules(detection.farmId, {
    detectionId: detection.id,
  });
  const createPestControlMutation = useCreatePestControl();
  const executePestControlMutation = useExecutePestControl();
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('06:00');
  const [controlMethod, setControlMethod] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const expertTreatments: string[] = Array.isArray(data?.treatments) && data.treatments.length > 0
    ? data.treatments
    : Array.isArray(detection.treatmentRecommendations)
      ? detection.treatmentRecommendations
      : [];
  const aiRecommendations: string[] = Array.isArray(data?.aiRecommendations) && data.aiRecommendations.length > 0
    ? data.aiRecommendations
    : Array.isArray(detection.detectionMetadata?.analysis?.recommendations)
      ? detection.detectionMetadata.analysis.recommendations
      : [];
  const expertNotes = data?.expertNotes || detection.expertNotes;
  const hasGuidance = expertTreatments.length > 0 || aiRecommendations.length > 0 || !!expertNotes;
  const pendingSchedules = useMemo(
    () =>
      pestControlSchedules
        .filter((schedule) => !schedule.isExecuted)
        .sort((left, right) => new Date(left.scheduledDate).getTime() - new Date(right.scheduledDate).getTime()),
    [pestControlSchedules]
  );
  const completedSchedules = useMemo(
    () =>
      pestControlSchedules
        .filter((schedule) => schedule.isExecuted)
        .sort((left, right) => new Date(right.executedAt || right.scheduledDate).getTime() - new Date(left.executedAt || left.scheduledDate).getTime()),
    [pestControlSchedules]
  );

  useEffect(() => {
    if (!controlMethod.trim()) {
      setControlMethod(expertTreatments[0] || detection.pestType || 'Targeted pest control action');
    }
  }, [controlMethod, detection.pestType, expertTreatments]);

  const handleScheduleControl = async () => {
    if (!scheduledDate || !controlMethod.trim()) return;

    await createPestControlMutation.mutateAsync({
      farmId: detection.farmId,
      data: {
        detectionId: detection.id,
        scheduledDate,
        scheduledTime: scheduledTime || undefined,
        controlMethod: controlMethod.trim(),
        treatmentSteps: expertTreatments.length > 0 ? expertTreatments : aiRecommendations,
        notes: scheduleNotes.trim() || undefined,
        triggerSource: detection.isConfirmed ? 'expert_review' : 'manual',
      },
    });
  };

  const handleExecuteControl = async (scheduleId: string) => {
    await executePestControlMutation.mutateAsync({
      farmId: detection.farmId,
      scheduleId,
      data: {
        actualOutcome: 'completed',
        notes: 'Farmer marked pest control as completed from the dashboard.',
      },
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-dashed p-3">
        <LoadingState text="Loading control guidance..." size="sm" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Unable to load detailed pest guidance right now.
      </div>
    );
  }

  if (!hasGuidance) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        No detailed pest-control guidance is available for this scan yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {expertTreatments.length > 0 && (
          <Badge variant="default">Expert-updated control plan</Badge>
        )}
        {expertTreatments.length === 0 && aiRecommendations.length > 0 && (
          <Badge variant="secondary">Preliminary AI guidance</Badge>
        )}
      </div>

      {expertNotes && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expert Notes</p>
          <p className="text-sm mt-1">{expertNotes}</p>
        </div>
      )}

      {expertTreatments.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended Field Actions</p>
          <ul className="mt-2 space-y-1 text-sm">
            {expertTreatments.map((item, index) => (
              <li key={`${detection.id}-expert-treatment-${index}`} className="flex gap-2">
                <span className="text-muted-foreground">-</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {aiRecommendations.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {expertTreatments.length > 0 ? 'AI Screening Notes' : 'AI Suggestions'}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {aiRecommendations.map((item, index) => (
              <li key={`${detection.id}-ai-guidance-${index}`} className="flex gap-2">
                <span>-</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-dashed p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pest Control Action Plan</p>
            <p className="text-sm text-muted-foreground">
              Schedule the field action here, then mark it executed after the treatment is done.
            </p>
          </div>
          {pendingSchedules.length > 0 && (
            <Badge variant="secondary">{pendingSchedules.length} scheduled</Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Scheduled date</span>
            <input
              type="date"
              value={scheduledDate}
              onChange={(event) => setScheduledDate(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Scheduled time</span>
            <input
              type="time"
              value={scheduledTime}
              onChange={(event) => setScheduledTime(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
        </div>

        <label className="text-sm space-y-1 block">
          <span className="text-muted-foreground">Control method</span>
          <input
            type="text"
            value={controlMethod}
            onChange={(event) => setControlMethod(event.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2"
            placeholder="Describe the planned pest control action"
          />
        </label>

        <label className="text-sm space-y-1 block">
          <span className="text-muted-foreground">Scheduling notes</span>
          <textarea
            value={scheduleNotes}
            onChange={(event) => setScheduleNotes(event.target.value)}
            className="w-full min-h-[84px] rounded-md border bg-background px-3 py-2"
            placeholder="Add any field notes, product details, or follow-up reminders"
          />
        </label>

        <Button
          onClick={handleScheduleControl}
          disabled={createPestControlMutation.isPending || !scheduledDate || !controlMethod.trim()}
        >
          {createPestControlMutation.isPending ? <Spinner size="sm" /> : 'Schedule Control Action'}
        </Button>

        {schedulesLoading ? (
          <LoadingState text="Loading pest control schedule..." size="sm" />
        ) : (
          <div className="space-y-3">
            {pendingSchedules.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Upcoming or Active Actions</p>
                {pendingSchedules.map((schedule) => (
                  <div key={schedule.id} className="rounded-md border bg-background p-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{schedule.controlMethod}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(schedule.scheduledDate).toLocaleDateString()}
                        {schedule.scheduledTime ? ` at ${schedule.scheduledTime}` : ''}
                      </p>
                      {schedule.notes && <p className="text-sm text-muted-foreground">{schedule.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Scheduled</Badge>
                      <Button
                        size="sm"
                        onClick={() => handleExecuteControl(schedule.id)}
                        disabled={executePestControlMutation.isPending}
                      >
                        {executePestControlMutation.isPending ? <Spinner size="sm" /> : 'Mark Executed'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {completedSchedules.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completed Pest Control</p>
                {completedSchedules.slice(0, 3).map((schedule) => (
                  <div key={schedule.id} className="rounded-md border bg-background p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm">{schedule.controlMethod}</p>
                      <Badge variant="default">Executed</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {schedule.executedAt
                        ? `Completed on ${new Date(schedule.executedAt).toLocaleString()}`
                        : `Scheduled for ${new Date(schedule.scheduledDate).toLocaleDateString()}`}
                    </p>
                    {schedule.actualOutcome && (
                      <p className="text-sm text-muted-foreground mt-1">Outcome: {schedule.actualOutcome}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsPanel({ farmId }: { farmId: string }) {
  const { data: dash, isLoading: dashLoading } = useAnalyticsDashboard(farmId);
  const { data: trends, isLoading: trendsLoading } = useFarmSensorTrendsAnalytics(farmId, { interval: 'day' });
  const { data: recommendationHistory, isLoading: recommendationHistoryLoading } = useRecommendationHistoryAnalytics(farmId, { days: 30 });
  const { data: farmActivity, isLoading: farmActivityLoading } = useFarmActivityAnalytics(farmId, { days: 30, limit: 10 });
  const exportFarmActivityMutation = useExportFarmActivity();
  if (dashLoading) return <LoadingState text="Loading analytics..." />;
  const d = dash as any;
  const stats = [
    { label: 'Total Sensors', value: d?.farm?.sensors?.length ?? d?.sensorCount ?? 0 },
    { label: 'Active Alerts', value: d?.recentAlerts?.length ?? d?.alertCount ?? 0 },
    { label: 'Recommendations', value: d?.activeRecommendations?.length ?? d?.recommendationCount ?? 0 },
    { label: 'Pest Events', value: d?.recentPestDetections?.length ?? d?.pestDetectionCount ?? 0 },
  ];
  const trendRows = Array.isArray((trends as any)?.trends)
    ? (trends as any).trends
    : Array.isArray((trends as any)?.readings)
      ? (trends as any).readings
      : [];
  const chartRows = trendRows.map((row: any) => ({
    date: row.date || row.reading_date || '',
    soilMoisture: row.soilMoisture ?? row.avgSoilMoisture ?? row.avg_soil_moisture ?? 0,
  }));
  const recommendationStats = recommendationHistory?.stats;
  const recentResponses = Array.isArray(recommendationHistory?.history)
    ? recommendationHistory.history
        .filter((item) => item.respondedAt)
        .sort((left, right) => new Date(right.respondedAt || 0).getTime() - new Date(left.respondedAt || 0).getTime())
        .slice(0, 4)
    : [];
  const responseChannels = Object.entries(recommendationStats?.byChannel || {});
  const formatChannelLabel = (value: string) =>
    value
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  const activityTypeRows = Object.entries(farmActivity?.summary?.byType || {});
  const recentActivityItems = Array.isArray(farmActivity?.activity) ? farmActivity.activity : [];
  const formatActivityLabel = (value: string) =>
    value
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  const formatActivityTimestamp = (value: string) => new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const handleExportFarmActivity = async (format: 'csv' | 'json') => {
    try {
      const blob = await exportFarmActivityMutation.mutateAsync({
        farmId,
        params: { days: 30, limit: 100, format },
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `farm-${farmId}-activity.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Error notification handled in mutation hook.
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{String(stat.value)}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {trendsLoading ? (
        <LoadingState text="Loading sensor trends..." size="sm" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Sensor Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {chartRows.length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartRows}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area type="monotone" dataKey="soilMoisture" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.15)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="No trend data" message="Not enough data to show trends yet." />
            )}
          </CardContent>
        </Card>
      )}
      {recommendationHistoryLoading ? (
        <LoadingState text="Loading recommendation insights..." size="sm" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommendation Response Insights</CardTitle>
              <CardDescription>How quickly you have been responding over the last 30 days.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Total recommendations</p>
                  <p className="mt-1 text-2xl font-semibold">{recommendationStats?.total ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Response rate</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {typeof recommendationStats?.responseRate === 'number'
                      ? `${Math.round(recommendationStats.responseRate)}%`
                      : '0%'}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Avg. response time</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {typeof recommendationStats?.averageResponseTime === 'number'
                      ? `${recommendationStats.averageResponseTime}h`
                      : 'N/A'}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Executed actions</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {recommendationStats?.byStatus?.executed ?? 0}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Response channels</p>
                {responseChannels.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {responseChannels.map(([channel, count]) => (
                      <Badge key={channel} variant="outline">
                        {formatChannelLabel(channel)}: {count}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No farmer responses have been recorded for this period yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Recommendation Responses</CardTitle>
              <CardDescription>Latest recorded farmer decisions and their response channel.</CardDescription>
            </CardHeader>
            <CardContent>
              {recentResponses.length > 0 ? (
                <div className="space-y-3">
                  {recentResponses.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">{item.title || 'Recommendation'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.responseChannel ? `${formatChannelLabel(item.responseChannel)} response` : 'Response recorded'}
                            {item.respondedAt ? ` on ${formatTime(item.respondedAt, 'en-US')}` : ''}
                          </p>
                        </div>
                        <Badge variant="outline">{item.status}</Badge>
                      </div>
                      {item.responseNotes && (
                        <p className="mt-2 text-sm text-muted-foreground">{item.responseNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No responses yet"
                  message="Accepted, rejected, or deferred recommendations will appear here once you act on them."
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {farmActivityLoading ? (
        <LoadingState text="Loading farm activity..." size="sm" />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-base">Farm Activity Log</CardTitle>
                <CardDescription>Recent logged actions across recommendations, schedules, pest scans, and issue follow-up.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exportFarmActivityMutation.isPending}
                  onClick={() => handleExportFarmActivity('csv')}
                >
                  Export CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exportFarmActivityMutation.isPending}
                  onClick={() => handleExportFarmActivity('json')}
                >
                  Export JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {activityTypeRows.length > 0 ? (
                activityTypeRows.map(([type, count]) => (
                  <Badge key={type} variant="outline">
                    {formatActivityLabel(type)}: {count}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No farm activity has been recorded for this period yet.</p>
              )}
            </div>

            {recentActivityItems.length > 0 ? (
              <div className="space-y-3">
                {recentActivityItems.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-sm">{item.title}</p>
                          <Badge variant="outline">{formatActivityLabel(item.action)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatActivityLabel(item.type)} - {formatActivityTimestamp(item.timestamp)}
                        </p>
                      </div>
                      {item.status && (
                        <Badge variant="outline">{item.status}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No activity yet"
                message="Completed actions, logged issue updates, and expert-reviewed events will appear here."
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AiChatPanel({ farmId }: { farmId?: string | null }) {
  const [messages, setMessages] = React.useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [input, setInput] = React.useState('');
  const [adviceQ, setAdviceQ] = React.useState('');
  const [analysisImageUrl, setAnalysisImageUrl] = React.useState('');
  const [translationText, setTranslationText] = React.useState('');
  const [translationTarget, setTranslationTarget] = React.useState<'en' | 'rw'>('rw');
  const chatMutation = useAiChat();
  const adviceMutation = useAiAdvice();
  const imageAnalysisMutation = useAiImageAnalysis();
  const saveFarmImageMutation = useSaveFarmImage();
  const translationMutation = useAiTranslate();
  const capabilitiesQuery = useAiCapabilities();
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const scrollToBottom = React.useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);
  const appendAssistantMessage = React.useCallback((content: string) => {
    setMessages((prev) => [...prev, { role: 'assistant', content }]);
    scrollToBottom();
  }, [scrollToBottom]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    const history = messages.map((m) => ({ role: m.role, content: m.content, timestamp: new Date().toISOString() }));
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    try {
      const res = await chatMutation.mutateAsync({
        message: userMsg,
        conversationHistory: history,
        farmId: farmId ?? undefined,
      });
      appendAssistantMessage(res?.reply?.trim() || 'I could not generate a response right now.');
    } catch {
      appendAssistantMessage('I could not reach the AI assistant right now. Please try again.');
    }
  };

  const handleAdvice = async () => {
    if (!adviceQ.trim()) return;
    const q = adviceQ.trim();
    setAdviceQ('');
    const res = await adviceMutation
      .mutateAsync({ question: q, context: { farmId: farmId ?? undefined } })
      .catch(() => null);
    if (!res) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: `[Advice] ${q}` },
        { role: 'assistant', content: 'I could not generate advice right now.' },
      ]);
      scrollToBottom();
      return;
    }
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: `[Advice] ${q}` },
      { role: 'assistant', content: res.answer + (res.suggestions?.length ? '\n\nSuggestions:\n- ' + res.suggestions.join('\n- ') : '') },
    ]);
    scrollToBottom();
  };

  const handleImageAnalysis = async () => {
    if (!analysisImageUrl.trim()) return;
    await imageAnalysisMutation.mutateAsync({
      imageUrl: analysisImageUrl.trim(),
      context: {
        cropType: 'Maize',
      },
    });
  };

  const handleSaveFarmImage = async () => {
    if (!farmId || !analysisImageUrl.trim()) return;
    await saveFarmImageMutation.mutateAsync({
      farmId,
      data: {
        imageUrl: analysisImageUrl.trim(),
        capturedAt: new Date().toISOString(),
      },
    });
  };

  const handleTranslate = async () => {
    if (!translationText.trim()) return;
    await translationMutation.mutateAsync({
      text: translationText.trim(),
      targetLanguage: translationTarget,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">AI Chat Assistant</CardTitle>
            <CardDescription>Ask anything about your farm, crops, or practices</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 gap-3">
            <div className="flex-1 overflow-y-auto max-h-72 space-y-2 rounded-lg border p-3 bg-muted/30">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center pt-6">Start a conversation with the AI assistant.</p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-lg px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border'
                  }`}>
                    {m.role === 'user' ? m.content : <FormattedAiResponse content={m.content} className="space-y-2" />}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Type a message..."
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
              <Button size="sm" onClick={handleSend} disabled={chatMutation.isPending || !input.trim()}>
                {chatMutation.isPending ? <Spinner size="sm" /> : 'Send'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agricultural Advice</CardTitle>
            <CardDescription>Get AI-powered crop & farm advice</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={adviceQ}
              onChange={(e) => setAdviceQ(e.target.value)}
              placeholder="e.g. How do I manage soil moisture for maize during dry season?"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
            />
            <Button onClick={handleAdvice} disabled={adviceMutation.isPending || !adviceQ.trim()} className="w-full">
              {adviceMutation.isPending ? <Spinner size="sm" /> : 'Get Advice'}
            </Button>
            {adviceMutation.data && (
              <div className="rounded-lg border p-3 bg-muted/30 text-sm space-y-2">
                <p className="font-medium">Answer</p>
                <FormattedAiResponse content={adviceMutation.data.answer} />
                {adviceMutation.data.suggestions?.length > 0 && (
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {adviceMutation.data.suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Camera size={18} className="text-primary" />
              Crop Image Analysis
            </CardTitle>
            <CardDescription>Analyze a hosted image URL and optionally save it to the farm image record</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              value={analysisImageUrl}
              onChange={(e) => setAnalysisImageUrl(e.target.value)}
              placeholder="Paste an image URL"
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
            <Button
              onClick={handleImageAnalysis}
              disabled={imageAnalysisMutation.isPending || !analysisImageUrl.trim()}
              className="w-full"
            >
              {imageAnalysisMutation.isPending ? <Spinner size="sm" /> : 'Analyze Image'}
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveFarmImage}
              disabled={saveFarmImageMutation.isPending || !analysisImageUrl.trim() || !farmId}
              className="w-full"
            >
              {saveFarmImageMutation.isPending ? <Spinner size="sm" /> : 'Save to Farm Record'}
            </Button>
            {!farmId && (
              <p className="text-xs text-muted-foreground">
                Select a farm first to save an image into the farm record.
              </p>
            )}
            {imageAnalysisMutation.data && (
              <div className="rounded-lg border p-3 bg-muted/30 space-y-2 text-sm">
                <p><span className="font-medium">Overall health:</span> {imageAnalysisMutation.data.overallHealth}</p>
                <p><span className="font-medium">Growth stage:</span> {imageAnalysisMutation.data.growthStageEstimate || 'Unknown'}</p>
                {imageAnalysisMutation.data.recommendations?.length > 0 && (
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {imageAnalysisMutation.data.recommendations.slice(0, 3).map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {saveFarmImageMutation.data && (
              <div className="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm">
                <p className="font-medium">Farm image saved</p>
                <p>Total stored farm images: {saveFarmImageMutation.data.data.totalImages}</p>
                <p className="text-muted-foreground break-all">{saveFarmImageMutation.data.data.image.url}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw size={18} className="text-primary" />
              Translator
            </CardTitle>
            <CardDescription>Translate agricultural text between English and Kinyarwanda</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={translationText}
              onChange={(e) => setTranslationText(e.target.value)}
              placeholder="Type text to translate..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
            />
            <div className="flex gap-2">
              <select
                value={translationTarget}
                onChange={(e) => setTranslationTarget(e.target.value as 'en' | 'rw')}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="rw">Translate to Kinyarwanda</option>
                <option value="en">Translate to English</option>
              </select>
              <Button onClick={handleTranslate} disabled={translationMutation.isPending || !translationText.trim()} className="flex-1">
                {translationMutation.isPending ? <Spinner size="sm" /> : 'Translate'}
              </Button>
            </div>
            {translationMutation.data && (
              <div className="rounded-lg border p-3 bg-muted/30 text-sm space-y-2">
                <p className="font-medium">Translation</p>
                <p>{translationMutation.data.translated}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sprout size={18} className="text-primary" />
              AI Capabilities
            </CardTitle>
            <CardDescription>Live backend AI feature summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {capabilitiesQuery.isLoading ? (
              <LoadingState text="Loading AI capabilities..." size="sm" />
            ) : capabilitiesQuery.data ? (
              <>
                <div className="rounded-lg border p-3 bg-muted/30 text-sm">
                  <p><span className="font-medium">Provider:</span> {capabilitiesQuery.data.provider}</p>
                  <p><span className="font-medium">Model:</span> {capabilitiesQuery.data.model}</p>
                  <p><span className="font-medium">Languages:</span> {capabilitiesQuery.data.supportedLanguages.join(', ')}</p>
                </div>
                <div className="space-y-2">
                  {capabilitiesQuery.data.features.slice(0, 5).map((feature) => (
                    <div key={feature.name} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">{feature.name}</p>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState title="Unavailable" message="Could not load AI capabilities from the backend." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ConnectedFarmerDashboard;

