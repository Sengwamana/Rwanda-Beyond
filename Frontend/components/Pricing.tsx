import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { contentService } from '../services/content';

export const Pricing: React.FC = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['content', 'pricing'],
    queryFn: () => contentService.getPricing(),
    staleTime: 60 * 1000,
  });

  const hero = data?.data?.hero || {};
  const plans = data?.data?.plans || [];
  const footnote = data?.data?.footnote || '';

  return (
    <div className="bg-[#FAFAF9] dark:bg-slate-900 min-h-screen pt-24 pb-20 animate-fade-in font-sans text-slate-900 dark:text-white transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 text-[#0F5132] dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
            {hero.badge || 'Plans'}
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-slate-900 dark:text-white mb-6 leading-[1.1] tracking-tight">
            {hero.title}
          </h1>
          <p className="text-xl text-slate-500 dark:text-slate-400 leading-relaxed">
            {hero.subtitle}
          </p>
        </div>

        {isLoading && <div className="text-center text-slate-500 dark:text-slate-400 mb-8">Loading pricing...</div>}
        {isError && (
          <div className="text-center mb-8">
            <p className="text-red-500 mb-3">Failed to load pricing content.</p>
            <button onClick={() => refetch()} className="px-4 py-2 rounded-full bg-[#0F5132] text-white text-sm font-bold">
              Retry
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-start">
          {plans.map((plan, idx) => (
            <div
              key={plan.id || `${plan.name}-${idx}`}
              className={`rounded-[2.5rem] p-8 lg:p-10 border shadow-sm transition-all duration-300 ${
                plan.featured
                  ? 'bg-[#0F5132] text-white border-[#0F5132] shadow-2xl'
                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:shadow-xl'
              }`}
            >
              {plan.badge && (
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider ${plan.featured ? 'bg-white/10 text-emerald-200 border border-white/10' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {plan.badge}
                </span>
              )}

              <h3 className={`text-2xl font-bold mt-4 mb-2 ${plan.featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className={`text-5xl font-bold tracking-tight ${plan.featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{plan.price}</span>
                {plan.period && <span className={plan.featured ? 'text-emerald-200' : 'text-slate-500 dark:text-slate-400'}>{plan.period}</span>}
              </div>
              <p className={`text-sm mb-8 leading-relaxed ${plan.featured ? 'text-emerald-100/90' : 'text-slate-500 dark:text-slate-400'}`}>{plan.description}</p>

              <div className={`h-px w-full mb-8 ${plan.featured ? 'bg-white/10' : 'bg-slate-100 dark:bg-slate-700'}`}></div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((item, i) => (
                  <li key={`${item}-${i}`} className={`flex items-start gap-3 text-sm font-medium ${plan.featured ? 'text-emerald-50' : 'text-slate-600 dark:text-slate-300'}`}>
                    <div className={`rounded-full p-0.5 mt-0.5 ${plan.featured ? 'bg-[#10B981] text-black' : 'bg-emerald-50 dark:bg-emerald-900/30'}`}>
                      <Check size={12} className={plan.featured ? '' : 'text-[#0F5132] dark:text-emerald-400'} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>

              <button className={`w-full py-4 rounded-full font-bold transition-colors ${
                plan.featured
                  ? 'bg-white text-[#0F5132] hover:bg-emerald-50 shadow-lg'
                  : 'border-2 border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}>
                {plan.cta || 'Select Plan'}
              </button>
            </div>
          ))}
        </div>

        {footnote && (
          <div className="mt-20 text-center">
            <p className="text-slate-400 text-sm font-medium">{footnote}</p>
          </div>
        )}

        {!isLoading && !isError && plans.length === 0 && (
          <div className="mt-10 text-center text-slate-500 dark:text-slate-400">No pricing plans configured yet.</div>
        )}
      </div>
    </div>
  );
};
