import React from 'react';
import { Store, Truck, AlertTriangle, TrendingDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { BasketComparison, BasketStrategyType } from '../types';

interface BasketStrategyPickerProps {
  comparison: BasketComparison;
  selected: BasketStrategyType | null;
  onSelect: (strategy: BasketStrategyType) => void;
  isOnline: boolean;
}

const BasketStrategyPicker: React.FC<BasketStrategyPickerProps> = ({
  comparison,
  selected,
  onSelect,
  isOnline,
}) => {
  const { isRTL } = useLanguage();
  const { single, multi, recommended, savingsAmount } = comparison;
  const absSavings = Math.abs(savingsAmount);

  // If multi-store is just one store, both strategies are identical
  const isIdentical = multi.storeCount <= 1;
  const hasMinOrderWarning = multi.storeBreakdowns.some(b => b.belowMinimum);

  return (
    <div className="space-y-3">
      {/* Savings callout */}
      {!isIdentical && absSavings >= 2 && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
          <TrendingDown className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-700">
            {recommended === 'multi'
              ? (isRTL
                ? `חסכו ₪${absSavings.toFixed(2)} עם קנייה מ-${multi.storeCount} חנויות`
                : `Save ₪${absSavings.toFixed(2)} by shopping at ${multi.storeCount} stores`)
              : (isRTL
                ? `חנות אחת זולה יותר${isOnline ? ' אחרי משלוח' : ''}`
                : `Single store is cheaper${isOnline ? ' after delivery' : ''}`)}
          </span>
        </div>
      )}

      {/* Strategy cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Single Store card */}
        <button
          type="button"
          onClick={() => onSelect('single')}
          className={`relative p-3 rounded-xl border-2 text-start transition-all ${
            selected === 'single'
              ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          {recommended === 'single' && !isIdentical && (
            <span className="absolute -top-2.5 start-3 px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full">
              {isRTL ? 'מומלץ' : 'Best'}
            </span>
          )}
          <div className="flex items-center gap-1.5 mb-2">
            <Store className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-600">
              {isRTL ? 'חנות אחת' : 'Single Store'}
            </span>
          </div>
          <p className="text-sm font-bold text-slate-800 truncate">{single.storeName}</p>
          <p className="text-lg font-black text-emerald-700 mt-1">₪{single.total.toFixed(2)}</p>
          {isOnline && single.deliveryFee > 0 && (
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Truck className="w-3 h-3" />
              {isRTL ? `כולל משלוח ₪${single.deliveryFee.toFixed(0)}` : `incl. ₪${single.deliveryFee.toFixed(0)} delivery`}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-1">
            {single.matchedItems}/{single.matchedItems + single.missingItems.length} {isRTL ? 'מוצרים' : 'items'}
          </p>
        </button>

        {/* Multi-Store card */}
        <button
          type="button"
          onClick={() => !isIdentical && onSelect('multi')}
          disabled={isIdentical}
          className={`relative p-3 rounded-xl border-2 text-start transition-all ${
            isIdentical
              ? 'border-slate-100 bg-slate-50 opacity-50 cursor-default'
              : selected === 'multi'
                ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          {recommended === 'multi' && !isIdentical && (
            <span className="absolute -top-2.5 start-3 px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full">
              {isRTL ? 'מומלץ' : 'Best'}
            </span>
          )}
          <div className="flex items-center gap-1.5 mb-2">
            <Store className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-600">
              {isRTL ? `${multi.storeCount} חנויות` : `${multi.storeCount} Stores`}
            </span>
          </div>
          <p className="text-sm font-bold text-slate-800 truncate">
            {multi.storeBreakdowns.map(b => b.storeName).join(' + ')}
          </p>
          <p className="text-lg font-black text-indigo-700 mt-1">₪{multi.total.toFixed(2)}</p>
          {isOnline && multi.totalDeliveryFees > 0 && (
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Truck className="w-3 h-3" />
              {isRTL ? `משלוחים ₪${multi.totalDeliveryFees.toFixed(0)}` : `deliveries ₪${multi.totalDeliveryFees.toFixed(0)}`}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-1">
            {multi.matchedItems}/{multi.matchedItems + multi.missingItems.length} {isRTL ? 'מוצרים' : 'items'}
          </p>
          {hasMinOrderWarning && (
            <div className="flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] text-amber-600 font-medium">
                {isRTL ? 'מתחת למינימום הזמנה' : 'Below min. order'}
              </span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};

export default BasketStrategyPicker;
