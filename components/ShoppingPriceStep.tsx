import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ShoppingCart, Laptop, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ListPriceComparison, ShoppingMode } from '../types';
import SavingsReport from './SavingsReport';
import ModeSelector from './ModeSelector';
import LocationInput from './LocationInput';

interface ShoppingPriceStepProps {
  comparison: ListPriceComparison;
  selectedMode: ShoppingMode | null;
  onSelectMode: (mode: ShoppingMode) => void;
  onBack: () => void;
  onOrganizeForStore: () => void;
  onStartOnlineAgent: () => void;
  isOrganizing: boolean;
}

const ShoppingPriceStep: React.FC<ShoppingPriceStepProps> = ({
  comparison,
  selectedMode,
  onSelectMode,
  onBack,
  onOrganizeForStore,
  onStartOnlineAgent,
  isOrganizing,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [userLocation, setUserLocation] = useState(() => {
    return localStorage.getItem('lista_user_location') || '';
  });

  useEffect(() => {
    if (userLocation) {
      localStorage.setItem('lista_user_location', userLocation);
    }
  }, [userLocation]);

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Back button */}
      <div className="px-6 py-4 border-b border-slate-100">
        <button
          type="button"
          onClick={onBack}
          disabled={isOrganizing}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          <BackArrow className="w-4 h-4" />
          <span>{t('appMode.backToBuildList')}</span>
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Savings Report */}
        <SavingsReport data={comparison} />

        {/* Mode Selection */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('appMode.selectMode')}</h3>
          <ModeSelector selectedMode={selectedMode} onSelectMode={onSelectMode} />
        </div>

        {/* Physical Mode: Location + Action */}
        {selectedMode === 'physical' && (
          <div className="space-y-3">
            <LocationInput value={userLocation} onChange={setUserLocation} />

            {comparison.cheapestStoreId && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <ShoppingCart className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-emerald-800">
                  {language === 'he'
                    ? `קנו ב-${comparison.cheapestStoreId} וחסכו ₪${comparison.savingsAmount.toFixed(2)}!`
                    : `Shop at ${comparison.cheapestStoreId} and save ₪${comparison.savingsAmount.toFixed(2)}!`}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={onOrganizeForStore}
              disabled={isOrganizing}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isOrganizing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('input.processing')}</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  <span>{t('appMode.organizeForStore')}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Online Mode: Start Agent */}
        {selectedMode === 'online' && (
          <button
            type="button"
            onClick={onStartOnlineAgent}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
          >
            <Laptop className="w-5 h-5" />
            <span>
              {language === 'he'
                ? `בנה עגלה ב-${comparison.cheapestStoreId}`
                : `Build Cart at ${comparison.cheapestStoreId}`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ShoppingPriceStep;
