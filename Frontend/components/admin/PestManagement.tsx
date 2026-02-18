import React, { useState } from 'react';
import { List as ListIcon, Grid, Shield, MapPin, Calendar, Activity } from 'lucide-react';
import { pestDetections } from './mockData';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const PestManagement = () => {
    const [pestViewMode, setPestViewMode] = useState<'list' | 'gallery'>('list');

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex justify-between items-center mb-4">
                 <div className="flex gap-2 bg-background p-1 rounded-xl border">
                     <Button 
                        variant={pestViewMode === 'list' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setPestViewMode('list')}
                        className="rounded-lg"
                     >
                        <ListIcon size={16} />
                     </Button>
                     <Button 
                        variant={pestViewMode === 'gallery' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setPestViewMode('gallery')}
                        className="rounded-lg"
                     >
                        <Grid size={16} />
                     </Button>
                 </div>
                 <Button variant="destructive" className="gap-2 bg-red-50 text-red-600 border-red-100 hover:bg-red-100 border hover:text-red-700 font-bold">
                     <Shield size={16} /> Update Pest Database
                 </Button>
             </div>

             {pestViewMode === 'list' ? (
                <Card className="rounded-[2.5rem] border-muted overflow-hidden">
                    <CardContent className="p-0">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground font-bold uppercase tracking-wider text-xs">
                                <tr>
                                    <th className="px-6 py-4">Pest Type</th>
                                    <th className="px-6 py-4">Confidence</th>
                                    <th className="px-6 py-4">Date Detected</th>
                                    <th className="px-6 py-4">Location</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {pestDetections.map((det) => (
                                    <tr key={det.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4 font-bold">{det.pest}</td>
                                        <td className="px-6 py-4">
                                            <Badge variant={det.confidence > 90 ? 'default' : 'secondary'} className={det.confidence > 90 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                                                {det.confidence}%
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">{det.date}</td>
                                        <td className="px-6 py-4 text-muted-foreground">{det.location}</td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline" className={det.status === 'Treated' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-amber-600 border-amber-200 bg-amber-50'}>
                                                {det.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button size="sm" variant="outline">View Details</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
             ) : (
                 <div className="grid md:grid-cols-3 gap-6">
                     {pestDetections.map((det) => (
                         <Card key={det.id} className="rounded-[2rem] overflow-hidden group border-muted">
                             <div className="h-48 overflow-hidden relative">
                                 <img src={det.image} alt={det.pest} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                 <div className="absolute top-4 right-4">
                                     <Badge className="bg-white/90 text-black backdrop-blur shadow-sm hover:bg-white">{det.confidence}% Match</Badge>
                                 </div>
                             </div>
                             <CardContent className="p-6">
                                 <h4 className="text-lg font-bold mb-1">{det.pest}</h4>
                                 <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                                     <MapPin size={14} /> {det.location}
                                     <span className="mx-1">•</span>
                                     <Calendar size={14} /> {det.date}
                                 </div>
                                 <div className="flex justify-between items-center">
                                     <Badge variant="outline" className={det.status === 'Treated' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-amber-600 border-amber-200 bg-amber-50'}>
                                         {det.status}
                                     </Badge>
                                     <Button size="icon" variant="secondary" className="rounded-full">
                                         <Activity size={16} />
                                     </Button>
                                 </div>
                             </CardContent>
                         </Card>
                     ))}
                 </div>
             )}
        </div>
    );
};
