// =====================================================
// Translation Hook - Smart Maize Farming System
// =====================================================

import { useCallback } from 'react';
import { useAppStore } from '../store';
import { translations } from '../utils/translations';
import { Language } from '../types';

type TranslationKey = keyof typeof translations.en;

export function useTranslation() {
  const { language, setLanguage } = useAppStore();

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const langTranslations = translations[language] || translations.en;
      let text = langTranslations[key] || translations.en[key] || key;

      // Replace parameters in the text
      if (params) {
        Object.entries(params).forEach(([paramKey, value]) => {
          text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value));
        });
      }

      return text;
    },
    [language]
  );

  const changeLanguage = useCallback(
    (newLanguage: Language) => {
      setLanguage(newLanguage);
    },
    [setLanguage]
  );

  return {
    t,
    language,
    changeLanguage,
    languages: ['en', 'rw', 'fr'] as Language[],
  };
}

export default useTranslation;
