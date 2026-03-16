// =====================================================
// Sensor Card Component - Smart Maize Farming System
// Display real-time sensor data with visual indicators
// =====================================================

import React from 'react';
import { 
  Droplets, Thermometer, Wind, Sun, Gauge, Leaf, 
  Activity, Wifi, WifiOff, Battery, BatteryLow, 
  AlertTriangle, CheckCircle2, Clock
} from 'lucide-react';

type SensorType = 'soil_moisture' | 'temperature' | 'humidity' | 'wind' | 'light' | 'ph' | 'nitrogen';
type SensorStatus = 'online' | 'offline' | 'warning' | 'error';

interface SensorCardProps {
  type: SensorType;
  name: string;
  value: number;
  unit: string;
  status?: SensorStatus;
  battery?: number;
  lastUpdate?: string;
  min?: number;
  max?: number;
  optimal?: { min: number; max: number };
  location?: string;
  onClick?: () => void;
  className?: string;
}

export const SensorCard: React.FC<SensorCardProps> = ({
  type,
  name,
  value,
  unit,
  status = 'online',
  battery,
  lastUpdate,
  min,
  max,
  optimal,
  location,
  onClick,
  className = ''
}) => {
  // Sensor type configurations
  const sensorConfig: Record<SensorType, {
    icon: typeof Droplets;
    color: string;
    bgColor: string;
    gradient: string;
  }> = {
    soil_moisture: {
      icon: Droplets,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      gradient: 'from-blue-500 to-cyan-500'
    },
    temperature: {
      icon: Thermometer,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      gradient: 'from-green-500 to-red-500'
    },
    humidity: {
      icon: Wind,
      color: 'text-teal-600',
      bgColor: 'bg-teal-100 dark:bg-teal-900/30',
      gradient: 'from-teal-500 to-emerald-500'
    },
    wind: {
      icon: Wind,
      color: 'text-slate-600',
      bgColor: 'bg-slate-100 dark:bg-slate-700/30',
      gradient: 'from-slate-500 to-slate-600'
    },
    light: {
      icon: Sun,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      gradient: 'from-yellow-500 to-green-500'
    },
    ph: {
      icon: Gauge,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      gradient: 'from-purple-500 to-pink-500'
    },
    nitrogen: {
      icon: Leaf,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      gradient: 'from-green-500 to-emerald-500'
    }
  };

  const config = sensorConfig[type];
  const Icon = config.icon;

  // Status configurations
  const statusConfig: Record<SensorStatus, {
    color: string;
    icon: typeof Wifi;
    label: string;
  }> = {
    online: { color: 'text-green-500', icon: Wifi, label: 'Online' },
    offline: { color: 'text-slate-400', icon: WifiOff, label: 'Offline' },
    warning: { color: 'text-green-500', icon: AlertTriangle, label: 'Warning' },
    error: { color: 'text-red-500', icon: AlertTriangle, label: 'Error' }
  };

  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.icon;

  // Calculate progress percentage for gauge
  const percentage = min !== undefined && max !== undefined
    ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
    : 50;

  // Check if value is in optimal range
  const isOptimal = optimal
    ? value >= optimal.min && value <= optimal.max
    : true;

  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-slate-800 
        border border-slate-100 dark:border-slate-700 
        rounded-2xl p-5 
        shadow-soft hover:shadow-lg
        transition-all duration-300
        ${onClick ? 'cursor-pointer hover:-translate-y-1' : ''}
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className={`
          ${config.bgColor}
          w-12 h-12 rounded-xl flex items-center justify-center
        `}>
          <Icon className={config.color} size={24} />
        </div>

        <div className="flex items-center gap-2">
          {battery !== undefined && (
            <div className="flex items-center gap-1">
              {battery < 20 ? (
                <BatteryLow size={14} className="text-red-500" />
              ) : (
                <Battery size={14} className="text-slate-400" />
              )}
              <span className="text-[10px] text-slate-400">{battery}%</span>
            </div>
          )}
          <div className={`flex items-center gap-1 ${statusInfo.color}`}>
            <StatusIcon size={14} />
          </div>
        </div>
      </div>

      {/* Name & Location */}
      <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">
        {name}
      </h4>
      {location && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
          {location}
        </p>
      )}

      {/* Value Display */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-slate-900 dark:text-white">
            {typeof value === 'number' ? value.toFixed(1) : value}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {unit}
          </span>
        </div>
        
        {/* Status indicator */}
        {optimal && (
          <div className={`
            inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium
            ${isOptimal 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            }
          `}>
            {isOptimal ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
            {isOptimal ? 'Optimal' : 'Attention needed'}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {min !== undefined && max !== undefined && (
        <div className="mb-3">
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${config.gradient} transition-all duration-500`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-slate-400">
            <span>{min}{unit}</span>
            <span>{max}{unit}</span>
          </div>
        </div>
      )}

      {/* Last Update */}
      {lastUpdate && (
        <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
          <Clock size={10} />
          <span>Updated {lastUpdate}</span>
        </div>
      )}
    </div>
  );
};

// =====================================================
// Sensor Grid - Display multiple sensors
// =====================================================

interface Sensor {
  id: string;
  type: SensorType;
  name: string;
  value: number;
  unit: string;
  status?: SensorStatus;
  battery?: number;
  lastUpdate?: string;
  min?: number;
  max?: number;
  optimal?: { min: number; max: number };
  location?: string;
}

interface SensorGridProps {
  sensors: Sensor[];
  onSensorClick?: (id: string) => void;
  columns?: 2 | 3 | 4;
  className?: string;
}

export const SensorGrid: React.FC<SensorGridProps> = ({
  sensors,
  onSensorClick,
  columns = 3,
  className = ''
}) => {
  const gridClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <div className={`grid gap-4 ${gridClasses[columns]} ${className}`}>
      {sensors.map((sensor) => (
        <SensorCard
          key={sensor.id}
          {...sensor}
          onClick={() => onSensorClick?.(sensor.id)}
        />
      ))}
    </div>
  );
};

// =====================================================
// Sensor Status Summary - Quick overview widget
// =====================================================

interface SensorSummaryProps {
  total: number;
  online: number;
  offline: number;
  warnings: number;
  className?: string;
}

export const SensorSummary: React.FC<SensorSummaryProps> = ({
  total,
  online,
  offline,
  warnings,
  className = ''
}) => {
  return (
    <div className={`
      bg-white dark:bg-slate-800 
      border border-slate-100 dark:border-slate-700 
      rounded-xl p-4
      ${className}
    `}>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="text-green-600" size={18} />
        <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
          Sensor Status
        </h4>
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{total}</p>
          <p className="text-[10px] text-slate-400">Total</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{online}</p>
          <p className="text-[10px] text-slate-400">Online</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-400">{offline}</p>
          <p className="text-[10px] text-slate-400">Offline</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-500">{warnings}</p>
          <p className="text-[10px] text-slate-400">Warnings</p>
        </div>
      </div>
    </div>
  );
};

export default SensorCard;

