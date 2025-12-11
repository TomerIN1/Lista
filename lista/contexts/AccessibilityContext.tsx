import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type DisplayMode = 'normal' | 'dark' | 'high-contrast';

interface AccessibilityContextType {
  fontSize: number;
  setFontSize: (size: number) => void;
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  reduceMotion: boolean;
  setReduceMotion: (reduce: boolean) => void;
  resetDefaults: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [fontSize, setFontSize] = useState(100);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('normal');
  const [reduceMotion, setReduceMotion] = useState(false);

  // Apply settings to HTML element
  useEffect(() => {
    const html = document.documentElement;

    // Font Size
    html.style.fontSize = `${fontSize}%`;

    // Display Mode
    html.classList.remove('dark-mode', 'high-contrast');
    if (displayMode === 'dark') {
      html.classList.add('dark-mode');
    } else if (displayMode === 'high-contrast') {
      html.classList.add('high-contrast');
    }

    // Reduce Motion
    if (reduceMotion) {
      html.classList.add('reduce-motion');
    } else {
      html.classList.remove('reduce-motion');
    }

  }, [fontSize, displayMode, reduceMotion]);

  const resetDefaults = () => {
    setFontSize(100);
    setDisplayMode('normal');
    setReduceMotion(false);
  };

  return (
    <AccessibilityContext.Provider 
      value={{ 
        fontSize, 
        setFontSize, 
        displayMode, 
        setDisplayMode, 
        reduceMotion, 
        setReduceMotion,
        resetDefaults 
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};