import React from 'react';
import { NavItem } from '../types';
import { LayoutDashboard, Droplet, Bug, Sprout, Settings, LogOut } from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  setPage: (page: string) => void;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
  { label: 'Irrigation', icon: Droplet, path: 'irrigation' },
  { label: 'Pest Control', icon: Bug, path: 'pest' },
  { label: 'Soil Health', icon: Sprout, path: 'soil' },
  { label: 'Settings', icon: Settings, path: 'settings' },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, setPage, isOpen, setIsOpen }) => {
  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      <div className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col z-50 transition-all duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-8">
          <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">RwandaBeyond<span className="text-[#10B981]">.</span></h1>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  setPage(item.path);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 font-medium ${
                  isActive 
                    ? 'bg-[#10B981] text-white shadow-lg shadow-emerald-200' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-[#10B981]'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-100">
            <button className="flex items-center gap-3 text-slate-400 hover:text-red-500 transition-colors px-2">
                <LogOut size={18} />
                <span className="font-medium text-sm">Sign Out</span>
            </button>
        </div>
      </div>
    </>
  );
};
