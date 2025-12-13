import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language } from '../types';
import { TRANSLATIONS, UNITS_TRANSLATIONS } from '../constants/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string) => string;
  tUnit: (unit: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'lista_language';

// Detect browser language
const detectBrowserLanguage = (): Language => {
  const browserLang = navigator.language || (navigator as any).userLanguage;
  // Check if browser language starts with 'he' (Hebrew)
  return browserLang.startsWith('he') ? 'he' : 'en';
};

// Get initial language with priority: localStorage > browser > default
const getInitialLanguage = (): Language => {
  try {
    // 1. Check localStorage for saved preference
    const savedLang = localStorage.getItem(STORAGE_KEY);
    if (savedLang === 'en' || savedLang === 'he') {
      return savedLang as Language;
    }

    // 2. Fall back to browser language detection
    const detectedLang = detectBrowserLanguage();

    // 3. Save detected language to localStorage
    localStorage.setItem(STORAGE_KEY, detectedLang);

    return detectedLang;
  } catch (error) {
    // If localStorage is not available (e.g., private mode), use browser detection
    console.warn('localStorage not available, using browser language detection');
    return detectBrowserLanguage();
  }
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  // Update HTML attributes and save to localStorage when language changes
  useEffect(() => {
    // Update HTML dir attribute for RTL support
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch (error) {
      console.warn('Failed to save language preference to localStorage');
    }
  }, [language]);

  const isRTL = language === 'he';

  const t = (path: string): string => {
    const keys = path.split('.');
    let value: any = TRANSLATIONS[language];
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return path; // Fallback to key if missing
      }
    }
    
    return typeof value === 'string' ? value : path;
  };

  const tUnit = (unit: string): string => {
    return (UNITS_TRANSLATIONS[language] as any)[unit] || unit;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tUnit, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};