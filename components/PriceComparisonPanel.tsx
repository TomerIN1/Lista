import React, { useState, useEffect } from 'react';
import { BarChart3, Loader2, ChevronDown, ChevronUp, ShoppingCart, Laptop } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { CategoryGroup, ListPriceComparison, ShoppingMode } from '../types';
import { compareListPrices } from '../services/priceDbService';
import SavingsReport from './SavingsReport';
import ModeSelector from './ModeSelector';
import LocationInput from './LocationInput';

interface PriceComparisonPanelProps {
  groups: CategoryGroup[];
  isOpen: boolean;
  onClose: () => void;
  onStartOnlineAgent: (storeName: string) => void;
}

const PriceComparisonPanel: React.FC<PriceComparisonPanelProps> = ({
  groups,
  isOpen,
  onClose,
  onStartOnlineAgent,
}) => {
  const { t, language } = useLanguage();
  const [comparison, setComparison] = useState<ListPriceComparison | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<ShoppingMode | null>(null);
  const [userLocation, setUserLocation] = useState(() => {
    return localStorage.getItem('lista_user_location') || '';
  });

  // Persist location to localStorage
  useEffect(() => {
    if (userLocation) {
      localStorage.setItem('lista_user_location', userLocation);
    }
  }, [userLocation]);

  const handleCompare = async () => {
    setIsComparing(true);
    setError(null);
    setComparison(null);

    try {
      const result = await compareListPrices(groups);
      setComparison(result);
    } catch (err) {
      console.error('Price comparison failed:', err);
      setError(t('priceComparison.noData'));
    } finally {
      setIsComparing(false);
    }
  };

  const handleModeSelect = (mode: ShoppingMode) => {
    setSelectedMode(mode);
  };

  if (!isOpen) return null;

  return (
    <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-800">{t('priceComparison.title')}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Compare Button */}
        {!comparison && !isComparing && (
          <button
            type="button"
            onClick={handleCompare}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
          >
            {t('priceComparison.comparePrices')}
          </button>
        )}

        {/* Loading State */}
        {isComparing && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-sm text-slate-500">{t('priceComparison.comparing')}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-4">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={handleCompare}
              className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {t('priceComparison.comparePrices')}
            </button>
          </div>
        )}

        {/* Results */}
        {comparison && (
          <>
            <SavingsReport data={comparison} />

            {/* Mode Selection */}
            <div className="pt-2">
              <ModeSelector selectedMode={selectedMode} onSelectMode={handleModeSelect} />
            </div>

            {/* Physical Mode Actions */}
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
              </div>
            )}

            {/* Online Mode Actions */}
            {selectedMode === 'online' && comparison.cheapestStoreId && (
              <button
                type="button"
                onClick={() => onStartOnlineAgent(comparison.cheapestStoreId)}
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

            {/* Re-compare button */}
            <button
              type="button"
              onClick={handleCompare}
              className="w-full py-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
            >
              {t('priceComparison.comparePrices')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PriceComparisonPanel;
