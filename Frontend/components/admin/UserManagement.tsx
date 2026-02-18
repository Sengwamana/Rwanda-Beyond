import React, { useState } from 'react';
import { Plus, X, CheckCircle2, AlertTriangle, Edit2, Trash2 } from 'lucide-react';
import { userList } from './mockData';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const UserManagement = () => {
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);

    return (
        <div className="space-y-6 animate-fade-in relative">
             {/* Edit User Modal */}
             {isUserModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-sm shadow-2xl animate-scale-in rounded-[2.5rem]">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{editingUser ? 'Edit User' : 'Invite User'}</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setIsUserModalOpen(false)}>
                                <X size={20} />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Input placeholder="Full Name" defaultValue={editingUser?.name || ''} />
                            <Input placeholder="Email Address" defaultValue={editingUser?.email || ''} />
                            <div>
                                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">System Role</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Farmer', 'Expert', 'Admin'].map(role => (
                                        <div 
                                            key={role}
                                            className={`py-2 rounded-xl text-xs font-bold border text-center cursor-pointer transition-all ${
                                                (editingUser?.role || 'Farmer') === role 
                                                ? 'bg-primary text-primary-foreground border-primary' 
                                                : 'bg-background border-input hover:bg-accent'
                                            }`}
                                        >
                                            {role}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <input type="checkbox" className="w-4 h-4 text-primary rounded focus:ring-primary" defaultChecked={editingUser?.status === 'Verified'} />
                                <span className="text-sm font-medium">Account Verified</span>
                            </div>
                            <Button className="w-full font-bold mt-2" onClick={() => setIsUserModalOpen(false)}>
                                {editingUser ? 'Save Changes' : 'Send Invite'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

             <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">User Management</h2>
                    <div className="flex gap-4 mt-2 text-sm font-medium text-muted-foreground">
                        <button className="text-primary border-b-2 border-primary pb-1">All Users</button>
                        <button className="hover:text-foreground pb-1">Pending Approval (1)</button>
                    </div>
                </div>
                <Button onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} className="gap-2">
                    <Plus size={18} /> Invite User
                </Button>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userList.map((user) => (
                    <Card key={user.id} className="rounded-[2rem] hover:shadow-md transition-all border-muted">
                        <CardContent className="p-6 flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground">
                                        {user.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold">{user.name}</h4>
                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                    </div>
                                </div>
                                <Badge variant="secondary" className={`
                                    ${user.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                                      user.role === 'Expert' ? 'bg-blue-100 text-blue-700' :
                                      'bg-emerald-100 text-emerald-700'}
                                `}>
                                    {user.role}
                                </Badge>
                            </div>
                            
                            <div className="space-y-2 bg-muted/30 p-3 rounded-xl">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span className="font-bold">Phone</span>
                                    <span>{user.phone}</span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span className="font-bold">Joined</span>
                                    <span>Aug 12, 2024</span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span className="font-bold">Farms</span>
                                    <span>{user.role === 'Farmer' ? '1 Assigned' : 'N/A'}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                <span className={`flex items-center gap-1.5 text-xs font-bold ${user.status === 'Verified' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {user.status === 'Verified' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                                    {user.status}
                                </span>
                                <div className="flex gap-2">
                                    {user.status === 'Pending' ? (
                                        <Button size="sm" className="h-8 text-xs">Approve</Button>
                                    ) : (
                                        <>
                                            <Button 
                                                variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
                                                onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }}
                                            >
                                                <Edit2 size={16} />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                                <Trash2 size={16} />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};
