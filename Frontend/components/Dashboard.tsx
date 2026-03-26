import React, { Suspense, lazy, useState, useEffect } from 'react';
import { 
  LayoutGrid, Sprout, Settings as SettingsIcon, LogOut, 
  Bell, Search, Menu, Activity, Server, Sun, Moon, Users, FileClock, Cpu, SlidersHorizontal, RadioTower, FileSpreadsheet, Send, CheckCheck, X, Trash2, PanelLeftClose, PanelLeftOpen,
  BarChart2, Bot, Wifi, BookOpen, MessageSquare, Droplets, Bug, Map as MapIcon
} from 'lucide-react';
import { useMarkAllMessagesRead, useMarkMessageRead, useMyMessages, useSystemHealth } from '../hooks/useApi';
import { Message, UserRole } from '../types';
import { Language, translations } from '../utils/translations';
import { useAlertStore, useAppStore, useAuthStore, useFarmStore } from '../store';
import { BrandLogo } from './ui/BrandLogo';

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
  const _role = role; // keep param usage

  return (
  <div className="space-y-5 animate-pulse">
    <div className="dash-hero-panel">
      <div className="h-3 w-40 rounded-full bg-slate-200 dark:bg-slate-700 mb-3" />
      <div className="h-8 w-64 rounded-xl bg-slate-200 dark:bg-slate-700 mb-3" />
      <div className="h-3 w-5/6 max-w-xl rounded-full bg-slate-200 dark:bg-slate-700" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`dash-skeleton-kpi-${index}`} className="dash-kpi-card">
            <div className="h-2.5 w-16 rounded-full bg-slate-200 dark:bg-slate-700 mb-2" />
            <div className="h-6 w-12 rounded-lg bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={`dash-skeleton-panel-${index}`} className="dash-panel p-5">
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

interface NavItemConfig {
  id: string;
  label: string;
  icon: any;
  section: string;
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
  const getNavItems = (role: UserRole): NavItemConfig[] => {
    const common = [
      { id: 'settings', label: t.settings, icon: SettingsIcon, section: 'Account' },
    ];

    switch (role) {
      case 'farmer':
        return [
          { id: 'overview', label: t.fieldView, icon: LayoutGrid, section: 'Workspace' },
          { id: 'irrigation', label: 'Irrigation', icon: Droplets, section: 'Workspace' },
          { id: 'fertilization', label: 'Fertilization', icon: Sprout, section: 'Workspace' },
          { id: 'sensors', label: 'Sensors', icon: Wifi, section: 'Workspace' },
          { id: 'pest-history', label: 'Pest History', icon: Bug, section: 'Planning' },
          { id: 'analytics', label: 'District Analytics', icon: BarChart2, section: 'Insights' },
          { id: 'map-view', label: 'Map View', icon: MapIcon, section: 'Insights' },
          { id: 'ai-chat', label: 'AI Advice', icon: Bot, section: 'Insights' },
          ...common,
        ];
      case 'expert':
        return [
          { id: 'overview', label: 'Expert Snapshot', icon: Activity, section: 'Core Operations' },
          { id: 'farm-coordination', label: 'Farm Coordination', icon: Sprout, section: 'Core Operations' },
          { id: 'field-support', label: 'Field Support', icon: Bug, section: 'Core Operations' },
          { id: 'irrigation', label: 'Irrigation', icon: Droplets, section: 'Decision Support' },
          { id: 'fertilization', label: 'Fertilization', icon: Sprout, section: 'Decision Support' },
          { id: 'expert-guidance', label: 'Expert Guidance', icon: Send, section: 'Decision Support' },
          { id: 'issue-oversight', label: 'Issue Oversight', icon: MessageSquare, section: 'Decision Support' },
          { id: 'review-lanes', label: 'Review Lanes', icon: CheckCheck, section: 'Decision Support' },
          { id: 'district-analytics', label: 'District Analytics', icon: BarChart2, section: 'Insights' },
          { id: 'map-view', label: 'Map View', icon: MapIcon, section: 'Insights' },
          { id: 'ai-advice', label: 'AI Advice', icon: Bot, section: 'Insights' },
          ...common
        ];
      case 'admin':
        return [
          { id: 'overview', label: t.systemView, icon: Server, section: 'Core Control' },
          { id: 'users', label: 'Users', icon: Users, section: 'Core Control' },
          { id: 'farms', label: 'Farms', icon: Sprout, section: 'Core Control' },
          { id: 'devices', label: 'Devices', icon: Cpu, section: 'Core Control' },
          { id: 'audit', label: 'Audit Logs', icon: FileClock, section: 'Operations' },
          { id: 'irrigation', label: 'Irrigation', icon: Droplets, section: 'Operations' },
          { id: 'fertilization', label: 'Fertilization', icon: Sprout, section: 'Operations' },
          { id: 'config', label: 'Configuration', icon: SlidersHorizontal, section: 'Operations' },
          { id: 'monitoring', label: 'Monitoring', icon: RadioTower, section: 'Operations' },
          { id: 'analytics', label: 'Analytics', icon: BarChart2, section: 'Platform' },
          { id: 'map-view', label: 'Map View', icon: MapIcon, section: 'Platform' },
          { id: 'content', label: 'Content', icon: BookOpen, section: 'Platform' },
          { id: 'ussd', label: 'USSD Monitor', icon: MessageSquare, section: 'Platform' },
          { id: 'reports', label: 'Reports', icon: FileSpreadsheet, section: 'Platform' },
          { id: 'broadcast', label: 'Broadcast', icon: Send, section: 'Platform' },
          ...common
        ];
      default:
        return common;
    }
  };

