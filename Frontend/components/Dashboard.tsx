import React, { Suspense, lazy, useState, useEffect } from 'react';
import { 
  LayoutGrid, Sprout, Settings as SettingsIcon, LogOut, 
  Bell, Search, Menu, Activity, Server, Sun, Moon, Users, FileClock, Cpu, SlidersHorizontal, RadioTower, FileSpreadsheet, Send, CheckCheck, X, Trash2, PanelLeftClose, PanelLeftOpen,
  BarChart2, Bot, Wifi, BookOpen, MessageSquare, Droplets, Bug
} from 'lucide-react';
import { useMarkAllMessagesRead, useMarkMessageRead, useMyMessages, useSystemHealth } from '../hooks/useApi';
import { Message, UserRole } from '../types';
import { Language, translations } from '../utils/translations';
import { useAlertStore, useAppStore, useAuthStore, useFarmStore } from '../store';

const Settings = lazy(() => import('./Settings').then((module) => ({ default: module.Settings })));
const ConnectedFarmerDashboard = lazy(() =>
  import('./ConnectedFarmerDashboard').then((module) => ({ default: module.ConnectedFarmerDashboard }))
);
const ConnectedExpertDashboard = lazy(() =>
  import('./ConnectedExpertDashboard').then((module) => ({ default: module.ConnectedExpertDashboard }))
);
const ConnectedAdminDashboard = lazy(() =>
  import('./ConnectedAdminDashboard').then((module) => ({ default: module.ConnectedAdminDashboard }))
);

