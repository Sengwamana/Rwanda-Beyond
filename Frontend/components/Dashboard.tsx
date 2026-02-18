import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, Droplets, Bug, Sprout, MessageSquare, Settings as SettingsIcon, LogOut, 
  Bell, Search, Menu, Map as MapIcon, Activity, Users, ShieldCheck, FileText, Server, Sun, Moon
} from 'lucide-react';
import { Irrigation } from './Irrigation';
import { PestControl } from './PestControl';
import { SoilHealth } from './SoilHealth';
import { Communication } from './Communication';
import { Settings } from './Settings';
import { FarmerDashboard } from './FarmerDashboard';
import { ExpertDashboard } from './ExpertDashboard';
import { AdminDashboard } from './AdminDashboard';
import { UserRole } from '../types';
import { Language, translations } from '../utils/translations';

interface DashboardProps {
  userRole: UserRole;
  onLogout?: () => void;
  language?: Language;
  setLanguage?: (lang: Language) => void;
  theme?: string;
  toggleTheme?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ userRole, onLogout, language = 'en', setLanguage, theme, toggleTheme }) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  const t = translations[language].dashboard;

  // Reset active tab when role changes to avoid getting stuck on a non-existent tab
  useEffect(() => {
    setActiveTab('overview');
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
          // The FarmerDashboard component now handles sub-navigation (Irrigation, Pest, etc.) internally
          // to provide a simpler, app-like experience.
        ];
      case 'expert':
        return [
          { id: 'overview', label: t.analysis, icon: Activity },
          { id: 'irrigation', label: t.waterTrends, icon: Droplets },
          { id: 'pest', label: t.pestMap, icon: MapIcon },
          { id: 'audit', label: t.aiAudit, icon: ShieldCheck },
          ...common
        ];
      case 'admin':
        return [
          { id: 'overview', label: t.systemView, icon: Server },
          { id: 'users', label: t.userMgmt, icon: Users },
          { id: 'devices', label: t.deviceHealth, icon: Activity },
          ...common
        ];
      default:
        return common;
    }
  };

  const navItems = getNavItems(userRole);

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

  const NavItem: React.FC<{ id: string; label: string; icon: any }> = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setIsMobileNavOpen(false);
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
          // FarmerDashboard handles its own internal routing for A-F modules
          return <FarmerDashboard onNavigate={setActiveTab} language={language} />;
      }

      // Expert Views
      if (userRole === 'expert') {
          switch (activeTab) {
              case 'overview': return <ExpertDashboard language={language} />;
              case 'irrigation': return <Irrigation language={language} />; // Expert can view charts
              case 'pest': return <PestControl language={language} />; // Expert can view pest analysis
              case 'audit': return <ExpertDashboard language={language} />; // In prototype, audit is part of dashboard
              default: return <ExpertDashboard language={language} />;
          }
      }

      // Admin Views
      if (userRole === 'admin') {
           // In this prototype, AdminDashboard contains all sections (Device, User, etc.)
           return <AdminDashboard language={language} />;
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
                          {userRole === 'admin' ? t.systemHealthy : t.ussdOnline}
                      </p>
                  </div>
               </div>
           </div>

           <div className="flex items-center gap-3 md:gap-4">
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
                   <input type="text" placeholder={t.search} className="bg-transparent text-sm w-full outline-none text-slate-600 dark:text-slate-300 placeholder:text-slate-400 font-medium" />
               </div>

               <button className="p-3 text-slate-400 hover:text-[#0F5132] transition-colors relative bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md">
                  <Bell size={20} />
                  <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-800"></span>
               </button>
           </div>
        </header>

        {/* DYNAMIC PAGE CONTENT */}
        <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto">
            {renderContent()}
        </div>
      </main>
    </div>
  );
};