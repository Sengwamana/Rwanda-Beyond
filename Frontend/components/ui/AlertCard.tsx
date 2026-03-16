// =====================================================
// Alert Card Component - Smart Maize Farming System
// Display alerts, notifications, and status messages
// =====================================================

import React from 'react';
import { 
  AlertTriangle, AlertCircle, CheckCircle2, Info, 
  X, Bell, Bug, Droplets, ThermometerSun, Wind
} from 'lucide-react';

type AlertType = 'success' | 'warning' | 'error' | 'info';
type AlertCategory = 'pest' | 'irrigation' | 'weather' | 'sensor' | 'system' | 'general';

interface AlertCardProps {
  type: AlertType;
  title: string;
  message: string;
  category?: AlertCategory;
  timestamp?: string;
  dismissable?: boolean;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const AlertCard: React.FC<AlertCardProps> = ({
  type,
  title,
  message,
  category = 'general',
  timestamp,
  dismissable = false,
  onDismiss,
  action,
  className = ''
}) => {
  // Type configurations
  const typeConfig = {
    success: {
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      iconColor: 'text-green-600 dark:text-green-400',
      iconBgColor: 'bg-green-100 dark:bg-green-800/50',
      titleColor: 'text-green-800 dark:text-green-200',
      textColor: 'text-green-700 dark:text-green-300',
      Icon: CheckCircle2
    },
    warning: {
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      iconColor: 'text-green-600 dark:text-green-400',
      iconBgColor: 'bg-green-100 dark:bg-green-800/50',
      titleColor: 'text-green-800 dark:text-green-200',
      textColor: 'text-green-700 dark:text-green-300',
      Icon: AlertTriangle
    },
    error: {
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
      iconColor: 'text-red-600 dark:text-red-400',
      iconBgColor: 'bg-red-100 dark:bg-red-800/50',
      titleColor: 'text-red-800 dark:text-red-200',
      textColor: 'text-red-700 dark:text-red-300',
      Icon: AlertCircle
    },
    info: {
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBgColor: 'bg-blue-100 dark:bg-blue-800/50',
      titleColor: 'text-blue-800 dark:text-blue-200',
      textColor: 'text-blue-700 dark:text-blue-300',
      Icon: Info
    }
  };

  // Category icons
  const categoryIcons: Record<AlertCategory, typeof Bug> = {
    pest: Bug,
    irrigation: Droplets,
    weather: ThermometerSun,
    sensor: Wind,
    system: Bell,
    general: Info
  };

  const config = typeConfig[type];
  const CategoryIcon = categoryIcons[category];
  const AlertIcon = config.Icon;

  return (
    <div className={`
      ${config.bgColor} 
      ${config.borderColor}
      border rounded-xl p-4 
      animate-fade-in
      ${className}
    `}>
      <div className="flex gap-3">
        {/* Icon */}
        <div className={`
          ${config.iconBgColor}
          w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
        `}>
          <AlertIcon className={config.iconColor} size={20} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className={`font-semibold text-sm ${config.titleColor}`}>
                {title}
              </h4>
              {category !== 'general' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
                  <CategoryIcon size={10} />
                  {category}
                </span>
              )}
            </div>
            
            {dismissable && (
              <button
                onClick={onDismiss}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <X size={16} className="text-slate-400" />
              </button>
            )}
          </div>

          <p className={`text-sm mt-1 ${config.textColor}`}>
            {message}
          </p>

          {/* Footer: Timestamp & Action */}
          <div className="flex items-center justify-between mt-3">
            {timestamp && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {timestamp}
              </span>
            )}
            
            {action && (
              <button
                onClick={action.onClick}
                className={`
                  text-xs font-semibold 
                  ${config.iconColor}
                  hover:underline
                `}
              >
                {action.label} ->
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// Alert List - Stacked alerts container
// =====================================================

interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  category?: AlertCategory;
  timestamp?: string;
}

interface AlertListProps {
  alerts: Alert[];
  onDismiss?: (id: string) => void;
  maxVisible?: number;
  className?: string;
}

export const AlertList: React.FC<AlertListProps> = ({
  alerts,
  onDismiss,
  maxVisible = 5,
  className = ''
}) => {
  const visibleAlerts = alerts.slice(0, maxVisible);
  const hiddenCount = alerts.length - maxVisible;

  return (
    <div className={`space-y-3 ${className}`}>
      {visibleAlerts.map((alert) => (
        <AlertCard
          key={alert.id}
          type={alert.type}
          title={alert.title}
          message={alert.message}
          category={alert.category}
          timestamp={alert.timestamp}
          dismissable={!!onDismiss}
          onDismiss={() => onDismiss?.(alert.id)}
        />
      ))}
      
      {hiddenCount > 0 && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-2">
          +{hiddenCount} more alerts
        </p>
      )}
    </div>
  );
};

// =====================================================
// Toast Notification - Floating notification
// =====================================================

interface ToastProps {
  type: AlertType;
  message: string;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  type,
  message,
  onClose,
  duration = 5000
}) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const config = {
    success: { bg: 'bg-green-600', Icon: CheckCircle2 },
    warning: { bg: 'bg-green-500', Icon: AlertTriangle },
    error: { bg: 'bg-red-600', Icon: AlertCircle },
    info: { bg: 'bg-blue-600', Icon: Info }
  };

  const { bg, Icon } = config[type];

  return (
    <div className={`
      ${bg} text-white
      px-4 py-3 rounded-xl shadow-xl
      flex items-center gap-3
      animate-slide-in-right
    `}>
      <Icon size={20} />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button
        onClick={onClose}
        className="p-1 rounded-lg hover:bg-white/20 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default AlertCard;

