import React, { useState } from 'react';
import { Search, HelpCircle, ChevronDown, Plus, Minus, MessageSquare, X } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface FAQProps {
    language?: Language;
}

export const FAQ: React.FC<FAQProps> = ({ language = 'en' }) => {
    const t = translations[language].faq;
    const [openIndex, setOpenIndex] = useState<number | null>(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Mapped categories for easier filtering
    const categoriesMap = {
        'General': ['General', 'Rusange', 'Général'],
        'Sensors': ['Sensors', 'Ibyuma', 'Capteurs'],
        'Billing': ['Billing', 'Kwishyura', 'Facturation'],
        'Account': ['Account', 'Konti', 'Compte']
    };

    const faqs = [
        {
            category: 'Sensors',
            question: "How do I install the soil sensors?",
            answer: "Our sensors are plug-and-play. Simply push the probe into the soil up to the marked line, ensure the solar panel faces the sun, and wait 5 minutes for the green LED to blink. It will automatically connect to the nearest gateway."
        },
        {
            category: 'General',
            question: "Does the app work without internet?",
            answer: "Yes! Our critical features work via SMS and USSD (*775#). The smartphone app caches data so you can view your last known status even when offline, and syncs when you reconnect."
        },
        {
            category: 'Billing',
            question: "How do I pay for my subscription?",
            answer: "We accept Mobile Money (MTN MoMo and Airtel Money). Go to Settings > Billing in the app, or dial *775*3# to pay via USSD."
        },
        {
            category: 'Sensors',
            question: "What if my sensor stops working?",
            answer: "If a sensor goes offline for more than 24 hours, we'll send you an alert. Basic troubleshooting guides are available in the app. If it's a hardware fault, we replace it for free under the Pro plan."
        },
        {
            category: 'Account',
            question: "Can I share my account with my family?",
            answer: "Yes, the Pro plan allows up to 3 users to access the same farm dashboard. You can invite them via their phone number in the Settings menu."
        }
    ];

    const filteredFAQs = faqs.filter(item => {
        const matchesSearch = item.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              item.answer.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Map translated category back to English key if selected
        let matchesCategory = true;
        if (selectedCategory) {
             const key = Object.keys(categoriesMap).find(k => categoriesMap[k as keyof typeof categoriesMap].includes(selectedCategory));
             matchesCategory = item.category === key;
        }

        return matchesSearch && matchesCategory;
    });

    return (
        <div className="bg-[#FAFAF9] min-h-screen pt-24 pb-20 animate-fade-in font-sans text-slate-900">
            <div className="max-w-4xl mx-auto px-6">
                
                {/* Header */}
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

                    {/* Search Bar */}
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

                {/* Categories */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
                    {t.categories.map((cat: string, i: number) => (
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

                {/* Accordion */}
                <div className="space-y-4 mb-20 min-h-[300px]">
                    {filteredFAQs.length > 0 ? (
                        filteredFAQs.map((item, i) => (
                            <div 
                                key={i} 
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
                            <button onClick={() => {setSearchQuery(''); setSelectedCategory(null);}} className="text-[#0F5132] font-bold mt-2 underline">Clear Filters</button>
                        </div>
                    )}
                </div>

                {/* Contact CTA */}
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
                    {/* Background Decor */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                </div>

            </div>
        </div>
    );
};