import React, { useState } from 'react';
import { 
  LayoutDashboard, Sprout, Bug, MessageSquare, Calendar, Video, 
  BookOpen, Filter, CheckCircle2, XCircle, AlertTriangle, 
  ChevronRight, FileText, ClipboardList, Map as MapIcon, 
  TrendingUp, Send, Phone, User, Clock, ArrowRight, MoreHorizontal
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area 
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Language, translations } from '../utils/translations';

// --- MOCK DATA ---
const assignedFarms = [
  { id: 'F-001', name: 'Kigali Maize Co-op', location: 'Rwamagana', status: 'Critical', lastUpdate: '10m ago', moisture: 28, crop: 'Maize' },
  { id: 'F-002', name: 'Sunrise Beans', location: 'Kayonza', status: 'Healthy', lastUpdate: '1h ago', moisture: 45, crop: 'Beans' },
  { id: 'F-003', name: 'Green Valley', location: 'Rwamagana', status: 'Warning', lastUpdate: '2h ago', moisture: 35, crop: 'Maize' },
  { id: 'F-005', name: 'Hillside Organic', location: 'Musanze', status: 'Healthy', lastUpdate: '4h ago', moisture: 52, crop: 'Potatoes' },
];

const consultationRequests = [
  { id: 1, farmer: 'Jean Claude', topic: 'Yellowing leaves', time: '10:30 AM', type: 'Chat', status: 'Unread', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' },
  { id: 2, farmer: 'Grace M.', topic: 'Irrigation planning', time: 'Yesterday', type: 'Video', status: 'Scheduled', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka' },
  { id: 3, farmer: 'Patrick N.', topic: 'Pest identification', time: '2 days ago', type: 'Chat', status: 'Resolved', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jude' },
];

const performanceData = [
  { month: 'Jan', verified: 45, impact: 85 },
  { month: 'Feb', verified: 52, impact: 88 },
  { month: 'Mar', verified: 48, impact: 87 },
  { month: 'Apr', verified: 60, impact: 92 },
  { month: 'May', verified: 55, impact: 90 },
  { month: 'Jun', verified: 65, impact: 95 },
];

const sensorHistoryData = Array.from({ length: 14 }, (_, i) => ({
    day: `Day ${i + 1}`,
    moisture: Math.floor(Math.random() * 30) + 30,
    nitrogen: Math.floor(Math.random() * 40 + 40),
}));

const pestVerifications = [
    { id: 1, pest: 'Fall Armyworm', confidence: 94, img: 'https://images.unsplash.com/photo-1625246333195-f4d9ebe43a7d?q=80&w=200&auto=format&fit=crop', location: 'Sector A' },
    { id: 2, pest: 'Maize Stalk Borer', confidence: 82, img: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?q=80&w=200&auto=format&fit=crop', location: 'Sector B' },
    { id: 3, pest: 'Aphids', confidence: 78, img: 'https://images.unsplash.com/photo-1551489186-cf8726f514f8?q=80&w=200&auto=format&fit=crop', location: 'Sector C' },
];

// Leaflet Icons
const createIcon = (color: string) => L.divIcon({
  className: 'bg-transparent',
  html: `<div class="text-${color}-500 drop-shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24]
});

interface ExpertDashboardProps {
    language?: Language;
}

export const ExpertDashboard: React.FC<ExpertDashboardProps> = ({ language = 'en' }) => {
    const [activeView, setActiveView] = useState('overview');
    const [selectedFarm, setSelectedFarm] = useState<string | null>(null);

    const menuItems = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'monitoring', label: 'Farm Monitoring', icon: Sprout },
        { id: 'pest', label: 'Pest Console', icon: Bug },
        { id: 'consultation', label: 'Consultations', icon: MessageSquare },
    ];

    // --- MODULES ---

    const OverviewModule = () => (
        <div className="space-y-6 animate-fade-in">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Assigned Farms', val: '12', icon: Sprout, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                    { label: 'Pending Reviews', val: '5', icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                    { label: 'Critical Alerts', val: '2', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
                    { label: 'Avg. Impact Score', val: '92%', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                        <div className={`p-4 rounded-2xl ${stat.bg}`}>
                            <stat.icon size={24} className={stat.color} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stat.val}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Performance Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
                    <h3 className="font-bold text-lg mb-6 text-slate-900 dark:text-white">Recommendation Success Rate</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={performanceData}>
                                <defs>
                                    <linearGradient id="colorImpact" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0F5132" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#0F5132" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Area type="monotone" dataKey="impact" stroke="#0F5132" strokeWidth={3} fillOpacity={1} fill="url(#colorImpact)" name="Yield Improvement" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activities */}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
                    <h3 className="font-bold text-lg mb-6 text-slate-900 dark:text-white">Recent Activity</h3>
                    <div className="space-y-6">
                        {[
                            { text: 'Verified Fall Armyworm in Sector A', time: '10m ago', type: 'pest' },
                            { text: 'Approved irrigation schedule for Farm F-002', time: '1h ago', type: 'rec' },
                            { text: 'Video call with Jean Claude', time: '3h ago', type: 'call' },
                            { text: 'Uploaded new Soil Health Guide', time: 'Yesterday', type: 'doc' },
                        ].map((act, i) => (
                            <div key={i} className="flex gap-4">
                                <div className={`mt-1 p-2 rounded-full h-fit flex-shrink-0 ${
                                    act.type === 'pest' ? 'bg-red-50 dark:bg-red-900/20 text-red-600' :
                                    act.type === 'rec' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' :
                                    act.type === 'call' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-600'
                                }`}>
                                    {act.type === 'pest' ? <Bug size={14} /> : act.type === 'rec' ? <CheckCircle2 size={14} /> : act.type === 'call' ? <Video size={14} /> : <FileText size={14} />}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{act.text}</p>
                                    <p className="text-xs text-slate-400 mt-1">{act.time}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    const FarmMonitoringModule = () => (
        <div className="space-y-6 animate-fade-in">
            {selectedFarm ? (
                // Detailed Farm Analysis View
                <div className="animate-slide-up">
                    <button onClick={() => setSelectedFarm(null)} className="flex items-center gap-2 text-sm font-bold text-slate-500 mb-4 hover:text-[#0F5132]">
                        <ChevronRight className="rotate-180" size={16} /> Back to List
                    </button>
                    
                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Main Analysis Panel */}
                        <div className="lg:col-span-2 space-y-8">
                            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Kigali Maize Co-op (F-001)</h2>
                                        <p className="text-slate-500 text-sm">Rwamagana • 2.5 Hectares • Maize</p>
                                    </div>
                                    <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold uppercase">Critical Moisture</span>
                                </div>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={sensorHistoryData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="moisture" stroke="#3b82f6" strokeWidth={3} dot={false} name="Moisture %" />
                                            <Line type="monotone" dataKey="nitrogen" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 5" name="Nitrogen (ppm)" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Recommendation Workflow */}
                            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
                                <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">AI Recommendation Review</h3>
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-800 mb-6">
                                    <div className="flex gap-4">
                                        <div className="bg-white dark:bg-slate-800 p-2 rounded-xl h-fit shadow-sm"><Sprout size={24} className="text-[#0F5132]" /></div>
                                        <div>
                                            <h4 className="font-bold text-[#0F5132] dark:text-emerald-400 text-lg">Trigger Emergency Irrigation</h4>
                                            <p className="text-slate-600 dark:text-slate-300 text-sm mt-1 mb-3">Soil moisture dropped to 28%. Rain probability is low (10%). Suggested duration: 45 mins.</p>
                                            <div className="flex gap-3">
                                                <button className="px-4 py-2 bg-[#0F5132] text-white rounded-xl text-sm font-bold hover:bg-[#0a3622]">Approve & Execute</button>
                                                <button className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-600">Modify</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Expert Notes */}
                        <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 h-fit">
                            <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Expert Notes</h3>
                            <textarea 
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-2xl p-4 text-sm mb-4 outline-none focus:border-[#0F5132] placeholder:text-slate-400"
                                rows={6}
                                placeholder="Add observations or specific instructions for the farmer..."
                            ></textarea>
                            <button className="w-full py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-bold text-sm">Save Note</button>
                            
                            <div className="mt-8">
                                <h4 className="font-bold text-sm text-slate-500 uppercase mb-3">History</h4>
                                <div className="space-y-4">
                                    <div className="text-xs text-slate-600 dark:text-slate-400 border-l-2 border-slate-300 pl-3">
                                        <p className="font-bold text-slate-900 dark:text-slate-200">Aug 12, 2024</p>
                                        <p>Advised to check nozzle pressure in Sector B due to uneven moisture distribution.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                // Farm List
                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Assigned Farms</h3>
                        <div className="flex gap-2">
                            <div className="relative">
                                <input type="text" placeholder="Search..." className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-10 py-2 text-sm outline-none w-64 text-slate-700 dark:text-slate-200" />
                            </div>
                            <button className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"><Filter size={18} className="text-slate-500" /></button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-bold uppercase tracking-wider text-xs">
                                <tr>
                                    <th className="px-6 py-4">Farm Name</th>
                                    <th className="px-6 py-4">Location</th>
                                    <th className="px-6 py-4">Moisture</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                {assignedFarms.map((farm) => (
                                    <tr key={farm.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group" onClick={() => setSelectedFarm(farm.id)}>
                                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white group-hover:text-[#0F5132] transition-colors">{farm.name}</td>
                                        <td className="px-6 py-4 text-slate-500">{farm.location}</td>
                                        <td className="px-6 py-4 font-mono font-bold text-slate-700 dark:text-slate-300">{farm.moisture}%</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                                farm.status === 'Critical' ? 'bg-red-100 text-red-600' :
                                                farm.status === 'Warning' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                                            }`}>
                                                {farm.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end">
                                                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-full transition-colors text-slate-400 hover:text-[#0F5132]"><ArrowRight size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );

    const PestConsoleModule = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="grid lg:grid-cols-2 gap-8">
                {/* Map View */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 h-[600px] relative overflow-hidden group z-0">
                    <div className="absolute top-6 left-6 z-20 flex gap-2">
                        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-xl shadow-sm font-bold text-xs flex items-center gap-2 text-slate-800 dark:text-white">
                            <MapIcon size={16} /> Regional Outbreak Heatmap
                        </div>
                    </div>
                    
                    <div className="h-full w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-600">
                        <MapContainer center={[-1.94, 30.43]} zoom={12} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            />
                            {/* Simulated Heatmap Zones */}
                            <Circle center={[-1.94, 30.43]} radius={1500} pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.3 }} />
                            <Marker position={[-1.94, 30.43]} icon={createIcon('red')}>
                                <Popup>Critical FAW Outbreak</Popup>
                            </Marker>

                            <Circle center={[-1.98, 30.48]} radius={1000} pathOptions={{ color: 'orange', fillColor: 'orange', fillOpacity: 0.3 }} />
                            <Marker position={[-1.98, 30.48]} icon={createIcon('orange')}>
                                <Popup>Warning: Aphid Activity</Popup>
                            </Marker>
                        </MapContainer>
                    </div>
                </div>

                {/* Verification List */}
                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col h-[600px]">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 rounded-t-[2.5rem]">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Pending Verifications</h3>
                        <p className="text-slate-500 text-sm">Validate AI detections to improve model accuracy.</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                        {pestVerifications.map((item) => (
                            <div key={item.id} className="p-4 bg-white dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600 rounded-2xl flex gap-4 transition-all hover:shadow-md">
                                <img src={item.img} className="w-24 h-24 rounded-xl object-cover bg-slate-200" alt={item.pest} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-bold text-slate-900 dark:text-white truncate pr-2">{item.pest}</h4>
                                        <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-600 px-2 py-1 rounded shadow-sm whitespace-nowrap">{item.confidence}% AI</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-3">{item.location}</p>
                                    
                                    <div className="flex gap-2 mb-3">
                                        <button className="flex-1 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors flex items-center justify-center gap-1 border border-emerald-100 dark:border-emerald-800">
                                            <CheckCircle2 size={14} /> Confirm
                                        </button>
                                        <button className="flex-1 py-1.5 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors flex items-center justify-center gap-1 border border-red-100 dark:border-red-800">
                                            <XCircle size={14} /> Reject
                                        </button>
                                    </div>
                                    <select className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs p-2 rounded-lg outline-none focus:border-[#0F5132]">
                                        <option value="">Select Treatment Strategy...</option>
                                        <option value="pesticide">Apply Pesticide (Rocket)</option>
                                        <option value="push-pull">Push-Pull Strategy</option>
                                        <option value="manual">Manual Removal</option>
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    const ConsultationModule = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="grid lg:grid-cols-3 gap-8">
                {/* Inbox List */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden h-[600px] flex flex-col">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Inquiries</h3>
                        <span className="bg-[#0F5132] text-white text-xs font-bold px-2 py-1 rounded-full">3</span>
                    </div>
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {consultationRequests.map((req) => (
                            <div key={req.id} className="p-5 border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group">
                                <div className="flex items-center gap-3 mb-2">
                                    <img src={req.avatar} alt={req.farmer} className="w-10 h-10 rounded-full bg-slate-200 border border-slate-100" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline">
                                            <span className="font-bold text-slate-900 dark:text-white truncate">{req.farmer}</span>
                                            <span className="text-[10px] text-slate-400 whitespace-nowrap">{req.time}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 truncate">Farm ID: F-00{req.id}</p>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-3 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                                    Topic: {req.topic}
                                </p>
                                <div className="flex gap-2">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${req.status === 'Unread' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                        {req.status}
                                    </span>
                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 ml-auto">
                                        {req.type === 'Video' ? <Video size={10} /> : <MessageSquare size={10} />} {req.type}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content Area (Chat/Schedule) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Active Chat/Details */}
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 h-[450px] flex flex-col">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-500 overflow-hidden">
                                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="JC" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white">Jean Claude</h4>
                                    <p className="text-xs text-slate-500">Rwamagana • Premium Plan</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button className="p-2.5 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-full text-slate-600 dark:text-slate-300 transition-colors"><Phone size={18} /></button>
                                <button className="p-2.5 bg-[#0F5132] hover:bg-[#0a3622] rounded-full text-white transition-colors shadow-lg shadow-emerald-200 dark:shadow-none"><Video size={18} /></button>
                                <button className="p-2.5 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-full text-slate-600 dark:text-slate-300 transition-colors ml-2"><MoreHorizontal size={18} /></button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 custom-scrollbar">
                            <div className="flex justify-center mb-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded-full">Today, 10:30 AM</span>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-8 h-8 bg-slate-200 rounded-full flex-shrink-0 overflow-hidden">
                                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" />
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-2xl rounded-tl-none text-sm text-slate-700 dark:text-slate-200 max-w-[80%]">
                                    Hello Expert, I noticed some yellowing on my lower maize leaves. Is this nitrogen deficiency? I have attached a photo.
                                </div>
                            </div>
                            <div className="flex gap-3 flex-row-reverse">
                                <div className="w-8 h-8 bg-[#0F5132] rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-md">Me</div>
                                <div className="bg-[#0F5132] text-white p-4 rounded-2xl rounded-tr-none text-sm max-w-[80%] shadow-md">
                                    Hello Jean! Based on your sensor data, nitrogen levels are indeed low (35ppm). Can you send a clearer photo of the leaf veins?
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <button className="p-3 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"><ClipboardList size={20} /></button>
                            <input type="text" placeholder="Type a message..." className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0F5132] transition-colors" />
                            <button className="p-3 bg-[#0F5132] text-white rounded-xl hover:bg-[#0a3622] transition-colors shadow-lg"><Send size={20} /></button>
                        </div>
                    </div>

                    {/* Schedule / Quick Actions */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700">
                            <h4 className="font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white"><Calendar size={18} /> Upcoming Visits</h4>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-sm p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                                    <div className="bg-white dark:bg-slate-600 px-2.5 py-1.5 rounded-lg text-center shadow-sm">
                                        <span className="block text-slate-400 uppercase text-[10px] font-bold">Aug</span>
                                        <span className="block text-slate-900 dark:text-white font-bold text-lg leading-none">14</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white">Farm Inspection</p>
                                        <p className="text-xs text-slate-500">Green Valley, Rwamagana</p>
                                    </div>
                                </div>
                            </div>
                            <button className="w-full mt-3 py-2 text-xs font-bold text-[#0F5132] dark:text-emerald-400 hover:underline">View Full Schedule</button>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700">
                            <h4 className="font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white"><BookOpen size={18} /> Knowledge Base</h4>
                            <button className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl text-slate-400 text-sm font-bold hover:border-[#0F5132] hover:text-[#0F5132] hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors mb-3 flex items-center justify-center gap-2">
                                <FileText size={16} /> Upload Resource
                            </button>
                            <p className="text-xs text-slate-400 text-center">Share guides directly with farmers.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderContent = () => {
        switch(activeView) {
            case 'overview': return <OverviewModule />;
            case 'monitoring': return <FarmMonitoringModule />;
            case 'pest': return <PestConsoleModule />;
            case 'consultation': return <ConsultationModule />;
            default: return <OverviewModule />;
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8 min-h-[800px] animate-fade-in font-sans">
            
            {/* Expert Sidebar Navigation */}
            <aside className="lg:w-64 flex-shrink-0">
                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 p-4 sticky top-24">
                    <div className="space-y-1">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveView(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm group ${
                                    activeView === item.id 
                                    ? 'bg-[#0F5132] text-white shadow-md shadow-emerald-200 dark:shadow-none' 
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <item.icon size={18} className={`transition-colors ${activeView === item.id ? 'text-white' : 'text-slate-400 group-hover:text-[#0F5132] dark:group-hover:text-white'}`} />
                                {item.label}
                                {activeView === item.id && <ChevronRight size={14} className="ml-auto opacity-50" />}
                            </button>
                        ))}
                    </div>
                    
                    <div className="mt-8 px-4 pt-6 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#0F5132] rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                                DR
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Dr. Ruzibiza</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Senior Agronomist</p>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight capitalize">
                            {menuItems.find(m => m.id === activeView)?.label}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                            Manage your assigned farms and provide expert guidance.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Live Data
                        </span>
                    </div>
                </div>
                {renderContent()}
            </div>
        </div>
    );
};