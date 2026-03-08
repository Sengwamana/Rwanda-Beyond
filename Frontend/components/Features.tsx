import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wifi, Cpu, Smartphone, CloudRain, Zap, ShieldCheck, Layers } from 'lucide-react';
import { contentService } from '../services/content';

const featureIcons: Record<string, React.ElementType> = {
  wifi: Wifi,
  cpu: Cpu,
  smartphone: Smartphone,
  rain: CloudRain,
  zap: Zap,
  shield: ShieldCheck,
  layers: Layers,
};

export const Features: React.FC = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['content', 'features'],
    queryFn: () => contentService.getFeatures(),
    staleTime: 60 * 1000,
  });

  const hero = data?.data?.hero || {};
  const cards = data?.data?.cards || [];
  const highlights = data?.data?.highlights || [];
  const integrations = data?.data?.integrations || [];

  return (
    <div className="bg-[#FAFAF9] dark:bg-slate-900 min-h-screen pt-24 pb-20 animate-fade-in font-sans text-slate-900 dark:text-white transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 text-[#0F5132] dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
            {hero.badge || 'Technology'}
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-slate-900 dark:text-white mb-8 leading-[1.1] tracking-tight">
            {hero.title}
          </h1>
          <p className="text-xl text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
            {hero.subtitle}
          </p>
        </div>

        {isLoading && <div className="text-center text-slate-500 dark:text-slate-400 mb-8">Loading features...</div>}
        {isError && (
          <div className="text-center mb-8">
            <p className="text-red-500 mb-3">Failed to load feature content.</p>
            <button onClick={() => refetch()} className="px-4 py-2 rounded-full bg-[#0F5132] text-white text-sm font-bold">
              Retry
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {cards.map((card, idx) => {
            const iconKey = String(card.icon || '').toLowerCase();
            const Icon = featureIcons[iconKey] || Layers;

            return (
              <div key={card.id || `${card.title}-${idx}`} className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-[#0F5132] dark:text-emerald-400 mb-6">
                  <Icon size={28} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{card.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{card.description}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-slate-900 dark:bg-black text-white rounded-[2.5rem] p-10 mb-12 border border-slate-800">
          <h3 className="text-3xl font-bold mb-6">Highlights</h3>
          <ul className="space-y-3 text-slate-300">
            {highlights.map((item, idx) => (
              <li key={`${item}-${idx}`} className="flex items-center gap-3">
                <div className="bg-emerald-500 rounded-full p-1"><CheckIcon /></div>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[3rem] p-8 md:p-20 text-center border border-slate-100 dark:border-slate-700 shadow-sm">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-8">Integration Network</h2>
          <div className="flex flex-wrap justify-center gap-4 md:gap-8">
            {integrations.map((name, idx) => (
              <div key={`${name}-${idx}`} className="h-12 px-6 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center font-bold text-slate-500 dark:text-slate-300 border border-slate-100 dark:border-slate-600">
                {name}
              </div>
            ))}
          </div>
          {!isLoading && !isError && cards.length === 0 && highlights.length === 0 && integrations.length === 0 && (
            <p className="mt-8 text-slate-500 dark:text-slate-400">No feature content configured yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const CheckIcon = () => <span className="text-black text-[10px] font-bold">✓</span>;
