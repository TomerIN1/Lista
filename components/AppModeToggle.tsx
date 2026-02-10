import React from 'react';
import { Sparkles, ShoppingCart } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { AppMode } from '../types';

interface AppModeToggleProps {
  appMode: AppMode;
  onSwitch: (mode: AppMode) => void;
  disabled?: boolean;
}

const AppModeToggle: React.FC<AppModeToggleProps> = ({ appMode, onSwitch, disabled = false }) => {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-center">
      <div className="inline-flex items-center bg-slate-100 rounded-2xl p-1.5 gap-1">
        <button
          type="button"
          onClick={() => onSwitch('organize')}
          disabled={disabled}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            appMode === 'organize'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{t('appMode.organize')}</span>
        </button>
        <button
          type="button"
          onClick={() => onSwitch('shopping')}
          disabled={disabled}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            appMode === 'shopping'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>{t('appMode.shopping')}</span>
        </button>
      </div>
    </div>
  );
};

export default AppModeToggle;
