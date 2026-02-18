import React from 'react';
import { Smartphone, Edit2, BrainCircuit, RefreshCw, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';

export const SystemConfiguration = () => {
    return (
        <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
            <div className="space-y-8">
                {/* Global Thresholds */}
                <Card className="rounded-[2.5rem] border-muted">
                    <CardHeader>
                        <CardTitle>Global Thresholds</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Critical Moisture %</label>
                            <input type="range" className="w-full accent-primary" />
                            <div className="flex justify-between text-xs text-muted-foreground font-bold mt-1">
                                <span>10%</span>
                                <span>30% (Current)</span>
                                <span>60%</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">AI Confidence Floor</label>
                            <input type="range" className="w-full accent-primary" />
                            <div className="flex justify-between text-xs text-muted-foreground font-bold mt-1">
                                <span>50%</span>
                                <span>85% (Current)</span>
                                <span>99%</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* USSD Config */}
                <Card className="rounded-[2.5rem] border-muted">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                             <Smartphone size={20} /> USSD Menu Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-muted/50 p-4 rounded-xl font-mono text-sm border mb-4">
                            <p className="text-muted-foreground mb-2">Code: *775#</p>
                            <ul className="space-y-1">
                                <li>1. Check Moisture</li>
                                <li>2. Weather Forecast</li>
                                <li>3. Market Prices</li>
                                <li>4. Contact Support</li>
                            </ul>
                        </div>
                        <Button variant="outline" className="w-full justify-center gap-2 font-bold">
                            <Edit2 size={14} /> Edit Flow
                        </Button>
                    </CardContent>
                </Card>
            </div>
            
            <div className="space-y-8">
                {/* System Toggles */}
                 <Card className="rounded-[2.5rem] border-muted">
                    <CardHeader>
                        <CardTitle>System Modules</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="font-medium">USSD Gateway</span>
                             <div className="w-10 h-5 bg-primary rounded-full relative cursor-pointer"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div></div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-medium">SMS Notifications</span>
                            <div className="w-10 h-5 bg-primary rounded-full relative cursor-pointer"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div></div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-medium">Maintenance Mode</span>
                             <div className="w-10 h-5 bg-muted rounded-full relative cursor-pointer"><div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div></div>
                        </div>
                    </CardContent>
                </Card>

                {/* AI Model Management (New) */}
                <Card className="rounded-[2.5rem] border-muted">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BrainCircuit size={20} /> AI Model Config
                        </CardTitle>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Active Model</label>
                            <select className="w-full bg-muted/30 border rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-primary">
                                <option value="gemini-3-flash">Gemini 3 Flash (Speed Priority)</option>
                                <option value="gemini-3-pro">Gemini 3 Pro (Reasoning Priority)</option>
                                <option value="gemini-2.5">Gemini 2.5 (Legacy)</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl">
                            <div>
                                <p className="font-bold text-sm">Auto-Retraining</p>
                                <p className="text-xs text-muted-foreground">Weekly calibration with new soil data</p>
                            </div>
                            <div className="w-10 h-5 bg-primary rounded-full relative cursor-pointer"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div></div>
                        </div>

                        <div className="flex gap-2">
                            <Button className="flex-1 justify-center gap-2 font-bold">
                                <RefreshCw size={14} /> Update Model
                            </Button>
                            <Button variant="outline" className="justify-center font-bold">
                                <FileText size={16} /> Logs
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
