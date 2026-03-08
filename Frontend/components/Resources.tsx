import React, { useState } from 'react';
import { ArrowUpRight, Video, FileText, Calendar } from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { useQuery } from '@tanstack/react-query';
import { contentService } from '../services/content';

interface ResourcesProps {
    language?: Language;
}

export const Resources: React.FC<ResourcesProps> = ({ language = 'en' }) => {
    const t = translations[language].resources;
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['content', 'resources'],
        queryFn: () => contentService.getResources(),
        staleTime: 60 * 1000,
    });

    const posts = data?.data?.items || [];
    const categories = data?.data?.categories || [];
    const filteredPosts = activeCategory 
        ? posts.filter(post => post.category === activeCategory)
        : posts;

    return (
        <div className="bg-[#FAFAF9] dark:bg-slate-900 min-h-screen pt-24 pb-20 animate-fade-in font-sans text-slate-900 dark:text-white transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-6">
                
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-20">
                     <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 text-[#0F5132] dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
                        Latest Updates
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold text-slate-900 dark:text-white mb-6 leading-[1.1] tracking-tight">
                        {t.title}
                    </h1>
                    <p className="text-xl text-slate-500 dark:text-slate-400 leading-relaxed">
                        {t.subtitle}
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center mt-10">
                        <button 
                            onClick={() => setActiveCategory(null)}
                            className={`px-6 py-2.5 rounded-full border text-sm font-bold transition-colors shadow-sm ${!activeCategory ? 'bg-[#0F5132] text-white border-[#0F5132]' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                            All
                        </button>
                        {categories.map((cat: string, i: number) => (
                            <button 
                                key={i} 
                                onClick={() => setActiveCategory(cat)}
                                className={`px-6 py-2.5 rounded-full border text-sm font-bold transition-colors shadow-sm ${activeCategory === cat ? 'bg-[#0F5132] text-white border-[#0F5132]' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {isLoading && (
                    <div className="text-center text-slate-500 dark:text-slate-400 mb-8">Loading resources...</div>
                )}
                {isError && (
                    <div className="text-center mb-8">
                        <p className="text-red-500 mb-3">Failed to load resources.</p>
                        <button
                            onClick={() => refetch()}
                            className="px-4 py-2 rounded-full bg-[#0F5132] text-white text-sm font-bold"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Grid */}
                <div className="grid md:grid-cols-3 gap-8">
                    {filteredPosts.map((post, i) => (
                        <div key={i} className="bg-white dark:bg-slate-800 rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group cursor-pointer h-full flex flex-col">
                            <div className="h-64 overflow-hidden relative">
                                <img src={post.image} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" alt={post.title} />
                                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-slate-900 uppercase tracking-wider border border-white/20 shadow-sm">
                                    {post.category}
                                </div>
                            </div>
                            <div className="p-8 flex-1 flex flex-col">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-4">
                                        <Calendar size={12} /> {post.date}
                                    </div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 group-hover:text-[#0F5132] dark:group-hover:text-emerald-400 transition-colors leading-tight">{post.title}</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 flex-1 leading-relaxed">
                                    {post.desc}
                                </p>
                                <div className="flex justify-between items-center pt-6 border-t border-slate-50 dark:border-slate-700">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide bg-slate-50 dark:bg-slate-700 px-3 py-1 rounded-lg group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 group-hover:text-[#0F5132] dark:group-hover:text-emerald-400 transition-colors">
                                        {post.type === 'video' ? <Video size={14} /> : <FileText size={14} />}
                                        {post.type === 'video' ? 'Video Tutorial' : '5 Min Read'}
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover:bg-[#0F5132] group-hover:text-white transition-all duration-300">
                                        <ArrowUpRight size={20} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {!isLoading && !isError && filteredPosts.length === 0 && (
                    <div className="text-center text-slate-500 dark:text-slate-400 mt-8">
                        No resources available yet.
                    </div>
                )}

            </div>
        </div>
    );
};
