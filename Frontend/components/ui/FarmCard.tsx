// =====================================================
// Farm Card Component - Smart Maize Farming System
// Display farm information with health status
// =====================================================

import React from 'react';
import { 
  MapPin, Droplets, Sprout, Calendar, ChevronRight,
  AlertTriangle, CheckCircle2, Clock, Thermometer,
  BarChart3, Activity, Leaf
} from 'lucide-react';

type FarmStatus = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
type CropStage = 'germination' | 'vegetative' | 'flowering' | 'maturity' | 'harvest';

interface FarmCardProps {
  id: string;
  name: string;
  location: string;
  area: number;
  areaUnit?: 'hectares' | 'acres';
  crop?: string;
  cropStage?: CropStage;
  healthScore?: number;
  status?: FarmStatus;
  soilMoisture?: number;
  temperature?: number;
  lastUpdated?: string;
  harvestDate?: string;
  imageUrl?: string;
  alerts?: number;
  onClick?: () => void;
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
}

export const FarmCard: React.FC<FarmCardProps> = ({
  id,
  name,
  location,
  area,
  areaUnit = 'hectares',
  crop = 'Maize',
  cropStage,
  healthScore,
  status = 'good',
  soilMoisture,
  temperature,
  lastUpdated,
  harvestDate,
  imageUrl,
  alerts = 0,
  onClick,
  variant = 'default',
  className = ''
}) => {
  // Status configurations
  const statusConfig: Record<FarmStatus, {
    color: string;
    bgColor: string;
    textColor: string;
    label: string;
  }> = {
    excellent: {
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/30',
      textColor: 'text-emerald-700 dark:text-emerald-400',
      label: 'Excellent'
    },
    good: {
      color: 'bg-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/30',
      textColor: 'text-green-700 dark:text-green-400',
      label: 'Good'
    },
    fair: {
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
      textColor: 'text-yellow-700 dark:text-yellow-400',
      label: 'Fair'
    },
    poor: {
      color: 'bg-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/30',
      textColor: 'text-green-700 dark:text-green-400',
      label: 'Poor'
    },
    critical: {
      color: 'bg-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/30',
      textColor: 'text-red-700 dark:text-red-400',
      label: 'Critical'
    }
  };

  // Crop stage configurations
  const stageConfig: Record<CropStage, { label: string; progress: number }> = {
    germination: { label: 'Germination', progress: 15 },
    vegetative: { label: 'Vegetative', progress: 40 },
    flowering: { label: 'Flowering', progress: 60 },
    maturity: { label: 'Maturity', progress: 85 },
    harvest: { label: 'Ready for Harvest', progress: 100 }
  };

  const statusInfo = statusConfig[status];
  const stageInfo = cropStage ? stageConfig[cropStage] : null;

  // Default farm image
  const defaultImage = "https://images.unsplash.com/photo-1551754655-cd27e38d2076?q=80&w=600&auto=format&fit=crop";

  // Compact variant
  if (variant === 'compact') {
    return (
      <div
        onClick={onClick}
        className={`
          bg-white dark:bg-slate-900
          border border-slate-200 dark:border-slate-800
          rounded-[1.25rem] p-4
          flex items-center gap-4
          transition-all duration-200
          ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
          ${className}
        `}
      >
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
          <img 
            src={imageUrl || defaultImage}
            alt={name}
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-slate-900 dark:text-white text-sm truncate">
              {name}
            </h4>
            <span className={`
              text-[10px] font-bold px-2 py-0.5 rounded
              ${statusInfo.bgColor} ${statusInfo.textColor}
            `}>
              {statusInfo.label}
            </span>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <MapPin size={10} />
            {location}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Sprout size={10} />
              {crop}
            </span>
            <span className="text-xs text-slate-500">
              {area} {areaUnit}
            </span>
          </div>
        </div>

        <ChevronRight className="text-slate-300 flex-shrink-0" size={20} />
      </div>
    );
  }

  // Default variant
  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-slate-900
        border border-slate-200 dark:border-slate-800
        rounded-[1.25rem] overflow-hidden shadow-sm
        transition-all duration-200
        ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
        ${className}
      `}
    >
      {/* Image Header */}
      <div className="relative h-40 overflow-hidden">
        <img 
          src={imageUrl || defaultImage}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Alerts badge */}
        {alerts > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
            <AlertTriangle size={12} />
            {alerts}
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <span className={`
            inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold
            ${statusInfo.bgColor} ${statusInfo.textColor}
          `}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.color}`} />
            {statusInfo.label}
          </span>
        </div>

        {/* Name overlay */}
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <h3 className="font-bold text-lg truncate">{name}</h3>
          <p className="text-sm text-white/80 flex items-center gap-1">
            <MapPin size={12} />
            {location}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Farm details */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <Sprout className="mx-auto mb-1 text-green-600" size={16} />
            <p className="text-xs font-semibold text-slate-900 dark:text-white">{crop}</p>
            <p className="text-[10px] text-slate-400">Crop</p>
          </div>
          <div className="text-center p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <BarChart3 className="mx-auto mb-1 text-blue-600" size={16} />
            <p className="text-xs font-semibold text-slate-900 dark:text-white">{area} {areaUnit.charAt(0)}</p>
            <p className="text-[10px] text-slate-400">Area</p>
          </div>
          <div className="text-center p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <Activity className="mx-auto mb-1 text-purple-600" size={16} />
            <p className="text-xs font-semibold text-slate-900 dark:text-white">{healthScore || '--'}%</p>
            <p className="text-[10px] text-slate-400">Health</p>
          </div>
        </div>

        {/* Crop stage progress */}
        {stageInfo && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <Leaf size={12} />
                {stageInfo.label}
              </span>
              <span className="text-xs text-slate-400">{stageInfo.progress}%</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${stageInfo.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Sensor readings */}
        {(soilMoisture !== undefined || temperature !== undefined) && (
          <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
            {soilMoisture !== undefined && (
              <div className="flex items-center gap-2">
                <Droplets className="text-blue-500" size={16} />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {soilMoisture}%
                </span>
              </div>
            )}
            {temperature !== undefined && (
              <div className="flex items-center gap-2">
                <Thermometer className="text-green-500" size={16} />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {temperature}°C
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          {harvestDate && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar size={12} />
              <span>Harvest: {harvestDate}</span>
            </div>
          )}
          {lastUpdated && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={12} />
              <span>{lastUpdated}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =====================================================
// Farm Grid - Display multiple farm cards
// =====================================================

interface Farm {
  id: string;
  name: string;
  location: string;
  area: number;
  areaUnit?: 'hectares' | 'acres';
  crop?: string;
  cropStage?: CropStage;
  healthScore?: number;
  status?: FarmStatus;
  soilMoisture?: number;
  temperature?: number;
  lastUpdated?: string;
  harvestDate?: string;
  imageUrl?: string;
  alerts?: number;
}

interface FarmGridProps {
  farms: Farm[];
  onFarmClick?: (id: string) => void;
  variant?: 'default' | 'compact';
  columns?: 2 | 3 | 4;
  className?: string;
}

export const FarmGrid: React.FC<FarmGridProps> = ({
  farms,
  onFarmClick,
  variant = 'default',
  columns = 3,
  className = ''
}) => {
  const gridClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  };

  if (variant === 'compact') {
    return (
      <div className={`space-y-3 ${className}`}>
        {farms.map((farm) => (
          <FarmCard
            key={farm.id}
            {...farm}
            variant="compact"
            onClick={() => onFarmClick?.(farm.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid gap-6 ${gridClasses[columns]} ${className}`}>
      {farms.map((farm) => (
        <FarmCard
          key={farm.id}
          {...farm}
          onClick={() => onFarmClick?.(farm.id)}
        />
      ))}
    </div>
  );
};

export default FarmCard;

