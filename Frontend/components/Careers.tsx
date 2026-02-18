import React, { useState } from 'react';
import { Briefcase, Heart, Zap, Users, ArrowRight, MapPin, CheckCircle2, Loader2 } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface CareersProps {
    language?: Language;
}

export const Careers: React.FC<CareersProps> = ({ language = 'en' }) => {
    const t = translations[language].careers;
    const [applyingFor, setApplyingFor] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleApply = (title: string) => {
        setApplyingFor(title);
        setIsSubmitting(true);
        // Simulate API
        setTimeout(() => {
            setIsSubmitting(false);
            setSuccessMsg(`Application for ${title} submitted!`);
            setApplyingFor(null);
            setTimeout(() => setSuccessMsg(null), 4000);
        }, 1500);
    };

    const positions = [
        {
            title: "Senior Agronomist",
            department: "Operations",
            location: "Rwamagana (Hybrid)",
            type: "Full-Time",
            desc: "Lead our field research and help calibrate our AI models with ground-truth data."
        },
        {
            title: "Senior React Engineer",
            department: "Engineering",
            location: "Kigali",
            type: "Full-Time",
            desc: "Build the next generation of our farm management dashboard and mobile tools."
        },
        {
            title: "Community Manager",
            department: "Sales",
            location: "Musanze",
            type: "Contract",
            desc: "Engage with local cooperatives and train farmers on digital adoption."
        },
        {
            title: "Data Scientist (IoT)",
            department: "Product",
            location: "Remote",
            type: "Full-Time",
            desc: "Analyze sensor data streams to improve our irrigation algorithms."
        }
    ];

    return (
        <div className="bg-[#FAFAF9] min-h-screen pt-24 pb-20 animate-fade-in font-sans text-slate-900 relative">
            
            {/* Success Toast */}
            {successMsg && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
                    <div className="bg-[#0F5132] text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 font-bold text-sm">
                        <CheckCircle2 size={18} /> {successMsg}
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6">
                
                {/* Hero */}
                <div className="text-center max-w-3xl mx-auto mb-20">
                     <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[#0F5132] text-xs font-bold uppercase tracking-wider mb-6">
                        We're Hiring
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 leading-[1.1] tracking-tight">
                        {t.title}
                    </h1>
                    <p className="text-xl text-slate-500 leading-relaxed">
                        {t.subtitle}
                    </p>
                </div>

                {/* Values Grid */}
                <div className="grid md:grid-cols-3 gap-8 mb-24">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-[#0F5132] mb-6">
                            <Heart size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Impact First</h3>
                        <p className="text-slate-500 leading-relaxed">
                            Every line of code and every field visit directly improves the livelihood of a smallholder farmer.
                        </p>
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                            <Zap size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Innovation</h3>
                        <p className="text-slate-500 leading-relaxed">
                            We combine ancient wisdom with cutting-edge AI and IoT to solve real-world problems.
                        </p>
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-6">
                            <Users size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Community</h3>
                        <p className="text-slate-500 leading-relaxed">
                            We build with our users, not just for them. Regular field visits are part of everyone's job.
                        </p>
                    </div>
                </div>

                {/* Open Positions */}
                <div className="bg-white rounded-[3rem] p-10 md:p-16 border border-slate-100 shadow-sm">
                    <h2 className="text-3xl font-bold text-slate-900 mb-10">{t.openings}</h2>
                    
                    <div className="grid gap-6">
                        {positions.map((job, i) => (
                            <div key={i} className="group flex flex-col md:flex-row md:items-center justify-between p-6 rounded-[2rem] border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all cursor-pointer">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">{job.department}</span>
                                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><MapPin size={12} /> {job.location}</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">{job.title}</h3>
                                    <p className="text-slate-500 text-sm max-w-xl">{job.desc}</p>
                                </div>
                                <div className="mt-6 md:mt-0">
                                    <button 
                                        onClick={() => handleApply(job.title)}
                                        disabled={isSubmitting && applyingFor === job.title}
                                        className="px-6 py-3 rounded-full bg-white border border-slate-200 text-slate-900 font-bold text-sm group-hover:bg-[#0F5132] group-hover:text-white group-hover:border-[#0F5132] transition-colors flex items-center gap-2 min-w-[140px] justify-center"
                                    >
                                        {isSubmitting && applyingFor === job.title ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <>{t.apply} <ArrowRight size={16} /></>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};