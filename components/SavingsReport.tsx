import React, { useState } from 'react';
import { TrendingDown, ChevronDown, ChevronUp, Award, AlertTriangle, XCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ListPriceComparison, StorePriceSummary } from '../types';

interface SavingsReportProps {
  data: ListPriceComparison;
}

const SavingsReport: React.FC<SavingsReportProps> = ({ data }) => {
  const { t } = useLanguage();
  const [expandedStore, setExpandedStore] = useState<string | null>(null);

  const toggleStore = (storeName: string) => {
    setExpandedStore((prev) => (prev === storeName ? null : storeName));
  };

  return (
    <div className="space-y-4">
      {/* Savings Header */}
      {data.savingsAmount > 0 && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-5 h-5" />
            <span className="text-sm font-medium opacity-90">{t('priceComparison.savings')}</span>
          </div>
          <div className="text-2xl font-bold">
            ₪{data.savingsAmount.toFixed(2)}
          </div>
          <div className="text-sm opacity-80 mt-0.5">
            {data.savingsPercent.toFixed(1)}% {t('priceComparison.savings').toLowerCase()}
          </div>
        </div>
      )}

      {/* Store Comparison List */}
      <div className="space-y-2">
        {data.stores.map((store, index) => (
          <StoreRow
            key={store.supermarketName}
            store={store}
            isRecommended={index === 0}
            isExpanded={expandedStore === store.supermarketName}
            onToggle={() => toggleStore(store.supermarketName)}
            totalItems={data.totalListItems}
          />
        ))}
      </div>

      {/* Unmatched Items */}
      {data.unmatchedItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">
              {t('priceComparison.unmatchedItems')} ({data.unmatchedItems.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.unmatchedItems.map((name) => (
              <span
                key={name}
                className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Store Row sub-component
interface StoreRowProps {
  store: StorePriceSummary;
  isRecommended: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  totalItems: number;
}

const StoreRow: React.FC<StoreRowProps> = ({
  store,
  isRecommended,
  isExpanded,
  onToggle,
  totalItems,
}) => {
  const { t } = useLanguage();
  const hasAllItems = store.matchedItems === totalItems;
  const isPartial = !hasAllItems;

  return (
    <div
      className={`rounded-xl border transition-all ${
        isRecommended
          ? 'border-emerald-300 bg-emerald-50/50'
          : isPartial
            ? 'border-slate-200 bg-slate-50/30 opacity-75'
            : 'border-slate-200 bg-white'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-start"
      >
        <div className="flex items-center gap-2.5">
          {isRecommended && (
            <Award className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${isRecommended ? 'text-emerald-800' : 'text-slate-700'}`}>
                {store.supermarketName}
              </span>
              {isRecommended && (
                <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-800 text-[10px] font-bold rounded-md uppercase">
                  {t('priceComparison.cheapestStore')}
                </span>
              )}
            </div>
            <span className={`text-xs ${hasAllItems ? 'text-emerald-600' : 'text-amber-600'}`}>
              {store.matchedItems} {t('priceComparison.of')} {totalItems} {t('priceComparison.items')} {t('priceComparison.matched')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-base font-bold ${isRecommended ? 'text-emerald-700' : 'text-slate-800'}`}>
            ₪{store.totalCost.toFixed(2)}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Item Breakdown */}
      {isExpanded && (
        <div className="px-4 pb-3 border-t border-slate-100">
          {store.itemPrices.length > 0 && (
            <div className="mt-2 space-y-1">
              {store.itemPrices.map((ip, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 truncate max-w-[60%]">
                    {ip.itemName} {ip.amount > 1 ? `x${ip.amount}` : ''}
                  </span>
                  <span className="text-slate-800 font-medium">₪{ip.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          {store.unmatchedItems.length > 0 && (
            <div className="mt-2 pt-2 border-t border-dashed border-slate-200 space-y-1">
              {store.unmatchedItems.map((name, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-red-400">
                  <XCircle className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{name}</span>
                  <span className="ms-auto text-[10px] italic">{t('priceComparison.unavailable')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SavingsReport;
