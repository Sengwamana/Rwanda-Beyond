import React from 'react';
import { Sprout, Activity, AlertTriangle, TrendingUp, Database, CloudLightning, BrainCircuit, CheckCircle2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { recentActivities } from './mockData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

// Fix for custom icon in separate file or here for now
const createMarkerIcon = (color: string) => L.divIcon({
  className: 'bg-transparent',
  html: `<div class="text-${color}-500 drop-shadow-xl hover:scale-110 transition-transform"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

export const Overview = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Farms', val: '142', icon: Sprout, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                    { label: 'Active Sensors', val: '894', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                    { label: 'Critical Alerts', val: '3', icon: AlertTriangle, color: 'text-destructive', bg: 'bg-red-50 dark:bg-red-900/20' },
                    { label: 'Avg. Efficiency', val: '87%', icon: TrendingUp, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
                ].map((stat, i) => (
                    <Card key={i} className="rounded-[2rem] border-muted">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className={`p-4 rounded-2xl ${stat.bg}`}>
                                <stat.icon size={24} className={stat.color} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                                <h3 className="text-2xl font-bold">{stat.val}</h3>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Geographic Map View - Updated to Leaflet */}
                <Card className="lg:col-span-2 rounded-[2.5rem] relative overflow-hidden h-[500px] z-0 p-0 border-muted">
                   <CardContent className="p-6 h-full"> 
                    <div className="absolute top-6 left-6 z-[400] flex gap-2">
                        <span className="bg-background/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold shadow-sm">Rwamagana District</span>
                        <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1"><div className="w-2 h-2 bg-white rounded-full animate-pulse"/> Live System Status</span>
                    </div>
                    
                    <div className="w-full h-full rounded-[2rem] overflow-hidden border">
                        <MapContainer center={[-1.94, 30.43]} zoom={11} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            />
                            {/* Farm A - Healthy */}
                            <Marker position={[-1.94, 30.43]} icon={createMarkerIcon('emerald')}>
                                <Popup>Farm A - Healthy</Popup>
                            </Marker>
                            {/* Farm B - Critical */}
                            <Marker position={[-1.98, 30.48]} icon={createMarkerIcon('red')}>
                                <Popup>Farm B - Critical Moisture</Popup>
                            </Marker>
                            {/* Farm C - Warning */}
                            <Marker position={[-1.91, 30.38]} icon={createMarkerIcon('amber')}>
                                <Popup>Farm C - Pest Alert</Popup>
                            </Marker>
                        </MapContainer>
                    </div>
                   </CardContent>
                </Card>

                <div className="space-y-6">
                    {/* System Health Pulse */}
                    <Card className="rounded-[2.5rem] border-muted">
                        <CardHeader>
                            <CardTitle>System Health</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Database size={20} className="text-emerald-600" />
                                    <div>
                                        <p className="text-sm font-bold">Database</p>
                                        <p className="text-xs text-emerald-600 font-bold">Operational</p>
                                    </div>
                                </div>
                                <CheckCircle2 size={18} className="text-emerald-500" />
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <CloudLightning size={20} className="text-emerald-600" />
                                    <div>
                                        <p className="text-sm font-bold">LoRaWAN Gateway</p>
                                        <p className="text-xs text-emerald-600 font-bold">99.9% Uptime</p>
                                    </div>
                                </div>
                                <CheckCircle2 size={18} className="text-emerald-500" />
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <BrainCircuit size={20} className="text-amber-600" />
                                    <div>
                                        <p className="text-sm font-bold">AI Models</p>
                                        <p className="text-xs text-amber-600 font-bold">Retraining Queued</p>
                                    </div>
                                </div>
                                <Activity size={18} className="text-amber-500 animate-pulse" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Activities Feed */}
                    <Card className="rounded-[2.5rem] flex flex-col flex-1 border-muted">
                        <CardHeader>
                            <CardTitle>Recent Activity</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 overflow-y-auto max-h-[200px] custom-scrollbar pr-2">
                            {recentActivities.map((act) => (
                                <div key={act.id} className="flex gap-3">
                                    <div className={`p-2 rounded-xl h-fit ${act.bg} ${act.color}`}>
                                        <act.icon size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">{act.action}</p>
                                        <p className="text-xs text-muted-foreground">{act.user} • {act.time}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
