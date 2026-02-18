import React, { useState } from 'react';
import { 
    LayoutDashboard, Sprout, Users, Activity, Bug, Droplets, 
    Beaker, Bell, FileText, Settings, ChevronRight 
} from 'lucide-react';
import { Overview } from './admin/Overview';
import { FarmManagement } from './admin/FarmManagement';
import { UserManagement } from './admin/UserManagement';
import { SensorAnalytics } from './admin/SensorAnalytics';
import { PestManagement } from './admin/PestManagement';
import { IrrigationConfig } from './admin/IrrigationConfig';
import { FertilizationManagement } from './admin/FertilizationManagement';
import { AlertsCenter } from './admin/AlertsCenter';
import { ReportsView } from './admin/ReportsView';
import { SystemConfiguration } from './admin/SystemConfiguration';
import { Card, CardContent } from './ui/Card';
import { Language } from '../utils/translations';

interface AdminDashboardProps {
    language?: Language;
}

export const AdminDashboard = ({ language = 'en' }: AdminDashboardProps) => {
    const [activeView, setActiveView] = useState('overview');

    const menuItems = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'farms', label: 'Farm Management', icon: Sprout },
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'sensors', label: 'Sensor Analytics', icon: Activity },
        { id: 'pest', label: 'Pest & Disease', icon: Bug },
        { id: 'irrigation', label: 'Smart Irrigation', icon: Droplets },
        { id: 'fertilization', label: 'Fertilization', icon: Beaker },
        { id: 'alerts', label: 'Alerts Center', icon: Bell },
        { id: 'reports', label: 'System Reports', icon: FileText },
        { id: 'config', label: 'Configuration', icon: Settings },
    ];

    const renderContent = () => {
        switch(activeView) {
            case 'overview': return <Overview />;
            case 'farms': return <FarmManagement />;
            case 'users': return <UserManagement />;
            case 'sensors': return <SensorAnalytics />;
            case 'pest': return <PestManagement />;
            case 'irrigation': return <IrrigationConfig />;
            case 'fertilization': return <FertilizationManagement />;
            case 'alerts': return <AlertsCenter />;
            case 'reports': return <ReportsView />;
            case 'config': return <SystemConfiguration />;
            default: return <Overview />;
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8 min-h-[800px] animate-fade-in font-sans">
            
            {/* Internal Admin Sidebar */}
            <aside className="lg:w-64 flex-shrink-0">
                <Card className="rounded-[2.5rem] border-muted p-4 sticky top-24">
                    <CardContent className="p-0 space-y-1">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveView(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm group ${
                                    activeView === item.id 
                                    ? 'bg-primary text-primary-foreground shadow-md' 
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                            >
                                <item.icon size={18} className={`transition-colors ${activeView === item.id ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-primary'}`} />
                                {item.label}
                                {activeView === item.id && <ChevronRight size={14} className="ml-auto opacity-50" />}
                            </button>
                        ))}
                    </CardContent>
                </Card>
            </aside>

            {/* Main Admin View Area */}
            <div className="flex-1 min-w-0">
                <div className="mb-6">
                    <h2 className="text-3xl font-bold tracking-tight capitalize">{activeView.replace('-', ' ')} Dashboard</h2>
                    <p className="text-muted-foreground text-sm mt-1">Manage system parameters and monitor field performance.</p>
                </div>
                {renderContent()}
            </div>
        </div>
    );
};