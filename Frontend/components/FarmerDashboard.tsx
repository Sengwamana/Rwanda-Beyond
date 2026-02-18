import React, { useState } from 'react';
import { 
  Sprout, Droplets, Bug, Zap, UploadCloud, ArrowRight, Bell, 
  CheckCircle2, Sun, MapPin, RefreshCw, X, Cloud, Sparkles, 
  Loader2, MessageSquare, Calendar, ChevronRight, User, 
  Settings, Phone, HelpCircle, BarChart3, AlertTriangle, 
  Thermometer, Wind, Camera, Leaf, Beaker, FileText, Send, CloudRain,
  ChevronLeft, LogOut, Navigation, Menu
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Language, translations } from '../utils/translations';
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY || '';

// Custom Marker Icon for Leaflet
const farmIcon = L.divIcon({
  className: 'bg-transparent',
  html: `<div class="text-[#0F5132] drop-shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// --- MOCK DATA ---
const weatherForecast = [
  { day: 'Mon', temp: 28, icon: Sun },
  { day: 'Tue', temp: 26, icon: Cloud },
  { day: 'Wed', temp: 24, icon: CloudRain },
  { day: 'Thu', temp: 29, icon: Sun },
  { day: 'Fri', temp: 27, icon: Cloud },
  { day: 'Sat', temp: 25, icon: Sun },
  { day: 'Sun', temp: 26, icon: Sun },
];

const waterUsageData = [
  { name: 'Jan', amount: 4500 },
  { name: 'Feb', amount: 5200 },
  { name: 'Mar', amount: 3800 },
  { name: 'Apr', amount: 4100 },
  { name: 'May', amount: 4800 },
  { name: 'Jun', amount: 5000 },
];

interface FarmerDashboardProps {
  onNavigate: (tab: string) => void;
  language?: Language;
}

export const FarmerDashboard: React.FC<FarmerDashboardProps> = ({ onNavigate, language = 'en' }) => {
  const [activeView, setActiveView] = useState('home');
  const t = translations[language].farmerDash; 

  // --- STATE ---
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Check Maize Block A', done: false },
    { id: 2, text: 'Apply Fertilizer (NPK)', done: false },
    { id: 3, text: 'Clean Sensor Nodes', done: true },
  ]);
  
  const [irrigationRequestStatus, setIrrigationRequestStatus] = useState<'idle' | 'pending' | 'approved'>('idle');

  // --- SUB-COMPONENTS ---

  // A. MY FARM DASHBOARD (HOME)
  const FarmOverview = () => (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Welcome & Weather Header */}
      <div className="bg-[#0F5132] text-white p-6 rounded-[2rem] shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">Rwamagana, Rwanda</p>
              <h2 className="text-3xl font-bold">Mwaramutse, Jean</h2>
            </div>
            <div className="bg-white/20 backdrop-blur-md p-2 rounded-full">
              <Sun className="text-yellow-300" size={24} />
            </div>
          </div>
          
          <div className="flex items-end gap-2 mb-6">
            <span className="text-5xl font-bold">26°</span>
            <span className="text-lg font-medium text-emerald-100 mb-1">Partly Cloudy</span>
          </div>

          {/* 7-Day Forecast Scroll */}
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {weatherForecast.map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-1 min-w-[50px]">
                <span className="text-xs text-emerald-200">{day.day}</span>
                <day.icon size={18} className="text-white" />
                <span className="text-sm font-bold">{day.temp}°</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Decor */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      </div>

      {/* Conditions Gauges */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Moisture', val: '45%', icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Temp', val: '24°C', icon: Thermometer, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          { label: 'Humidity', val: '62%', icon: Wind, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800' },
        ].map((item, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center shadow-sm">
            <div className={`p-2 rounded-full ${item.bg} ${item.color} mb-2`}>
              <item.icon size={18} />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">{item.val}</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Today's Tasks */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
        <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white flex items-center gap-2">
          <CheckCircle2 size={20} className="text-[#0F5132]" /> Today's Tasks
        </h3>
        <div className="space-y-3">
          {tasks.map((task) => (
            <div 
              key={task.id} 
              onClick={() => setTasks(tasks.map(t => t.id === task.id ? {...t, done: !t.done} : t))}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${task.done ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${task.done ? 'bg-[#0F5132] border-[#0F5132]' : 'border-slate-300 dark:border-slate-600'}`}>
                {task.done && <CheckCircle2 size={14} className="text-white" />}
              </div>
              <span className={`text-sm font-medium ${task.done ? 'text-emerald-800 dark:text-emerald-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>{task.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Active Alerts */}
      <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-[2rem] border border-red-100 dark:border-red-900/50">
        <h3 className="font-bold text-lg mb-4 text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle size={20} /> Active Alerts
        </h3>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-red-100 dark:border-red-900/30 flex gap-3">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center text-red-600 flex-shrink-0">
            <Bug size={20} />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Pest Risk</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Fall Armyworm detected in neighboring farm. Inspect your maize today.</p>
            <button onClick={() => setActiveView('pest')} className="mt-2 text-xs font-bold text-red-600 uppercase tracking-wide hover:underline">Check Pest Monitor</button>
          </div>
        </div>
      </div>
    </div>
  );

  // B. IRRIGATION STATUS
  const IrrigationView = () => (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Timer Card */}
      <div className="bg-blue-600 text-white p-8 rounded-[2.5rem] shadow-lg text-center relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-blue-100 text-sm font-bold uppercase tracking-wider mb-2">Next Scheduled Irrigation</p>
          <h2 className="text-5xl font-bold mb-2">04:30</h2>
          <p className="text-blue-200 text-sm">Hours : Minutes</p>
          
          <div className="mt-8 flex justify-center">
             {irrigationRequestStatus === 'idle' ? (
                <button 
                  onClick={() => setIrrigationRequestStatus('pending')}
                  className="bg-white text-blue-600 px-6 py-3 rounded-full font-bold text-sm hover:bg-blue-50 transition-colors shadow-lg flex items-center gap-2"
                >
                  <Droplets size={18} /> Request Water Now
                </button>
             ) : irrigationRequestStatus === 'pending' ? (
                <button disabled className="bg-blue-500 text-white border border-blue-400 px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 cursor-wait">
                  <Loader2 size={18} className="animate-spin" /> Pending Approval...
                </button>
             ) : (
                <button className="bg-emerald-500 text-white px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2">
                  <CheckCircle2 size={18} /> Approved
                </button>
             )}
          </div>
        </div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500 rounded-full blur-3xl opacity-50"></div>
      </div>

      {/* Usage Graph */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
        <h3 className="font-bold text-lg mb-6 text-slate-900 dark:text-white">Monthly Water Usage</h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterUsageData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px'}} />
              <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} name="Liters" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* History */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
        <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Recent Events</h3>
        <div className="space-y-4">
          {[
            { date: 'Yesterday', amount: '450L', status: 'Completed' },
            { date: 'Aug 12', amount: '500L', status: 'Completed' },
            { date: 'Aug 10', amount: 'Skipped', status: 'Rain Detected' },
          ].map((event, i) => (
            <div key={i} className="flex justify-between items-center text-sm border-b border-slate-50 dark:border-slate-700 pb-2 last:border-0 last:pb-0">
              <span className="text-slate-500">{event.date}</span>
              <div className="text-right">
                <p className="font-bold text-slate-900 dark:text-white">{event.amount}</p>
                <p className="text-[10px] text-emerald-600">{event.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // C. PEST MONITORING
  const PestView = () => (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] text-center relative overflow-hidden">
        <Camera size={48} className="mx-auto mb-4 text-emerald-400" />
        <h2 className="text-2xl font-bold mb-2">Scan for Pests</h2>
        <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">Take a photo of a leaf to detect Fall Armyworm or other pests instantly.</p>
        <button className="bg-[#0F5132] text-white w-full py-4 rounded-xl font-bold shadow-lg hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2">
          <Camera size={20} /> Open Camera
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-red-100 text-red-600 p-2 rounded-lg"><Bug size={20} /></div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Latest Detection</h3>
            <p className="text-xs text-slate-500">Today, 10:30 AM</p>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl mb-4 flex gap-4">
           <img src="https://images.unsplash.com/photo-1625246333195-f4d9ebe43a7d?q=80&w=150&auto=format&fit=crop" className="w-16 h-16 rounded-lg object-cover" />
           <div>
             <p className="font-bold text-red-600">Fall Armyworm</p>
             <p className="text-xs text-slate-500 mb-1">Confidence: 94%</p>
             <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded">High Severity</span>
           </div>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
          <h4 className="font-bold text-[#0F5132] dark:text-emerald-400 text-sm mb-2">Treatment Advice</h4>
          <ul className="text-xs text-emerald-800 dark:text-emerald-300 space-y-1 list-disc pl-4">
            <li>Apply "Rocket" pesticide immediately.</li>
            <li>Spray in the late afternoon.</li>
            <li>Monitor neighboring plants.</li>
          </ul>
        </div>
      </div>
    </div>
  );

  // D. FERTILIZATION GUIDE
  const FertilizationView = () => (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* NPK Visualizer */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm">
        <h3 className="font-bold text-lg mb-6 text-slate-900 dark:text-white flex items-center gap-2">
          <Beaker size={20} className="text-[#0F5132]" /> Soil Health (NPK)
        </h3>
        <div className="grid grid-cols-3 gap-6 text-center">
          {[
            { label: 'N', val: 40, max: 100, color: 'bg-amber-400' },
            { label: 'P', val: 80, max: 100, color: 'bg-emerald-500' },
            { label: 'K', val: 75, max: 100, color: 'bg-emerald-500' },
          ].map((nut, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-32 w-4 bg-slate-100 dark:bg-slate-700 rounded-full relative overflow-hidden">
                <div 
                  className={`absolute bottom-0 w-full ${nut.color} transition-all duration-1000`} 
                  style={{ height: `${nut.val}%` }}
                ></div>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">{nut.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
          <span className="font-bold">Insight:</span> Nitrogen levels are low. Consider applying Urea.
        </div>
      </div>

      {/* Schedule Card */}
      <div className="bg-[#0F5132] text-white p-6 rounded-[2rem] shadow-lg flex justify-between items-center">
        <div>
          <p className="text-emerald-200 text-xs font-bold uppercase tracking-wider">Next Application</p>
          <h3 className="text-2xl font-bold mt-1">Aug 24</h3>
          <p className="text-sm mt-1">NPK 17-17-17</p>
        </div>
        <Calendar size={40} className="text-emerald-300 opacity-50" />
      </div>

      {/* Instructions */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
        <h3 className="font-bold text-slate-900 dark:text-white mb-4">Application Guide</h3>
        <div className="space-y-4">
          <div className="flex gap-4 items-start">
            <div className="bg-emerald-100 text-[#0F5132] w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">1</div>
            <p className="text-sm text-slate-600 dark:text-slate-300">Mix 50kg of Urea per hectare.</p>
          </div>
          <div className="flex gap-4 items-start">
            <div className="bg-emerald-100 text-[#0F5132] w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">2</div>
            <p className="text-sm text-slate-600 dark:text-slate-300">Apply at the base of the maize plant, not on the leaves.</p>
          </div>
          <div className="flex gap-4 items-start">
            <div className="bg-emerald-100 text-[#0F5132] w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">3</div>
            <p className="text-sm text-slate-600 dark:text-slate-300">Water immediately after application if no rain is forecast.</p>
          </div>
        </div>
      </div>
    </div>
  );

  // E. RECOMMENDATIONS
  const RecommendationsView = () => (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
        <button className="flex-1 py-2 rounded-lg bg-white dark:bg-slate-600 shadow-sm text-sm font-bold text-slate-900 dark:text-white">Inbox</button>
        <button className="flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 dark:text-slate-400">Expert Advice</button>
      </div>

      <div className="space-y-4">
        {[
          { sender: 'System', title: 'Weekly Summary', time: '2h ago', icon: FileText, color: 'bg-blue-100 text-blue-600' },
          { sender: 'Dr. Ruzibiza', title: 'Re: Yellowing Leaves', time: 'Yesterday', icon: MessageSquare, color: 'bg-purple-100 text-purple-600' },
          { sender: 'System', title: 'Rain Alert: Heavy Rain Expected', time: '2 days ago', icon: CloudRain, color: 'bg-slate-100 text-slate-600' },
        ].map((msg, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <div className={`p-3 rounded-full ${msg.color}`}>
              <msg.icon size={20} />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">{msg.title}</h4>
              <p className="text-xs text-slate-500">{msg.sender}</p>
            </div>
            <span className="text-[10px] font-bold text-slate-400">{msg.time}</span>
          </div>
        ))}
      </div>

      <div className="bg-[#FAFAF9] dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800">
        <h3 className="font-bold text-slate-900 dark:text-white mb-4">Common Questions</h3>
        <div className="space-y-3">
          <details className="group">
            <summary className="flex justify-between items-center font-medium cursor-pointer list-none text-sm text-slate-700 dark:text-slate-300">
              How do I use the sensors?
              <span className="transition group-open:rotate-180">
                <ChevronRight size={16} />
              </span>
            </summary>
            <p className="text-xs text-slate-500 mt-2 group-open:animate-fade-in">
              Simply place the probe into the soil up to the marked line. Ensure the solar panel faces the sun.
            </p>
          </details>
          <div className="h-px bg-slate-200 dark:bg-slate-700"></div>
          <details className="group">
            <summary className="flex justify-between items-center font-medium cursor-pointer list-none text-sm text-slate-700 dark:text-slate-300">
              What if I lose internet?
              <span className="transition group-open:rotate-180">
                <ChevronRight size={16} />
              </span>
            </summary>
            <p className="text-xs text-slate-500 mt-2 group-open:animate-fade-in">
              You can dial *775# to access critical alerts and simplified data via USSD.
            </p>
          </details>
        </div>
      </div>
    </div>
  );

  // F. PROFILE
  const ProfileView = () => (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm text-center">
        <div className="w-24 h-24 bg-slate-200 rounded-full mx-auto mb-4 overflow-hidden">
           <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Profile" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Jean Claude</h2>
        <p className="text-sm text-slate-500">Rwamagana, Sector 4</p>
        <div className="flex justify-center gap-2 mt-4">
           <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">Pro Plan</span>
           <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">2.5 Ha</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Farm Location Map (Geographic View - Leaflet) */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden h-64 relative z-0">
           <div className="flex justify-between items-center mb-4 relative z-10">
               <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">Farm Location</h3>
               <button className="flex items-center gap-1 text-xs font-bold text-[#0F5132]"><Navigation size={12} /> Directions</button>
           </div>
           <div className="h-full rounded-2xl overflow-hidden relative border border-slate-200 dark:border-slate-700">
               <MapContainer 
                  center={[-1.94, 30.43]} 
                  zoom={13} 
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
               >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <Marker position={[-1.94, 30.43]} icon={farmIcon}>
                    <Popup>Your Farm <br/> Rwamagana Sector 4</Popup>
                  </Marker>
               </MapContainer>
           </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
           <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Farm Details</h3>
           <div className="space-y-3">
             <div className="flex justify-between items-center text-sm border-b border-slate-50 dark:border-slate-700 pb-2">
               <span className="text-slate-500">Location</span>
               <span className="font-bold text-slate-900 dark:text-white">Rwamagana</span>
             </div>
             <div className="flex justify-between items-center text-sm border-b border-slate-50 dark:border-slate-700 pb-2">
               <span className="text-slate-500">Size</span>
               <span className="font-bold text-slate-900 dark:text-white">2.5 Hectares</span>
             </div>
             <div className="flex justify-between items-center text-sm">
               <span className="text-slate-500">Primary Crop</span>
               <span className="font-bold text-emerald-600">Maize (Hybrid)</span>
             </div>
           </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
           <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Contact Info</h3>
           <div className="space-y-4">
             <div>
               <label className="text-xs text-slate-400 font-bold block mb-1">Phone Number</label>
               <input type="text" defaultValue="+250 788 123 456" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-2 text-sm font-bold text-slate-700 dark:text-white" />
             </div>
             <div>
               <label className="text-xs text-slate-400 font-bold block mb-1">Email (Optional)</label>
               <input type="text" defaultValue="jean@farm.rw" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-2 text-sm font-bold text-slate-700 dark:text-white" />
             </div>
           </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
           <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Preferences</h3>
           <div className="flex justify-between items-center mb-4">
             <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Receive SMS Alerts</span>
             <div className="w-10 h-5 bg-[#0F5132] rounded-full relative"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div></div>
           </div>
           <div className="flex justify-between items-center">
             <span className="text-sm font-medium text-slate-700 dark:text-slate-300">USSD Daily Summary</span>
             <div className="w-10 h-5 bg-slate-200 rounded-full relative"><div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div></div>
           </div>
        </div>

        <button className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
           <Phone size={18} /> Contact Extension Officer
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch(activeView) {
      case 'home': return <FarmOverview />;
      case 'irrigation': return <IrrigationView />;
      case 'pest': return <PestView />;
      case 'fertilizer': return <FertilizationView />;
      case 'recommendations': return <RecommendationsView />;
      case 'profile': return <ProfileView />;
      default: return <FarmOverview />;
    }
  };

  // Internal Navigation Bar
  const BottomNav = () => (
    <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe pt-2 px-6 flex justify-between items-center md:hidden z-40 h-20 shadow-up">
        {[
          { id: 'home', icon: Sprout, label: 'Home' },
          { id: 'irrigation', icon: Droplets, label: 'Water' },
          { id: 'pest', icon: Bug, label: 'Pest' },
          { id: 'fertilizer', icon: Beaker, label: 'Soil' },
          { id: 'recommendations', icon: MessageSquare, label: 'Inbox' },
          { id: 'profile', icon: User, label: 'Profile' },
        ].map((item) => (
          <button 
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeView === item.id ? 'text-[#0F5132] dark:text-emerald-400' : 'text-slate-400'}`}
          >
            <item.icon size={20} strokeWidth={activeView === item.id ? 2.5 : 2} />
            <span className="text-[10px] font-bold">{item.label}</span>
          </button>
        ))}
    </div>
  );

  // Desktop Side/Top Nav simplified for this view
  const DesktopNav = () => (
    <div className="hidden md:flex gap-2 mb-8 bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 w-fit mx-auto">
        {[
          { id: 'home', icon: Sprout, label: 'Dashboard' },
          { id: 'irrigation', icon: Droplets, label: 'Irrigation' },
          { id: 'pest', icon: Bug, label: 'Pest Monitor' },
          { id: 'fertilizer', icon: Beaker, label: 'Fertilizer' },
          { id: 'recommendations', icon: MessageSquare, label: 'Inbox' },
          { id: 'profile', icon: User, label: 'Profile' },
        ].map((item) => (
          <button 
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeView === item.id 
                ? 'bg-[#0F5132] text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
    </div>
  );

  return (
    <div className="pb-20 md:pb-0 font-sans min-h-[80vh]">
      <DesktopNav />
      
      <div className="max-w-xl mx-auto md:max-w-4xl">
         {/* Simple Breadcrumb for context */}
         {activeView !== 'home' && (
             <button 
                onClick={() => setActiveView('home')} 
                className="flex items-center gap-1 text-xs font-bold text-slate-400 mb-4 hover:text-[#0F5132] md:hidden"
             >
                 <ChevronLeft size={14} /> Back to Dashboard
             </button>
         )}
         
         {renderContent()}
      </div>

      <BottomNav />
    </div>
  );
};