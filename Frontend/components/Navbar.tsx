// =====================================================
// Navbar Component - Smart Maize Farming System
// =====================================================

import React, { useState } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { Button } from './ui/Button';
import { BrandLogo } from './ui/BrandLogo';
import { translations, Language } from '../utils/translations';

interface NavbarProps {
  onNavigate: (page: string) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: string;
  toggleTheme: () => void;
  currentPath: string;
}

export function Navbar({ 
  onNavigate, 
  language, 
  setLanguage, 
  theme, 
  toggleTheme,
  currentPath 
}: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const t = translations[language].nav;

  const navigate = (page: string) => {
    onNavigate(page);
    setIsMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };

  // Helper to determine active link style
  const getLinkVariant = (path: string) => {
    const pathMap: Record<string, string> = {
      'landing': '/',
      'features': '/features',
      'pricing': '/pricing',
      'resources': '/resources',
    };
    return currentPath === pathMap[path] ? "secondary" : "ghost";
  };

  return (
    <nav className="fixed w-full z-50 transition-all duration-300 bg-background/90 backdrop-blur-md border-b">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* Logo */}
        <div className="cursor-pointer" onClick={() => navigate('landing')}>
          <BrandLogo variant="navbar" />
        </div>

        {/* Desktop Nav - Centered */}
        <div className="hidden md:flex items-center gap-2">
          <Button variant={getLinkVariant('landing')} onClick={() => navigate('landing')}>{t.home}</Button>
          <Button variant={getLinkVariant('features')} onClick={() => navigate('features')}>{t.features}</Button>
          <Button variant={getLinkVariant('pricing')} onClick={() => navigate('pricing')}>{t.pricing}</Button>
          <Button variant={getLinkVariant('resources')} onClick={() => navigate('resources')}>{t.resources}</Button>
        </div>

        {/* Right Side - Language & CTA */}
        <div className="hidden md:flex items-center gap-4">
          {/* Theme Toggle */}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle Dark Mode"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </Button>

          {/* Language Switcher */}
          <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground mr-2">
            <button 
              onClick={() => setLanguage('rw')} 
              className={`hover:text-primary transition-colors ${language === 'rw' ? 'text-primary underline decoration-2' : ''}`}
            >
              RW
            </button>
            <span className="text-muted-foreground/50">/</span>
            <button 
              onClick={() => setLanguage('en')} 
              className={`hover:text-primary transition-colors ${language === 'en' ? 'text-primary underline decoration-2' : ''}`}
            >
              EN
            </button>
            <span className="text-muted-foreground/50">/</span>
            <button 
              onClick={() => setLanguage('fr')} 
              className={`hover:text-primary transition-colors ${language === 'fr' ? 'text-primary underline decoration-2' : ''}`}
            >
              FR
            </button>
          </div>

          <Button onClick={() => navigate('login')}>
            {t.signIn}
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex items-center gap-4 md:hidden">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle Dark Mode"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-20 left-0 w-full bg-background border-b p-6 flex flex-col gap-4 shadow-xl animate-fade-in z-40">
          <Button variant="ghost" className="justify-start text-lg" onClick={() => navigate('landing')}>
            {t.home}
          </Button>
          <Button variant="ghost" className="justify-start text-lg" onClick={() => navigate('features')}>
            {t.features}
          </Button>
          <Button variant="ghost" className="justify-start text-lg" onClick={() => navigate('pricing')}>
            {t.pricing}
          </Button>
          <Button variant="ghost" className="justify-start text-lg" onClick={() => navigate('resources')}>
            {t.resources}
          </Button>
          
          <div className="h-px bg-border my-2"></div>
          
          <div className="flex gap-4 justify-start">
            <button 
              onClick={() => setLanguage('rw')} 
              className={`text-sm font-bold transition-colors ${language === 'rw' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              Kinyarwanda
            </button>
            <button 
              onClick={() => setLanguage('en')} 
              className={`text-sm font-bold transition-colors ${language === 'en' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              English
            </button>
            <button 
              onClick={() => setLanguage('fr')} 
              className={`text-sm font-bold transition-colors ${language === 'fr' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              Français
            </button>
          </div>
          
          <Button className="w-full" onClick={() => navigate('login')}>
            {t.signIn}
          </Button>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
