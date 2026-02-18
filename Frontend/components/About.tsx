import React from 'react';
import { Target, Heart, Globe, Users, Award, Sprout, ArrowRight } from 'lucide-react';

export const About: React.FC = () => {
  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen pt-24 pb-20 animate-fade-in font-sans text-slate-800 dark:text-white transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 text-[#0F5132] dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
                About Us
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6 leading-tight tracking-tight">
                Cultivating the Future of <br className="hidden md:block"/> Rwandan Agriculture.
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
                RwandaBeyond is a movement to bridge the digital divide for smallholder farmers, combining ancestral knowledge with cutting-edge technology.
            </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid md:grid-cols-12 gap-6 mb-24">
            {/* Primary Image: Tea Plantation */}
            <div className="md:col-span-8 h-96 rounded-[2.5rem] overflow-hidden relative group shadow-lg">
                <img 
                    src="https://images.unsplash.com/photo-1598512752271-33f913a5af13?q=80&w=2000&auto=format&fit=crop" 
                    alt="Rwandan Tea Plantation" 
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-8">
                    <h3 className="text-2xl font-bold text-white mb-2">Rooted in Rwamagana</h3>
                    <p className="text-slate-200 font-medium">Where innovation meets tradition.</p>
                </div>
            </div>

            {/* Vision / Stat Card */}
            <div className="md:col-span-4 bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
                    <Target size={24} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-5xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">2030</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-wider">Vision Goal</p>
                    <p className="text-sm text-slate-400 mt-3 leading-relaxed">
                        Empowering 1 million farmers with data-driven independence and sustainable practices.
                    </p>
                </div>
            </div>

            {/* Mission Card (Dark Green) */}
            <div className="md:col-span-5 bg-[#0F5132] text-white rounded-[2.5rem] p-10 shadow-xl relative overflow-hidden flex flex-col justify-between">
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <Sprout className="absolute -bottom-8 -left-8 text-emerald-400/10 w-48 h-48 rotate-12" />
                
                <div className="relative z-10">
                    <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center text-emerald-100 mb-8 border border-white/10">
                        <Heart size={24} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-2xl font-bold mb-4">Our Mission</h3>
                    <p className="text-emerald-100/90 leading-relaxed text-lg">
                        To democratize access to precision agriculture tools, ensuring no farmer is left behind due to lack of connectivity.
                    </p>
                </div>
            </div>

            {/* Values Grid */}
            <div className="md:col-span-7 bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-center">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-8">Our Core Values</h3>
                <div className="space-y-6">
                    <div className="flex items-start gap-4 group">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                            <Globe size={22} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-lg">Sustainability First</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Building for both planet regeneration and economic profit.</p>
                        </div>
                    </div>
                    <div className="h-px bg-slate-50 dark:bg-slate-700 w-full"></div>
                    <div className="flex items-start gap-4 group">
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-2xl text-purple-600 dark:text-purple-400 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 transition-colors">
                            <Users size={22} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-lg">Community Led</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Solutions built by farmers, for farmers, with constant feedback.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Team Section */}
        <div className="mb-20">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Meet the Leadership</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">The minds behind the technology.</p>
                </div>
                <button className="text-[#0F5132] dark:text-emerald-400 font-bold flex items-center gap-2 hover:gap-3 transition-all text-sm">
                    Join the Team <ArrowRight size={16} />
                </button>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
                {[
                    { name: "Jean Claude", role: "Founder & Lead Agronomist", img: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" },
                    { name: "Marie Claire", role: "Head of Community", img: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka" },
                    { name: "David N.", role: "IoT Systems Architect", img: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jude" }
                ].map((member, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 text-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                        <div className="w-28 h-28 mx-auto bg-slate-50 dark:bg-slate-700 rounded-full mb-6 overflow-hidden border-4 border-white dark:border-slate-600 shadow-sm group-hover:scale-105 transition-transform">
                            <img src={member.img} alt={member.name} className="w-full h-full" />
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-xl mb-1">{member.name}</h3>
                        <p className="text-[#0F5132] dark:text-emerald-400 text-sm font-bold uppercase tracking-wider opacity-80">{member.role}</p>
                    </div>
                ))}
            </div>
        </div>

        {/* Closing Image: Path/Field */}
        <div className="relative h-64 rounded-[2.5rem] overflow-hidden">
             <img src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=2000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Path" />
             <div className="absolute inset-0 bg-[#0F5132]/80 flex items-center justify-center text-center px-6">
                 <div>
                     <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to transform your farm?</h2>
                     <button className="px-8 py-4 bg-white text-[#0F5132] rounded-full font-bold hover:bg-emerald-50 transition-colors shadow-lg">
                         Get Started Today
                     </button>
                 </div>
             </div>
        </div>

      </div>
    </div>
  );
};