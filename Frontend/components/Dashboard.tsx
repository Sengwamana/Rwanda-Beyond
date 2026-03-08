import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, Sprout, Settings as SettingsIcon, LogOut, 
  Bell, Search, Menu, Activity, Server, Sun, Moon, Users, FileClock, Cpu, SlidersHorizontal, RadioTower, FileSpreadsheet, Send, CheckCheck, X, Trash2,
  BarChart2, Bot, Wifi, BookOpen, MessageSquare, Droplets, Bug
} from 'lucide-react';
import { Settings } from './Settings';
import { ConnectedFarmerDashboard } from './ConnectedFarmerDashboard';
import { ConnectedExpertDashboard } from './ConnectedExpertDashboard';
import { ConnectedAdminDashboard } from './ConnectedAdminDashboard';
import { UserRole } from '../types';
import { Language, translations } from '../utils/translations';
import { useAlertStore } from '../store';

interface DashboardProps {
  userRole: UserRole;
  onLogout?: () => void;
  language?: Language;
  setLanguage?: (lang: Language) => void;
  theme?: string;
  toggleTheme?: () => void;
}

const DASHBOARD_TAB_STORAGE_KEY = 'dashboard-active-tab';

export const Dashboard: React.FC<DashboardProps> = ({ userRole, onLogout, language = 'en', setLanguage, theme, toggleTheme }) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAlerts, setShowAlerts] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  const { alerts, unreadCount, markAllAsRead, markAsRead, removeAlert, clearAlerts } = useAlertStore();
  
  const t = translations[language].dashboard;

  // Reset active tab when role changes to avoid getting stuck on a non-existent tab
  useEffect(() => {
    if (typeof window === 'undefined') {
      setActiveTab('overview');
      return;
    }

    const raw = window.sessionStorage.getItem(DASHBOARD_TAB_STORAGE_KEY);
    if (!raw) {
      setActiveTab('overview');
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      setActiveTab(parsed[userRole] || 'overview');
    } catch {
      setActiveTab('overview');
    }
  }, [userRole]);

  useEffect(() => {
    setSearchQuery('');
    setShowAlerts(false);
    setShowMobileSearch(false);
  }, [userRole]);

  // Define Navigation Items based on Role
  const getNavItems = (role: UserRole) => {
    const common = [
      { id: 'settings', label: t.settings, icon: SettingsIcon },
    ];

    switch (role) {
      case 'farmer':
        return [
          { id: 'overview', label: t.fieldView, icon: LayoutGrid },
          { id: 'sensors', label: 'Sensors', icon: Wifi },
          { id: 'fertilization', label: 'Fertilization', icon: Droplets },
          { id: 'pest-history', label: 'Pest History', icon: Bug },
          { id: 'analytics', label: 'Analytics', icon: BarChart2 },
          { id: 'ai-chat', label: 'AI Assistant', icon: Bot },
          ...common,
        ];
      case 'expert':
        return [
          { id: 'overview', label: t.analysis, icon: Activity },
          { id: 'district-analytics', label: 'District Analytics', icon: BarChart2 },
          { id: 'ai-advice', label: 'AI Advice', icon: Bot },
          ...common
        ];
      case 'admin':
        return [
          { id: 'overview', label: t.systemView, icon: Server },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'audit', label: 'Audit Logs', icon: FileClock },
          { id: 'devices', label: 'Devices', icon: Cpu },
          { id: 'config', label: 'Configuration', icon: SlidersHorizontal },
          { id: 'monitoring', label: 'Monitoring', icon: RadioTower },
          { id: 'analytics', label: 'Analytics', icon: BarChart2 },
          { id: 'content', label: 'Content', icon: BookOpen },
          { id: 'ussd', label: 'USSD Monitor', icon: MessageSquare },
          { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
          { id: 'broadcast', label: 'Broadcast', icon: Send },
          ...common
        ];
      default:
        return common;
    }
  };

  const navItems = getNavItems(userRole);

  useEffect(() => {
    if (!navItems.some((item) => item.id === activeTab)) {
      setActiveTab('overview');
    }
  }, [activeTab, navItems]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem(DASHBOARD_TAB_STORAGE_KEY);
    let parsed: Record<string, string> = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw) as Record<string, string>;
      } catch {
        parsed = {};
      }
    }
    parsed[userRole] = activeTab;
    window.sessionStorage.setItem(DASHBOARD_TAB_STORAGE_KEY, JSON.stringify(parsed));
  }, [activeTab, userRole]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  // Role-based Label helpers
  const getRoleLabel = (role: UserRole) => {
      if (role === 'admin') return 'System Administrator';
      if (role === 'expert') return 'Senior Agronomist';
      return 'Head Farmer';
  };

  const getPageTitle = (role: UserRole) => {
      if (role === 'admin') return 'System Control Center';
      if (role === 'expert') return 'Rwamagana District Analysis';
      return 'Rwamagana District - Farm A';
  };

  const getTabLabel = (tabId: string) => {
    const active = navItems.find((item) => item.id === tabId);
    return active?.label || tabId;
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== '/') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      event.preventDefault();
      const desktopSearchInput = document.getElementById('dashboard-search-input') as HTMLInputElement | null;
      if (desktopSearchInput) {
        desktopSearchInput.focus();
        return;
      }
      setShowMobileSearch(true);
      setTimeout(() => {
        const mobileSearchInput = document.getElementById('dashboard-search-input-mobile') as HTMLInputElement | null;
        mobileSearchInput?.focus();
      }, 0);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsMobileNavOpen(false);
      setShowMobileSearch(false);
      setShowAlerts(false);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const NavItem: React.FC<{ id: string; label: string; icon: any }> = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setIsMobileNavOpen(false);
        setShowMobileSearch(false);
      }}
      className={`w-full flex items-center gap-3 px-6 py-4 rounded-full transition-all duration-300 font-bold text-sm group ${
        activeTab === id
          ? 'bg-[#0F5132] text-white shadow-lg'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#0F5132] dark:hover:text-[#0F5132]'
      }`}
    >
      <Icon size={20} className={activeTab === id ? 'text-white' : 'text-slate-400 group-hover:text-[#0F5132]'} />
      {label}
    </button>
  );

  const renderContent = () => {
      // Common components
      if (activeTab === 'settings') return <Settings language={language} setLanguage={setLanguage} />;
      
      // Farmer Views
      if (userRole === 'farmer') {
          return <ConnectedFarmerDashboard language={language} searchQuery={searchQuery} activeTab={activeTab} />;
      }

      // Expert Views
      if (userRole === 'expert') {
          return <ConnectedExpertDashboard searchQuery={searchQuery} activeTab={activeTab} />;
      }

      // Admin Views
      if (userRole === 'admin') {
           return <ConnectedAdminDashboard activeTab={activeTab} searchQuery={searchQuery} />;
      }

      return <div>Select a tab</div>;
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAF9] dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-100 animate-fade-in selection:bg-[#0F5132] selection:text-white transition-colors duration-300">
      
      {/* MOBILE OVERLAY */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          isMobileNavOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileNavOpen(false)}
        aria-hidden="true"
      />

      {/* SIDEBAR */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-screen w-72 bg-white dark:bg-slate-800 flex flex-col z-50 
        transition-transform duration-300 ease-out border-r border-slate-100 dark:border-slate-700
        ${isMobileNavOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0 md:shadow-none'}
      `}>
        <div className="p-8">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('overview')}>
            <div className="bg-[#0F5132] p-2 rounded-xl">
                <Sprout size={20} className="text-white fill-current" />
            </div>
            <span className="text-xl font-bold tracking-tight text-[#0F5132]">RwandaBeyond</span>
          </div>
        </div>

        <nav className="flex-1 px-6 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="px-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
             {userRole === 'admin' ? 'Admin Console' : userRole === 'expert' ? 'Expert Tools' : 'Main Menu'}
          </div>
          {navItems.map(item => (
              <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} />
          ))}
        </nav>

        <div className="p-6 border-t border-slate-50 dark:border-slate-700 space-y-4">
           {/* Mini Profile */}
           <div className="bg-[#FAFAF9] dark:bg-slate-700 p-4 rounded-[2rem] flex items-center gap-3">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userRole}`} className="w-10 h-10 rounded-full bg-white border-2 border-white shadow-sm" />
              <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate capitalize">{userRole}</p>
                  <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-wider">{getRoleLabel(userRole)}</p>
              </div>
           </div>

           <button 
             onClick={onLogout}
             className="flex items-center justify-center gap-2 w-full py-3 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-bold text-xs uppercase tracking-wider"
           >
             <LogOut size={16} />
             <span>{t.signOut}</span>
           </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0">
        
        {/* HEADER */}
        <header className="sticky top-0 z-30 bg-[#FAFAF9]/80 dark:bg-slate-900/80 backdrop-blur-xl px-6 py-4 flex justify-between items-center border-b border-slate-200/50 dark:border-slate-700/50">
           <div className="flex items-center gap-4">
               <button className="md:hidden p-2 -ml-2 text-slate-500" onClick={() => setIsMobileNavOpen(true)}>
                   <Menu size={24} />
               </button>
               <div>
                  <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight">{getPageTitle(userRole)}</h1>
                  <div className="flex items-center gap-2 mt-0.5">
                      <div className={`w-2 h-2 rounded-full ${userRole === 'admin' ? 'bg-blue-500 animate-pulse' : 'bg-[#0F5132] animate-pulse'}`}></div>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                          {`${getTabLabel(activeTab)} | ${userRole === 'admin' ? t.systemHealthy : t.ussdOnline}`}
                      </p>
                  </div>
               </div>
           </div>

           <div className="flex items-center gap-3 md:gap-4">
               <button
                 className="md:hidden p-3 text-slate-400 hover:text-[#0F5132] transition-colors relative bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md"
                 onClick={() => setShowMobileSearch((previous) => !previous)}
                 title="Search"
               >
                  <Search size={20} />
               </button>
               {toggleTheme && (
                   <button 
                     onClick={toggleTheme}
                     className="p-3 text-slate-400 hover:text-[#0F5132] transition-colors bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md"
                     title="Toggle Dark Mode"
                   >
                      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                   </button>
               )}

               <div className="hidden md:flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2.5 rounded-full shadow-sm w-72 focus-within:ring-2 ring-[#0F5132]/20 transition-all border border-slate-100 dark:border-slate-700">
                   <Search size={18} className="text-slate-400" />
                   <input
                     id="dashboard-search-input"
                     type="text"
                     placeholder={t.search}
                     value={searchQuery}
                     onChange={(event) => setSearchQuery(event.target.value)}
                     className="bg-transparent text-sm w-full outline-none text-slate-600 dark:text-slate-300 placeholder:text-slate-400 font-medium"
                   />
                   {searchQuery && (
                     <button
                       onClick={() => setSearchQuery('')}
                       className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                       title="Clear search"
                     >
                       <X size={14} />
                     </button>
                   )}
               </div>

               <button
                  onClick={() => setShowAlerts((previous) => !previous)}
                  className="p-3 text-slate-400 hover:text-[#0F5132] transition-colors relative bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md"
               >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center border border-white dark:border-slate-800">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
               </button>
           </div>
        </header>

        {showMobileSearch && (
          <div className="md:hidden px-4 pt-3">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2.5 rounded-full shadow-sm border border-slate-100 dark:border-slate-700">
              <Search size={16} className="text-slate-400" />
              <input
                id="dashboard-search-input-mobile"
                type="text"
                placeholder={t.search}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="bg-transparent text-sm w-full outline-none text-slate-600 dark:text-slate-300 placeholder:text-slate-400 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {showAlerts && (
          <div className="px-4 md:px-8 lg:px-10 max-w-7xl mx-auto pt-4">
            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-800 shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/70 dark:border-slate-700/70">
                <div>
                  <p className="font-semibold text-sm">Alerts</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => markAllAsRead()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F5132] hover:underline"
                  >
                    <CheckCheck size={14} />
                    Mark all read
                  </button>
                  <button
                    onClick={() => clearAlerts()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {alerts.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                    No alerts yet.
                  </div>
                ) : (
                  alerts.slice(0, 8).map((alert) => (
                    <div
                      key={alert.id}
                      className="px-4 py-3 border-b last:border-b-0 border-slate-100 dark:border-slate-700/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{alert.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{alert.message}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                            {new Date(alert.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!alert.isRead && <span className="mt-1 w-2 h-2 rounded-full bg-red-500"></span>}
                          {!alert.isRead && (
                            <button
                              onClick={() => markAsRead(alert.id)}
                              className="text-[11px] font-semibold text-[#0F5132] hover:underline"
                            >
                              Mark read
                            </button>
                          )}
                          <button
                            onClick={() => removeAlert(alert.id)}
                            className="text-[11px] font-semibold text-slate-500 hover:text-red-600"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* DYNAMIC PAGE CONTENT */}
        <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto">
            {renderContent()}
        </div>
      </main>
    </div>
  );
};
