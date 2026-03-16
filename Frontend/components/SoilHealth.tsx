import React, { useState } from 'react';
import { Beaker, Sprout, RefreshCw, CheckCircle2, CheckSquare, Sparkles, Loader2 } from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { getAgriculturalAdvice } from '../services/ai';
import { useFarmStore } from '../store';

interface SoilHealthProps {
    language?: Language;
}

export const SoilHealth: React.FC<SoilHealthProps> = ({ language = 'en' }) => {
    const t = translations[language].soil;
    const { selectedFarm, farms } = useFarmStore();
    const [isSyncing, setIsSyncing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [actionTaken, setActionTaken] = useState(false);
    const [nutrients, setNutrients] = useState([
        { name: 'Nitrogen (N)', value: 45, max: 100, status: 'Low', color: 'bg-green-400', text: 'text-green-600' },
        { name: 'Phosphorus (P)', value: 82, max: 100, status: 'Optimal', color: 'bg-[#0F5132]', text: 'text-[#0F5132]' },
        { name: 'Potassium (K)', value: 75, max: 100, status: 'Optimal', color: 'bg-[#0F5132]', text: 'text-[#0F5132]' },
    ]);
    const [phLevel, setPhLevel] = useState(6.2);

    const handleSync = () => {
        setIsSyncing(true);
        setTimeout(() => {
            const newN = Math.floor(Math.random() * (95 - 30) + 30);
            const newP = Math.floor(Math.random() * (95 - 50) + 50);
            const newK = Math.floor(Math.random() * (95 - 50) + 50);
            const newPh = (Math.random() * (7.5 - 5.5) + 5.5).toFixed(1);

            setNutrients([
                { 
                    name: 'Nitrogen (N)', 
                    value: newN, 
                    max: 100, 
                    status: newN < 50 ? 'Low' : 'Optimal', 
                    color: newN < 50 ? 'bg-green-400' : 'bg-[#0F5132]', 
                    text: newN < 50 ? 'text-green-600' : 'text-[#0F5132]' 
                },
                { 
                    name: 'Phosphorus (P)', 
                    value: newP, 
                    max: 100, 
                    status: 'Optimal', 
                    color: 'bg-[#0F5132]', 
                    text: 'text-[#0F5132]' 
                },
                { 
                    name: 'Potassium (K)', 
                    value: newK, 
                    max: 100, 
                    status: 'Optimal', 
                    color: 'bg-[#0F5132]', 
                    text: 'text-[#0F5132]' 
                },
            ]);
            setPhLevel(parseFloat(newPh));
            setActionTaken(false); // Reset action status on new data
            setAiInsight(null); // Reset old insight
            setIsSyncing(false);
        }, 2000);
    };

    const runAIAnalysis = async () => {
        if (isAnalyzing) return;
        setIsAnalyzing(true);
        try {
            const prompt = `Act as an expert agronomist for Maize farming in Rwanda. 
            Analyze the following soil sensor data:
            - Nitrogen (N): ${nutrients[0].value} ppm (Status: ${nutrients[0].status})
            - Phosphorus (P): ${nutrients[1].value} ppm
            - Potassium (K): ${nutrients[2].value} ppm
            - pH Level: ${phLevel}

            Context: Maize requires specific NPK ratios. Rwandan soils are often acidic.
            
            Task: Provide a specific, actionable recommendation in 2 sentences. 
            1. Suggest a specific fertilizer common in Rwanda (e.g., DAP, NPK 17-17-17, Urea, or Lime for pH).
            2. Mention the optimal timing for application (e.g., planting, top dressing).`;

            const farmId = selectedFarm?.id || farms[0]?.id;
            const response = await getAgriculturalAdvice({
                question: prompt,
                context: {
                    cropType: 'maize',
                    location: 'Rwamagana, Rwanda',
                    farmId,
                    growthStage: 'vegetative'
                }
            });

            if (response.answer) {
                setAiInsight(response.answer);
            }
        } catch (e) {
            console.error("AI Soil Analysis failed", e);
            setAiInsight("Unable to generate AI insight at this moment. Please check connection.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const isHealthy = nutrients[0].value >= 50;

    return (
        <div className="space-y-8 animate-fade-in">
             <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t.title}</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={runAIAnalysis}
                        disabled={isAnalyzing || isSyncing}
                        className="flex items-center gap-2 px-5 py-3 bg-[#0F5132] text-white font-bold rounded-xl hover:bg-[#0a3622] transition-all shadow-lg disabled:opacity-70"
                    >
                        {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                        {isAnalyzing ? 'Analyzing...' : 'Ask AI Advisor'}
                    </button>
                    <button 
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-70"
                    >
                        <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                        {isSyncing ? 'Syncing...' : 'Sync Sensors'}
                    </button>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-sm shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-700">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-10 flex items-center gap-3 text-xl">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                            <Beaker className="text-[#0F5132] dark:text-emerald-400" size={24} />
                        </div>
                        {t.nutrients}
                    </h3>
                    
                    <div className="space-y-10">
                        {nutrients.map((n) => (
                            <div key={n.name}>
                                <div className="flex justify-between mb-3">
                                    <span className="font-bold text-slate-900 dark:text-white text-base">{n.name}</span>
                                    <span className={`font-bold text-xs bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-full uppercase tracking-wider ${n.text}`}>{n.status}</span>
                                </div>
                                <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${n.color} transition-all duration-1000 ease-out rounded-full shadow-sm`} 
                                        style={{ width: `${n.value}%` }} 
                                    />
                                </div>
                                <div className="mt-3 flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    <span>0 ppm</span>
                                    <span>Target: 90 ppm</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-8">
                    <div className={`p-10 rounded-[2.5rem] shadow-xl relative overflow-hidden flex-1 transition-colors duration-500 ${isHealthy ? 'bg-emerald-600' : 'bg-green-600'}`}>
                        <div className="relative z-10 text-white">
                            <h3 className="font-bold text-2xl mb-6 opacity-90">{t.aiRec}</h3>
                            
                            {/* Dynamic Content Area */}
                            {aiInsight ? (
                                <div className="animate-fade-in">
                                    <div className="flex items-center gap-2 mb-4 text-emerald-100 font-bold uppercase text-xs tracking-wider">
                                        <Sparkles size={14} /> Gemini Analysis
                                    </div>
                                    <p className="text-white/95 leading-relaxed mb-8 text-lg font-medium">
                                        "{aiInsight}"
                                    </p>
                                </div>
                            ) : isHealthy ? (
                                <>
                                    <p className="text-white/90 leading-relaxed mb-8 text-lg">
                                        Soil analysis indicates <span className="font-bold underline decoration-white decoration-2 underline-offset-4">optimal nutrient levels</span>. No immediate fertilization required.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-white/90 leading-relaxed mb-8 text-lg">
                                        Soil analysis indicates a <span className="font-bold underline decoration-white decoration-2 underline-offset-4">Nitrogen deficiency</span> which may stunt leaf growth in the current vegetative stage.
                                    </p>
                                </>
                            )}

                            <div className="bg-white/10 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                                {isHealthy && !aiInsight ? (
                                    <>
                                        <div className="flex items-center gap-3 mb-2">
                                            <CheckCircle2 className="text-white" />
                                            <span className="font-bold">Status: Healthy</span>
                                        </div>
                                        <p className="text-sm text-white/80">Continue monitoring weekly.</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="font-bold text-white text-sm mb-4 uppercase tracking-wider">{t.actionPlan}:</p>
                                        <ul className="list-disc list-inside text-sm text-white/90 space-y-3 font-medium mb-6">
                                            <li>Apply Urea (46-0-0) fertilizer.</li>
                                            <li>Recommended Rate: 50kg per hectare.</li>
                                            <li>Apply before next forecasted rain.</li>
                                        </ul>
                                        <button 
                                            onClick={() => setActionTaken(!actionTaken)}
                                            className="w-full py-3 bg-white text-green-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-50 transition-colors"
                                        >
                                            {actionTaken ? (
                                                <><CheckCircle2 size={18} /> Marked as Done</>
                                            ) : (
                                                <><CheckSquare size={18} /> Mark Action Taken</>
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        <Sprout className="absolute -bottom-10 -right-10 text-white/20 w-72 h-72 rotate-12" />
                    </div>
                    
                    <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-sm shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.phLevel}</p>
                            <div className="flex items-baseline gap-3">
                                <span className="text-5xl font-bold text-slate-900 dark:text-white tracking-tight">{phLevel}</span>
                                <span className={`font-bold text-sm px-3 py-1 rounded-full uppercase tracking-wider ${phLevel >= 5.5 && phLevel <= 7.0 ? 'text-[#0F5132] bg-emerald-50 dark:bg-emerald-900/30' : 'text-green-600 bg-green-50 dark:bg-green-900/30'}`}>
                                    {phLevel >= 5.5 && phLevel <= 7.0 ? 'Optimal' : 'Needs Attn'}
                                </span>
                            </div>
                        </div>
                        <div className="h-20 w-20 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-[#0F5132] dark:text-emerald-400 font-bold text-xl border-4 border-emerald-100 dark:border-emerald-800">
                            pH
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

