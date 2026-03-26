import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ShoppingCart, Loader2, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ListPriceComparison, ShoppingMode, BasketStrategyType } from '../types';
import { computeBasketComparison } from '../utils/basketStrategies';
import { SUPPORTED_ONLINE_STORES } from '../services/agentService';
import BasketStrategyPicker from './BasketStrategyPicker';
import BasketBreakdownView from './BasketBreakdownView';
import SavingsReport from './SavingsReport';

interface ShoppingPriceStepProps {
  comparison: ListPriceComparison;
  shoppingMode: ShoppingMode;
  cityName: string;
  onBack: () => void;
  onOrganizeForStore: () => void;
  onStartOnlineAgent: (storeName: string) => void;
  isOrganizing: boolean;
}

const ShoppingPriceStep: React.FC<ShoppingPriceStepProps> = ({
  comparison,
  shoppingMode,
  cityName,
  onBack,
  onOrganizeForStore,
  onStartOnlineAgent,
  isOrganizing,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [selectedStrategy, setSelectedStrategy] = useState<BasketStrategyType | null>(null);
  const [showAllStores, setShowAllStores] = useState(false);

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;
  const isOnline = shoppingMode === 'online';

  const basketComparison = useMemo(
    () => computeBasketComparison(comparison, isOnline),
    [comparison, isOnline]
  );

  // Items for single-store breakdown (from the best-ranked store)
  const singleStoreItems = comparison.stores[0]?.itemPrices ?? [];

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
        {/* City info chip */}
        {cityName && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full w-fit mx-auto">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">
              {t('appMode.comparingIn')} {cityName}
            </span>
          </div>
        )}

        {/* Strategy picker */}
        <BasketStrategyPicker
          comparison={basketComparison}
          selected={selectedStrategy}
          onSelect={setSelectedStrategy}
          isOnline={isOnline}
        />

        {/* Breakdown for selected strategy */}
        {selectedStrategy && (
          <BasketBreakdownView
            comparison={basketComparison}
            selected={selectedStrategy}
            isOnline={isOnline}
            singleStoreItems={singleStoreItems}
            onBuildCart={isOnline ? onStartOnlineAgent : undefined}
          />
        )}

        {/* Action button (online mode — build cart) */}
        {shoppingMode === 'online' && selectedStrategy === 'single' && (
          (() => {
            const bestStore = basketComparison.single.storeName;
            const isSupported = SUPPORTED_ONLINE_STORES.has(bestStore);
            return (
              <button
                type="button"
                onClick={() => onStartOnlineAgent(bestStore)}
                disabled={!isSupported}
                className={`w-full flex items-center justify-center gap-2 py-3 font-semibold rounded-xl shadow-sm transition-all active:scale-[0.98] ${
                  isSupported
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                <span>
                  {isRTL ? `בנה עגלה ב-${bestStore}` : `Build Cart at ${bestStore}`}
                </span>
                {!isSupported && (
                  <span className="text-xs bg-slate-300 text-slate-500 px-2 py-0.5 rounded-full">
                    {isRTL ? 'בקרוב' : 'Coming soon'}
                  </span>
                )}
              </button>
            );
          })()
        )}

        {/* Action button (physical mode — organize for store) */}
        {shoppingMode === 'physical' && selectedStrategy === 'single' && (
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
        )}

        {/* Explore all stores (collapsible SavingsReport) */}
        <div>
          <button
            type="button"
            onClick={() => setShowAllStores(v => !v)}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors w-full justify-center py-2"
          >
            <span>{isRTL ? 'הצג את כל החנויות' : 'View all stores'}</span>
            {showAllStores
              ? <ChevronUp className="w-4 h-4" />
              : <ChevronDown className="w-4 h-4" />
            }
          </button>
          {showAllStores && <SavingsReport data={comparison} />}
        </div>
      </div>
    </div>
  );
};

export default ShoppingPriceStep;
