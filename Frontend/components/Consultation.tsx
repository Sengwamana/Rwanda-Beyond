import React, { useEffect, useState } from 'react';
import { Calendar, User, Mail, MessageSquare, MapPin, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { contentService } from '../services/content';
import { handleApiError } from '../services/api';

interface ConsultationProps {
    language?: Language;
}

export const Consultation: React.FC<ConsultationProps> = ({ language = 'en' }) => {
    const t = translations[language].consultation;
    const defaultTopic = t.topics?.[0] ?? 'Soil Health';
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        size: '',
        topic: defaultTopic,
        message: ''
    });

    useEffect(() => {
        if (!t.topics.includes(formData.topic)) {
            setFormData((prev) => ({ ...prev, topic: defaultTopic }));
        }
    }, [defaultTopic, formData.topic, t.topics]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            await contentService.submitConsultation({
                name: formData.name.trim(),
                size: formData.size.trim() || undefined,
                topic: formData.topic.trim(),
                message: formData.message.trim(),
                language,
            });
            setIsLoading(false);
            setIsSuccess(true);
            setFormData({ name: '', size: '', topic: defaultTopic, message: '' });
            setTimeout(() => setIsSuccess(false), 5000);
        } catch (submitError) {
            setIsLoading(false);
            setError(handleApiError(submitError));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="bg-[#FAFAF9] dark:bg-slate-900 min-h-screen pt-24 pb-20 animate-fade-in font-sans text-slate-900 dark:text-white transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-6">
                
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-20">
                     <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 text-[#0F5132] dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
                        Expert Advice
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold text-slate-900 dark:text-white mb-6 leading-[1.1] tracking-tight">
                        {t.title}
                    </h1>
                    <p className="text-xl text-slate-500 dark:text-slate-400 leading-relaxed">
                        {t.subtitle}
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
                    
                    {/* Contact Info Card */}
                    <div className="bg-[#0F5132] text-white rounded-[2.5rem] p-10 md:p-12 shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 space-y-10">
                            <div>
                                <h3 className="text-3xl font-bold mb-4">Our Head Office</h3>
                                <p className="text-emerald-100 text-lg leading-relaxed">Kigali Heights, 4th Floor<br/>Kigali, Rwanda</p>
                            </div>
                            
                            <div className="space-y-6">
                                <div className="flex items-center gap-6 group">
                                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-colors">
                                        <Mail size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-1">Email Us</p>
                                        <p className="font-bold text-xl">experts@rwandabeyond.rw</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 group">
                                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-colors">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-1">Call Us</p>
                                        <p className="font-bold text-xl">+250 788 000 000</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Decor */}
                        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                    </div>

                    {/* Booking Form */}
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                         {isSuccess && (
                            <div className="absolute inset-0 z-20 bg-white/95 dark:bg-slate-800/95 flex flex-col items-center justify-center text-center p-8 animate-fade-in">
                                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 text-[#0F5132] dark:text-emerald-400 rounded-full flex items-center justify-center mb-6">
                                    <CheckCircle2 size={40} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Request Received!</h3>
                                <p className="text-slate-500 dark:text-slate-400">We'll contact you within 24 hours to schedule.</p>
                                <button 
                                    onClick={() => setIsSuccess(false)}
                                    className="mt-8 text-sm font-bold text-[#0F5132] dark:text-emerald-400 underline"
                                >
                                    Submit another request
                                </button>
                            </div>
                        )}

                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">{t.formTitle}</h3>
                        {error && (
                            <div className="mb-6 rounded-2xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-4 py-3 text-sm font-medium">
                                {error}
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">{t.name}</label>
                                <input 
                                    type="text" 
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium placeholder:text-slate-400" 
                                    placeholder="Jean Claude" 
                                    required
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">{t.farmSize}</label>
                                    <input 
                                        type="number" 
                                        name="size"
                                        value={formData.size}
                                        onChange={handleChange}
                                        placeholder="2.5" 
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium placeholder:text-slate-400" 
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">{t.topic}</label>
                                    <div className="relative">
                                        <select 
                                            name="topic"
                                            value={formData.topic}
                                            onChange={handleChange}
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium appearance-none cursor-pointer"
                                        >
                                            {t.topics.map((topic: string, i: number) => (
                                                <option key={i} value={topic}>{topic}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">{t.message}</label>
                                <textarea 
                                    name="message"
                                    value={formData.message}
                                    onChange={handleChange}
                                    rows={4} 
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium resize-none placeholder:text-slate-400" 
                                    placeholder="I need help with..."
                                    required
                                ></textarea>
                            </div>

                            <button 
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-4 bg-[#0F5132] text-white rounded-full font-bold hover:bg-[#0a3622] transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <>{t.submit} <ArrowRight size={18} /></>}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
