import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Brush, BarChart, Bar, Cell } from 'recharts';
import { Power, Zap, Droplets, CheckCircle2, Calendar, AlertTriangle, Droplet, Bell, XCircle, CheckCircle } from 'lucide-react';
import { ChartData } from '../types';
import { Language, translations } from '../utils/translations';

const generateHistoryData = (days: number): ChartData[] => {
  const data: ChartData[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Simulate realistic fluctuation (rain events, drying cycles)
      const cycle = Math.sin(i * 0.5) * 15;
      const noise = (Math.random() - 0.5) * 10;
      let moisture = Math.round(45 + cycle + noise);
      
      // Clamp values
      moisture = Math.max(15, Math.min(85, moisture));

      data.push({
          day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullDate: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          moisture: moisture
      });
  }
  return data;
};

const waterUsageData = [
  { name: 'Last Week', liters: 1250 },
  { name: 'This Week', liters: 850 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      // Handle both LineChart (moisture) and BarChart (liters) payloads
      const value = payload[0].value;
      const name = payload[0].name;

      // If it's the bar chart
      if (payload[0].dataKey === 'liters') {
           return (
            <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-xl shadow-xl border border-slate-700/50 text-white min-w-[120px] animate-fade-in">
                <p className="text-xs font-bold text-slate-400 mb-1">{data.name}</p>
                <p className="text-xl font-bold">{value} <span className="text-xs text-slate-500">L</span></p>
            </div>
           );
      }
      
      // Determine status based on moisture level
      const moisture = value;
      let statusColor = 'text-emerald-400';
      let statusBg = 'bg-emerald-500/20';
      let statusIcon = <CheckCircle2 size={14} />;
      let statusText = 'Optimal';

      if (moisture < 30) {
        statusColor = 'text-red-400';
        statusBg = 'bg-red-500/20';
        statusIcon = <AlertTriangle size={14} />;
        statusText = 'Critical Low';
      } else if (moisture < 45) {
        statusColor = 'text-amber-400';
        statusBg = 'bg-amber-500/20';
        statusIcon = <Droplet size={14} />;
        statusText = 'Low Moisture';
      } else if (moisture > 80) {
         statusColor = 'text-blue-400';
         statusBg = 'bg-blue-500/20';
         statusIcon = <Droplets size={14} />;
         statusText = 'High Saturation';
      }

      return (
        <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-700/50 text-white min-w-[200px] animate-fade-in">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
             <Calendar size={14} className="text-slate-400" />
             <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{data.fullDate}</span>
          </div>
          
          <div className="flex items-end justify-between gap-6 mb-3">
              <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">Moisture Level</p>
                  <p className={`text-3xl font-bold tracking-tight ${moisture < 30 ? 'text-red-400' : 'text-white'}`}>
                      {moisture}<span className="text-lg align-top text-slate-500 ml-0.5">%</span>
                  </p>
              </div>
              <div className={`p-2 rounded-xl ${statusBg} ${statusColor}`}>
                  {statusIcon}
              </div>
          </div>
          
          <div className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg w-full ${statusBg} ${statusColor}`}>
              <span>Status: {statusText}</span>
          </div>
        </div>
      );
    }
    return null;
};

interface IrrigationProps {
    language?: Language;
}

export const Irrigation: React.FC<IrrigationProps> = ({ language = 'en' }) => {
  const [autoMode, setAutoMode] = useState(false);
  const [isPumping, setIsPumping] = useState(false);
  const [countdown, setCountdown] = useState(0); // in seconds
  const [timeRange, setTimeRange] = useState<7 | 30>(30);
  
  // New States for AI Notification Flow
  const [pendingApproval, setPendingApproval] = useState(false);
  const [simulationRun, setSimulationRun] = useState(false);
  
  const t = translations[language].irrigation;

  // Memoize data so it regenerates only when timeRange changes
  const data = useMemo(() => generateHistoryData(timeRange), [timeRange]);

  useEffect(() => {
    let timer: any;
    if (isPumping && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setIsPumping(false);
    }
    return () => clearInterval(timer);
  }, [isPumping, countdown]);

  // AI Simulation Effect
  useEffect(() => {
    if (!autoMode) {
        setSimulationRun(false);
        setPendingApproval(false);
        return;
    }

    let timer: any;
    // Trigger simulation if auto mode is on, not pumping, not already pending, and hasn't run yet
    if (autoMode && !isPumping && !pendingApproval && !simulationRun) {
        timer = setTimeout(() => {
            setPendingApproval(true);
        }, 2500); // 2.5s delay to simulate analysis
    }
    return () => clearTimeout(timer);
  }, [autoMode, isPumping, pendingApproval, simulationRun]);

  const handleManualPump = () => {
    if (autoMode) return;
    setIsPumping(true);
    setCountdown(600); // 10 minutes = 600 seconds
  };

  const confirmAiAction = () => {
    setPendingApproval(false);
    setIsPumping(true);
    setCountdown(600);
    setSimulationRun(true); // Mark simulation as run to prevent loops
  };

  const rejectAiAction = () => {
    setPendingApproval(false);
    setSimulationRun(true); // Mark as run so it doesn't nag immediately
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center">
        <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{t.title}</h2>
            <p className="text-slate-500 mt-1">{t.subtitle}</p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 mt-4 md:mt-0">
            <button 
                onClick={() => setTimeRange(7)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${timeRange === 7 ? 'bg-[#0F5132] text-white shadow-md' : 'text-slate-500 hover:text-[#0F5132]'}`}
            >
                7 Days
            </button>
            <button 
                onClick={() => setTimeRange(30)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${timeRange === 30 ? 'bg-[#0F5132] text-white shadow-md' : 'text-slate-500 hover:text-[#0F5132]'}`}
            >
                30 Days
            </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm shadow-slate-200 border border-slate-100">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h3 className="font-bold text-slate-900 text-lg">{t.chartTitle}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Last {timeRange} Days • Sector A</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-0.5 bg-red-500/50"></span>
                    <span className="text-xs font-bold text-red-500 uppercase">{t.critical} (30%)</span>
                </div>
            </div>
            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                            dataKey="day" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                            dy={10} 
                            minTickGap={30}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                            unit="%" 
                            domain={[0, 100]} 
                        />
                        <Tooltip 
                            content={<CustomTooltip />} 
                            cursor={{ stroke: '#0F5132', strokeWidth: 1, strokeDasharray: '4 4' }}
                            wrapperStyle={{ outline: 'none' }}
                        />
                        <ReferenceLine y={30} stroke="#EF4444" strokeDasharray="4 4" strokeWidth={2} label={{ value: 'CRITICAL', position: 'insideBottomRight', fill: '#EF4444', fontSize: 10, fontWeight: 'bold' }} />
                        <defs>
                            <linearGradient id="colorMoisture" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0F5132" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#0F5132" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Line 
                            type="monotone" 
                            dataKey="moisture" 
                            stroke="#0F5132" 
                            strokeWidth={3} 
                            dot={false}
                            activeDot={{r: 6, fill: '#0F5132', strokeWidth: 4, stroke: '#ecfdf5'}} 
                            animationDuration={1500}
                        />
                        <Brush 
                            dataKey="day" 
                            height={30} 
                            stroke="#0F5132" 
                            fill="#f8fafc"
                            tickFormatter={() => ''}
                            travellerWidth={10}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Control Panel */}
        <div className="space-y-6">
            {/* Auto Mode Toggle Card */}
            <div className={`p-8 rounded-[2.5rem] shadow-sm border transition-all duration-300 flex flex-col gap-6 relative overflow-hidden ${autoMode ? 'bg-[#0F5132] text-white border-emerald-900' : 'bg-white text-slate-900 border-slate-100 shadow-slate-200'}`}>
                
                {/* Background Decoration for Active State */}
                {autoMode && (
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                )}

                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                         <div className={`p-3 rounded-2xl transition-colors ${autoMode ? 'bg-white/10 text-emerald-300' : 'bg-slate-50 text-slate-500'}`}>
                             <Zap size={24} />
                         </div>
                         <div>
                             <h3 className="font-bold text-lg">{t.autoMode}</h3>
                             <div className="flex items-center gap-2 h-5">
                                 {autoMode && <span className="flex w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>}
                                 <p className={`text-xs font-bold uppercase tracking-wider ${autoMode ? 'text-emerald-300' : 'text-slate-400'}`}>
                                     {autoMode ? t.autoActive : t.autoOff}
                                 </p>
                             </div>
                         </div>
                    </div>
                    
                    <button 
                        onClick={() => setAutoMode(!autoMode)}
                        className={`w-16 h-9 rounded-full p-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${autoMode ? 'bg-emerald-600' : 'bg-slate-200'}`}
                        aria-label="Toggle Auto-Irrigation"
                    >
                        <div className={`w-7 h-7 rounded-full bg-white shadow-md transform transition-transform duration-300 flex items-center justify-center ${autoMode ? 'translate-x-7' : 'translate-x-0'}`}>
                            {autoMode ? <CheckCircle2 size={14} className="text-[#0F5132]" /> : <Power size={14} className="text-slate-400" />}
                        </div>
                    </button>
                </div>
                
                <div className="relative z-10">
                    <p className={`text-sm leading-relaxed ${autoMode ? 'text-emerald-100' : 'text-slate-500'}`}>
                        {autoMode ? t.autoDescOn : t.autoDescOff}
                    </p>
                </div>
            </div>

            {/* AI Notification Card */}
            {pendingApproval && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 p-6 rounded-[2rem] shadow-lg animate-slide-up relative overflow-hidden">
                    <div className="flex items-start gap-4 relative z-10">
                        <div className="p-3 bg-amber-100 dark:bg-amber-800/50 text-amber-600 dark:text-amber-400 rounded-2xl animate-pulse">
                            <Bell size={24} />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-white text-lg">AI Intervention</h4>
                            <p className="text-slate-600 dark:text-slate-300 text-sm mt-1 mb-4 leading-relaxed">
                                Soil moisture in Sector A has dropped below optimal levels. AI recommends a 10-minute irrigation cycle.
                            </p>
                            <div className="flex gap-3">
                                <button 
                                    onClick={confirmAiAction}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#0F5132] text-white rounded-xl font-bold text-xs shadow-md hover:bg-[#0a3622] transition-colors"
                                >
                                    <CheckCircle size={14} /> Approve
                                </button>
                                <button 
                                    onClick={rejectAiAction}
                                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <XCircle size={14} /> Deny
                                </button>
                            </div>
                        </div>
                    </div>
                    {/* Background glow */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                </div>
            )}

            {/* Manual Pump Control */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm shadow-slate-200 border border-slate-100 relative overflow-hidden">
                <h3 className="font-bold text-slate-900 mb-6">{t.manual}</h3>
                
                {isPumping ? (
                    <div className="flex flex-col items-center justify-center py-4 space-y-4">
                        <div className="relative">
                            <div className="h-24 w-24 rounded-full border-4 border-slate-100"></div>
                            <div className="absolute top-0 left-0 h-24 w-24 rounded-full border-4 border-[#0F5132] border-t-transparent animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-2xl text-slate-900">
                                {formatTime(countdown)}
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-[#0F5132]">{t.pumpActive}</p>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Sector A - Valve 2 Open</p>
                        </div>
                        <button 
                            onClick={() => {setIsPumping(false); setCountdown(0);}}
                            className="text-xs font-bold text-red-500 hover:text-red-600 uppercase tracking-wide mt-2"
                        >
                            {t.stopPump}
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={handleManualPump}
                        disabled={autoMode}
                        className={`w-full py-6 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 transition-all ${
                            autoMode 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60' 
                            : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg hover:shadow-xl active:scale-95'
                        }`}
                    >
                        <Droplet size={24} />
                        <span>{t.startPump}</span>
                    </button>
                )}
                
                {autoMode && !isPumping && !pendingApproval && (
                    <div className="mt-4 flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-100">
                        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                        <span>{t.overrideDisable}</span>
                    </div>
                )}
            </div>

            {/* Water Usage Chart */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm shadow-slate-200 border border-slate-100">
                <h3 className="font-bold text-slate-900 mb-6">Water Usage (Liters)</h3>
                <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={waterUsageData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                                dy={10}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                            />
                            <Tooltip 
                                cursor={{fill: '#f1f5f9'}}
                                content={<CustomTooltip />}
                            />
                            <Bar dataKey="liters" radius={[10, 10, 10, 10]} barSize={40}>
                                {waterUsageData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 1 ? '#0F5132' : '#cbd5e1'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                 <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500">Total Saved:</span>
                    <span className="font-bold text-[#0F5132] bg-emerald-50 px-2 py-1 rounded-lg">400 Liters</span>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};