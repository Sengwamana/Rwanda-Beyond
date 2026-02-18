import React, { useState } from 'react';
import { User, MapPin, Save, Sliders, Smartphone, Globe, Shield, Wifi, Battery, BellRing } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface SettingsProps {
    language?: Language;
    setLanguage?: (lang: Language) => void;
}

export const Settings: React.FC<SettingsProps> = ({ language = 'en', setLanguage }) => {
  const [moistureThreshold, setMoistureThreshold] = useState(30);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const t = translations[language].settings;
  
  // Notification State
  const [notifications, setNotifications] = useState({
      pest: true,
      irrigation: true,
      soil: false,
      sms: true,
      ussd: false
  });

  const toggleNotification = (key: keyof typeof notifications) => {
      setNotifications(prev => ({...prev, [key]: !prev[key]}));
  };

  const handleSave = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
        setLoading(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }, 1500);
  };

  return (
    <div className="space-y-8 animate-fade-in">
       <div className="flex justify-between items-end">
            <div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{t.title}</h2>
                <p className="text-slate-500 mt-1">{t.subtitle}</p>
            </div>
            <button 
                onClick={handleSave}
                className={`px-8 py-3 rounded-full font-bold text-sm flex items-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${
                    saved 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-[#0F5132] text-white hover:bg-[#0a3622]'
                }`}
            >
                {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : saved ? (
                    <>{t.saved}</>
                ) : (
                    <><Save size={18} /> {t.save}</>
                )}
            </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
            
            {/* COLUMN 1: Profile & General */}
            <div className="space-y-8">
                {/* Profile Card */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm shadow-slate-200 border border-slate-100">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-slate-50 rounded-2xl text-slate-600">
                            <User size={20} />
                        </div>
                        <h3 className="font-bold text-slate-900 text-lg">{t.profile}</h3>
                    </div>

                    <div className="space-y-6">
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-28 h-28 rounded-full bg-slate-100 border-4 border-white shadow-md overflow-hidden mb-4">
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" className="w-full h-full" alt="Profile" />
                            </div>
                            <button className="text-xs font-bold text-[#0F5132] hover:text-emerald-700 bg-emerald-50 px-4 py-2 rounded-full uppercase tracking-wider transition-colors">{t.changeAvatar}</button>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">{t.fullName}</label>
                            <input type="text" defaultValue="Jean Claude" className="w-full bg-[#FAFAF9] border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#0F5132] transition-all" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">{t.location}</label>
                            <div className="relative">
                                <MapPin size={18} className="absolute left-5 top-4 text-slate-400" />
                                <input type="text" defaultValue="Rwamagana, Sector 4" className="w-full bg-[#FAFAF9] border border-slate-200 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#0F5132] transition-all" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notification Config */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm shadow-slate-200 border border-slate-100">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-slate-50 rounded-2xl text-slate-600">
                            <BellRing size={20} />
                        </div>
                        <h3 className="font-bold text-slate-900 text-lg">{t.notificationConfig}</h3>
                    </div>
                    
                    <div className="space-y-4">
                        {[
                            { id: 'pest', label: t.pestAlerts },
                            { id: 'irrigation', label: t.irrigationAlerts },
                            { id: 'soil', label: t.soilAlerts }
                        ].map((item) => (
                             <div key={item.id} className="flex items-center justify-between p-4 bg-[#FAFAF9] rounded-2xl">
                                <span className="text-sm font-bold text-slate-700 ml-1">{item.label}</span>
                                <button 
                                    onClick={() => toggleNotification(item.id as keyof typeof notifications)}
                                    className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ${notifications[item.id as keyof typeof notifications] ? 'bg-[#0F5132]' : 'bg-slate-200'}`}
                                >
                                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${notifications[item.id as keyof typeof notifications] ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        ))}
                        
                        <div className="h-px bg-slate-100 my-4"></div>
                        
                        <div className="flex items-center justify-between px-2 mb-2">
                             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.channels}</span>
                        </div>
                         {[
                            { id: 'sms', label: t.smsAlerts },
                            { id: 'ussd', label: t.ussdPrompts }
                        ].map((item) => (
                             <div key={item.id} className="flex items-center justify-between p-4 bg-[#FAFAF9] rounded-2xl">
                                <span className="text-sm font-bold text-slate-700 ml-1">{item.label}</span>
                                <button 
                                    onClick={() => toggleNotification(item.id as keyof typeof notifications)}
                                    className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ${notifications[item.id as keyof typeof notifications] ? 'bg-slate-900' : 'bg-slate-200'}`}
                                >
                                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${notifications[item.id as keyof typeof notifications] ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* App Preferences */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm shadow-slate-200 border border-slate-100">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-slate-50 rounded-2xl text-slate-600">
                            <Globe size={20} />
                        </div>
                        <h3 className="font-bold text-slate-900 text-lg">{t.appPref}</h3>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-[#FAFAF9] rounded-2xl">
                            <span className="text-sm font-bold text-slate-700 ml-1">{t.language}</span>
                            <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                                <button 
                                    onClick={() => setLanguage?.('rw')} 
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold hover:text-slate-600 transition-colors ${language === 'rw' ? 'bg-[#0F5132] text-white shadow-md' : 'bg-transparent text-slate-400'}`}
                                >
                                    RW
                                </button>
                                <button 
                                    onClick={() => setLanguage?.('en')} 
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold hover:text-slate-600 transition-colors ${language === 'en' ? 'bg-[#0F5132] text-white shadow-md' : 'bg-transparent text-slate-400'}`}
                                >
                                    EN
                                </button>
                                <button 
                                    onClick={() => setLanguage?.('fr')} 
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold hover:text-slate-600 transition-colors ${language === 'fr' ? 'bg-[#0F5132] text-white shadow-md' : 'bg-transparent text-slate-400'}`}
                                >
                                    FR
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-[#FAFAF9] rounded-2xl">
                             <span className="text-sm font-bold text-slate-700 ml-1">{t.units}</span>
                             <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-100">Metric (Celsius, Liters)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* COLUMN 2: IoT Calibration */}
            <div className="lg:col-span-2 space-y-8">
                {/* Calibration Card */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm shadow-slate-200 border border-slate-100">
                     <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-emerald-50 rounded-2xl text-[#0F5132]">
                                <Sliders size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 text-lg">{t.calibration}</h3>
                                <p className="text-xs text-slate-400">Fine-tune automation triggers</p>
                            </div>
                        </div>
                        <div className="bg-amber-50 text-amber-600 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 border border-amber-100">
                            <Shield size={14} /> Admin Access
                        </div>
                    </div>

                    <div className="mb-10">
                        <div className="flex justify-between items-end mb-6">
                            <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">{t.threshold}</label>
                            <span className="text-4xl font-bold text-[#0F5132]">{moistureThreshold}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="10" 
                            max="60" 
                            value={moistureThreshold} 
                            onChange={(e) => setMoistureThreshold(parseInt(e.target.value))}
                            className="w-full h-3 bg-slate-100 rounded-full appearance-none cursor-pointer accent-[#0F5132]"
                        />
                        <div className="flex justify-between mt-3 text-xs text-slate-400 font-bold uppercase tracking-wider">
                            <span>10% (Very Dry)</span>
                            <span>Default: 30%</span>
                            <span>60% (Wet)</span>
                        </div>
                        <p className="mt-8 text-sm text-slate-500 bg-[#FAFAF9] p-6 rounded-[1.5rem] leading-relaxed border border-slate-100">
                            <span className="font-bold text-slate-900">Note:</span> When soil moisture drops below <span className="font-bold text-[#0F5132]">{moistureThreshold}%</span>, the Smart Irrigation system will automatically engage pumps (if Auto Mode is enabled) and send a critical SMS alert.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="p-6 rounded-[2rem] border border-slate-100 bg-[#FAFAF9]">
                             <div className="flex items-center justify-between mb-4">
                                 <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pump Run Duration</span>
                                 <span className="text-base font-bold text-slate-900">10 Mins</span>
                             </div>
                             <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                 <div className="w-1/3 bg-blue-500 h-full rounded-full"></div>
                             </div>
                        </div>
                        <div className="p-6 rounded-[2rem] border border-slate-100 bg-[#FAFAF9]">
                             <div className="flex items-center justify-between mb-4">
                                 <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sensor Polling Rate</span>
                                 <span className="text-base font-bold text-slate-900">30 Mins</span>
                             </div>
                             <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                 <div className="w-1/2 bg-purple-500 h-full rounded-full"></div>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Connected Devices */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm shadow-slate-200 border border-slate-100">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-slate-50 rounded-2xl text-slate-600">
                            <Wifi size={20} />
                        </div>
                        <h3 className="font-bold text-slate-900 text-lg">{t.connectedDevices}</h3>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        {[
                            { name: 'Main Gateway', id: 'GW-001', status: 'Online', battery: 100, signal: 'Strong' },
                            { name: 'Soil Sensor A', id: 'SN-A04', status: 'Online', battery: 84, signal: 'Good' },
                            { name: 'Soil Sensor B', id: 'SN-B02', status: 'Offline', battery: 0, signal: 'Lost' },
                            { name: 'Pump Controller', id: 'PC-001', status: 'Standby', battery: 100, signal: 'Strong' },
                        ].map((device) => (
                            <div key={device.id} className="flex items-center justify-between p-5 bg-[#FAFAF9] border border-slate-100 rounded-[1.5rem] hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-3 h-3 rounded-full shadow-sm ${device.status === 'Online' || device.status === 'Standby' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                    <div>
                                        <p className="font-bold text-sm text-slate-900">{device.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wide">{device.id}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {device.status !== 'Offline' && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-100">
                                            <Battery size={12} className={device.battery < 20 ? 'text-red-500' : 'text-slate-400'} />
                                            {device.battery}%
                                        </div>
                                    )}
                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                        device.status === 'Offline' 
                                        ? 'bg-red-100 text-red-600' 
                                        : device.status === 'Standby'
                                        ? 'bg-amber-100 text-amber-600'
                                        : 'bg-emerald-100 text-emerald-600'
                                    }`}>
                                        {device.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};