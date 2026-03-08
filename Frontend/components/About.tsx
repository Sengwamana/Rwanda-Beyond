import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Globe, Users, Heart, Target } from 'lucide-react';
import { contentService } from '../services/content';

const valueIcons: Record<string, React.ElementType> = {
  globe: Globe,
  users: Users,
  heart: Heart,
  target: Target,
};

export const About: React.FC = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['content', 'about'],
    queryFn: () => contentService.getAbout(),
    staleTime: 60 * 1000,
  });

  const hero = data?.data?.hero || {};
  const mission = data?.data?.mission || {};
  const values = data?.data?.values || [];
  const team = data?.data?.team || [];
  const cta = data?.data?.cta || {};

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen pt-24 pb-20 animate-fade-in font-sans text-slate-800 dark:text-white transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 text-[#0F5132] dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
            {hero.badge || 'About'}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6 leading-tight tracking-tight">
            {hero.title}
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
            {hero.subtitle}
          </p>
        </div>

        {isLoading && <div className="text-center text-slate-500 dark:text-slate-400 mb-8">Loading about content...</div>}
        {isError && (
          <div className="text-center mb-8">
            <p className="text-red-500 mb-3">Failed to load about content.</p>
            <button onClick={() => refetch()} className="px-4 py-2 rounded-full bg-[#0F5132] text-white text-sm font-bold">
              Retry
            </button>
          </div>
        )}

        <div className="bg-[#0F5132] text-white rounded-[2.5rem] p-10 mb-12">
          <h3 className="text-2xl font-bold mb-4">{mission.title || 'Mission'}</h3>
          <p className="text-emerald-100/90 leading-relaxed text-lg">{mission.description}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {values.map((value, idx) => {
            const iconKey = String(value.icon || '').toLowerCase();
            const Icon = valueIcons[iconKey] || Globe;
            return (
              <div key={value.id || `${value.title}-${idx}`} className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-[#0F5132] dark:text-emerald-400 mb-4">
                  <Icon size={22} />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-2">{value.title}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">{value.description}</p>
              </div>
            );
          })}
        </div>

        <div className="mb-20">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Team</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {team.map((member, i) => (
              <div key={member.id || `${member.name}-${i}`} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 text-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                <div className="w-28 h-28 mx-auto bg-slate-50 dark:bg-slate-700 rounded-full mb-6 overflow-hidden border-4 border-white dark:border-slate-600 shadow-sm group-hover:scale-105 transition-transform">
                  <img src={member.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(member.name || 'team')}`} alt={member.name} className="w-full h-full" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-xl mb-1">{member.name}</h3>
                <p className="text-[#0F5132] dark:text-emerald-400 text-sm font-bold uppercase tracking-wider opacity-80">{member.role}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative h-64 rounded-[2.5rem] overflow-hidden bg-[#0F5132] flex items-center justify-center text-center px-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">{cta.title}</h2>
            <button className="px-8 py-4 bg-white text-[#0F5132] rounded-full font-bold hover:bg-emerald-50 transition-colors shadow-lg">
              {cta.button || 'Get Started'}
            </button>
          </div>
        </div>

        {!isLoading && !isError && !hero.title && values.length === 0 && team.length === 0 && (
          <div className="mt-10 text-center text-slate-500 dark:text-slate-400">No about page content configured yet.</div>
        )}
      </div>
    </div>
  );
};
