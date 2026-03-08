import React, { useState } from 'react';
import { Heart, Zap, Users, ArrowRight, MapPin, CheckCircle2, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Language, translations } from '../utils/translations';
import { contentService } from '../services/content';

interface CareersProps {
    language?: Language;
}

const valueIconMap: Record<string, any> = {
    heart: Heart,
    zap: Zap,
    users: Users,
};

const valueIconStyleMap: Record<string, string> = {
    heart: 'bg-emerald-50 text-[#0F5132]',
    zap: 'bg-blue-50 text-blue-600',
    users: 'bg-purple-50 text-purple-600',
};

export const Careers: React.FC<CareersProps> = ({ language = 'en' }) => {
    const t = translations[language].careers;
    const [applyingFor, setApplyingFor] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['content', 'careers'],
        queryFn: () => contentService.getCareers(),
        staleTime: 60 * 1000,
    });

    const positions = data?.data?.positions || [];
    const values = data?.data?.values || [];

    const handleApply = async (id: string | undefined, title: string) => {
        setApplyingFor(title);
        setIsSubmitting(true);
        setErrorMsg(null);

        try {
            await contentService.submitCareerInterest(id, title);
            setSuccessMsg(`Application for ${title} submitted!`);
            setTimeout(() => setSuccessMsg(null), 4000);
        } catch {
            setErrorMsg(`Failed to submit application for ${title}.`);
            setTimeout(() => setErrorMsg(null), 4000);
        } finally {
            setIsSubmitting(false);
            setApplyingFor(null);
        }
    };

    return (
        <div className="bg-[#FAFAF9] min-h-screen pt-24 pb-20 animate-fade-in font-sans text-slate-900 relative">
            {successMsg && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
                    <div className="bg-[#0F5132] text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 font-bold text-sm">
                        <CheckCircle2 size={18} /> {successMsg}
                    </div>
                </div>
            )}
            {errorMsg && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
                    <div className="bg-red-600 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 font-bold text-sm">
                        <CheckCircle2 size={18} /> {errorMsg}
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6">
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

                {isLoading && (
                    <div className="text-center text-slate-500 mb-10">Loading careers content...</div>
                )}
                {isError && (
                    <div className="text-center mb-10">
                        <p className="text-red-500 mb-3">Failed to load careers content.</p>
                        <button
                            onClick={() => refetch()}
                            className="px-4 py-2 rounded-full bg-[#0F5132] text-white text-sm font-bold"
                        >
                            Retry
                        </button>
                    </div>
                )}

                <div className="grid md:grid-cols-3 gap-8 mb-24">
                    {values.map((value, index) => {
                        const iconKey = String(value.icon || '').toLowerCase();
                        const Icon = valueIconMap[iconKey] || Heart;
                        const iconStyle = valueIconStyleMap[iconKey] || valueIconStyleMap.heart;

                        return (
                            <div key={value.id || `${value.title}-${index}`} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${iconStyle}`}>
                                    <Icon size={24} />
                                </div>
                                <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                                <p className="text-slate-500 leading-relaxed">{value.desc}</p>
                            </div>
                        );
                    })}
                </div>

                <div className="bg-white rounded-[3rem] p-10 md:p-16 border border-slate-100 shadow-sm">
                    <h2 className="text-3xl font-bold text-slate-900 mb-10">{t.openings}</h2>

                    <div className="grid gap-6">
                        {positions.map((job, i) => (
                            <div key={job.id || `${job.title}-${i}`} className="group flex flex-col md:flex-row md:items-center justify-between p-6 rounded-[2rem] border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all cursor-pointer">
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
                                        onClick={() => handleApply(job.id, job.title)}
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

                    {!isLoading && !isError && positions.length === 0 && (
                        <div className="text-center text-slate-500 mt-8">No open positions available yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
};
