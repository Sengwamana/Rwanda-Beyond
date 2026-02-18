import React from 'react';
import { Sprout, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';

interface FooterProps {
    onNavigate: (page: any) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
      <footer className="bg-[#0F5132] text-white py-12 border-t border-white/10 font-sans">
          <div className="max-w-7xl mx-auto px-6">
              
              {/* TOP SECTION: Brand & Links */}
              <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 mb-12">
                  {/* Brand Column */}
                  <div>
                      <div className="flex items-center gap-2 mb-4">
                          <div className="bg-white p-1.5 rounded-full">
                            <Sprout className="text-[#0F5132] w-5 h-5" />
                          </div>
                          <span className="text-xl font-bold tracking-tight">RwandaBeyond</span>
                      </div>
                      <p className="text-emerald-100 text-sm leading-relaxed max-w-sm mb-6">
                          We are a premium AgTech platform located in Rwamagana, Rwanda, 
                          servicing smallholder farmers with IoT and AI solutions.
                      </p>
                      <div className="flex gap-3">
                          {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
                              <button key={i} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white hover:text-[#0F5132] transition-colors group">
                                  <Icon size={16} className="text-emerald-100 group-hover:text-[#0F5132] transition-colors" />
                              </button>
                          ))}
                      </div>
                  </div>

                  {/* Links Columns */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                          <h4 className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-4">Company</h4>
                          <ul className="space-y-3 text-sm text-emerald-50">
                              <li><button onClick={() => onNavigate('features')} className="hover:text-white transition-colors text-left">Features</button></li>
                              <li><button onClick={() => onNavigate('pricing')} className="hover:text-white transition-colors text-left">Pricing</button></li>
                              <li><button onClick={() => onNavigate('about')} className="hover:text-white transition-colors text-left">About Us</button></li>
                              <li><button onClick={() => onNavigate('consultation')} className="hover:text-white transition-colors text-left">Contact</button></li>
                          </ul>
                      </div>
                      <div>
                          <h4 className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-4">Resource</h4>
                          <ul className="space-y-3 text-sm text-emerald-50">
                              <li><button onClick={() => onNavigate('resources')} className="hover:text-white transition-colors text-left">Blog</button></li>
                              <li><button onClick={() => onNavigate('resources')} className="hover:text-white transition-colors text-left">Customer Stories</button></li>
                              <li><button onClick={() => onNavigate('about')} className="hover:text-white transition-colors text-left">Information</button></li>
                              <li><button onClick={() => onNavigate('terms')} className="hover:text-white transition-colors text-left">Legal</button></li>
                          </ul>
                      </div>
                      <div>
                          <h4 className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-4">Career</h4>
                          <ul className="space-y-3 text-sm text-emerald-50">
                              <li><button onClick={() => onNavigate('careers')} className="hover:text-white transition-colors text-left">Jobs</button></li>
                              <li><button onClick={() => onNavigate('careers')} className="hover:text-white transition-colors text-left">Hiring</button></li>
                              <li><button onClick={() => onNavigate('resources')} className="hover:text-white transition-colors text-left">News</button></li>
                          </ul>
                      </div>
                      <div>
                          <h4 className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-4">Help</h4>
                          <ul className="space-y-3 text-sm text-emerald-50">
                              <li><button onClick={() => onNavigate('faq')} className="hover:text-white transition-colors text-left">FAQ</button></li>
                              <li><button onClick={() => onNavigate('faq')} className="hover:text-white transition-colors text-left">Help Center</button></li>
                              <li><button onClick={() => onNavigate('faq')} className="hover:text-white transition-colors text-left">Support</button></li>
                          </ul>
                      </div>
                  </div>
              </div>

              {/* MIDDLE SECTION: Newsletter & Contact Info */}
              <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 mb-12">
                  
                  {/* Newsletter */}
                  <div>
                      <h2 className="text-2xl font-bold mb-3">Get In Touch!</h2>
                      <p className="text-emerald-100 mb-6 text-sm">
                          Have questions or need assistance? <br/> We're here to help!
                      </p>
                      <div className="relative max-w-md">
                          <input 
                            type="email" 
                            placeholder="Enter your email" 
                            className="w-full h-12 pl-6 pr-32 rounded-full bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 text-sm"
                          />
                          <button className="absolute right-1 top-1 bottom-1 px-5 bg-[#0A0A0A] text-white font-bold rounded-full hover:bg-black transition-colors text-xs">
                              Subscribe
                          </button>
                      </div>
                  </div>

                  {/* Address & Contact */}
                  <div className="grid md:grid-cols-2 gap-6">
                      <div>
                          <div className="mb-6">
                              <h4 className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-2">Address</h4>
                              <p className="text-sm text-emerald-50 leading-relaxed">
                                  Kigali Heights, 4th Floor<br/>
                                  Kigali, Rwanda
                              </p>
                          </div>
                          <div>
                              <h4 className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-2">Field Office</h4>
                              <p className="text-sm text-emerald-50 leading-relaxed">
                                  Rwamagana District<br/>
                                  Eastern Province
                              </p>
                          </div>
                      </div>
                      <div>
                          <div className="mb-6">
                              <h4 className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-2">Phone</h4>
                              <p className="text-sm text-emerald-50">+250 788 123 456</p>
                          </div>
                          <div>
                              <h4 className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-2">Email</h4>
                              <p className="text-sm text-emerald-50">hello@rwandabeyond.rw</p>
                          </div>
                      </div>
                  </div>
              </div>

              {/* BOTTOM SECTION: Copyright & Links */}
              <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                  <p className="text-xs text-emerald-200">© Copyright 2024, RwandaBeyond All Rights Reserved</p>
                  <div className="flex gap-6 text-xs font-medium text-emerald-100">
                      <button onClick={() => onNavigate('faq')} className="hover:text-white transition-colors">FAQ</button>
                      <button onClick={() => onNavigate('terms')} className="hover:text-white transition-colors">Term of Service</button>
                      <button onClick={() => onNavigate('privacy')} className="hover:text-white transition-colors">Privacy Policy</button>
                  </div>
              </div>

          </div>
      </footer>
  );
};