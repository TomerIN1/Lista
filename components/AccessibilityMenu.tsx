import React, { useState, useRef, useEffect } from 'react';
import { 
  Accessibility, 
  X, 
  Type, 
  Sun, 
  Moon, 
  Eye, 
  Zap, 
  RotateCcw,
  Minus,
  Plus
} from 'lucide-react';
import { useAccessibility, DisplayMode } from '../contexts/AccessibilityContext';
import { useLanguage } from '../contexts/LanguageContext';

const AccessibilityMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    fontSize, 
    setFontSize, 
    displayMode, 
    setDisplayMode, 
    reduceMotion, 
    setReduceMotion, 
    resetDefaults 
  } = useAccessibility();
  const { isRTL, t } = useLanguage();
  
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // On mobile, the backdrop handles closing. On desktop, we rely on this.
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleOpen = () => setIsOpen(!isOpen);

  // Helper to clamp font size between 70% and 150%
  const adjustFontSize = (delta: number) => {
    setFontSize(Math.min(150, Math.max(70, fontSize + delta)));
  };

  // Extract menu content to reuse in both mobile (modal) and desktop (dropdown) views
  const MenuContent = () => (
    <>
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Accessibility className="w-5 h-5 text-indigo-600" />
          {t('accessibilityMenu.title')}
        </h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={resetDefaults}
            className="text-xs font-medium text-slate-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 hover:bg-red-50 rounded-md transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            {t('accessibilityMenu.reset')}
          </button>
          {/* Close button for Mobile explicit close */}
          <button
            onClick={() => setIsOpen(false)}
            className="sm:hidden p-1 text-slate-400 hover:bg-slate-100 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6 max-h-[60vh] overflow-y-auto">
        
        {/* Text Size */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Type className="w-4 h-4 text-slate-400" />
            {t('accessibilityMenu.textSize')} ({fontSize}%)
          </div>
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
            <button 
              onClick={() => adjustFontSize(-10)}
              className="p-2 bg-white rounded-lg shadow-sm text-slate-600 hover:text-indigo-600 disabled:opacity-50"
              disabled={fontSize <= 70}
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex-1 text-center font-medium text-slate-600 text-sm">
              Aa
            </div>
            <button 
              onClick={() => adjustFontSize(10)}
              className="p-2 bg-white rounded-lg shadow-sm text-slate-600 hover:text-indigo-600 disabled:opacity-50"
              disabled={fontSize >= 150}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Display Mode */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Eye className="w-4 h-4 text-slate-400" />
            {t('accessibilityMenu.displayMode')}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ModeButton 
              mode="normal" 
              current={displayMode} 
              onClick={setDisplayMode} 
              icon={<Sun className="w-4 h-4" />}
              label={t('accessibilityMenu.modes.normal')}
            />
            <ModeButton 
              mode="high-contrast" 
              current={displayMode} 
              onClick={setDisplayMode} 
              icon={<Eye className="w-4 h-4" />}
              label={t('accessibilityMenu.modes.contrast')}
            />
            <ModeButton 
              mode="dark" 
              current={displayMode} 
              onClick={setDisplayMode} 
              icon={<Moon className="w-4 h-4" />}
              label={t('accessibilityMenu.modes.dark')}
            />
          </div>
        </div>

        {/* Reduce Motion */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Zap className="w-4 h-4 text-slate-400" />
            {t('accessibilityMenu.reduceMotion')}
          </div>
          <button
            onClick={() => setReduceMotion(!reduceMotion)}
            className={`
              w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none
              ${reduceMotion ? 'bg-indigo-600' : 'bg-slate-200'}
            `}
          >
            <div className={`
              w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200
              ${reduceMotion ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-0'}
            `} />
          </button>
        </div>

      </div>
    </>
  );

  return (
    <div className="relative z-50" ref={menuRef}>
      <button
        onClick={toggleOpen}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-sm font-medium shadow-sm relative z-[51]
          ${isOpen 
            ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
            : 'bg-white border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200'
          }
        `}
        aria-label="Accessibility Options"
        title="Accessibility Settings"
      >
        <Accessibility className="w-4 h-4" />
      </button>

      {isOpen && (
        <>
           {/* Mobile: Centered Modal using Flexbox to avoid transform conflicts */}
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:hidden">
             {/* Backdrop */}
             <div 
               className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200"
               onClick={() => setIsOpen(false)}
             />
             
             {/* Modal Card */}
             <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
               <MenuContent />
             </div>
           </div>

           {/* Desktop: Absolute Dropdown */}
           <div className={`
             hidden sm:block absolute top-full mt-3 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50
             ${isRTL 
               ? 'left-0 origin-top-left' 
               : 'right-0 origin-top-right'
             }
           `}>
             <MenuContent />
           </div>
        </>
      )}
    </div>
  );
};

const ModeButton: React.FC<{ 
  mode: DisplayMode; 
  current: DisplayMode; 
  onClick: (m: DisplayMode) => void; 
  icon: React.ReactNode;
  label: string;
}> = ({ mode, current, onClick, icon, label }) => (
  <button
    onClick={() => onClick(mode)}
    className={`
      flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-xs font-medium
      ${current === mode 
        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500' 
        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      }
    `}
  >
    {icon}
    {label}
  </button>
);

export default AccessibilityMenu;