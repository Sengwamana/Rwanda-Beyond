import React from 'react';
import { nutrientData } from './mockData';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const FertilizationManagement = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid md:grid-cols-2 gap-8">
                <Card className="rounded-[2.5rem] border-muted">
                    <CardHeader>
                        <CardTitle>Regional NPK Averages</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {nutrientData.map((item) => (
                            <div key={item.name}>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.name} Level</span>
                                    <span className="text-sm font-bold">{item.value} ppm</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${item.value < 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                        style={{ width: `${item.value}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-muted">
                    <CardHeader>
                        <CardTitle>Fertilizer Inventory (Co-op)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            { name: 'UREA (46-0-0)', stock: '450 kg', status: 'High' },
                            { name: 'DAP (18-46-0)', stock: '120 kg', status: 'Low' },
                            { name: 'NPK 17-17-17', stock: '850 kg', status: 'High' },
                        ].map((item, i) => (
                            <div key={i} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                                <div>
                                    <p className="font-bold text-sm">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">Stock: {item.stock}</p>
                                </div>
                                <Badge variant={item.status === 'High' ? 'default' : 'secondary'} className={item.status === 'High' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                                    {item.status}
                                </Badge>
                            </div>
                        ))}
                        <Button className="w-full mt-2" variant="secondary">Request Restock</Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
