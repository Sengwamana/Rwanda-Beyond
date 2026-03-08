import React, { useState } from 'react';
import { Search, Plus, Minus, MessageSquare, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Language, translations } from '../utils/translations';
import { contentService } from '../services/content';

interface FAQProps {
    language?: Language;
}

export const FAQ: React.FC<FAQProps> = ({ language = 'en' }) => {
    const t = translations[language].faq;
    const [openIndex, setOpenIndex] = useState<number | null>(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['content', 'faq'],
        queryFn: () => contentService.getFAQ(),
        staleTime: 60 * 1000,
    });

    const faqs = data?.data?.items || [];
    const categories = data?.data?.categories || [];

    const filteredFAQs = faqs.filter((item) => {
        const question = item.question || '';
        const answer = item.answer || '';
        const matchesSearch = question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              answer.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = !selectedCategory || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="bg-[#FAFAF9] min-h-screen pt-24 pb-20 animate-fade-in font-sans text-slate-900">
            <div className="max-w-4xl mx-auto px-6">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[#0F5132] text-xs font-bold uppercase tracking-wider mb-6">
                        Support
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight tracking-tight">
                        {t.title}
                    </h1>
                    <p className="text-xl text-slate-500 leading-relaxed mb-10">
                        {t.subtitle}
                    </p>

                    <div className="relative max-w-lg mx-auto">
                        <Search className="absolute left-5 top-4 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search for help..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-12 py-4 bg-white border border-slate-200 rounded-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium shadow-sm transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
                    {categories.map((cat: string, i: number) => (
                        <button
                            key={i}
                            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                            className={`p-4 border rounded-2xl font-bold transition-all shadow-sm ${
                                selectedCategory === cat
                                    ? 'bg-[#0F5132] text-white border-[#0F5132]'
                                    : 'bg-white text-slate-600 border-slate-100 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {isLoading && (
                    <div className="text-center text-slate-500 mb-8">Loading FAQ...</div>
                )}
                {isError && (
                    <div className="text-center mb-8">
                        <p className="text-red-500 mb-3">Failed to load FAQ content.</p>
                        <button
                            onClick={() => refetch()}
                            className="px-4 py-2 rounded-full bg-[#0F5132] text-white text-sm font-bold"
                        >
                            Retry
                        </button>
                    </div>
                )}

                <div className="space-y-4 mb-20 min-h-[300px]">
                    {filteredFAQs.length > 0 ? (
                        filteredFAQs.map((item, i) => (
                            <div
                                key={item.id || `${item.category}-${i}`}
                                className={`bg-white rounded-[2rem] border transition-all duration-300 overflow-hidden ${openIndex === i ? 'border-emerald-200 shadow-md' : 'border-slate-100 shadow-sm'}`}
                            >
                                <button
                                    onClick={() => setOpenIndex(openIndex === i ? null : i)}
                                    className="w-full flex items-center justify-between p-6 md:p-8 text-left focus:outline-none"
                                >
                                    <span className="font-bold text-lg md:text-xl text-slate-900 pr-8">{item.question}</span>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${openIndex === i ? 'bg-[#0F5132] text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {openIndex === i ? <Minus size={16} /> : <Plus size={16} />}
                                    </div>
                                </button>
                                <div
                                    className={`px-6 md:px-8 pb-8 text-slate-500 leading-relaxed transition-all duration-300 ${openIndex === i ? 'block opacity-100' : 'hidden opacity-0'}`}
                                >
                                    {item.answer}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-slate-400 font-medium">No results found matching your criteria.</p>
                            <button onClick={() => { setSearchQuery(''); setSelectedCategory(null); }} className="text-[#0F5132] font-bold mt-2 underline">Clear Filters</button>
                        </div>
                    )}
                </div>

                <div className="bg-[#0F5132] rounded-[3rem] p-10 md:p-16 text-center text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md border border-white/10">
                            <MessageSquare size={32} />
                        </div>
                        <h2 className="text-3xl font-bold mb-4">{t.stillNeedHelp}</h2>
                        <p className="text-emerald-100 mb-8 max-w-md mx-auto">
                            Our agronomy support team is available Mon-Fri, 8am - 6pm.
                        </p>
                        <button className="px-8 py-4 bg-white text-[#0F5132] rounded-full font-bold hover:bg-emerald-50 transition-colors shadow-lg">
                            {t.contact}
                        </button>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                </div>
            </div>
        </div>
    );
};
