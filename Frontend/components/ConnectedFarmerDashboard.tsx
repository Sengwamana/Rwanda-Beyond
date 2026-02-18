// =====================================================
// Connected Farmer Dashboard - Smart Maize Farming System
// With real API integration and state management
// =====================================================

import React, { useState, useEffect } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Spinner, LoadingState, ErrorState, EmptyState } from './ui/Spinner';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// Import hooks
import { 
  useFarms, 
  useFarmDashboard, 
  useFarmSensorData, 
  useWeather, 
  useForecast,
  useActiveRecommendations,
  useRespondToRecommendation,
  useCreateIrrigation,
  useAnalyzePest
} from '../hooks/useApi';
import { useAuthStore, useFarmStore } from '../store';
import { Language, translations } from '../utils/translations';
import { 
  Farm, 
  SensorData, 
  Recommendation, 
  WeatherData, 
  WeatherForecast,
  RecommendationPriority 
} from '../types';

interface ConnectedFarmerDashboardProps {
  language: Language;
}

// Helper to format dates
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

// Helper to format time
const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Priority badge colors
const priorityColors: Record<RecommendationPriority, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

// Sensor Card Component
function SensorCard({ 
  icon: Icon, 
  label, 
  value, 
  unit, 
  status, 
  trend 
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
    warning: 'text-yellow-500',
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
            <TrendIcon 
              size={16} 
              className={trend === 'up' ? 'text-green-500' : 'text-red-500'} 
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Recommendation Card Component
function RecommendationCard({ 
  recommendation,
  onAccept,
  onReject,
  isLoading
}: { 
  recommendation: Recommendation;
  onAccept: () => void;
  onReject: () => void;
  isLoading: boolean;
}) {
  const getIcon = () => {
    switch (recommendation.type) {
      case 'irrigation': return Droplets;
      case 'fertilization': return Sprout;
      case 'pest_alert': return AlertTriangle;
      case 'weather_alert': return Cloud;
      default: return CheckCircle;
    }
  };
  
  const Icon = getIcon();

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
              <Badge className={priorityColors[recommendation.priority]}>
                {recommendation.priority}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {recommendation.description}
            </p>
            {recommendation.actionDeadline && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Clock size={12} />
                Action needed by {formatDate(recommendation.actionDeadline)}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                onClick={onAccept}
                disabled={isLoading}
              >
                {isLoading ? <Spinner size="sm" /> : 'Accept'}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={onReject}
                disabled={isLoading}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Weather Card Component
function WeatherCard({ weather, forecast }: { weather?: WeatherData; forecast?: WeatherForecast[] }) {
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
    if (condition.toLowerCase().includes('rain')) return CloudRain;
    if (condition.toLowerCase().includes('cloud')) return Cloud;
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
          {/* Current Weather */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{Math.round(weather.temperature)}°C</p>
              <p className="text-sm text-muted-foreground capitalize">{weather.description}</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Humidity: {weather.humidity}%</p>
              <p>Wind: {weather.windSpeed} m/s</p>
            </div>
          </div>

          {/* Forecast */}
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
                      <p className="text-xs">
                        {Math.round(day.temperatureMax)}°
                      </p>
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

// Farm Selector Component
function FarmSelector({ 
  farms, 
  selectedFarm, 
  onSelect 
}: { 
  farms: Farm[];
  selectedFarm: Farm | null;
  onSelect: (farm: Farm) => void;
}) {
  if (farms.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Sprout className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Farms Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Register your first farm to start monitoring
          </p>
          <Button>
            <Plus size={16} className="mr-2" />
            Add Farm
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
          {farm.sizeHectares && (
            <p className="text-xs opacity-80">{farm.sizeHectares} ha</p>
          )}
        </button>
      ))}
      <Button variant="outline" size="sm" className="flex-shrink-0">
        <Plus size={14} className="mr-1" />
        Add Farm
      </Button>
    </div>
  );
}

// Main Connected Dashboard Component
export function ConnectedFarmerDashboard({ language }: ConnectedFarmerDashboardProps) {
  const { user } = useAuthStore();
  const { farms, selectedFarm, setFarms, setSelectedFarm } = useFarmStore();
  
  // API Queries
  const { data: farmsData, isLoading: farmsLoading, error: farmsError, refetch: refetchFarms } = useFarms();
  const { data: dashboardData, isLoading: dashboardLoading } = useFarmDashboard(selectedFarm?.id || '');
  const { data: sensorData } = useFarmSensorData(selectedFarm?.id || '', { limit: 50 });
  const { data: weather } = useWeather(selectedFarm?.id || '');
  const { data: forecast } = useForecast(selectedFarm?.id || '', 5);
  const { data: recommendations } = useActiveRecommendations(selectedFarm?.id);
  
  // Mutations
  const respondMutation = useRespondToRecommendation();
  const irrigationMutation = useCreateIrrigation();

  // Update store when farms data changes
  useEffect(() => {
    if (farmsData?.data) {
      setFarms(farmsData.data);
      if (!selectedFarm && farmsData.data.length > 0) {
        setSelectedFarm(farmsData.data[0]);
      }
    }
  }, [farmsData, selectedFarm, setFarms, setSelectedFarm]);

  // Transform sensor data for charts
  const chartData = sensorData?.map((reading) => ({
    time: formatTime(reading.readingTimestamp),
    date: formatDate(reading.readingTimestamp),
    moisture: reading.soilMoisture || 0,
    temperature: reading.airTemperature || reading.soilTemperature || 0,
    humidity: reading.humidity || 0,
  })).reverse() || [];

  // Handle recommendation response
  const handleRecommendationResponse = (id: string, status: 'accepted' | 'rejected') => {
    respondMutation.mutate({ id, data: { status } });
  };

  // Loading state
  if (farmsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState text="Loading your farms..." />
      </div>
    );
  }

  // Error state
  if (farmsError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ErrorState 
          title="Failed to load farms"
          message="We couldn't load your farm data. Please try again."
          onRetry={() => refetchFarms()}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {user?.firstName ? `Hello, ${user.firstName}! 👋` : 'Farm Dashboard'}
          </h1>
          <p className="text-muted-foreground">
            Monitor your farm's health and get AI-powered recommendations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchFarms()}>
            <RefreshCw size={14} className="mr-2" />
            Refresh
          </Button>
          <Button size="sm">
            <Camera size={14} className="mr-2" />
            Scan for Pests
          </Button>
        </div>
      </div>

      {/* Farm Selector */}
      <FarmSelector 
        farms={farms} 
        selectedFarm={selectedFarm} 
        onSelect={setSelectedFarm} 
      />

      {selectedFarm && (
        <>
          {/* Sensor Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SensorCard
              icon={Droplets}
              label="Soil Moisture"
              value={sensorData?.[0]?.soilMoisture?.toFixed(1) || '--'}
              unit="%"
              status={
                sensorData?.[0]?.soilMoisture 
                  ? sensorData[0].soilMoisture < 30 ? 'critical' 
                    : sensorData[0].soilMoisture < 50 ? 'warning' 
                    : 'normal'
                  : 'normal'
              }
              trend={chartData.length > 1 
                ? chartData[chartData.length - 1].moisture > chartData[chartData.length - 2].moisture 
                  ? 'up' : 'down'
                : undefined
              }
            />
            <SensorCard
              icon={Thermometer}
              label="Temperature"
              value={sensorData?.[0]?.airTemperature?.toFixed(1) || weather?.temperature?.toFixed(1) || '--'}
              unit="°C"
              status="normal"
            />
            <SensorCard
              icon={Wind}
              label="Humidity"
              value={sensorData?.[0]?.humidity?.toFixed(0) || weather?.humidity || '--'}
              unit="%"
              status="normal"
            />
            <SensorCard
              icon={Sprout}
              label="N-P-K"
              value={
                sensorData?.[0]?.nitrogen 
                  ? `${sensorData[0].nitrogen}-${sensorData[0].phosphorus || 0}-${sensorData[0].potassium || 0}`
                  : '--'
              }
              unit="mg/kg"
              status="normal"
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Chart - 2 columns */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Soil Moisture Trend</CardTitle>
                <CardDescription>Last 24 hours</CardDescription>
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
                        <XAxis 
                          dataKey="time" 
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                          domain={[0, 100]}
                          className="text-muted-foreground"
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
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
                  <EmptyState 
                    title="No sensor data"
                    message="Connect sensors to see moisture trends"
                  />
                )}
              </CardContent>
            </Card>

            {/* Weather - 1 column */}
            <WeatherCard weather={weather} forecast={forecast} />
          </div>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle size={20} className="text-primary" />
                Active Recommendations
              </CardTitle>
              <CardDescription>
                AI-powered suggestions for your farm
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendations && recommendations.length > 0 ? (
                <div className="space-y-4">
                  {recommendations.map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      recommendation={rec}
                      onAccept={() => handleRecommendationResponse(rec.id, 'accepted')}
                      onReject={() => handleRecommendationResponse(rec.id, 'rejected')}
                      isLoading={respondMutation.isPending}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState 
                  title="No active recommendations"
                  message="You're all caught up! Check back later for new insights."
                  icon={
                    <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full">
                      <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                  }
                />
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Droplets size={24} />
              <span>Start Irrigation</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Camera size={24} />
              <span>Pest Detection</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Sprout size={24} />
              <span>Fertilization</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Calendar size={24} />
              <span>View Schedule</span>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default ConnectedFarmerDashboard;
