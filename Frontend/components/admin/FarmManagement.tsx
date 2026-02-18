import React, { useState } from 'react';
import { 
    Search, Filter, Plus, FileText, Settings, X, Radio, 
    Activity, Trash2, ChevronRight, Edit2 
} from 'lucide-react';
import { farmList } from './mockData';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const FarmManagement = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
    const [isFarmModalOpen, setIsFarmModalOpen] = useState(false);
    const [editingFarm, setEditingFarm] = useState<any>(null); // If null, it's 'Add Mode'
    const [showSensorConfigModal, setShowSensorConfigModal] = useState(false);

    return (
        <div className="space-y-6 animate-fade-in relative">
            {/* Add/Edit Farm Modal */}
            {isFarmModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-lg shadow-2xl animate-scale-in rounded-[2.5rem]">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{editingFarm ? 'Edit Farm Details' : 'Register New Farm'}</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setIsFarmModalOpen(false)}>
                                <X size={20} />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Input 
                                placeholder="Farm Name" 
                                defaultValue={editingFarm?.name || ''}
                            />
                            <Input 
                                placeholder="Owner Name" 
                                defaultValue={editingFarm?.owner || ''}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    placeholder="Location (Sector)" 
                                    defaultValue={editingFarm?.location || ''}
                                />
                                <Input 
                                    placeholder="Size (Hectares)" 
                                    defaultValue={editingFarm?.size || ''}
                                />
                            </div>
                            <div className="pt-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Status</label>
                                <select 
                                    defaultValue={editingFarm?.status || 'Active'}
                                    className="w-full bg-muted/30 border rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-primary"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Warning">Warning</option>
                                    <option value="Offline">Offline</option>
                                    <option value="Suspended">Suspended</option>
                                </select>
                            </div>
                            <Button className="w-full font-bold mt-4" onClick={() => setIsFarmModalOpen(false)}>
                                {editingFarm ? 'Save Changes' : 'Register Farm'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Sensor Config Modal */}
            {showSensorConfigModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-2xl shadow-2xl animate-scale-in rounded-[2.5rem]">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Sensor Configuration - F-001</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setShowSensorConfigModal(false)}>
                                <X size={20} />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="bg-muted/50 p-4 rounded-2xl border flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Radio size={20} className="text-primary" />
                                    <div>
                                        <p className="font-bold text-sm">LoRaWAN Gateway ID</p>
                                        <p className="text-xs text-muted-foreground font-mono">GW-RW-0442</p>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded">Online</span>
                            </div>
                            
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Assigned Nodes</h4>
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center gap-4 p-3 border rounded-xl hover:bg-muted/50 transition-colors">
                                        <Activity size={18} className="text-muted-foreground" />
                                        <input type="text" defaultValue={`Sensor Node 0${i}`} className="bg-transparent font-bold text-sm outline-none flex-1" />
                                        <select className="bg-muted text-xs font-bold p-2 rounded-lg outline-none border-none">
                                            <option>Soil Moisture</option>
                                            <option>NPK</option>
                                            <option>Weather</option>
                                        </select>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 size={16} /></Button>
                                    </div>
                                ))}
                                <Button variant="outline" className="w-full border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                                    + Assign New Node
                                </Button>
                            </div>
                            
                            <div className="flex justify-end pt-4">
                                <Button onClick={() => setShowSensorConfigModal(false)} className="font-bold">Save Configuration</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {selectedFarm ? (
                // Farm Detail View
                <div className="animate-slide-up">
                    <Button variant="ghost" onClick={() => setSelectedFarm(null)} className="gap-2 mb-4 pl-0 hover:bg-transparent hover:text-primary">
                        <ChevronRight className="rotate-180" size={16} /> Back to List
                    </Button>
                    <Card className="rounded-[2.5rem] border-muted">
                        <CardContent className="p-8">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-2xl font-bold">Kigali Maize Co-op</h2>
                                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Active</Badge>
                                    </div>
                                    <p className="text-muted-foreground text-sm">ID: F-001 • Rwamagana Sector 4</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" className="gap-2">
                                        <FileText size={16} /> History
                                    </Button>
                                    <Button className="gap-2" onClick={() => setShowSensorConfigModal(true)}>
                                        <Settings size={16} /> Configure Sensors
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="bg-muted/30 p-5 rounded-2xl">
                                    <p className="text-xs font-bold text-muted-foreground uppercase">Soil Moisture</p>
                                    <p className="text-3xl font-bold mt-2">42%</p>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
                                        <div className="bg-blue-500 w-[42%] h-full"></div>
                                    </div>
                                </div>
                                <div className="bg-muted/30 p-5 rounded-2xl">
                                    <p className="text-xs font-bold text-muted-foreground uppercase">Last Irrigation</p>
                                    <p className="text-xl font-bold mt-2">Today, 06:00 AM</p>
                                    <p className="text-xs text-muted-foreground mt-1">Duration: 45 mins</p>
                                </div>
                                <div className="bg-muted/30 p-5 rounded-2xl">
                                    <p className="text-xs font-bold text-muted-foreground uppercase">Crop Health</p>
                                    <p className="text-3xl font-bold text-emerald-600 mt-2">92/100</p>
                                    <p className="text-xs text-muted-foreground mt-1">AI Assessed</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                // Farm List View
                <>
                    <Card className="rounded-[2rem] border-muted">
                        <CardContent className="p-4 flex justify-between items-center">
                            <div className="flex items-center gap-4 flex-1">
                                <Search className="text-muted-foreground ml-4" size={20} />
                                <input 
                                    type="text" 
                                    placeholder="Search farms..." 
                                    className="bg-transparent outline-none text-sm font-medium w-full"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button variant="secondary" size="icon"><Filter size={18} /></Button>
                                <Button onClick={() => { setEditingFarm(null); setIsFarmModalOpen(true); }} className="gap-2">
                                    <Plus size={18} /> Add Farm
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[2.5rem] border-muted overflow-hidden">
                        <CardContent className="p-0">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 text-muted-foreground font-bold text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Farm ID</th>
                                        <th className="px-6 py-4">Name / Owner</th>
                                        <th className="px-6 py-4">Location</th>
                                        <th className="px-6 py-4">Health Score</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {farmList.map((farm) => (
                                        <tr 
                                            key={farm.id} 
                                            className="hover:bg-muted/30 transition-colors cursor-pointer group"
                                        >
                                            <td className="px-6 py-4 font-mono font-bold text-muted-foreground">{farm.id}</td>
                                            <td className="px-6 py-4" onClick={() => setSelectedFarm(farm.id)}>
                                                <p className="font-bold group-hover:text-primary transition-colors">{farm.name}</p>
                                                <p className="text-xs text-muted-foreground">{farm.owner}</p>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground">{farm.location}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${farm.health > 80 ? 'bg-emerald-500' : farm.health > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{width: `${farm.health}%`}}></div>
                                                    </div>
                                                    <span className="font-bold">{farm.health}%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant={farm.status === 'Active' ? 'default' : farm.status === 'Warning' ? 'secondary' : 'outline'} className={farm.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : farm.status === 'Warning' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : ''}>
                                                    {farm.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button 
                                                        variant="ghost" size="icon"
                                                        onClick={(e) => { e.stopPropagation(); setEditingFarm(farm); setIsFarmModalOpen(true); }}
                                                    >
                                                        <Edit2 size={16} />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" size="icon"
                                                        onClick={() => setSelectedFarm(farm.id)}
                                                    >
                                                        <ChevronRight size={16} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
};
