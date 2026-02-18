import React from 'react';
import { Wifi, Cpu, Smartphone, CloudRain, Zap, ShieldCheck, ArrowRight, Layers, BarChart3, Radio } from 'lucide-react';

export const Features: React.FC = () => {
  return (
    <div className="bg-[#FAFAF9] dark:bg-slate-900 min-h-screen pt-24 pb-20 animate-fade-in font-sans text-slate-900 dark:text-white transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Hero Header */}
        <div className="text-center max-w-4xl mx-auto mb-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 text-[#0F5132] dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
                Our Technology
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-slate-900 dark:text-white mb-8 leading-[1.1] tracking-tight">
                Built for the <br className="hidden md:block"/> Highland Terrain.
            </h1>
            <p className="text-xl text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
                Rwanda's agriculture faces unique challenges. Our stack is optimized for low-connectivity, steep slopes, and smallholder plots.
            </p>
        </div>

        {/* Feature Grid - Row 1 */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                <div className="relative z-10 max-w-md">
                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-[#0F5132] dark:text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                        <Wifi size={28} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">IoT Soil Monitoring</h3>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                        Real-time sensors measure Nitrogen, Phosphorus, and Potassium (NPK) levels alongside moisture, sending data every 30 minutes via LoRaWAN gateways designed for hilly topography.
                    </p>
                </div>
                {/* Decor */}
                <div className="absolute top-1/2 right-0 transform translate-x-1/3 -translate-y-1/2 w-64 h-64 bg-emerald-50 dark:bg-emerald-900/10 rounded-full blur-3xl opacity-60"></div>
                <Radio className="absolute bottom-8 right-8 text-slate-100 dark:text-slate-700 w-32 h-32 -rotate-12" />
            </div>

            <div className="bg-[#0F5132] text-white rounded-[2.5rem] p-10 shadow-xl relative overflow-hidden flex flex-col justify-between group">
                <div className="relative z-10">
                    <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-emerald-100 mb-6 border border-white/10">
                        <Cpu size={28} />
                    </div>
                    <h3 className="text-2xl font-bold mb-4">Gemini AI Engine</h3>
                    <p className="text-emerald-100/80 leading-relaxed text-sm">
                        Detect pests like Fall Armyworm with 94% accuracy using our vision models.
                    </p>
                </div>
                <div className="absolute bottom-0 right-0 w-40 h-40 bg-emerald-400/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
            </div>
        </div>

        {/* Feature Grid - Row 2 */}
        <div className="grid md:grid-cols-3 gap-6 mb-24">
             <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group">
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                    <Smartphone size={28} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Offline-First</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-sm">
                    Receive critical alerts and daily summaries via standard SMS and USSD (*775#). No data needed.
                </p>
            </div>

            <div className="md:col-span-2 bg-slate-900 dark:bg-black text-white rounded-[2.5rem] p-10 relative overflow-hidden flex flex-col md:flex-row items-center gap-8 border border-slate-800 dark:border-slate-800">
                <div className="flex-1 relative z-10">
                     <div className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                        Smart Irrigation
                    </div>
                    <h3 className="text-3xl font-bold mb-4">Automate water usage. <br/>Save up to 40%.</h3>
                    <ul className="space-y-3 text-slate-300">
                        <li className="flex items-center gap-3">
                            <div className="bg-emerald-500 rounded-full p-1"><Zap size={12} className="text-black" /></div>
                            <span>Auto-trigger pumps based on moisture.</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <div className="bg-emerald-500 rounded-full p-1"><CloudRain size={12} className="text-black" /></div>
                            <span>Weather-aware scheduling.</span>
                        </li>
                    </ul>
                </div>
                
                {/* Abstract Chart Visual */}
                <div className="flex-1 w-full h-48 bg-white/5 rounded-2xl border border-white/10 p-6 relative backdrop-blur-sm">
                    <div className="flex justify-between items-end h-full gap-2">
                         {[40, 65, 45, 80, 35, 60, 75].map((h, i) => (
                             <div key={i} className="flex-1 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg opacity-80" style={{ height: `${h}%` }}></div>
                         ))}
                    </div>
                    <div className="absolute top-4 left-4 text-xs font-bold text-emerald-400">Water Efficiency</div>
                </div>
            </div>
        </div>

        {/* Integration Section */}
        <div className="bg-white dark:bg-slate-800 rounded-[3rem] p-8 md:p-20 text-center border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-8">Seamless Integration</h2>
                <p className="text-lg text-slate-500 dark:text-slate-400 mb-12">
                    Our platform connects with major hardware providers and local telecom networks to ensure 99.9% uptime.
                </p>
                <div className="flex flex-wrap justify-center gap-4 md:gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                     {/* Mock Logos */}
                     <div className="h-12 px-6 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center font-bold text-slate-400 dark:text-slate-300 border border-slate-100 dark:border-slate-600">MTN Rwanda</div>
                     <div className="h-12 px-6 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center font-bold text-slate-400 dark:text-slate-300 border border-slate-100 dark:border-slate-600">Airtel</div>
                     <div className="h-12 px-6 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center font-bold text-slate-400 dark:text-slate-300 border border-slate-100 dark:border-slate-600">LoRa Alliance</div>
                     <div className="h-12 px-6 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center font-bold text-slate-400 dark:text-slate-300 border border-slate-100 dark:border-slate-600">RAB</div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};