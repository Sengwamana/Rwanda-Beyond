import React from 'react';
import { Droplets } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { waterUsageData } from './mockData';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

export const IrrigationConfig = () => {
    return (
        <div className="space-y-6 animate-fade-in">
             <Card className="rounded-[2.5rem] border-muted">
                 <CardHeader>
                    <CardTitle>Water Usage Analytics</CardTitle>
                 </CardHeader>
                 <CardContent>
                     <div className="h-80 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={waterUsageData}>
                                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                 <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                                 <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                                 <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                                 <Bar dataKey="usage" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Actual Usage (L)" />
                                 <Bar dataKey="efficient" fill="#10b981" radius={[4, 4, 0, 0]} name="Efficient Target (L)" />
                             </BarChart>
                         </ResponsiveContainer>
                     </div>
                 </CardContent>
             </Card>
             
             <div className="grid md:grid-cols-2 gap-6">
                 <Card className="rounded-[2.5rem] border-muted">
                     <CardHeader>
                        <CardTitle>Irrigation Rules</CardTitle>
                     </CardHeader>
                     <CardContent className="space-y-4">
                         <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                             <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Disable during rain probability &gt; 60%</span>
                             <div className="w-10 h-5 bg-primary rounded-full relative cursor-pointer"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div></div>
                         </div>
                         <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                             <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Max daily duration per sector (45 mins)</span>
                             <div className="w-10 h-5 bg-primary rounded-full relative cursor-pointer"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div></div>
                         </div>
                     </CardContent>
                 </Card>
                 
                 <Card className="rounded-[2.5rem] border-muted flex flex-col justify-center items-center text-center">
                     <CardContent className="flex flex-col items-center justify-center h-full pt-8">
                        <Droplets size={48} className="text-blue-500 mb-4" />
                        <h3 className="text-xl font-bold mb-2">Emergency Stop</h3>
                        <p className="text-muted-foreground text-sm mb-6">Halt all pumps across all sectors immediately.</p>
                        <Button variant="destructive" className="px-8 py-6 rounded-xl font-bold shadow-lg shadow-red-200 dark:shadow-none">SHUT DOWN</Button>
                     </CardContent>
                 </Card>
             </div>
        </div>
    );
};
