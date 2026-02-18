import { 
    LayoutDashboard, Sprout, Users, Activity, Bug, Droplets, 
    Beaker, Bell, FileText, Settings, Search, MapPin, 
    Plus, Download, ChevronRight, AlertTriangle, 
    CheckCircle2, XCircle, RefreshCw, Filter, 
    Trash2, Edit2, Shield, Calendar, BrainCircuit,
    CloudLightning, Database, TrendingUp, X, Image as ImageIcon,
    Smartphone, MessageSquare, Save, Clock, Radio, Grid, List as ListIcon,
    MoreVertical, Lock, BarChart3, PieChart as PieChartIcon
  } from 'lucide-react';

export const sensorHistoryData = Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    moisture: Math.floor(Math.random() * 30) + 40,
    temp: Math.floor(Math.random() * 10) + 20,
    anomaly: Math.random() > 0.95
  }));
  
  export const waterUsageData = [
    { day: 'Mon', usage: 450, efficient: 400 },
    { day: 'Tue', usage: 520, efficient: 420 },
    { day: 'Wed', usage: 380, efficient: 380 },
    { day: 'Thu', usage: 600, efficient: 450 },
    { day: 'Fri', usage: 480, efficient: 410 },
    { day: 'Sat', usage: 550, efficient: 430 },
    { day: 'Sun', usage: 400, efficient: 390 },
  ];
  
  export const nutrientData = [
    { name: 'N', value: 45, target: 80 },
    { name: 'P', value: 82, target: 70 },
    { name: 'K', value: 75, target: 75 },
  ];
  
  export const farmList = [
    { id: 'F-001', name: 'Kigali Maize Co-op', owner: 'Jean Claude', location: 'Rwamagana', size: '2.5 Ha', status: 'Active', sensors: 12, health: 92 },
    { id: 'F-002', name: 'Sunrise Beans', owner: 'Grace M.', location: 'Kayonza', size: '1.2 Ha', status: 'Warning', sensors: 6, health: 78 },
    { id: 'F-003', name: 'Green Valley', owner: 'Patrick N.', location: 'Rwamagana', size: '4.0 Ha', status: 'Active', sensors: 18, health: 95 },
    { id: 'F-004', name: 'Hillside Organic', owner: 'Marie C.', location: 'Musanze', size: '0.8 Ha', status: 'Offline', sensors: 4, health: 0 },
  ];
  
  export const userList = [
      { id: 1, name: 'Jean Claude', role: 'Farmer', email: 'jean@gmail.com', status: 'Verified', phone: '+250 788 123 456' },
      { id: 2, name: 'Dr. Mukamana', role: 'Expert', email: 'muka@agri.rw', status: 'Verified', phone: '+250 788 555 123' },
      { id: 3, name: 'Admin User', role: 'Admin', email: 'admin@rb.rw', status: 'Verified', phone: '+250 788 000 000' },
      { id: 4, name: 'New User', role: 'Farmer', email: 'new@gmail.com', status: 'Pending', phone: '+250 788 999 888' },
  ];
  
  export const recentActivities = [
      { id: 1, action: 'System Broadcast Sent', user: 'Admin', time: '10 mins ago', icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
      { id: 2, action: 'New Farm Registered', user: 'Dr. Ruzibiza', time: '1 hour ago', icon: Sprout, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { id: 3, action: 'Critical Alert Resolved', user: 'System', time: '2 hours ago', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { id: 4, action: 'Sensor Calibration', user: 'Jean Claude', time: 'Yesterday', icon: Settings, color: 'text-slate-600', bg: 'bg-slate-50' },
  ];
  
  export const alertHistory = [
    { id: 1, type: 'critical', msg: 'Sensor SN-04 offline > 24h', farm: 'Hillside Organic', time: '2h ago', status: 'Open' },
    { id: 2, type: 'warning', msg: 'Moisture below 20% in Sector B', farm: 'Kigali Maize Co-op', time: '4h ago', status: 'Investigating' },
    { id: 3, type: 'info', msg: 'Irrigation cycle completed', farm: 'Green Valley', time: '6h ago', status: 'Resolved' },
    { id: 4, type: 'info', msg: 'Weekly Report Generated', farm: 'System', time: '1d ago', status: 'Resolved' },
    { id: 5, type: 'critical', msg: 'Fall Armyworm Outbreak', farm: 'Sunrise Beans', time: '2d ago', status: 'Resolved' },
  ];
  
  export const pestDetections = [
      { id: 1, pest: 'Fall Armyworm', confidence: 98, date: 'Today, 10:30 AM', location: 'Rwamagana', status: 'Treated', image: 'https://images.unsplash.com/photo-1625246333195-f4d9ebe43a7d?q=80&w=200&auto=format&fit=crop' },
      { id: 2, pest: 'Maize Stalk Borer', confidence: 85, date: 'Yesterday, 4:15 PM', location: 'Kayonza', status: 'Pending', image: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?q=80&w=200&auto=format&fit=crop' },
      { id: 3, pest: 'Aphids', confidence: 92, date: 'Aug 12, 09:00 AM', location: 'Musanze', status: 'Treated', image: 'https://images.unsplash.com/photo-1551489186-cf8726f514f8?q=80&w=200&auto=format&fit=crop' },
  ];
