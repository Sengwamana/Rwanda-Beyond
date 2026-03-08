import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, ScanLine, AlertTriangle, Leaf, X, Image as ImageIcon, 
  Bug, ArrowRight, Activity, Info, CheckCircle2, Zap, Droplets, 
  Plus, Trash2, Microscope, Sprout, Worm, AlertCircle, TrendingUp,
  Search, ShieldAlert, Loader2, Camera, Check, Sparkles
} from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { uploadPestImage } from '../services/imageService';
import { useFarmStore } from '../store';

interface UploadedImage {
  id: string;
  url: string;
  file?: File;
}

interface AnalysisResult {
  pest: string;
  scientific: string;
  confidence: number;
  severity: string;
  type: string;
  recommendation: string;
  affectedArea: string;
  stage: string;
  treated?: boolean;
}

interface PestControlProps {
    language?: Language;
}

export const PestControl: React.FC<PestControlProps> = ({ language = 'en' }) => {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<Record<string, AnalysisResult>>({});
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({});
  const { selectedFarm, farms } = useFarmStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[language].pest;

  const activeImage = images.find(img => img.id === activeId);
  const activeResult = activeId ? results[activeId] : null;

  // Helper for Severity Colors & Icons
  const getSeverityConfig = (severity: string) => {
    const level = severity.toLowerCase();
    if (level === 'critical') return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', icon: AlertCircle, barColor: 'bg-red-500', level: 4 };
    if (level === 'high') return { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', icon: AlertTriangle, barColor: 'bg-orange-500', level: 3 };
    if (level === 'moderate') return { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100', icon: Info, barColor: 'bg-yellow-500', level: 2 };
    return { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: CheckCircle2, barColor: 'bg-emerald-500', level: 1 };
  };

  // Helper for Confidence Colors
  const getConfidenceColor = (score: number) => {
      if (score >= 90) return '#0F5132'; // Emerald
      if (score >= 75) return '#f59e0b'; // Amber
      return '#ef4444'; // Red
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newImages = Array.from(e.target.files).map((file: File) => ({
        id: Math.random().toString(36).substr(2, 9),
        url: URL.createObjectURL(file),
        file
      }));

      setImages(prev => {
        const updated = [...prev, ...newImages];
        return updated;
      });

      // Automatically select the first new image if none selected
      if (!activeId && newImages.length > 0) {
        setActiveId(newImages[0].id);
        // Automatically analyze ONLY the very first image for UX, others require manual trigger
        if (images.length === 0) {
            runAnalysis(newImages[0].id);
        }
      }
      e.target.value = '';
    }
  };

  const runAnalysis = async (id: string) => {
    if (results[id] || analyzing) return; 
    
    const imageToAnalyze = images.find(img => img.id === id);
    if (!imageToAnalyze || !imageToAnalyze.file) return;

    setAnalyzing(true);
    
    try {
        const farmId = selectedFarm?.id || farms[0]?.id;
        if (!farmId) {
          throw new Error('No farm selected for pest analysis.');
        }

        const response: any = await uploadPestImage(imageToAnalyze.file, farmId);
        const payload = response?.data ?? response;
        const analysis = payload?.analysis ?? payload?.result ?? {};

        const rawConfidence = analysis.confidenceScore ?? analysis.confidence ?? analysis.result?.pest?.confidence ?? 0;
        const confidence = rawConfidence > 1 ? Math.round(rawConfidence) : Math.round(rawConfidence * 100);
        const recommendations: string[] = Array.isArray(analysis.recommendations)
          ? analysis.recommendations
          : [];

        const result: AnalysisResult = {
          pest: analysis.detectedPest || analysis.pestType || analysis.result?.pest?.name || 'Unknown',
          scientific: analysis.scientificName || analysis.result?.pest?.scientificName || 'N/A',
          confidence: Number.isFinite(confidence) ? confidence : 0,
          severity: analysis.severity || 'Low',
          type: analysis.type || (analysis.pestDetected ? 'Insect' : 'Unknown'),
          recommendation: recommendations[0] || 'No specific recommendation.',
          affectedArea: analysis.affectedArea || `${analysis.affectedAreaPercentage ?? 0}%`,
          stage: analysis.stage || 'N/A'
        };

        setResults(prev => ({...prev, [id]: result}));
        setAnalysisErrors(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });

    } catch (error) {
        console.error("AI Analysis failed:", error);
        setAnalysisErrors(prev => ({
          ...prev,
          [id]: error instanceof Error ? error.message : 'Analysis failed. Please try again.',
        }));
    } finally {
        setAnalyzing(false);
    }
  };

  const handleRemoveImage = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newImages = images.filter(img => img.id !== id);
    setImages(newImages);
    const next = {...results};
    delete next[id];
    setResults(next);
    setAnalysisErrors(prev => {
      const nextErrors = { ...prev };
      delete nextErrors[id];
      return nextErrors;
    });
    if (id === activeId) setActiveId(newImages.length > 0 ? newImages[0].id : null);
  };

  const handleAnalyzeNext = () => {
      // Find next unanalyzed image
      const unanalyzed = images.find(img => !results[img.id]);
      if (unanalyzed) {
          setActiveId(unanalyzed.id);
          // UX Improvement: Auto-start analysis when user clicks "Analyze Next"
          runAnalysis(unanalyzed.id);
      } else {
          setActiveId(null); // Go back to upload screen
      }
  };

  const handleSaveTreat = () => {
      if (activeId && results[activeId]) {
          setResults(prev => ({
              ...prev,
              [activeId]: { ...prev[activeId], treated: true }
          }));
      }
  };

  // Safe access to severity config
  const severityConfig = activeResult ? getSeverityConfig(activeResult.severity) : getSeverityConfig('low');
  const SeverityIcon = severityConfig.icon;
  const confidenceColor = activeResult ? getConfidenceColor(activeResult.confidence) : '#ccc';
  
  // Dynamic Pest Icon
  const PestIconComponent = activeResult?.pest.toLowerCase().includes('worm') ? Worm : Bug;

  // Chart Dimensions
  const radius = 48;
  const circumference = 2 * Math.PI * radius;

  // Check if there are more images to analyze
  const hasMoreToAnalyze = images.some(img => !results[img.id]);

  return (
    <div className="space-y-8 animate-fade-in">
       <div className="flex justify-between items-end">
            <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t.title}</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
            </div>
            {images.length > 0 && (
                <button 
                    onClick={() => { setActiveId(null); fileInputRef.current?.click(); }}
                    className="flex items-center gap-2 px-6 py-3 bg-[#0F5132] text-white rounded-full font-bold hover:bg-[#0a3622] transition-colors shadow-lg shadow-emerald-200"
                >
                    <Plus size={18} />
                    <span>{t.addPhotos}</span>
                </button>
            )}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
            {/* LEFT: Upload Zone */}
            <div className="space-y-4">
                <label 
                    className={`bg-white dark:bg-slate-800 rounded-[2.5rem] h-[600px] flex flex-col items-center justify-center cursor-pointer transition-all duration-300 border-2 border-dashed relative overflow-hidden group shadow-sm shadow-slate-100 dark:shadow-none ${
                        activeImage ? 'border-[#0F5132] bg-slate-50 dark:bg-slate-700' : 'border-slate-200 dark:border-slate-700 hover:border-[#0F5132] hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                >
                    <input type="file" className="hidden" accept="image/*" multiple onChange={handleUpload} ref={fileInputRef} />
                    {activeImage ? (
                         <div className="relative w-full h-full p-4 flex items-center justify-center">
                            <img 
                                src={activeImage.url} 
                                className="w-full h-full object-contain rounded-[2rem]" 
                            />
                            {analyzing && (
                                <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm flex items-center justify-center rounded-[2rem] z-20">
                                   {/* Simple overlay, loader is mainly on right panel now */}
                                </div>
                            )}
                         </div>
                    ) : (
                        <div className="text-center p-8">
                            <div className="h-24 w-24 bg-emerald-50 dark:bg-emerald-900/30 text-[#0F5132] dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform shadow-sm">
                                <UploadCloud size={40} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t.dragDrop}</h3>
                            <p className="text-slate-400 text-base max-w-xs mx-auto leading-relaxed">
                                {t.uploadInst}
                            </p>
                            <div className="mt-12 flex gap-6 justify-center">
                                <div className="flex flex-col items-center gap-2 group/icon">
                                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-slate-400 group-hover/icon:bg-[#0F5132] group-hover/icon:text-white transition-colors"><ImageIcon size={22} /></div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover/icon:text-[#0F5132] dark:group-hover/icon:text-emerald-400 transition-colors">{t.gallery}</span>
                                </div>
                                <div className="flex flex-col items-center gap-2 group/icon">
                                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-slate-400 group-hover/icon:bg-[#0F5132] group-hover/icon:text-white transition-colors"><Camera size={22} /></div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover/icon:text-[#0F5132] dark:group-hover/icon:text-emerald-400 transition-colors">{t.camera}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </label>

                {/* Thumbnail Strip */}
                {images.length > 0 && (
                    <div className="flex gap-4 overflow-x-auto pb-4 px-1 scrollbar-hide">
                        {images.map(img => (
                            <div 
                                key={img.id}
                                onClick={() => setActiveId(img.id)}
                                className={`relative h-24 w-24 flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer border-4 transition-all ${
                                    activeId === img.id ? 'border-[#0F5132] shadow-md scale-105' : 'border-white dark:border-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 opacity-70 hover:opacity-100 hover:scale-105'
                                }`}
                            >
                                <img src={img.url} className="w-full h-full object-cover" />
                                {results[img.id] ? (
                                    <div className={`absolute top-1 right-1 w-5 h-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${results[img.id].treated ? 'bg-blue-500' : 'bg-[#0F5132]'}`}>
                                        <CheckCircle2 size={12} className="text-white" />
                                    </div>
                                ) : (
                                     <div className="absolute top-1 right-1 w-4 h-4 bg-slate-200 rounded-full border-2 border-white shadow-sm"></div>
                                )}
                                <button 
                                    onClick={(e) => handleRemoveImage(e, img.id)}
                                    className="absolute bottom-1 right-1 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-lg transition-colors backdrop-blur-sm"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* RIGHT: Analysis Results */}
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 shadow-sm shadow-slate-200 dark:shadow-none min-h-[600px] flex flex-col relative overflow-hidden border border-slate-100 dark:border-slate-700">
                 {/* Decorative background blob */}
                 <div className="absolute top-0 right-0 w-96 h-96 bg-[#FAFAF9] dark:bg-slate-900 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-[#0F5132] dark:text-emerald-400 rounded-2xl">
                            <ScanLine size={24} />
                        </div>
                        <div>
                             <h3 className="font-bold text-slate-900 dark:text-white text-xl">{t.report}</h3>
                             <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">{t.confidence}</p>
                        </div>
                    </div>
                    {activeResult && (
                        <div className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-xs font-bold rounded-lg uppercase tracking-wider border border-slate-200 dark:border-slate-600">
                            ID: {activeId}
                        </div>
                    )}
                </div>

                {/* State: Has Result */}
                {activeResult ? (
                    <div className="flex-1 space-y-6 overflow-y-auto pr-2 relative z-10 custom-scrollbar animate-fade-in">
                        
                        {/* 1. MAIN IDENTITY CARD */}
                        <div className="p-8 rounded-[2rem] bg-gradient-to-br from-[#FAFAF9] to-white dark:from-slate-700 dark:to-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                             <div className="absolute -bottom-6 -right-6 text-slate-200/50 dark:text-slate-900/50 transform rotate-12 group-hover:rotate-0 transition-transform duration-500 pointer-events-none">
                                <PestIconComponent size={140} />
                             </div>

                            <div className="flex justify-between items-start mb-2 relative z-10">
                                <div>
                                    <div className={`inline-flex items-center gap-1.5 ${severityConfig.bg} ${severityConfig.color} border ${severityConfig.border} text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wide mb-4`}>
                                        <SeverityIcon size={12} />
                                        {activeResult.pest !== 'Healthy' ? t.pestDetected : t.healthy}
                                    </div>
                                    <h2 className="text-4xl font-bold text-slate-900 dark:text-white leading-tight mb-2 tracking-tight">{activeResult.pest}</h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-lg italic font-serif">{activeResult.scientific}</p>
                                </div>
                                
                                <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0 group/chart cursor-default">
                                    <svg className="w-full h-full transform -rotate-90 drop-shadow-sm">
                                        <defs>
                                            <linearGradient id="confidenceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor={confidenceColor} stopOpacity="0.6" />
                                                <stop offset="100%" stopColor={confidenceColor} />
                                            </linearGradient>
                                        </defs>
                                        <circle cx="56" cy="56" r={radius} stroke="#f1f5f9" className="dark:stroke-slate-600" strokeWidth="8" fill="transparent" />
                                        <circle cx="56" cy="56" r={radius} stroke="url(#confidenceGradient)" strokeWidth="8" fill="transparent"
                                            strokeDasharray={circumference}
                                            strokeDashoffset={circumference - (circumference * activeResult.confidence) / 100}
                                            strokeLinecap="round"
                                            className="transition-all duration-1000 ease-out group-hover/chart:stroke-[10px]"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center transition-transform group-hover/chart:scale-105">
                                        <span className="text-2xl font-bold text-slate-800 dark:text-white">{activeResult.confidence}%</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Match</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RECOMMENDATION TOOLTIP BAR */}
                        {activeResult.recommendation && (
                             <div className="bg-white dark:bg-slate-700/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                     <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                                         <Sparkles size={18} />
                                     </div>
                                     <div>
                                        <span className="font-bold text-slate-700 dark:text-slate-300 text-sm block">AI Insight Available</span>
                                        <span className="text-xs text-slate-400">Treatment recommendation ready</span>
                                     </div>
                                 </div>
                                 <div className="relative group/tooltip">
                                     <button className="p-3 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-xl transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white">
                                         <Info size={20} />
                                     </button>
                                     <div className="absolute bottom-full right-0 mb-3 w-72 p-5 bg-slate-900/95 backdrop-blur-md text-white text-xs rounded-2xl shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-all z-50 pointer-events-none transform translate-y-2 group-hover/tooltip:translate-y-0 duration-200">
                                         <div className="flex items-start gap-3">
                                             <Sparkles size={16} className="text-yellow-400 mt-0.5 shrink-0" />
                                             <div>
                                                 <p className="font-bold mb-2 text-slate-200 text-sm">Suggested Action</p>
                                                 <p className="leading-relaxed text-slate-300">{activeResult.recommendation}</p>
                                             </div>
                                         </div>
                                         <div className="absolute -bottom-2 right-5 w-4 h-4 bg-slate-900/95 transform rotate-45"></div>
                                     </div>
                                 </div>
                            </div>
                        )}

                        {/* 2. METRICS GRID */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className={`p-6 rounded-[2rem] border ${severityConfig.border} ${severityConfig.bg} transition-all duration-300 hover:shadow-sm`}>
                                <div className={`flex items-center justify-between ${severityConfig.color} mb-3`}>
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert size={20} />
                                        <span className="text-xs font-bold uppercase tracking-wider">{t.severity}</span>
                                    </div>
                                    <SeverityIcon size={20} />
                                </div>
                                <p className={`text-3xl font-bold text-slate-900`}>{activeResult.severity}</p>
                                <div className="flex gap-1.5 mt-6">
                                   {[1, 2, 3, 4].map((level) => (
                                       <div 
                                          key={level} 
                                          className={`h-2.5 flex-1 rounded-full transition-all duration-500 ${
                                              level <= severityConfig.level ? severityConfig.barColor : 'bg-white/50'
                                          } ${level <= severityConfig.level ? 'shadow-sm' : ''}`} 
                                       />
                                   ))}
                                </div>
                                <div className="flex justify-between mt-2 text-[10px] font-bold opacity-60 uppercase tracking-wider">
                                    <span>Low</span>
                                    <span>Crit</span>
                                </div>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-800 relative overflow-hidden group/stage hover:shadow-md transition-all">
                                 {/* Watermark Icon */}
                                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/stage:opacity-20 transition-opacity pointer-events-none">
                                      <Activity size={80} className="text-blue-600" />
                                 </div>
                                 <div className="relative z-10">
                                     <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-3">
                                          <Activity size={20} />
                                          <span className="text-xs font-bold uppercase tracking-wider">{t.stage}</span>
                                     </div>
                                     <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-5">{activeResult.stage || 'Larva'}</p>
                                     
                                     {/* Enhanced Lifecycle Progress */}
                                     <div className="space-y-2">
                                         <div className="flex justify-between text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                                             <span className={activeResult.stage?.includes('Egg') ? 'text-blue-700 dark:text-blue-300' : ''}>Egg</span>
                                             <span className={activeResult.stage?.includes('Larva') ? 'text-blue-700 dark:text-blue-300' : ''}>Larva</span>
                                             <span className={activeResult.stage?.includes('Pupa') ? 'text-blue-700 dark:text-blue-300' : ''}>Pupa</span>
                                             <span className={activeResult.stage?.includes('Adult') ? 'text-blue-700 dark:text-blue-300' : ''}>Adult</span>
                                         </div>
                                         <div className="h-2.5 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden flex shadow-inner">
                                              <div className={`h-full bg-blue-600 transition-all duration-700 ease-out rounded-full ${
                                                  activeResult.stage?.includes('Egg') ? 'w-1/4' :
                                                  activeResult.stage?.includes('Larva') ? 'w-2/4' :
                                                  activeResult.stage?.includes('Pupa') ? 'w-3/4' : 'w-full'
                                              }`}></div>
                                         </div>
                                     </div>
                                 </div>
                            </div>
                        </div>

                        {/* 3. ACTIONS */}
                        <div className="flex gap-4">
                            <button 
                                onClick={handleSaveTreat}
                                disabled={activeResult.treated}
                                className={`flex-1 py-4 text-white text-sm font-bold rounded-full transition-all flex items-center justify-center gap-2 shadow-lg ${
                                    activeResult.treated 
                                    ? 'bg-blue-600 hover:bg-blue-700' 
                                    : 'bg-[#0F5132] hover:bg-[#0a3622] hover:-translate-y-0.5'
                                }`}
                            >
                                {activeResult.treated ? (
                                    <><Check size={18} /> Treated</>
                                ) : (
                                    <><CheckCircle2 size={18} /> {t.saveTreat}</>
                                )}
                            </button>
                            <button 
                                onClick={handleAnalyzeNext}
                                className="flex-1 py-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white text-sm font-bold rounded-full hover:bg-slate-50 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
                            >
                                <ArrowRight size={18} /> 
                                {hasMoreToAnalyze ? t.analyzeNext : t.finish}
                            </button>
                        </div>
                    </div>
                ) : activeImage ? (
                    // State: Image Selected, No Result
                    <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
                         {analyzing ? (
                             <>
                                <Loader2 className="animate-spin text-[#0F5132] mb-8" size={64} />
                                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{t.analyzing}</h3>
                                <p className="text-slate-500 dark:text-slate-400 font-medium">Identifying pest patterns and severity...</p>
                             </>
                         ) : (
                             <>
                                <div className="w-28 h-28 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-8 ring-8 ring-emerald-50/50 dark:ring-emerald-900/20">
                                    <ScanLine size={48} className="text-[#0F5132] dark:text-emerald-400" />
                                </div>
                                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{t.ready}</h3>
                                {activeId && analysisErrors[activeId] ? (
                                    <p className="mt-3 mb-2 max-w-[320px] text-sm text-red-600 dark:text-red-400">
                                      {analysisErrors[activeId]}
                                    </p>
                                ) : null}
                                <p className="text-slate-500 dark:text-slate-400 max-w-[280px] mt-4 text-base leading-relaxed mb-10">
                                    Image uploaded successfully. Run AI detection to identify pests and get treatment plans.
                                </p>
                                <button 
                                    onClick={() => activeId && runAnalysis(activeId)}
                                    className="px-8 py-4 bg-[#0F5132] hover:bg-[#0a3622] text-white font-bold rounded-full shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center gap-2"
                                >
                                    <Zap size={20} className="fill-white" /> {t.runAnalysis}
                                </button>
                             </>
                         )}
                    </div>
                ) : (
                    // State: Empty
                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                         <div className="w-24 h-24 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <Microscope size={48} className="text-slate-300 dark:text-slate-500" />
                         </div>
                        <p className="font-bold text-slate-900 dark:text-white text-xl">{t.waiting}</p>
                        <p className="text-slate-500 dark:text-slate-400 max-w-[240px] mt-2 text-sm leading-relaxed">
                            Upload a clear image of the affected maize leaf to generate an AI diagnosis.
                        </p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
