import React from 'react';
import { FileText, Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';

export const ReportsView = () => {
    return (
        <Card className="rounded-[2.5rem] border-muted h-[600px] flex flex-col items-center justify-center text-center animate-fade-in">
            <CardContent className="flex flex-col items-center">
                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-6">
                    <FileText size={48} className="text-slate-300 dark:text-slate-500" />
                </div>
                <h3 className="text-2xl font-bold mb-2">System Reports</h3>
                <p className="text-muted-foreground max-w-sm mb-8">Generate detailed PDF reports for monthly yield, sensor performance, and user activity.</p>
                <div className="flex gap-4">
                    <Button className="font-bold flex items-center gap-2 px-6 py-6 h-auto">
                        <Download size={16} /> Download Monthly Summary
                    </Button>
                    <Button variant="secondary" className="font-bold px-6 py-6 h-auto">
                        Custom Range
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
