import React, { useState } from 'react';
import { Sprout, Mail, Lock, ArrowRight, Loader2, User, ShieldCheck, Activity } from 'lucide-react';
import { useSignIn } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '../types';
import { Language, translations } from '../utils/translations';

interface LoginProps {
  onLogin: (role: UserRole) => void;
  onNavigate: (page: any) => void;
  language?: Language;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onNavigate, language = 'en' }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const { signIn, setActive, isLoaded } = useSignIn();
  const navigate = useNavigate();
  
  const t = translations[language].login;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn.create({
        identifier: email,
        password: password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        navigate('/dashboard');
      } else {
        // Handle other statuses (e.g., needs second factor)
        console.log('Sign in needs additional steps:', result.status);
        setError('Additional verification required. Please check your email.');
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.errors?.[0]?.longMessage || err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Demo login - redirects to Clerk sign-in
  const handleDemoLogin = (role: UserRole) => {
    navigate('/sign-in');
  };

  return (
    <div className="min-h-screen bg-[#F4F1EA] dark:bg-slate-900 flex animate-fade-in transition-colors duration-300">
      {/* Left: Image / Branding */}
      <div className="hidden lg:flex w-1/2 relative bg-[#2D5A27] text-white flex-col justify-between p-12 overflow-hidden">
        {/* Background Image: Tea Plantation */}
        <img 
            src="https://images.unsplash.com/photo-1598512752271-33f913a5af13?q=80&w=2000&auto=format&fit=crop" 
            className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay"
            alt="Farming"
        />
        {/* Gradient Overlay for Readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/50 to-[#2D5A27]/50 pointer-events-none"></div>
        
        <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
                <div className="bg-white/10 p-2 rounded-lg backdrop-blur-md">
                    <Sprout size={24} className="text-[#4ade80]" />
                </div>
                <span className="text-xl font-bold tracking-tight">RwandaBeyond</span>
            </div>
            <h1 className="text-5xl font-bold leading-tight mb-4">
                Cultivating Intelligence. <br/> Harvesting Success.
            </h1>
            <p className="text-emerald-100 text-lg max-w-md">
                Join 1,200+ farmers in Rwamagana using data to increase yields by up to 40%.
            </p>
        </div>

        <div className="relative z-10 flex gap-4 text-sm font-medium text-emerald-200/80">
            <span>© 2024 RwandaBeyond</span>
            <span>Privacy Policy</span>
            <span>Terms</span>
        </div>
      </div>

      {/* Right: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
            <div className="text-center lg:text-left">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{t.welcome}</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">{t.subtitle}</p>
            </div>

            {/* Quick Demo Login Buttons (Prototype Feature) */}
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t.proto}</p>
                <div className="grid grid-cols-3 gap-2">
                    <button 
                        onClick={() => handleDemoLogin('farmer')}
                        disabled={isLoading}
                        className="flex flex-col items-center justify-center gap-2 p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:border-emerald-500 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shadow-sm group"
                    >
                        <User size={20} className="text-slate-400 group-hover:text-emerald-500" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">{t.farmer}</span>
                    </button>
                    <button 
                        onClick={() => handleDemoLogin('expert')}
                        disabled={isLoading}
                        className="flex flex-col items-center justify-center gap-2 p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:border-purple-500 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-all shadow-sm group"
                    >
                        <Activity size={20} className="text-slate-400 group-hover:text-purple-500" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">{t.expert}</span>
                    </button>
                    <button 
                        onClick={() => handleDemoLogin('admin')}
                        disabled={isLoading}
                        className="flex flex-col items-center justify-center gap-2 p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm group"
                    >
                        <ShieldCheck size={20} className="text-slate-400 group-hover:text-blue-500" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">{t.admin}</span>
                    </button>
                </div>
            </div>

            <div className="relative flex items-center gap-4 py-2">
                <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                <span className="text-xs font-bold text-slate-400 uppercase">{t.secure}</span>
                <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.email}</label>
                    <div className="relative">
                        <Mail className="absolute left-4 top-3.5 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="e.g. jean@farm.rw"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.password}</label>
                        <button type="button" className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">{t.forgot}</button>
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-4 top-3.5 text-slate-400" size={18} />
                        <input 
                            type="password" 
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium transition-all"
                        />
                    </div>
                </div>

                <button 
                    type="submit"
                    disabled={isLoading || !isLoaded}
                    className="w-full bg-[#2D5A27] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#1a3817] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : <>{t.signIn} <ArrowRight size={18} /></>}
                </button>
            </form>

            <p className="text-center text-slate-500 text-sm">
                {t.noAccount} {' '}
                <button onClick={() => onNavigate('signup')} className="font-bold text-[#2D5A27] dark:text-emerald-400 hover:underline">
                    {t.create}
                </button>
            </p>
        </div>
      </div>
    </div>
  );
};