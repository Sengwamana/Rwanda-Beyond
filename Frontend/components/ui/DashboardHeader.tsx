// =====================================================
// Dashboard Header Component - Smart Maize Farming System
// Modern, SmartTani-inspired header for dashboard pages
// =====================================================

import React from 'react';
import { 
  Bell, Search, ChevronDown, Sun, Moon, 
  Settings, User, LogOut, HelpCircle 
} from 'lucide-react';
import { Language } from '../../utils/translations';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  userName: string;
  userRole?: 'farmer' | 'expert' | 'admin';
  userAvatar?: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  notificationCount?: number;
  onNotificationClick?: () => void;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  onLogout?: () => void;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  subtitle,
  userName,
  userRole = 'farmer',
  userAvatar,
  theme,
  onToggleTheme,
  language,
  onLanguageChange,
  notificationCount = 0,
  onNotificationClick,
  onProfileClick,
  onSettingsClick,
  onLogout,
  showSearch = true,
  onSearch
}) => {
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  
  const roleLabels: Record<string, string> = {
    farmer: 'Farmer',
    expert: 'Agricultural Expert',
    admin: 'System Administrator'
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left: Title & Subtitle */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Center: Search (Optional) */}
        {showSearch && (
          <form onSubmit={handleSearch} className="hidden lg:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search farms, sensors, reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
              />
            </div>
          </form>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-medium">
            {['en', 'rw', 'fr'].map((lang) => (
              <button
                key={lang}
                onClick={() => onLanguageChange(lang as Language)}
                className={`px-2 py-1 rounded-md transition-colors ${
                  language === lang
                    ? 'bg-green-600 text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Notifications */}
          <button
            onClick={onNotificationClick}
            className="relative p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 overflow-hidden flex items-center justify-center">
                {userAvatar ? (
                  <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-sm">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">
                  {userName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {roleLabels[userRole]}
                </p>
              </div>
              <ChevronDown 
                size={16} 
                className={`text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} 
              />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-2 z-50 animate-fade-in">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{userName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{roleLabels[userRole]}</p>
                </div>
                
                <div className="py-1">
                  <button
                    onClick={() => { onProfileClick?.(); setIsProfileOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <User size={16} />
                    My Profile
                  </button>
                  <button
                    onClick={() => { onSettingsClick?.(); setIsProfileOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <Settings size={16} />
                    Settings
                  </button>
                  <button
                    onClick={() => setIsProfileOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <HelpCircle size={16} />
                    Help & Support
                  </button>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-700 pt-1">
                  <button
                    onClick={() => { onLogout?.(); setIsProfileOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
