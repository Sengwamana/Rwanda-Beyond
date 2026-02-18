// =====================================================
// Dashboard Widgets - Reusable components
// =====================================================

import React from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { 
  Droplets, 
  Thermometer, 
  Wind, 
  Sprout, 
  Sun,
  CloudRain,
  Cloud,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Battery,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Sensor, SensorData, Device, Alert } from '../../types';

// ===== Sensor Status Widget =====
interface SensorStatusWidgetProps {
  sensors: Sensor[];
  isLoading?: boolean;
}

export function SensorStatusWidget({ sensors, isLoading }: SensorStatusWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Spinner size="md" />
        </CardContent>
      </Card>
    );
  }

  const activeSensors = sensors.filter(s => s.status === 'active').length;
  const totalSensors = sensors.length;
  const avgBattery = sensors.reduce((sum, s) => sum + (s.batteryLevel || 0), 0) / totalSensors || 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Sensor Network</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">{activeSensors}/{totalSensors}</span>
            <Badge variant={activeSensors === totalSensors ? 'default' : 'secondary'}>
              {activeSensors === totalSensors ? 'All Online' : 'Partial'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Battery size={14} />
            <span>Avg Battery: {avgBattery.toFixed(0)}%</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {sensors.slice(0, 3).map((sensor) => (
              <div 
                key={sensor.id}
                className={`p-2 rounded-lg text-center ${
                  sensor.status === 'active' 
                    ? 'bg-green-100 dark:bg-green-900/30' 
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}
              >
                {sensor.status === 'active' ? (
                  <Wifi size={14} className="mx-auto text-green-600 dark:text-green-400" />
                ) : (
                  <WifiOff size={14} className="mx-auto text-red-600 dark:text-red-400" />
                )}
                <p className="text-xs mt-1 truncate">{sensor.name || sensor.sensorType}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Quick Stats Widget =====
interface StatItem {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ElementType;
}

interface QuickStatsWidgetProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4;
}

export function QuickStatsWidget({ stats, columns = 4 }: QuickStatsWidgetProps) {
  const gridClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  }[columns];

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  {stat.change !== undefined && (
                    <div className={`flex items-center gap-1 text-xs mt-1 ${
                      stat.change >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      <span>{Math.abs(stat.change)}% {stat.changeLabel || 'vs last week'}</span>
                    </div>
                  )}
                </div>
                {Icon && (
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon size={20} className="text-primary" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ===== Alerts List Widget =====
interface AlertsWidgetProps {
  alerts: Alert[];
  maxItems?: number;
  onViewAll?: () => void;
}

export function AlertsWidget({ alerts, maxItems = 5, onViewAll }: AlertsWidgetProps) {
  const displayAlerts = alerts.slice(0, maxItems);
  
  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'critical': return <AlertTriangle className="text-red-500" size={16} />;
      case 'warning': return <AlertTriangle className="text-yellow-500" size={16} />;
      case 'success': return <CheckCircle className="text-green-500" size={16} />;
      default: return <Clock className="text-blue-500" size={16} />;
    }
  };

  const getAlertBg = (type: Alert['type']) => {
    switch (type) {
      case 'critical': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning': return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'success': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      default: return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Recent Alerts</CardTitle>
        {alerts.length > maxItems && onViewAll && (
          <button 
            onClick={onViewAll}
            className="text-xs text-primary hover:underline"
          >
            View all ({alerts.length})
          </button>
        )}
      </CardHeader>
      <CardContent>
        {displayAlerts.length > 0 ? (
          <div className="space-y-2">
            {displayAlerts.map((alert) => (
              <div 
                key={alert.id}
                className={`p-3 rounded-lg border ${getAlertBg(alert.type)}`}
              >
                <div className="flex items-start gap-2">
                  {getAlertIcon(alert.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">{alert.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <CheckCircle className="mx-auto h-8 w-8 text-green-500 mb-2" />
            <p className="text-sm text-muted-foreground">No active alerts</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Device Grid Widget =====
interface DeviceGridWidgetProps {
  devices: Device[];
  onDeviceClick?: (device: Device) => void;
}

export function DeviceGridWidget({ devices, onDeviceClick }: DeviceGridWidgetProps) {
  const getSignalIcon = (signal: Device['signal']) => {
    const colors: Record<string, string> = {
      'Strong': 'text-green-500',
      'Good': 'text-green-400',
      'Weak': 'text-yellow-500',
      'Lost': 'text-red-500',
    };
    return <Wifi size={14} className={colors[signal] || 'text-gray-500'} />;
  };

  const getStatusBadge = (status: Device['status']) => {
    const variants: Record<Device['status'], 'default' | 'secondary' | 'destructive'> = {
      'Online': 'default',
      'Offline': 'destructive',
      'Maintenance': 'secondary',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Connected Devices</CardTitle>
        <CardDescription>{devices.length} devices registered</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {devices.map((device) => (
            <div 
              key={device.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => onDeviceClick?.(device)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  {device.type === 'Gateway' ? (
                    <Wifi size={16} />
                  ) : device.type === 'Pump Controller' ? (
                    <Droplets size={16} />
                  ) : (
                    <Thermometer size={16} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{device.type}</p>
                  <p className="text-xs text-muted-foreground">{device.location}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-xs">
                  <div className="flex items-center gap-1">
                    <Battery size={12} />
                    <span>{device.battery}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {getSignalIcon(device.signal)}
                    <span>{device.signal}</span>
                  </div>
                </div>
                {getStatusBadge(device.status)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Growth Stage Indicator =====
interface GrowthStageWidgetProps {
  currentStage: string;
  plantingDate?: string;
  expectedHarvest?: string;
}

const growthStages = [
  { key: 'germination', label: 'Germination', days: '0-10' },
  { key: 'vegetative', label: 'Vegetative', days: '11-45' },
  { key: 'flowering', label: 'Flowering', days: '46-65' },
  { key: 'grain_filling', label: 'Grain Filling', days: '66-100' },
  { key: 'maturity', label: 'Maturity', days: '101-120' },
];

export function GrowthStageWidget({ currentStage, plantingDate, expectedHarvest }: GrowthStageWidgetProps) {
  const currentIndex = growthStages.findIndex(s => s.key === currentStage);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sprout size={16} className="text-primary" />
          Growth Stage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Stage Progress */}
          <div className="flex items-center gap-1">
            {growthStages.map((stage, index) => (
              <div key={stage.key} className="flex-1 flex flex-col items-center">
                <div 
                  className={`w-full h-2 rounded-full ${
                    index <= currentIndex 
                      ? 'bg-primary' 
                      : 'bg-muted'
                  }`}
                />
                <p className={`text-xs mt-2 text-center ${
                  index === currentIndex 
                    ? 'text-primary font-medium' 
                    : 'text-muted-foreground'
                }`}>
                  {stage.label}
                </p>
              </div>
            ))}
          </div>

          {/* Dates */}
          <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
            <div>
              <p className="font-medium">Planted</p>
              <p>{plantingDate ? new Date(plantingDate).toLocaleDateString() : 'Not set'}</p>
            </div>
            <div className="text-right">
              <p className="font-medium">Expected Harvest</p>
              <p>{expectedHarvest ? new Date(expectedHarvest).toLocaleDateString() : 'Not set'}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default {
  SensorStatusWidget,
  QuickStatsWidget,
  AlertsWidget,
  DeviceGridWidget,
  GrowthStageWidget,
};
