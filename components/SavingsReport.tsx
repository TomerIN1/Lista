import React, { useState } from 'react';
import { TrendingDown, ChevronDown, ChevronUp, Award, AlertTriangle, XCircle, MapPin, Truck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ListPriceComparison, StorePriceSummary, StoreBranch } from '../types';

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
  const [selectedBranchIndex, setSelectedBranchIndex] = useState(0);
  const [showBranches, setShowBranches] = useState(false);

  const branches = store.availableBranches;
  const hasMultipleBranches = branches && branches.length > 1;
  const activeBranch = branches?.[selectedBranchIndex];

  // Use the selected branch's data if available, otherwise fall back to store defaults
  const displayTotal = activeBranch?.totalCost ?? store.totalCost;
  const displayItemPrices = activeBranch?.itemPrices ?? store.itemPrices;
  const displayAddress = activeBranch?.address ?? store.storeAddress;
  const displayMatchedItems = activeBranch ? activeBranch.itemPrices.length : store.matchedItems;

  const hasDelivery = store.deliveryFee != null;
  const displayHeadlineTotal = store.totalWithDelivery ?? displayTotal;
  const isBelowMinimum = store.minimumOrder != null && store.minimumOrder > 0 && displayTotal < store.minimumOrder;

  const hasAllItems = displayMatchedItems === totalItems;
  const isPartial = !hasAllItems;

  const handleBranchSelect = (index: number) => {
    setSelectedBranchIndex(index);
    setShowBranches(false);
  };

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
            {displayAddress && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-500">{displayAddress}</span>
              </div>
            )}
            <span className={`text-xs ${hasAllItems ? 'text-emerald-600' : 'text-amber-600'}`}>
              {displayMatchedItems} {t('priceComparison.of')} {totalItems} {t('priceComparison.items')} {t('priceComparison.matched')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-base font-bold ${isRecommended ? 'text-emerald-700' : 'text-slate-800'}`}>
            ₪{displayHeadlineTotal.toFixed(2)}
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
          {/* Branch Selector */}
          {hasMultipleBranches && (
            <div className="mt-2 mb-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowBranches((v) => !v); }}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {showBranches ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span>{branches!.length - 1} {t('priceComparison.otherBranches')}</span>
              </button>
              {showBranches && (
                <div className="mt-1.5 space-y-1 ps-1">
                  {branches!.map((branch, idx) => (
                    idx !== selectedBranchIndex && (
                      <button
                        key={branch.storeId}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleBranchSelect(idx); }}
                        className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-start"
                      >
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="text-slate-600">{branch.address || branch.storeId}</span>
                        </div>
                        <span className="text-slate-800 font-medium">₪{branch.totalCost.toFixed(2)}</span>
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          )}

          {displayItemPrices.length > 0 && (
            <div className="mt-2 space-y-1">
              {displayItemPrices.map((ip, i) => (
                <div key={i} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-slate-600 truncate min-w-0 flex-1">
                    {ip.itemName}
                  </span>
                  {ip.amount > 1 ? (
                    <span className="text-slate-400 whitespace-nowrap flex-shrink-0">
                      ₪{ip.price.toFixed(2)} × {ip.amount}
                    </span>
                  ) : (
                    <span className="text-slate-400 whitespace-nowrap flex-shrink-0">
                      ₪{ip.price.toFixed(2)}
                    </span>
                  )}
                  <span className="text-slate-800 font-medium whitespace-nowrap flex-shrink-0">
                    ₪{ip.total.toFixed(2)}
                  </span>
                </div>
              ))}
              {/* Delivery fee line for online stores */}
              {hasDelivery && (
                <div className="flex items-center justify-between text-xs pt-1.5 mt-1.5 border-t border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    {t('priceComparison.deliveryFee')}
                  </span>
                  <span className="text-slate-800 font-medium">₪{store.deliveryFee!.toFixed(2)}</span>
                </div>
              )}
              {hasDelivery && (
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700">{t('priceComparison.totalWithDelivery')}</span>
                  <span className="text-slate-900">₪{displayHeadlineTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
          {/* Minimum order warning */}
          {isBelowMinimum && (
            <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span className="text-xs text-amber-700">
                {t('priceComparison.belowMinimum')} (₪{store.minimumOrder})
              </span>
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