  const navItems = getNavItems(userRole);
  const navSections = navItems.reduce<Array<{ section: string; items: NavItemConfig[] }>>((acc, item) => {
    const existing = acc.find((entry) => entry.section === item.section);
    if (existing) {
      existing.items.push(item);
      return acc;
    }
    acc.push({ section: item.section, items: [item] });
    return acc;
  }, []);

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
  const getSearchPlaceholder = (role: UserRole, tabId: string) => {
    if (role === 'admin') {
      if (tabId === 'users') return 'Search users, roles, districts, or status';
      if (tabId === 'farms') return 'Search farms, farmers, districts, or growth stages';
      if (tabId === 'devices') return 'Search devices, farms, IDs, or health status';
      if (tabId === 'irrigation') return 'Search irrigation schedules, water usage, and execution status';
      if (tabId === 'fertilization') return 'Search fertilization schedules, quantities, and execution status';
      if (tabId === 'monitoring') return 'Search services, alerts, sensors, or health signals';
      if (tabId === 'map-view') return 'Search mapped farms, outbreaks, and system coverage';
      if (tabId === 'content') return 'Search resources, FAQ entries, and content categories';
      return 'Search system users, farms, reports, or alerts';
    }

    if (role === 'expert') {
      if (tabId === 'farm-coordination') return 'Search farms, recommendations, or farmer activity';
      if (tabId === 'field-support') return 'Search pest schedules, scans, or field actions';
      if (tabId === 'irrigation') return 'Search irrigation schedules, water usage, or assigned farms';
      if (tabId === 'fertilization') return 'Search nutrient plans, quantities, or assigned farms';
      if (tabId === 'review-lanes') return 'Search pending reviews, detections, or issue severity';
      if (tabId === 'district-analytics') return 'Search districts, outbreaks, or weather insights';
      if (tabId === 'map-view') return 'Search mapped farms, field coverage, or outbreak points';
      return 'Search farms, guidance, pest reviews, or issue updates';
    }

    if (tabId === 'sensors') return 'Search sensors, readings, and farm devices';
    if (tabId === 'irrigation') return 'Search irrigation plans, water volume, and schedule timing';
    if (tabId === 'fertilization') return 'Search fertilization plans and execution history';
    if (tabId === 'pest-history') return 'Search scans, treatments, and pest detections';
    if (tabId === 'analytics') return 'Search trends, weather, and farm performance';
    if (tabId === 'map-view') return 'Search mapped farms, selected fields, and location coverage';
    if (tabId === 'ai-chat') return 'Search chat topics, advice, and AI tools';
    return 'Search recommendations, schedules, alerts, and farm records';
  };
  const expertTabSubtitleMap: Record<string, string> = {
    overview: 'Review your live workload and jump into the right expert lane.',
    'farm-coordination': 'Select a farm, monitor farmer response, and inspect farm history.',
    'field-support': 'Track field execution and pest-control follow-through for active farms.',
    irrigation: 'Review irrigation schedules and water usage across your assigned farm scope.',
    fertilization: 'Track nutrient plans and fertilizer usage across your assigned farm scope.',
    'expert-guidance': 'Create direct advice and monitor recent system activity.',
    'issue-oversight': 'Handle reported farm issues in a focused support workspace.',
    'review-lanes': 'Process recommendation and pest-review decisions in separate lanes.',
    'district-analytics': 'Inspect district performance, outbreak signals, and weather conditions.',
    'map-view': 'Navigate assigned farms and outbreak activity on an interactive map.',
    'ai-advice': 'Use the AI expert system for focused agricultural guidance.',
    settings: 'Manage your expert profile and dashboard preferences.',
  };

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || userRole;
  const compactSidebar = sidebarCollapsed && !isMobileNavOpen;
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const searchPlaceholder = getSearchPlaceholder(userRole, activeTab);
  const searchContextLabel =
    userRole === 'admin'
      ? 'Searching across platform operations'
      : userRole === 'expert'
        ? 'Searching across expert workflows'
        : 'Searching across selected farm workspaces';
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
        ? expertTabSubtitleMap[activeTab] || 'Live district review and recommendation workflow'
        : 'Live platform operations and system management';
  const statusLabel =
    userRole === 'admin'
      ? `System: ${systemHealth?.status || 'Checking'}`
      : selectedFarm?.currentGrowthStage
        ? `Growth stage: ${selectedFarm.currentGrowthStage.replace(/_/g, ' ')}`
        : 'Live data connected';
  const activeNavItem = navItems.find((item) => item.id === activeTab);
  const ActiveTabIcon = activeNavItem?.icon || LayoutGrid;
  const roleTheme = userRole === 'expert' ? { dot: 'bg-green-500' } : { dot: 'bg-emerald-500' };
  const rolePillClass =
    userRole === 'admin'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
      : userRole === 'expert'
        ? 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/20'
        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
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
        setShowAlerts(false);
      }}
      title={compactSidebar ? label : undefined}
      className={`relative w-[calc(100%-20px)] mx-2.5 flex ${compactSidebar ? 'flex-col justify-center px-2 py-3 mt-1.5' : 'items-center gap-3.5 px-4 py-3.5 my-1.5'} rounded-[1.25rem] transition-all duration-200 text-[15px] group ${
        activeTab === id
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-primary dark:text-emerald-300 font-semibold border border-emerald-100 dark:border-emerald-900/50 shadow-[0_14px_24px_-22px_rgba(27,107,70,0.45)]'
          : 'text-slate-500 hover:bg-[hsl(var(--secondary))] dark:hover:bg-slate-800 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium border border-transparent'
      }`}
    >
      <Icon size={21} strokeWidth={activeTab === id ? 2.35 : 2} className={`${activeTab === id ? 'text-primary dark:text-emerald-300' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
      {compactSidebar ? (
        <span className="mt-1 text-[10px] leading-tight text-center font-medium">
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
    <div className="dashboard-shell relative min-h-screen bg-[hsl(var(--background))] dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 flex w-full">

      
      {/* MOBILE OVERLAY */}
      <div 
        className={`fixed inset-0 bg-slate-950/35 backdrop-blur-[2px] z-40 md:hidden transition-opacity duration-300 ${
          isMobileNavOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileNavOpen(false)}
        aria-hidden="true"
      />

      {/* SIDEBAR */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-screen ${compactSidebar ? 'w-24' : 'w-[292px] xl:w-[304px] shrink-0'} bg-transparent flex flex-col z-50
        transition-transform duration-300 ease-out
        ${isMobileNavOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0 md:shadow-none'}
      `}>
        <div className={`m-3 md:m-4 dash-shell-surface flex h-[calc(100vh-1.5rem)] md:h-[calc(100vh-2rem)] flex-col overflow-hidden ${compactSidebar ? 'px-3 py-5' : 'px-4 py-5'}`}>
        <div className={compactSidebar ? 'px-0 pt-1 pb-4' : 'px-2 pt-1 pb-5'}>
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            title="RwandaBeyond"
            className={`w-full rounded-[1.35rem] transition-colors ${compactSidebar ? 'flex justify-center px-0 py-1.5' : 'px-2 py-2 text-left hover:bg-[hsl(var(--secondary))] dark:hover:bg-slate-800/80'}`}
          >
            <BrandLogo compact={compactSidebar} variant="sidebar" />
          </button>
        </div>

        <nav className="flex-1 px-1 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navSections.map((section) => (
            <div key={section.section} className="space-y-1.5">
              {!compactSidebar && (
                <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {section.section}
                </div>
              )}
              {section.items.map((item) => (
                <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} />
              ))}
            </div>
          ))}
        </nav>

        {!compactSidebar && (
          <div className="px-2 pb-3">
            <div className="rounded-[1.45rem] border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] dark:bg-slate-950 px-3.5 py-3.5 flex items-center gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
              <img
                src={user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || userRole}`}
                alt={`${displayName} avatar`}
                className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{displayName}</p>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                  {getRoleLabel(userRole)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className={`mt-auto border-t border-[hsl(var(--border))] px-2 py-4 ${compactSidebar ? 'px-1' : ''}`}>
           <button 
             onClick={onLogout}
             className={`w-full flex ${compactSidebar ? 'flex-col justify-center px-2 py-3' : 'items-center gap-3 px-4 py-3.5'} rounded-[1.25rem] border border-transparent text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:border-red-100/80 dark:hover:border-red-900/40 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 text-[14px] font-medium`}
           >
             <LogOut size={20} className="text-slate-400" />
             {compactSidebar ? (
               <span className="mt-1 text-[10px] leading-tight text-center font-medium">{t.signOut}</span>
             ) : (
               <span>{t.signOut}</span>
             )}
           </button>
        </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="dashboard-main relative flex-1 min-w-0 bg-[hsl(var(--background))] dark:bg-slate-950 flex flex-col h-screen overflow-y-auto">
        
        {/* HEADER TOP BAR */}
        <header className="sticky top-0 z-30 border-b border-[hsl(var(--border))]/70 bg-[hsl(var(--background))]/90 dark:bg-slate-950/90 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-4 md:px-6 lg:px-8">
           {/* Left */}
           <div className="flex items-center gap-4 flex-1 min-w-0">
               <button className="md:hidden p-2.5 -ml-2 text-slate-500 hover:bg-white rounded-full border border-[hsl(var(--border))] bg-white/85" onClick={() => setIsMobileNavOpen(true)}>
                   <Menu size={24} />
               </button>
               <button
                 className="hidden md:flex p-2.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors rounded-full border border-[hsl(var(--border))] hover:bg-white dark:hover:bg-slate-800 bg-white/85 dark:bg-slate-900"
                 onClick={toggleSidebar}
                 title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
               >
                 {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
               </button>
               
               {/* Search */}
               <div className="hidden md:flex items-center gap-3 bg-white/95 dark:bg-slate-900 px-5 py-3 rounded-full w-full max-w-[480px] focus-within:ring-2 ring-emerald-200/70 dark:ring-emerald-700/40 transition-all border border-[hsl(var(--border))] shadow-[0_16px_28px_-24px_rgba(15,23,42,0.28)]">
                   <Search size={18} className="text-slate-400" />
                   <input
                     id="dashboard-search-input"
                     type="text"
                     placeholder={searchPlaceholder}
                     value={searchQuery}
                     onChange={(event) => setSearchQuery(event.target.value)}
                     className="bg-transparent text-sm w-full outline-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400 font-medium"
                   />
                   {searchQuery && (
                     <button
                       onClick={() => setSearchQuery('')}
                       className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                     >
                       <X size={14} />
                     </button>
                   )}
                   <div className="hidden lg:flex items-center justify-center gap-1 px-2.5 py-1 rounded-xl bg-[hsl(var(--secondary))] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 text-[10px] font-bold uppercase tracking-[0.18em]">
                     <span>/</span>
                     <span>Focus</span>
                   </div>
               </div>
           </div>

           {/* Right Actions */}
           <div className="flex items-center gap-3 shrink-0">
               <button
                 className="md:hidden p-2.5 text-slate-600 hover:bg-white rounded-full transition-colors border border-[hsl(var(--border))] bg-white/85"
                 onClick={() => setShowMobileSearch((previous) => !previous)}
               >
                  <Search size={20} />
               </button>
               
               {toggleTheme && (
                   <button 
                     onClick={toggleTheme}
                     className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors bg-white dark:bg-slate-900 shadow-[0_14px_26px_-22px_rgba(15,23,42,0.35)] border border-[hsl(var(--border))]"
                   >
                      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                   </button>
               )}

               <button
                  onClick={() => setShowAlerts((previous) => !previous)}
                  className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors relative bg-white dark:bg-slate-900 shadow-[0_14px_26px_-22px_rgba(15,23,42,0.35)] border border-[hsl(var(--border))]"
               >
                  <Bell size={20} />
                  {totalUnreadCount > 0 && (
                     <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                  )}
               </button>
               
               {/* Minimal visible profile for large screens is optional, but reference image has it right top */}
              <div className="hidden lg:flex items-center gap-3 ml-2 cursor-pointer hover:opacity-90 transition-opacity pl-2 pr-3 py-2 rounded-full border border-[hsl(var(--border))] bg-white dark:bg-slate-900 shadow-[0_14px_26px_-22px_rgba(15,23,42,0.3)]" onClick={() => setActiveTab('settings')}>
                <img src={user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || userRole}`} alt={`${displayName} profile`} className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100" />
                  <div className="flex flex-col text-left">
                      <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{displayName}</span>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">{user?.email || 'User'}</span>
                  </div>
               </div>
           </div>
          </div>
        </header>

        {showMobileSearch && (
          <div className="md:hidden">
            <div className="mx-auto w-full max-w-[1600px] px-4 pt-3">
              <div className="space-y-2 rounded-[1.5rem] border border-[hsl(var(--border))] bg-white/95 px-4 py-3 shadow-[0_14px_26px_-22px_rgba(15,23,42,0.25)] dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3 px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {searchContextLabel}
                  </p>
                  <span className="rounded-full bg-[hsl(var(--secondary))] px-2.5 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    Tap outside or press Esc
                  </span>
                </div>
                <div className="flex items-center gap-2">
                <Search size={16} className="text-slate-400" />
                <input
                  id="dashboard-search-input-mobile"
                  type="text"
                  placeholder={searchPlaceholder}
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
            </div>
          </div>
        )}

        {/* PAGE TITLE & TABS */}
        <div className="px-4 md:px-6 lg:px-8 pt-5 pb-3 max-w-[1600px] mx-auto w-full">
          <div className="dash-hero-panel">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
             <div>
                 <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-semibold ${rolePillClass}`}>
                   <span className={`h-2 w-2 rounded-full ${roleTheme.dot}`}></span>
                   {getRoleLabel(userRole)}
                 </div>
                 <h1 className="text-[2.15rem] md:text-[2.7rem] font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.05] mt-4">{pageTitle}</h1>
                <p className="text-slate-500 dark:text-slate-400 text-[15px] mt-2.5 max-w-2xl">{pageSubtitle}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <span className="dash-meta-pill">{todayLabel}</span>
                  <span className="dash-meta-pill">{getTabLabel(activeTab)}</span>
                  <span className="dash-meta-pill">{searchContextLabel}</span>
                </div>
             </div>
             
             <div className="flex flex-col items-stretch gap-3 md:min-w-[250px] md:max-w-[320px]">
               <div className="dash-soft-block">
                 <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                   Live status
                 </p>
                 <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:bg-slate-900 dark:text-slate-300">
                   <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                   {statusLabel}
                 </div>
               </div>
               <div className="dash-outline-block">
                 <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                   Search scope
                 </p>
                 <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                   {searchPlaceholder}
                 </p>
               </div>
             </div>
          </div>

          <div className="dash-tab-strip pt-7">
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
                    setShowAlerts(false);
                  }}
                  className={`shrink-0 inline-flex items-center gap-2 py-2.5 px-4 rounded-full border text-[14px] font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-transparent shadow-[0_18px_28px_-18px_rgba(27,107,70,0.62)]'
                      : 'bg-white text-slate-500 border-[hsl(var(--border))] hover:text-slate-800 hover:border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <TabIcon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
          </div>
        </div>

        {showAlerts && (
          <div className="px-4 md:px-6 lg:px-8 max-w-[1600px] mx-auto w-full pt-4">
            <div className="dash-panel">
              <div className="flex flex-col gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold text-sm">Notifications & Alerts</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {totalUnreadCount > 0 ? `${totalUnreadCount} unread` : 'All caught up'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => markAllMessagesReadMutation.mutate()}
                    disabled={markAllMessagesReadMutation.isPending || messageUnreadCount === 0}
                    className="dash-link-action"
                  >
                    <CheckCheck size={14} />
                    Mark notifications read
                  </button>
                  <button
                    onClick={() => markAllAsRead()}
                    disabled={unreadCount === 0}
                    className="dash-link-action"
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
                              className="dash-link-action text-[11px]"
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
                              className="dash-link-action text-[11px]"
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
        <div className="px-4 md:px-6 lg:px-8 pb-8 pt-5 max-w-[1600px] mx-auto w-full relative">
          <Suspense
            fallback={
              <DashboardContentSkeleton role={userRole} />
            }
          >
            <div
              key={`${userRole}-${activeTab}`}
              className="dashboard-page animate-fade-in [animation-duration:220ms] [animation-fill-mode:both]"
            >
              {renderContent()}
            </div>
          </Suspense>
        </div>
      </main>
    </div>
  );
};
