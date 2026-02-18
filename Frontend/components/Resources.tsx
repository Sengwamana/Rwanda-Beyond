import React, { useState } from 'react';
import { ArrowUpRight, Video, FileText, Calendar } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface ResourcesProps {
    language?: Language;
}

export const Resources: React.FC<ResourcesProps> = ({ language = 'en' }) => {
    const t = translations[language].resources;
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    const posts = [
        {
            category: "Guides",
            title: "Maximizing Maize Yields in Highland Terrain",
            image: "https://images.unsplash.com/photo-1551754655-cd27e38d2076?q=80&w=800&auto=format&fit=crop",
            desc: "Learn the best practices for soil conservation and crop spacing in Rwamagana's unique topography.",
            type: "article",
            date: "Aug 12, 2024"
        },
        {
            category: "Tech",
            title: "How to Use the IoT Soil Sensor",
            image: "https://images.unsplash.com/photo-1581092335397-9583eb92d232?q=80&w=800&auto=format&fit=crop",
            desc: "A step-by-step video guide on installing and maintaining your LoRaWAN sensors.",
            type: "video",
            date: "Aug 10, 2024"
        },
        {
            category: "Stories",
            title: "Success Story: Cooperative Abahuza",
            image: "https://images.unsplash.com/photo-1595841696677-6489ff3f8cd1?q=80&w=800&auto=format&fit=crop",
            desc: "How a local cooperative increased their harvest by 40% using SmartTani's data insights.",
            type: "article",
            date: "Aug 05, 2024"
        },
        {
            category: "News",
            title: "New Government Subsidies for 2025",
            image: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=800&auto=format&fit=crop",
            desc: "Find out if you are eligible for the new equipment grants for solar-powered irrigation.",
            type: "article",
            date: "July 28, 2024"
        }
    ];

    // Map localized categories back to English data keys if needed, 
    // or mostly rely on index since t.categories is an array
    const categoryMap: Record<string, string> = {
        'Guides': 'Guides', 'Inyandiko': 'Guides',
        'News': 'News', 'Amakuru': 'News', 'Actu': 'News',
        'Tech': 'Tech', 'Ikoranabuhanga': 'Tech',
        'Stories': 'Stories', 'Ubuhamya': 'Stories', 'Histoires': 'Stories'
    };

    const filteredPosts = activeCategory 
        ? posts.filter(post => post.category === categoryMap[activeCategory] || post.category === activeCategory)
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
                        {t.categories.map((cat: string, i: number) => (
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

            </div>
        </div>
    );
};