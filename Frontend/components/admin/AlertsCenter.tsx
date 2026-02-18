import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { alertHistory } from './mockData';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const AlertsCenter = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            <Card className="rounded-[2.5rem] border-muted">
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle>Active System Alerts</CardTitle>
                    <div className="flex gap-2">
                        <Badge variant="destructive" className="bg-red-100 text-red-600">2 Critical</Badge>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-600">5 Warnings</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {alertHistory.map((alert) => (
                        <div key={alert.id} className="flex items-start gap-4 p-4 border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-xl">
                            <div className={`mt-1 p-2 rounded-full ${alert.type === 'critical' ? 'bg-red-50 text-red-600' : alert.type === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                <AlertTriangle size={16} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between">
                                    <h4 className="font-bold text-sm">{alert.msg}</h4>
                                    <span className="text-xs text-muted-foreground">{alert.time}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Source: {alert.farm}</p>
                            </div>
                            <Button variant="ghost" className="text-xs font-bold text-muted-foreground hover:text-foreground uppercase h-auto p-2">Dismiss</Button>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
};
