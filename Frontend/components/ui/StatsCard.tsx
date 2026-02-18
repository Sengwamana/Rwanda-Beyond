// =====================================================
// Stats Card Component - Smart Maize Farming System
// Reusable stats card with various display variants
// =====================================================

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  trend?: {
    value: number;
    label?: string;
    isPositive?: boolean;
  };
  variant?: 'default' | 'gradient' | 'outline' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-green-600',
  iconBgColor = 'bg-green-100 dark:bg-green-900/30',
  trend,
  variant = 'default',
  size = 'md',
  className = '',
  onClick
}) => {
  // Size configurations
  const sizeConfig = {
    sm: {
      padding: 'p-4',
      iconSize: 20,
      iconContainer: 'w-10 h-10',
      titleSize: 'text-xs',
      valueSize: 'text-xl',
      subtitleSize: 'text-[10px]'
    },
    md: {
      padding: 'p-5',
      iconSize: 24,
      iconContainer: 'w-12 h-12',
      titleSize: 'text-sm',
      valueSize: 'text-2xl',
      subtitleSize: 'text-xs'
    },
    lg: {
      padding: 'p-6',
      iconSize: 28,
      iconContainer: 'w-14 h-14',
      titleSize: 'text-sm',
      valueSize: 'text-3xl',
      subtitleSize: 'text-sm'
    }
  };

  const config = sizeConfig[size];

  // Variant configurations
  const variantClasses = {
    default: 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-soft',
    gradient: 'bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0',
    outline: 'bg-transparent border-2 border-slate-200 dark:border-slate-700',
    minimal: 'bg-slate-50 dark:bg-slate-800/50 border-0'
  };

  const isGradient = variant === 'gradient';

  // Trend icon
  const TrendIcon = trend 
    ? (trend.value > 0 ? TrendingUp : trend.value < 0 ? TrendingDown : Minus)
    : null;

  const trendColor = trend
    ? (trend.isPositive !== undefined 
        ? (trend.isPositive ? 'text-green-500' : 'text-red-500')
        : (trend.value > 0 ? 'text-green-500' : trend.value < 0 ? 'text-red-500' : 'text-slate-400'))
    : '';

  return (
    <div
      onClick={onClick}
      className={`
        rounded-2xl transition-all duration-300
        ${config.padding}
        ${variantClasses[variant]}
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1' : ''}
        ${className}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`
            font-medium mb-2
            ${config.titleSize}
            ${isGradient ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}
          `}>
            {title}
          </p>
          
          <p className={`
            font-bold leading-none
            ${config.valueSize}
            ${isGradient ? 'text-white' : 'text-slate-900 dark:text-white'}
          `}>
            {value}
          </p>

          {/* Trend & Subtitle */}
          <div className="flex items-center gap-2 mt-2">
            {trend && TrendIcon && (
              <span className={`
                flex items-center gap-1 font-semibold
                ${config.subtitleSize}
                ${isGradient ? 'text-white/90' : trendColor}
              `}>
                <TrendIcon size={14} />
                {Math.abs(trend.value)}%
              </span>
            )}
            {(subtitle || trend?.label) && (
              <span className={`
                ${config.subtitleSize}
                ${isGradient ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}
              `}>
                {trend?.label || subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Icon */}
        {Icon && (
          <div className={`
            ${config.iconContainer}
            ${isGradient ? 'bg-white/20' : iconBgColor}
            rounded-xl flex items-center justify-center flex-shrink-0
          `}>
            <Icon 
              size={config.iconSize} 
              className={isGradient ? 'text-white' : iconColor}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// =====================================================
// Stats Card Grid - Helper for displaying multiple stats
// =====================================================

interface StatsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export const StatsGrid: React.FC<StatsGridProps> = ({
  children,
  columns = 4,
  className = ''
}) => {
  const gridClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <div className={`grid gap-4 ${gridClasses[columns]} ${className}`}>
      {children}
    </div>
  );
};

// =====================================================
// Featured Stats Card - Large hero-style stat display
// =====================================================

interface FeaturedStatsProps {
  stats: Array<{
    value: string;
    label: string;
    suffix?: string;
  }>;
  className?: string;
}

export const FeaturedStats: React.FC<FeaturedStatsProps> = ({
  stats,
  className = ''
}) => {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-8 ${className}`}>
      {stats.map((stat, index) => (
        <div key={index} className="text-center">
          <p className="text-4xl md:text-5xl font-bold text-green-600 dark:text-green-400 mb-2">
            {stat.value}
            {stat.suffix && <span className="text-2xl">{stat.suffix}</span>}
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
};

export default StatsCard;
