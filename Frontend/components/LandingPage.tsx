import React, { useState } from 'react';
import { 
  ArrowRight, ArrowUpRight, Cloud, Sun, Droplets, MapPin, 
  MessageSquare, Mic, List, CheckCircle2, TrendingUp, Bell,
  Radio, Smartphone, Sprout, Quote, Check
} from 'lucide-react';
import { UserRole } from '../types';
import { Language, translations } from '../utils/translations';
import { contentService } from '../services/content';
import { handleApiError } from '../services/api';

interface LandingPageProps {
  onLogin: (role: UserRole) => void;
  onNavigate: (page: any) => void;
  language?: Language;
}

// Reusable Phone Frame Component
const PhoneMockup: React.FC<{children: React.ReactNode, alignRight?: boolean}> = ({ children, alignRight }) => (
    <div className={`relative w-[280px] h-[580px] bg-[#1E1E1E] rounded-[3rem] border-4 border-[#2d2d2d] shadow-2xl overflow-hidden mx-auto ${alignRight ? 'lg:mr-0' : 'lg:ml-0'}`}>
        {/* Dynamic Island / Notch */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-28 h-7 bg-black rounded-b-2xl z-20"></div>
        {/* Screen Content */}
        <div className="w-full h-full bg-slate-50 overflow-y-auto scrollbar-hide pt-8 pb-4 relative">
             {children}
        </div>
    </div>
);

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onNavigate, language = 'en' }) => {
  const t = translations[language].landing;
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
      e.preventDefault();
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) return;
      setSubscribeError(null);
      try {
          await contentService.subscribeNewsletter(normalizedEmail);
          setSubscribed(true);
          setEmail('');
          setTimeout(() => setSubscribed(false), 5000); // Reset after 5s
      } catch (error) {
          setSubscribeError(handleApiError(error));
      }
  };

  return (
    <div className="animate-fade-in bg-white dark:bg-slate-900 text-slate-900 dark:text-white pt-20 transition-colors duration-300">
      
      {/* 1. HERO SECTION */}
      <section className="relative pt-10 pb-20 lg:pt-16 lg:pb-32 overflow-hidden bg-[#FAFAF9] dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          
          {/* Left: Content */}
          <div className="relative z-20 text-center lg:text-left">
            <div className="inline-block p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm mb-6 border border-slate-100 dark:border-slate-700">
               <div className="bg-[#0F5132]/10 p-2 rounded-lg">
                   <Droplets size={24} className="text-[#0F5132]" />
               </div>
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold text-slate-900 dark:text-white leading-[1.1] mb-6 tracking-tight">
              {t.heroTitle}
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 mb-10 leading-relaxed max-w-lg mx-auto lg:mx-0">
              {t.heroSubtitle}
            </p>
            
            <div className="flex justify-center lg:justify-start">
              <button 
                onClick={() => onNavigate('login')}
                className="px-8 py-4 bg-[#0F5132] text-white rounded-full font-bold hover:bg-[#0a3622] transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center gap-2 group"
              >
                {t.signIn} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Right: Dashboard Mockup */}
          <div className="relative flex justify-center lg:justify-end">
             {/* Decorative Background Elements */}
             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-100/50 dark:bg-emerald-900/20 rounded-full blur-3xl -z-10"></div>
             <img src="https://images.unsplash.com/photo-1528183429752-a97d0bf99b5a?q=80&w=1000&auto=format&fit=crop" className="absolute top-20 -right-20 w-64 h-64 rounded-[2rem] object-cover opacity-20 dark:opacity-10 -z-10 rotate-12" alt="Farming Background" />

             <PhoneMockup alignRight>
                 <div className="px-5">
                     <div className="flex justify-between items-center mb-6">
                         <div>
                             <p className="text-xs text-slate-400">Welcome back,</p>
                             <h4 className="font-bold text-slate-900">Jean Claude</h4>
                         </div>
                         <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Profile" />
                         </div>
                     </div>

                     {/* Weather Card */}
                     <div className="bg-white p-4 rounded-3xl shadow-sm mb-4 border border-slate-100">
                         <div className="flex items-center gap-2 text-slate-400 mb-2">
                             <MapPin size={12} />
                             <span className="text-xs font-medium">Rwamagana, Rwanda</span>
                         </div>
                         <div className="flex justify-between items-center">
                             <div>
                                 <h2 className="text-3xl font-bold text-slate-900">28°C</h2>
                                 <p className="text-xs text-slate-400">Today is sunny day!</p>
                             </div>
                             <Sun size={40} className="text-yellow-400 fill-yellow-100" />
                         </div>
                         <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-50">
                             <div className="text-center">
                                 <p className="text-[10px] text-slate-400">Humidity</p>
                                 <p className="text-xs font-bold text-slate-700">71%</p>
                             </div>
                             <div className="text-center">
                                 <p className="text-[10px] text-slate-400">Precip</p>
                                 <p className="text-xs font-bold text-slate-700">2mm</p>
                             </div>
                             <div className="text-center">
                                 <p className="text-[10px] text-slate-400">Wind</p>
                                 <p className="text-xs font-bold text-slate-700">19km/h</p>
                             </div>
                         </div>
                     </div>

                     {/* List Section */}
                     <div className="flex justify-between items-end mb-3">
                         <h4 className="font-bold text-slate-900 text-sm">Our Agriculture Field</h4>
                         <span className="text-[10px] font-bold text-[#0F5132] cursor-pointer">See All</span>
                     </div>

                     {/* List Items */}
                     <div className="space-y-3">
                         <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-3">
                             <div className="w-16 h-16 rounded-xl bg-slate-200 overflow-hidden flex-shrink-0">
                                 <img src="https://images.unsplash.com/photo-1551754655-cd27e38d2076?q=80&w=200&auto=format&fit=crop" className="w-full h-full object-cover" alt="Maize" />
                             </div>
                             <div className="flex-1">
                                 <div className="flex justify-between items-start">
                                     <h5 className="text-xs font-bold text-slate-900 mb-1">Maize Field - Block A</h5>
                                     <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">Good</span>
                                 </div>
                                 <p className="text-[10px] text-slate-400 mb-2">Expected Harvest: 14 June 2024</p>
                                 <div className="flex justify-between items-center">
                                     <div className="flex gap-2">
                                         <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1"><Droplets size={10}/> 20%</span>
                                     </div>
                                     <div className="w-6 h-6 rounded-full bg-[#0F5132] flex items-center justify-center">
                                         <ArrowUpRight size={14} className="text-white" />
                                     </div>
                                 </div>
                             </div>
                         </div>
                         <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-3">
                             <div className="w-16 h-16 rounded-xl bg-slate-200 overflow-hidden flex-shrink-0">
                                 <img src="https://images.unsplash.com/photo-1551489186-cf8726f514f8?q=80&w=200&auto=format&fit=crop" className="w-full h-full object-cover" alt="Beans" />
                             </div>
                             <div className="flex-1">
                                 <div className="flex justify-between items-start">
                                     <h5 className="text-xs font-bold text-slate-900 mb-1">Beans Field - Block B</h5>
                                     <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded">Dry</span>
                                 </div>
                                 <p className="text-[10px] text-slate-400 mb-2">Expected Harvest: 21 July 2024</p>
                                 <div className="flex justify-between items-center">
                                     <div className="flex gap-2">
                                         <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1"><Droplets size={10}/> 10%</span>
                                     </div>
                                     <div className="w-6 h-6 rounded-full bg-[#0F5132] flex items-center justify-center">
                                         <ArrowUpRight size={14} className="text-white" />
                                     </div>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
             </PhoneMockup>
          </div>
        </div>
      </section>

      {/* 2. FEATURES SECTION */}
      <section className="py-20 lg:py-32 bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto px-6">
              <div className="text-center max-w-3xl mx-auto mb-24">
                  <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-6">{t.featuresTitle}</h2>
                  <p className="text-lg text-slate-500 dark:text-slate-400">{t.featuresSub}</p>
              </div>

              {/* Feature Block 1: AI Assistant */}
              <div className="grid lg:grid-cols-2 gap-16 items-center mb-32">
                  <div className="order-2 lg:order-1 relative">
                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-slate-100 dark:bg-slate-800 rounded-full blur-3xl -z-10"></div>
                       <PhoneMockup>
                           <div className="px-5 pt-4">
                               <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                                   <ArrowRight className="rotate-180 text-slate-900" size={20} />
                                   <h4 className="font-bold text-slate-900 flex-1 text-center">AI Assistant</h4>
                                   <div className="w-5"></div>
                               </div>
                               <div className="space-y-4">
                                   <div className="flex gap-2">
                                       <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" />
                                       </div>
                                       <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none text-xs text-slate-600 max-w-[80%]">
                                           Hello! How can I help you today?
                                       </div>
                                   </div>
                                   <div className="flex gap-2 flex-row-reverse">
                                       <div className="w-8 h-8 rounded-full bg-[#0F5132] flex items-center justify-center flex-shrink-0 text-white font-bold text-[10px]">
                                            AI
                                       </div>
                                       <div className="bg-[#0F5132] text-white p-3 rounded-2xl rounded-tr-none text-xs max-w-[80%]">
                                           I noticed a drop in moisture levels in Block A. Should I schedule irrigation?
                                       </div>
                                   </div>
                                   <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-50 mx-4">
                                       <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Suggested Actions</p>
                                       <div className="space-y-2">
                                           <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                                               <div className="w-4 h-4 rounded-full border border-slate-300"></div>
                                               <span className="text-xs font-medium text-slate-700">Start Irrigation (20m)</span>
                                           </div>
                                            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                                               <div className="w-4 h-4 rounded-full border border-slate-300"></div>
                                               <span className="text-xs font-medium text-slate-700">Check Valves</span>
                                           </div>
                                       </div>
                                   </div>
                               </div>
                               <div className="absolute bottom-0 left-0 w-full p-4 bg-white border-t border-slate-100">
                                   <div className="bg-slate-50 rounded-full h-10 flex items-center px-4 justify-between">
                                       <span className="text-xs text-slate-400">Ask a question...</span>
                                       <div className="w-6 h-6 bg-[#0F5132] rounded-full flex items-center justify-center">
                                           <Mic size={12} className="text-white" />
                                       </div>
                                   </div>
                               </div>
                           </div>
                       </PhoneMockup>
                  </div>
                  <div className="order-1 lg:order-2">
                      <div className="inline-block px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 mb-6">
                          AI Assistant
                      </div>
                      <h3 className="text-4xl font-bold text-slate-900 dark:text-white mb-6">{t.aiTitle}</h3>
                      <p className="text-lg text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                          {t.aiDesc}
                      </p>
                      <button onClick={() => onNavigate('features')} className="flex items-center gap-2 font-bold text-[#0F5132] hover:underline">
                          Learn More <ArrowUpRight size={18} />
                      </button>
                  </div>
              </div>

              {/* Feature Block 2: Precision Ag */}
              <div className="grid lg:grid-cols-2 gap-16 items-center">
                  <div>
                      <div className="inline-block px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 mb-6">
                          Agri Optimization
                      </div>
                      <h3 className="text-4xl font-bold text-slate-900 dark:text-white mb-6">{t.precisionTitle}</h3>
                      <p className="text-lg text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                          {t.precisionDesc}
                      </p>
                      <button onClick={() => onNavigate('features')} className="flex items-center gap-2 font-bold text-[#0F5132] hover:underline">
                          Learn More <ArrowUpRight size={18} />
                      </button>
                  </div>
                  <div className="relative">
                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-50 dark:bg-emerald-900/10 rounded-full blur-3xl -z-10"></div>
                       <PhoneMockup alignRight>
                           <div className="h-full bg-slate-800 relative">
                               <img src="https://images.unsplash.com/photo-1508614589041-895b88991e3e?q=80&w=1000&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Satellite Field" />
                               {/* Overlay UI */}
                               <div className="absolute top-6 left-4 right-4 flex justify-between">
                                   <div className="bg-white/90 backdrop-blur rounded-full w-8 h-8 flex items-center justify-center">
                                       <ArrowRight className="rotate-180" size={16} />
                                   </div>
                                   <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold">
                                       Satellite View
                                   </div>
                               </div>

                               {/* Field Grid Overlay */}
                               <div className="absolute top-1/3 left-10 w-32 h-40 border-2 border-white/50 rounded-xl bg-green-500/20 backdrop-blur-sm flex items-center justify-center">
                                   <span className="text-white font-bold text-xs drop-shadow-md">Block A <br/> 92% Health</span>
                               </div>

                               <div className="absolute bottom-6 left-4 right-4 bg-white p-4 rounded-2xl shadow-xl">
                                   <div className="flex justify-between items-center mb-3">
                                       <h5 className="font-bold text-sm">Strawberry Field E-BAL</h5>
                                       <span className="text-[10px] text-[#0F5132] font-bold bg-emerald-50 px-2 py-1 rounded">Completed</span>
                                   </div>
                                   <div className="grid grid-cols-3 gap-2 text-center">
                                       <div className="bg-slate-50 p-2 rounded-lg">
                                           <p className="text-[10px] text-slate-400">Health</p>
                                           <p className="text-xs font-bold text-green-600">Good</p>
                                       </div>
                                       <div className="bg-slate-50 p-2 rounded-lg">
                                           <p className="text-[10px] text-slate-400">Acidity</p>
                                           <p className="text-xs font-bold text-slate-700">pH 5.0</p>
                                       </div>
                                       <div className="bg-slate-50 p-2 rounded-lg">
                                           <p className="text-[10px] text-slate-400">Nutrients</p>
                                           <p className="text-xs font-bold text-slate-700">High</p>
                                       </div>
                                   </div>
                               </div>
                           </div>
                       </PhoneMockup>
                  </div>
              </div>

          </div>
      </section>

      {/* 3. HOW IT WORKS SECTION (NEW) */}
      <section className="py-20 bg-white dark:bg-slate-900 border-t border-slate-50 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-16">
                  <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-4">{t.howWorksTitle}</h2>
                  <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">{t.howWorksSub}</p>
              </div>

              <div className="grid md:grid-cols-3 gap-8 relative">
                  {/* Connector Line (Desktop) */}
                  <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-emerald-100 via-emerald-200 to-emerald-100 dark:from-emerald-900 dark:via-emerald-800 dark:to-emerald-900 w-2/3 mx-auto z-0"></div>

                  {/* Step 1 */}
                  <div className="relative z-10 flex flex-col items-center text-center">
                      <div className="w-24 h-24 bg-white dark:bg-slate-800 border-4 border-emerald-50 dark:border-emerald-900/50 rounded-full flex items-center justify-center mb-6 shadow-sm">
                          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center text-[#0F5132] dark:text-emerald-400">
                              <Radio size={32} />
                          </div>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{t.step1Title}</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed px-4">{t.step1Desc}</p>
                  </div>

                  {/* Step 2 */}
                  <div className="relative z-10 flex flex-col items-center text-center">
                      <div className="w-24 h-24 bg-white dark:bg-slate-800 border-4 border-emerald-50 dark:border-emerald-900/50 rounded-full flex items-center justify-center mb-6 shadow-sm">
                          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center text-[#0F5132] dark:text-emerald-400">
                              <Smartphone size={32} />
                          </div>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{t.step2Title}</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed px-4">{t.step2Desc}</p>
                  </div>

                  {/* Step 3 */}
                  <div className="relative z-10 flex flex-col items-center text-center">
                      <div className="w-24 h-24 bg-white dark:bg-slate-800 border-4 border-emerald-50 dark:border-emerald-900/50 rounded-full flex items-center justify-center mb-6 shadow-sm">
                          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center text-[#0F5132] dark:text-emerald-400">
                              <Sprout size={32} />
                          </div>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{t.step3Title}</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed px-4">{t.step3Desc}</p>
                  </div>
              </div>
          </div>
      </section>

      {/* 4. REGENERATION STATS */}
      <section className="py-20 bg-[#FAFAF9] dark:bg-slate-800">
          <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
              <div className="relative h-[600px] rounded-[3rem] overflow-hidden shadow-2xl">
                  <img src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Hills" />
                  <div className="absolute bottom-8 left-8 right-8 text-white">
                      <h3 className="text-2xl font-bold mb-2">Yield Prediction with AI</h3>
                      <p className="text-sm text-slate-200">Forecasting based on historical data, weather, and soil conditions.</p>
                  </div>
              </div>
              <div>
                  <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
                      {t.statsTitle}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-12">
                      {t.statsSub}
                  </p>
                  <button onClick={() => onNavigate('features')} className="px-6 py-3 bg-[#0F5132] text-white rounded-full font-bold text-sm mb-16 hover:bg-[#0a3622] transition-colors">
                      Explore Cases
                  </button>

                  <div className="space-y-12">
                      <div>
                          <h3 className="text-5xl font-bold text-[#0F5132] dark:text-emerald-400 mb-2">{t.stat1}</h3>
                          <p className="text-slate-500 dark:text-slate-400">{t.stat1Desc}</p>
                      </div>
                      <div>
                          <h3 className="text-5xl font-bold text-[#0F5132] dark:text-emerald-400 mb-2">{t.stat2}</h3>
                          <p className="text-slate-500 dark:text-slate-400">{t.stat2Desc}</p>
                      </div>
                      <div>
                          <h3 className="text-5xl font-bold text-[#0F5132] dark:text-emerald-400 mb-2">{t.stat3}</h3>
                          <p className="text-slate-500 dark:text-slate-400">{t.stat3Desc}</p>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* 5. TESTIMONIALS SECTION (NEW) */}
      <section className="py-24 bg-[#0F5132] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

          <div className="max-w-7xl mx-auto px-6 relative z-10">
              <div className="text-center mb-16">
                  <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">{t.testimonialsTitle}</h2>
                  <p className="text-emerald-100/80 max-w-2xl mx-auto">{t.testimonialsSub}</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                  {/* Testimonial 1 */}
                  <div className="bg-[#1a4223] p-8 rounded-[2rem] border border-white/5 relative group hover:-translate-y-2 transition-transform duration-300">
                      <Quote className="text-emerald-500/20 absolute top-6 right-6" size={48} />
                      <p className="text-emerald-50 text-lg leading-relaxed mb-8 relative z-10">"{t.test1Quote}"</p>
                      <div className="flex items-center gap-4">
                          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" className="w-12 h-12 rounded-full border-2 border-emerald-500/30 bg-emerald-800" alt="User" />
                          <div>
                              <h4 className="font-bold text-white text-base">{t.test1Author}</h4>
                              <p className="text-xs text-emerald-300 font-medium uppercase tracking-wider">{t.test1Role}</p>
                          </div>
                      </div>
                  </div>

                  {/* Testimonial 2 */}
                  <div className="bg-[#1a4223] p-8 rounded-[2rem] border border-white/5 relative group hover:-translate-y-2 transition-transform duration-300">
                      <Quote className="text-emerald-500/20 absolute top-6 right-6" size={48} />
                      <p className="text-emerald-50 text-lg leading-relaxed mb-8 relative z-10">"{t.test2Quote}"</p>
                      <div className="flex items-center gap-4">
                          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka" className="w-12 h-12 rounded-full border-2 border-emerald-500/30 bg-emerald-800" alt="User" />
                          <div>
                              <h4 className="font-bold text-white text-base">{t.test2Author}</h4>
                              <p className="text-xs text-emerald-300 font-medium uppercase tracking-wider">{t.test2Role}</p>
                          </div>
                      </div>
                  </div>

                  {/* Testimonial 3 */}
                  <div className="bg-[#1a4223] p-8 rounded-[2rem] border border-white/5 relative group hover:-translate-y-2 transition-transform duration-300">
                      <Quote className="text-emerald-500/20 absolute top-6 right-6" size={48} />
                      <p className="text-emerald-50 text-lg leading-relaxed mb-8 relative z-10">"{t.test3Quote}"</p>
                      <div className="flex items-center gap-4">
                          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jude" className="w-12 h-12 rounded-full border-2 border-emerald-500/30 bg-emerald-800" alt="User" />
                          <div>
                              <h4 className="font-bold text-white text-base">{t.test3Author}</h4>
                              <p className="text-xs text-emerald-300 font-medium uppercase tracking-wider">{t.test3Role}</p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* 6. FOOTER CTA */}
      <section className="relative h-[500px] flex items-center justify-center text-center px-6">
          <div className="absolute inset-0 bg-black">
              <img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2000&auto=format&fit=crop" className="w-full h-full object-cover opacity-40" alt="Field" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
          </div>
          <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                  {t.ctaTitle}
              </h2>
              <p className="text-slate-300 text-lg mb-10">
                  {t.ctaDesc}
              </p>
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto relative">
                  {subscribed ? (
                       <div className="absolute inset-0 flex items-center justify-center bg-[#0F5132] rounded-full text-white font-bold animate-fade-in shadow-xl">
                            <Check className="mr-2" size={20} /> Subscribed Successfully!
                       </div>
                  ) : null}
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.placeholder} 
                    className="px-6 py-4 rounded-full bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F5132] flex-1"
                    required
                  />
                  <button 
                    type="submit"
                    className="px-8 py-4 bg-[#0F5132] text-white rounded-full font-bold hover:bg-[#0a3622] transition-colors shadow-lg"
                  >
                      {t.subscribe}
                  </button>
              </form>
              {subscribeError && (
                  <p className="text-red-300 mt-4 text-sm font-medium">{subscribeError}</p>
              )}
          </div>
      </section>
    </div>
  );
};

