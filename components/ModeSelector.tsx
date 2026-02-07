import React from 'react';
import { ShoppingCart, MapPin, Laptop, ShoppingBag } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ShoppingMode } from '../types';

interface ModeSelectorProps {
  selectedMode: ShoppingMode | null;
  onSelectMode: (mode: ShoppingMode) => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ selectedMode, onSelectMode }) => {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Physical Shopping */}
      <button
        type="button"
        onClick={() => onSelectMode('physical')}
        className={`p-4 rounded-xl border-2 transition-all text-start ${
          selectedMode === 'physical'
            ? 'border-emerald-500 bg-emerald-50 shadow-sm'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <ShoppingCart className={`w-5 h-5 ${selectedMode === 'physical' ? 'text-emerald-600' : 'text-slate-500'}`} />
          <MapPin className={`w-4 h-4 ${selectedMode === 'physical' ? 'text-emerald-500' : 'text-slate-400'}`} />
        </div>
        <div className={`text-sm font-semibold ${selectedMode === 'physical' ? 'text-emerald-800' : 'text-slate-700'}`}>
          {t('priceComparison.physicalMode')}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {t('priceComparison.physicalDesc')}
        </div>
      </button>

      {/* Online Shopping */}
      <button
        type="button"
        onClick={() => onSelectMode('online')}
        className={`p-4 rounded-xl border-2 transition-all text-start ${
          selectedMode === 'online'
            ? 'border-indigo-500 bg-indigo-50 shadow-sm'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Laptop className={`w-5 h-5 ${selectedMode === 'online' ? 'text-indigo-600' : 'text-slate-500'}`} />
          <ShoppingBag className={`w-4 h-4 ${selectedMode === 'online' ? 'text-indigo-500' : 'text-slate-400'}`} />
        </div>
        <div className={`text-sm font-semibold ${selectedMode === 'online' ? 'text-indigo-800' : 'text-slate-700'}`}>
          {t('priceComparison.onlineMode')}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {t('priceComparison.onlineDesc')}
        </div>
      </button>
    </div>
  );
};

export default ModeSelector;