const DashboardContentSkeleton: React.FC<{ role: UserRole }> = ({ role }) => {
  const roleTone =
    role === 'admin'
      ? 'from-emerald-500/10 to-transparent dark:from-emerald-500/15'
      : role === 'expert'
        ? 'from-green-500/10 to-transparent dark:from-green-500/15'
        : 'from-emerald-500/10 to-transparent dark:from-emerald-500/15';

  return (
  <div className="space-y-5 animate-pulse">
    <div className={`rounded-3xl border border-slate-200/70 dark:border-slate-700/70 bg-gradient-to-br ${roleTone} bg-white/80 dark:bg-slate-900/70 p-4 md:p-6`}>
      <div className="h-3 w-40 rounded-full bg-slate-200 dark:bg-slate-700 mb-3" />
      <div className="h-8 w-64 rounded-xl bg-slate-200 dark:bg-slate-700 mb-3" />
      <div className="h-3 w-5/6 max-w-xl rounded-full bg-slate-200 dark:bg-slate-700" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`dash-skeleton-kpi-${index}`} className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 p-3">
            <div className="h-2.5 w-16 rounded-full bg-slate-200 dark:bg-slate-700 mb-2" />
            <div className="h-6 w-12 rounded-lg bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={`dash-skeleton-panel-${index}`} className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 p-4 md:p-5">
          <div className="h-4 w-32 rounded-full bg-slate-200 dark:bg-slate-700 mb-3" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-11/12 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-9/12 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      ))}
    </div>
  </div>
  );
};

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
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const { user } = useAuthStore();
  const { selectedFarm } = useFarmStore();
  const { data: systemHealth } = useSystemHealth(userRole === 'admin');
  const notificationsQuery = useMyMessages({ page: 1, limit: 8 });
  const markMessageReadMutation = useMarkMessageRead();
  const markAllMessagesReadMutation = useMarkAllMessagesRead();
  
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
          { id: 'analytics', label: 'District Analytics', icon: BarChart2 },
          { id: 'ai-chat', label: 'AI Advice', icon: Bot },
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
          { id: 'farms', label: 'Farms', icon: Sprout },
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
  const farmerShortcutItems = userRole === 'farmer'
    ? navItems.filter((item) => ['analytics', 'ai-chat', 'settings'].includes(item.id))
    : [];
  const primaryNavItems =
    userRole === 'farmer'
      ? navItems.filter((item) => !['analytics', 'ai-chat', 'settings'].includes(item.id))
      : navItems;

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
    if (role === 'expert') return 'Agricultural Expert';
    return 'Farmer Dashboard';
  };

  const getTabLabel = (tabId: string) => {
    const active = navItems.find((item) => item.id === tabId);
    return active?.label || tabId;
  };

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || userRole;
  const compactSidebar = sidebarCollapsed && !isMobileNavOpen;
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const pageTitle =
    userRole === 'farmer'
      ? selectedFarm?.name || 'My Farm Dashboard'
      : userRole === 'expert'
        ? `${getTabLabel(activeTab)} Workspace`
        : `${getTabLabel(activeTab)} Control Center`;
  const pageSubtitle =
    userRole === 'farmer'
      ? selectedFarm?.locationName || 'Live farm monitoring and actions'
      : userRole === 'expert'
        ? 'Live district review and recommendation workflow'
        : 'Live platform operations and system management';
  const statusLabel =
    userRole === 'admin'
      ? `System: ${systemHealth?.status || 'Checking'}`
      : selectedFarm?.currentGrowthStage
        ? `Growth stage: ${selectedFarm.currentGrowthStage.replace(/_/g, ' ')}`
        : 'Live data connected';
  const activeNavItem = navItems.find((item) => item.id === activeTab);
  const ActiveTabIcon = activeNavItem?.icon || LayoutGrid;
  const roleTheme =
    userRole === 'admin'
      ? {
          surface: 'from-emerald-500/10 via-green-500/5 to-transparent dark:from-emerald-500/20 dark:via-green-500/10',
          chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
          dot: 'bg-emerald-500',
        }
      : userRole === 'expert'
        ? {
            surface: 'from-green-500/10 via-green-500/5 to-transparent dark:from-green-500/20 dark:via-green-500/10',
            chip: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/20',
            dot: 'bg-green-500',
          }
        : {
            surface: 'from-emerald-500/10 via-green-500/5 to-transparent dark:from-emerald-500/20 dark:via-green-500/10',
            chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
            dot: 'bg-emerald-500',
          };
  const rolePillClass =
    userRole === 'admin'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
      : userRole === 'expert'
        ? 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/20'
        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
  const navAccentClass =
    userRole === 'admin'
      ? 'bg-[#0F5132] text-white border-[#0F5132] shadow-[0_12px_28px_-18px_rgba(15,81,50,0.85)]'
      : userRole === 'expert'
        ? 'bg-green-600 text-white border-green-600 shadow-[0_12px_28px_-18px_rgba(22,163,74,0.85)]'
        : 'bg-[#0F5132] text-white border-[#0F5132] shadow-[0_12px_28px_-18px_rgba(15,81,50,0.85)]';
  const navAccentTextClass =
    userRole === 'admin'
      ? 'group-hover:text-[#0F5132]'
      : userRole === 'expert'
        ? 'group-hover:text-green-600'
        : 'group-hover:text-[#0F5132]';
  const quickActiveTabClass =
    userRole === 'admin'
      ? 'bg-[#0F5132] text-white border-[#0F5132] shadow-md'
      : userRole === 'expert'
        ? 'bg-green-600 text-white border-green-600 shadow-md'
        : 'bg-[#0F5132] text-white border-[#0F5132] shadow-md';
  const persistedMessages = notificationsQuery.data?.messages || [];
  const messageUnreadCount = notificationsQuery.data?.unreadCount || 0;
  const totalUnreadCount = unreadCount + messageUnreadCount;

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
      title={compactSidebar ? label : undefined}
      className={`w-full relative border flex ${compactSidebar ? 'flex-col justify-center px-2 py-3' : 'items-center gap-3 px-6 py-4'} rounded-3xl transition-all duration-300 font-bold text-sm group ${
        activeTab === id
          ? navAccentClass
          : 'border-slate-200/70 dark:border-slate-700/70 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      {!compactSidebar && activeTab === id && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-1.5 rounded-full bg-white/80" />
      )}
      <Icon size={20} className={activeTab === id ? 'text-white' : `text-slate-400 ${navAccentTextClass}`} />
      {compactSidebar ? (
        <span className="mt-1 text-[10px] leading-tight text-center font-semibold">
          {label}
        </span>
      ) : (
        label
      )}
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
    <div className="relative flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 animate-fade-in selection:bg-[#0F5132] selection:text-white transition-colors duration-300 overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl dark:bg-emerald-700/20" />
        <div className="absolute top-48 -right-20 h-72 w-72 rounded-full bg-green-200/35 blur-3xl dark:bg-green-700/20" />
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-white/70 via-white/20 to-transparent dark:from-slate-900/55 dark:via-slate-900/15" />
        <div className="absolute inset-0 opacity-[0.16] dark:opacity-[0.08] bg-[radial-gradient(circle_at_1px_1px,_rgba(15,81,50,0.45)_1px,_transparent_0)] [background-size:22px_22px]" />
      </div>
      
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
        fixed md:sticky top-0 left-0 h-screen ${compactSidebar ? 'w-24' : 'w-72'} bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl flex flex-col z-50 
        transition-transform duration-300 ease-out border-r border-white/40 dark:border-slate-700/70
        ${isMobileNavOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0 md:shadow-none'}
      `}>
        <div className={`p-6 ${compactSidebar ? 'px-4' : 'px-8'}`}>
          <div className={`flex items-center ${compactSidebar ? 'justify-center' : 'gap-2'} cursor-pointer`} onClick={() => setActiveTab('overview')}>
            <div className="bg-[#0F5132] p-2 rounded-xl">
                <Sprout size={20} className="text-white fill-current" />
            </div>
            {!compactSidebar && <span className="text-xl font-bold tracking-tight text-[#0F5132]">RwandaBeyond</span>}
          </div>
        </div>

        <nav className={`flex-1 ${compactSidebar ? 'px-3' : 'px-6'} space-y-2 overflow-y-auto custom-scrollbar`}>
          {!compactSidebar && (
            <div className="px-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
             {userRole === 'admin' ? 'Admin Console' : userRole === 'expert' ? 'Expert Tools' : 'Main Menu'}
            </div>
          )}
          {primaryNavItems.map(item => (
              <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} />
          ))}
        </nav>

        {farmerShortcutItems.length > 0 && (
          <div className={`shrink-0 border-t border-slate-100 dark:border-slate-700 ${compactSidebar ? 'px-3 py-3' : 'px-6 py-4'} space-y-2`}>
            {!compactSidebar && (
              <div className="px-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Insights
              </div>
            )}
            {farmerShortcutItems.map((item) => (
              <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} />
            ))}
          </div>
        )}

        <div className={`p-6 border-t border-slate-50 dark:border-slate-700 space-y-4 ${compactSidebar ? 'px-3' : ''}`}>
           {/* Mini Profile */}
           <div className={`bg-[#FAFAF9] dark:bg-slate-700 p-4 rounded-[2rem] flex items-center ${compactSidebar ? 'justify-center' : 'gap-3'}`}>
              <img src={user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || userRole}`} className="w-10 h-10 rounded-full bg-white border-2 border-white shadow-sm" />
              {!compactSidebar && (
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{displayName}</p>
                    <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-wider">{getRoleLabel(userRole)}</p>
                </div>
              )}
           </div>

           <button 
             onClick={onLogout}
             className="flex items-center justify-center gap-2 w-full py-3 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-bold text-xs uppercase tracking-wider"
           >
             <LogOut size={16} />
             {!compactSidebar && <span>{t.signOut}</span>}
           </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="relative flex-1 min-w-0">
        
        {/* HEADER */}
        <header className="sticky top-0 z-30 px-4 md:px-6 lg:px-10 py-4">
          <div className="rounded-3xl border border-white/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_10px_40px_-22px_rgba(15,81,50,0.45)] px-4 md:px-5 py-4 flex justify-between items-center gap-4">
           <div className="flex items-center gap-4 min-w-0">
               <button className="md:hidden p-2 -ml-2 text-slate-500" onClick={() => setIsMobileNavOpen(true)}>
                   <Menu size={24} />
               </button>
               <button
                 className="hidden md:flex p-2 text-slate-500 hover:text-[#0F5132] transition-colors"
                 onClick={toggleSidebar}
                 title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
               >
                 {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
               </button>
               <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">{pageTitle}</h1>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-[0.14em] ${rolePillClass}`}>
                      {getRoleLabel(userRole)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <div className="w-2 h-2 rounded-full bg-[#0F5132] animate-pulse"></div>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                          {`${pageSubtitle} | ${statusLabel}`}
                      </p>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{todayLabel}</span>
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
                  {totalUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center border border-white dark:border-slate-800">
                      {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                    </span>
                  )}
               </button>
           </div>
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

        <div className="px-4 md:px-6 lg:px-10 mt-2">
          <div className={`rounded-3xl border border-white/70 dark:border-slate-700/60 bg-gradient-to-r ${roleTheme.surface} bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-[0_10px_36px_-24px_rgba(15,81,50,0.55)] px-4 md:px-5 py-4`}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-10 w-10 shrink-0 rounded-2xl border border-white/70 dark:border-slate-700/60 flex items-center justify-center ${roleTheme.chip}`}>
                    <ActiveTabIcon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Current Workspace</p>
                    <p className="font-extrabold text-slate-900 dark:text-white truncate">{getTabLabel(activeTab)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-[0.16em] ${roleTheme.chip}`}>
                    <span className={`inline-block w-2 h-2 rounded-full ${roleTheme.dot}`}></span>
                    {userRole}
                  </span>
                  {searchQuery && (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300 bg-white/80 dark:bg-slate-900/60">
                      <Search size={12} />
                      Filtered
                    </span>
                  )}
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300 bg-white/80 dark:bg-slate-900/60">
                    <Bell size={12} />
                    {totalUnreadCount} unread
                  </span>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {navItems.map((item) => {
                  const TabIcon = item.icon;
                  const isActive = item.id === activeTab;
                  return (
                    <button
                      key={`quick-tab-${item.id}`}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileNavOpen(false);
                        setShowMobileSearch(false);
                      }}
                      className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all duration-200 ${
                        isActive
                          ? quickActiveTabClass
                          : 'bg-white/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#0F5132]/40 hover:text-[#0F5132]'
                      }`}
                    >
                      <TabIcon size={14} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {showAlerts && (
          <div className="px-4 md:px-8 lg:px-10 max-w-7xl mx-auto pt-4">
            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-800 shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/70 dark:border-slate-700/70">
                <div>
                  <p className="font-semibold text-sm">Notifications & Alerts</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {totalUnreadCount > 0 ? `${totalUnreadCount} unread` : 'All caught up'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => markAllMessagesReadMutation.mutate()}
                    disabled={markAllMessagesReadMutation.isPending || messageUnreadCount === 0}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F5132] hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    <CheckCheck size={14} />
                    Mark notifications read
                  </button>
                  <button
                    onClick={() => markAllAsRead()}
                    disabled={unreadCount === 0}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F5132] hover:underline"
                  >
                    <CheckCheck size={14} />
                    Mark alerts read
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
              <div className="max-h-[32rem] overflow-y-auto">
                <div className="px-4 pt-4 pb-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Stored Notifications</p>
                </div>
                {notificationsQuery.isLoading ? (
                  <div className="px-4 pb-4 text-sm text-slate-500 dark:text-slate-400">
                    Loading notifications...
                  </div>
                ) : persistedMessages.length === 0 ? (
                  <div className="px-4 pb-4 text-sm text-slate-500 dark:text-slate-400">
                    No notifications yet.
                  </div>
                ) : (
                  persistedMessages.map((message: Message) => (
                    <div
                      key={message.id}
                      className="px-4 py-3 border-b last:border-b-0 border-slate-100 dark:border-slate-700/60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{message.subject || 'Notification'}</p>
                            <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                              {message.channel}
                            </span>
                            {message.recommendationId && (
                              <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                Recommendation
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{message.content}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                            {new Date(message.readAt || message.sentAt || message.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!message.readAt && <span className="mt-1 w-2 h-2 rounded-full bg-red-500"></span>}
                          {!message.readAt && (
                            <button
                              onClick={() => markMessageReadMutation.mutate(message.id)}
                              disabled={markMessageReadMutation.isPending}
                              className="text-[11px] font-semibold text-[#0F5132] hover:underline"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                <div className="px-4 pt-4 pb-2 border-t border-slate-100 dark:border-slate-700/60">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Realtime Alerts</p>
                </div>
                {alerts.length === 0 ? (
                  <div className="px-4 pb-4 text-sm text-slate-500 dark:text-slate-400">
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
        <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto relative">
          <Suspense
            fallback={
              <DashboardContentSkeleton role={userRole} />
            }
          >
            <div
              key={`${userRole}-${activeTab}`}
              className="animate-fade-in [animation-duration:220ms] [animation-fill-mode:both]"
            >
              {renderContent()}
            </div>
          </Suspense>
        </div>
      </main>
    </div>
  );
};

