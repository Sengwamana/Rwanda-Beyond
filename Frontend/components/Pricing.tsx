import React from 'react';
import { Check, ArrowRight } from 'lucide-react';

export const Pricing: React.FC = () => {
  return (
    <div className="bg-[#FAFAF9] dark:bg-slate-900 min-h-screen pt-24 pb-20 animate-fade-in font-sans text-slate-900 dark:text-white transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 text-[#0F5132] dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
                Plans & Pricing
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-slate-900 dark:text-white mb-6 leading-[1.1] tracking-tight">
                Fair Pricing for <br/> Every Scale.
            </h1>
            <p className="text-xl text-slate-500 dark:text-slate-400 leading-relaxed">
                Choose a plan that fits your land size and technology needs. <br/> Pay easily via Mobile Money (MoMo).
            </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-start">
            
            {/* Basic Plan */}
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 lg:p-10 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300">
                <div className="mb-8">
                    <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-full uppercase tracking-wider">Urumuri</span>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-4 mb-2">Starter</h3>
                    <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-bold text-slate-900 dark:text-white tracking-tight">Free</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-4 leading-relaxed">Perfect for subsistence farmers starting their digital journey.</p>
                </div>
                
                <div className="h-px bg-slate-100 dark:bg-slate-700 w-full mb-8"></div>

                <ul className="space-y-4 mb-8">
                    {['USSD Access (*775#)', 'Daily Weather SMS', 'Community Marketplace', 'Basic Market Prices'].map((item, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300 font-medium">
                            <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-full p-0.5 mt-0.5"><Check size={12} className="text-[#0F5132] dark:text-emerald-400" /></div> 
                            {item}
                        </li>
                    ))}
                </ul>
                <button className="w-full py-4 rounded-full border-2 border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    Get Started
                </button>
            </div>

            {/* Pro Plan (Featured) */}
            <div className="bg-[#0F5132] rounded-[2.5rem] p-8 lg:p-10 text-white shadow-2xl relative overflow-hidden transform md:-translate-y-6">
                <div className="absolute top-6 right-6 bg-[#10B981] text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Most Popular</div>
                
                <div className="mb-8 relative z-10">
                    <span className="text-xs font-bold bg-white/10 text-emerald-200 px-3 py-1.5 rounded-full uppercase tracking-wider border border-white/10">Isuka</span>
                    <h3 className="text-2xl font-bold mt-4 mb-2">Professional</h3>
                    <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-bold tracking-tight">5K</span>
                        <span className="text-emerald-200 font-medium">RWF / mo</span>
                    </div>
                    <p className="text-emerald-100 text-sm mt-4 leading-relaxed opacity-90">For progressive farmers and small cooperatives.</p>
                </div>

                <div className="h-px bg-white/10 w-full mb-8"></div>

                <ul className="space-y-4 mb-8 relative z-10">
                    {['Everything in Free', 'Smart Dashboard Access', '1 IoT Sensor Lease Included', 'AI Pest Detection (Unlimited)', 'Auto-Irrigation Control'].map((item, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-emerald-50 font-medium">
                            <div className="bg-[#10B981] rounded-full p-0.5 text-black mt-0.5"><Check size={12} /></div> 
                            {item}
                        </li>
                    ))}
                </ul>
                <button className="w-full py-4 rounded-full bg-white text-[#0F5132] font-bold hover:bg-emerald-50 transition-colors shadow-lg relative z-10">
                    Start Free Trial
                </button>
                
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 lg:p-10 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300">
                <div className="mb-8">
                    <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-full uppercase tracking-wider">Igisubizo</span>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-4 mb-2">Enterprise</h3>
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">Custom</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-4 leading-relaxed">For large cooperatives, NGOs, and Government bodies.</p>
                </div>

                <div className="h-px bg-slate-100 dark:bg-slate-700 w-full mb-8"></div>

                <ul className="space-y-4 mb-8">
                    {['Multi-Farm Management', 'Advanced Analytics & Reporting', 'API Access', 'Dedicated Support Agronomist', 'White-label Options'].map((item, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300 font-medium">
                            <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-full p-0.5 mt-0.5"><Check size={12} className="text-[#0F5132] dark:text-emerald-400" /></div> 
                            {item}
                        </li>
                    ))}
                </ul>
                <button className="w-full py-4 rounded-full border-2 border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    Contact Sales
                </button>
            </div>

        </div>

        <div className="mt-20 text-center">
            <p className="text-slate-400 text-sm font-medium">
                Prices include VAT. Cancel anytime. <a href="#" className="underline hover:text-[#0F5132] dark:hover:text-emerald-400 transition-colors">Read our terms</a>.
            </p>
        </div>

      </div>
    </div>
  );
};