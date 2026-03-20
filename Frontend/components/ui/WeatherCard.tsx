// =====================================================
// Weather Card Component - Smart Maize Farming System
// Display weather data with forecast and conditions
// =====================================================

import React from 'react';
import { 
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle,
  Wind, Droplets, Thermometer, Eye, Gauge, Sunrise, Sunset,
  MapPin, RefreshCw
} from 'lucide-react';

type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'drizzle' | 'storm' | 'snow' | 'fog';

interface WeatherData {
  location: string;
  temperature: number;
  feelsLike?: number;
  condition: WeatherCondition;
  description: string;
  humidity: number;
  windSpeed: number;
  windDirection?: string;
  pressure?: number;
  visibility?: number;
  uvIndex?: number;
  sunrise?: string;
  sunset?: string;
}

interface ForecastDay {
  day: string;
  date?: string;
  tempHigh: number;
  tempLow: number;
  condition: WeatherCondition;
  precipitation?: number;
}

interface WeatherCardProps {
  weather: WeatherData;
  forecast?: ForecastDay[];
  onRefresh?: () => void;
  isLoading?: boolean;
  variant?: 'full' | 'compact' | 'minimal';
  className?: string;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({
  weather,
  forecast,
  onRefresh,
  isLoading = false,
  variant = 'full',
  className = ''
}) => {
  // Weather condition configurations
  const conditionConfig: Record<WeatherCondition, {
    icon: typeof Sun;
    gradient: string;
    iconColor: string;
  }> = {
    clear: {
      icon: Sun,
      gradient: 'from-green-400 via-green-400 to-yellow-500',
      iconColor: 'text-yellow-300'
    },
    cloudy: {
      icon: Cloud,
      gradient: 'from-slate-400 via-slate-500 to-slate-600',
      iconColor: 'text-slate-200'
    },
    rain: {
      icon: CloudRain,
      gradient: 'from-slate-500 via-blue-600 to-slate-700',
      iconColor: 'text-blue-200'
    },
    drizzle: {
      icon: CloudDrizzle,
      gradient: 'from-blue-400 via-slate-500 to-blue-600',
      iconColor: 'text-blue-200'
    },
    storm: {
      icon: CloudLightning,
      gradient: 'from-slate-700 via-purple-900 to-slate-800',
      iconColor: 'text-yellow-300'
    },
    snow: {
      icon: CloudSnow,
      gradient: 'from-blue-200 via-slate-300 to-blue-300',
      iconColor: 'text-white'
    },
    fog: {
      icon: Cloud,
      gradient: 'from-slate-300 via-slate-400 to-slate-500',
      iconColor: 'text-slate-200'
    }
  };

  const config = conditionConfig[weather.condition];
  const WeatherIcon = config.icon;

  // Minimal variant
  if (variant === 'minimal') {
    return (
      <div className={`
        flex items-center gap-3 p-3 rounded-xl
        bg-white dark:bg-slate-800 
        border border-slate-100 dark:border-slate-700
        ${className}
      `}>
        <WeatherIcon className={config.iconColor.replace('text-', 'text-')} size={32} />
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {weather.temperature}°C
          </p>
          <p className="text-xs text-slate-500">{weather.location}</p>
        </div>
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={`
        bg-gradient-to-br ${config.gradient}
        rounded-2xl p-5 text-white
        shadow-lg
        ${className}
      `}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white/80">
            <MapPin size={14} />
            <span className="text-sm font-medium">{weather.location}</span>
          </div>
          {onRefresh && (
            <button 
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-4xl font-bold">{weather.temperature}°C</p>
            <p className="text-white/80 text-sm capitalize">{weather.description}</p>
          </div>
          <WeatherIcon className={config.iconColor} size={56} />
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/20">
          <div className="text-center">
            <Droplets size={16} className="mx-auto mb-1 text-white/70" />
            <p className="text-sm font-semibold">{weather.humidity}%</p>
            <p className="text-[10px] text-white/60">Humidity</p>
          </div>
          <div className="text-center">
            <Wind size={16} className="mx-auto mb-1 text-white/70" />
            <p className="text-sm font-semibold">{weather.windSpeed} km/h</p>
            <p className="text-[10px] text-white/60">Wind</p>
          </div>
          <div className="text-center">
            <Thermometer size={16} className="mx-auto mb-1 text-white/70" />
            <p className="text-sm font-semibold">{weather.feelsLike || weather.temperature}°</p>
            <p className="text-[10px] text-white/60">Feels Like</p>
          </div>
        </div>
      </div>
    );
  }

  // Full variant (default)
  return (
    <div className={`
      bg-white dark:bg-slate-900 
      border border-slate-200 dark:border-slate-800 
      rounded-[1.25rem] overflow-hidden shadow-sm
      ${className}
    `}>
      {/* Header with gradient */}
      <div className={`bg-gradient-to-br ${config.gradient} p-6 text-white relative overflow-hidden`}>
        {/* Background decoration */}
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-white/90">
              <MapPin size={14} />
              <span className="text-sm font-medium">{weather.location}</span>
            </div>
            {onRefresh && (
              <button 
                onClick={onRefresh}
                disabled={isLoading}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-5xl font-bold leading-none">{weather.temperature}°</p>
              <p className="text-white/80 text-sm mt-1 capitalize">{weather.description}</p>
              {weather.feelsLike && (
                <p className="text-white/60 text-xs mt-1">
                  Feels like {weather.feelsLike}°C
                </p>
              )}
            </div>
            <WeatherIcon className={`${config.iconColor} drop-shadow-lg`} size={72} />
          </div>
        </div>
      </div>

      {/* Weather details */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
          <Droplets className="mx-auto mb-2 text-blue-500" size={20} />
          <p className="text-lg font-bold text-slate-900 dark:text-white">{weather.humidity}%</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Humidity</p>
        </div>
        <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
          <Wind className="mx-auto mb-2 text-teal-500" size={20} />
          <p className="text-lg font-bold text-slate-900 dark:text-white">{weather.windSpeed} km/h</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Wind</p>
        </div>
        {weather.pressure && (
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <Gauge className="mx-auto mb-2 text-purple-500" size={20} />
            <p className="text-lg font-bold text-slate-900 dark:text-white">{weather.pressure} hPa</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pressure</p>
          </div>
        )}
        {weather.visibility && (
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <Eye className="mx-auto mb-2 text-green-500" size={20} />
            <p className="text-lg font-bold text-slate-900 dark:text-white">{weather.visibility} km</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Visibility</p>
          </div>
        )}
      </div>

      {/* Sunrise/Sunset */}
      {(weather.sunrise || weather.sunset) && (
        <div className="px-4 pb-4">
          <div className="flex justify-center gap-8 p-3 bg-gradient-to-r from-green-50 to-purple-50 dark:from-green-900/20 dark:to-purple-900/20 rounded-xl">
            {weather.sunrise && (
              <div className="flex items-center gap-2">
                <Sunrise className="text-green-500" size={20} />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sunrise</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{weather.sunrise}</p>
                </div>
              </div>
            )}
            {weather.sunset && (
              <div className="flex items-center gap-2">
                <Sunset className="text-purple-500" size={20} />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sunset</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{weather.sunset}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Forecast */}
      {forecast && forecast.length > 0 && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-700">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            7-Day Forecast
          </h4>
          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {forecast.map((day, index) => {
              const DayIcon = conditionConfig[day.condition].icon;
              return (
                <div 
                  key={index}
                  className="flex-shrink-0 text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl min-w-[70px]"
                >
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    {day.day}
                  </p>
                  <DayIcon 
                    size={24} 
                    className={`mx-auto mb-2 ${
                      day.condition === 'clear' ? 'text-yellow-500' :
                      day.condition === 'rain' ? 'text-blue-500' :
                      day.condition === 'cloudy' ? 'text-slate-400' :
                      'text-slate-500'
                    }`}
                  />
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {day.tempHigh}°
                  </p>
                  <p className="text-xs text-slate-400">
                    {day.tempLow}°
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherCard;

