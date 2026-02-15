import React from 'react';
import { ArrowLeft, ArrowRight, ShoppingCart, Laptop, Loader2, MapPin } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ListPriceComparison, ShoppingMode } from '../types';
import SavingsReport from './SavingsReport';

interface ShoppingPriceStepProps {
  comparison: ListPriceComparison;
  shoppingMode: ShoppingMode;
  cityName: string;
  onBack: () => void;
  onOrganizeForStore: () => void;
  onStartOnlineAgent: () => void;
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
        {/* City info chip */}
        {cityName && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full w-fit mx-auto">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">
              {t('appMode.comparingIn')} {cityName}
            </span>
          </div>
        )}

        {/* Savings Report */}
        <SavingsReport data={comparison} />

        {/* Action based on mode */}
        {shoppingMode === 'physical' && (
          <div className="space-y-3">
            {comparison.cheapestStoreId && (() => {
              const cheapestStore = comparison.stores.find(
                (s) => s.supermarketName === comparison.cheapestStoreId
              );
              const address = cheapestStore?.storeAddress;
              return (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <ShoppingCart className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-emerald-800">
                    {language === 'he'
                      ? `קנו ב-${comparison.cheapestStoreId} וחסכו ₪${comparison.savingsAmount.toFixed(2)}!`
                      : `Shop at ${comparison.cheapestStoreId} and save ₪${comparison.savingsAmount.toFixed(2)}!`}
                  </p>
                  {address && (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {address}
                    </p>
                  )}
                </div>
              );
            })()}

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

        {shoppingMode === 'online' && (
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
