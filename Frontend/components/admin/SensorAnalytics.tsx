import React from 'react';
import { Download, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { sensorHistoryData } from './mockData';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

export const SensorAnalytics = () => {
    return (
        <div className="space-y-6 animate-fade-in">
             <Card className="rounded-[2.5rem] border-muted">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Sensor Health Overview</CardTitle>
                     <Button variant="secondary" className="gap-2 font-bold">
                        <Download size={16} /> Export Data
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={sensorHistoryData}>
                                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Line type="monotone" dataKey="moisture" stroke="#3b82f6" strokeWidth={3} dot={false} name="Avg Moisture" />
                                <Line type="monotone" dataKey="temp" stroke="#f59e0b" strokeWidth={3} dot={false} name="Avg Temp" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
             <div className="grid md:grid-cols-2 gap-6">
                <Card className="rounded-[2.5rem] border-muted">
                     <CardHeader>
                        <CardTitle>Sensor Status</CardTitle>
                     </CardHeader>
                     <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-muted-foreground">Online</span>
                            <span className="font-bold text-emerald-600">850 Nodes</span>
                        </div>
                         <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full w-[95%]"></div>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-muted-foreground">Maintenance Required</span>
                             <span className="font-bold text-amber-600">32 Nodes</span>
                        </div>
                         <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                            <div className="bg-amber-500 h-full w-[4%]"></div>
                        </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-muted-foreground">Offline</span>
                             <span className="font-bold text-destructive">12 Nodes</span>
                        </div>
                         <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                            <div className="bg-destructive h-full w-[1%]"></div>
                        </div>
                     </CardContent>
                </Card>
                 <Card className="rounded-[2.5rem] border-muted">
                     <CardHeader>
                        <CardTitle>Calibration Requests</CardTitle>
                     </CardHeader>
                     <CardContent>
                         <div className="flex flex-col items-center justify-center h-48 text-center">
                             <Activity size={48} className="text-muted mb-4" />
                             <p className="text-muted-foreground">All sensors are calibrated.</p>
                         </div>
                     </CardContent>
                </Card>
            </div>
        </div>
    );
};
