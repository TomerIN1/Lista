import React from 'react';
import { Store, Truck, AlertTriangle, Tag } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  BasketComparison,
  BasketStrategyType,
  SingleStoreBasket,
  MultiStoreBasket,
  ItemPriceDetail,
  StoreBasketBreakdown,
} from '../types';

interface BasketBreakdownViewProps {
  comparison: BasketComparison;
  selected: BasketStrategyType;
  isOnline: boolean;
  singleStoreItems: ItemPriceDetail[]; // items from comparison.stores[0].itemPrices
}

const ItemRow: React.FC<{ item: ItemPriceDetail; isRTL: boolean }> = ({ item, isRTL }) => {
  const hasDiscount = item.originalPrice != null && item.originalPrice > item.price;
  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-700 truncate">{item.itemName}</p>
        {item.promotion && (
          <div className="flex items-center gap-1 mt-0.5">
            <Tag className="w-2.5 h-2.5 text-rose-500" />
            <p className="text-[10px] text-rose-500 truncate">{item.promotion.description}</p>
          </div>
        )}
      </div>
      <div className="text-end flex-shrink-0">
        <div className="flex items-baseline gap-1">
          {hasDiscount && (
            <span className="text-[10px] text-slate-400 line-through">₪{item.originalPrice!.toFixed(2)}</span>
          )}
          <span className={`text-xs font-bold ${hasDiscount ? 'text-rose-600' : 'text-slate-700'}`}>
            ₪{item.price.toFixed(2)}
          </span>
        </div>
        {item.amount > 1 && (
          <p className="text-[10px] text-slate-400">×{item.amount} = ₪{item.total.toFixed(2)}</p>
        )}
      </div>
    </div>
  );
};

const SingleStoreView: React.FC<{ basket: SingleStoreBasket; items: ItemPriceDetail[]; isOnline: boolean; isRTL: boolean }> = ({
  basket, items, isOnline, isRTL,
}) => (
  <div className="rounded-xl border border-slate-200 overflow-hidden">
    {/* Store header */}
    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border-b border-emerald-100">
      <Store className="w-4 h-4 text-emerald-600" />
      <span className="text-sm font-semibold text-emerald-800">{basket.storeName}</span>
    </div>

    {/* Items */}
    <div className="px-3 divide-y divide-slate-50">
      {items.map((item, i) => (
        <ItemRow key={i} item={item} isRTL={isRTL} />
      ))}
    </div>

    {/* Totals */}
    <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 space-y-0.5">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{isRTL ? 'סכום ביניים' : 'Subtotal'}</span>
        <span>₪{basket.subtotal.toFixed(2)}</span>
      </div>
      {isOnline && basket.deliveryFee > 0 && (
        <div className="flex justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Truck className="w-3 h-3" />
            {isRTL ? 'משלוח' : 'Delivery'}
          </span>
          <span>₪{basket.deliveryFee.toFixed(2)}</span>
        </div>
      )}
      <div className="flex justify-between text-sm font-bold text-emerald-700 pt-1 border-t border-slate-200">
        <span>{isRTL ? 'סה״כ' : 'Total'}</span>
        <span>₪{basket.total.toFixed(2)}</span>
      </div>
    </div>

    {/* Missing items */}
    {basket.missingItems.length > 0 && (
      <div className="px-3 py-2 bg-amber-50 border-t border-amber-100">
        <p className="text-[11px] text-amber-600 font-medium mb-1">
          {isRTL ? `${basket.missingItems.length} מוצרים לא נמצאו:` : `${basket.missingItems.length} items not found:`}
        </p>
        <p className="text-[10px] text-amber-500">{basket.missingItems.join(', ')}</p>
      </div>
    )}
  </div>
);

const StoreSection: React.FC<{ breakdown: StoreBasketBreakdown; isOnline: boolean; isRTL: boolean }> = ({
  breakdown, isOnline, isRTL,
}) => (
  <div className="rounded-xl border border-slate-200 overflow-hidden">
    {/* Store header */}
    <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border-b border-indigo-100">
      <div className="flex items-center gap-2">
        <Store className="w-4 h-4 text-indigo-600" />
        <span className="text-sm font-semibold text-indigo-800">{breakdown.storeName}</span>
        <span className="text-[10px] text-indigo-500">
          ({breakdown.items.length} {isRTL ? 'מוצרים' : 'items'})
        </span>
      </div>
      <span className="text-sm font-bold text-indigo-700">₪{breakdown.subtotal.toFixed(2)}</span>
    </div>

    {/* Items */}
    <div className="px-3 divide-y divide-slate-50">
      {breakdown.items.map((item, i) => (
        <ItemRow key={i} item={item} isRTL={isRTL} />
      ))}
    </div>

    {/* Delivery fee */}
    {isOnline && breakdown.deliveryFee > 0 && (
      <div className="flex justify-between items-center px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Truck className="w-3 h-3" />
          {isRTL ? 'משלוח' : 'Delivery'}
        </span>
        <span>₪{breakdown.deliveryFee.toFixed(2)}</span>
      </div>
    )}

    {/* Min order warning */}
    {breakdown.belowMinimum && (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border-t border-amber-100">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-[11px] text-amber-600 font-medium">
          {isRTL
            ? `מתחת למינימום הזמנה (₪${breakdown.minimumOrder})`
            : `Below minimum order (₪${breakdown.minimumOrder})`}
        </span>
      </div>
    )}
  </div>
);

const MultiStoreView: React.FC<{ basket: MultiStoreBasket; isOnline: boolean; isRTL: boolean }> = ({
  basket, isOnline, isRTL,
}) => (
  <div className="space-y-3">
    {basket.storeBreakdowns.map((breakdown, i) => (
      <StoreSection key={i} breakdown={breakdown} isOnline={isOnline} isRTL={isRTL} />
    ))}

    {/* Grand total */}
    <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3">
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-indigo-600">
          <span>{isRTL ? 'סכום מוצרים' : 'Products subtotal'}</span>
          <span>₪{basket.subtotal.toFixed(2)}</span>
        </div>
        {isOnline && basket.totalDeliveryFees > 0 && (
          <div className="flex justify-between text-xs text-indigo-600">
            <span>{isRTL ? `משלוחים (${basket.storeCount})` : `Deliveries (${basket.storeCount})`}</span>
            <span>₪{basket.totalDeliveryFees.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-black text-indigo-800 pt-1 border-t border-indigo-200">
          <span>{isRTL ? 'סה״כ' : 'Grand Total'}</span>
          <span>₪{basket.total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    {/* Missing items */}
    {basket.missingItems.length > 0 && (
      <div className="rounded-xl px-3 py-2 bg-amber-50 border border-amber-100">
        <p className="text-[11px] text-amber-600 font-medium mb-1">
          {isRTL ? `${basket.missingItems.length} מוצרים לא נמצאו:` : `${basket.missingItems.length} items not found:`}
        </p>
        <p className="text-[10px] text-amber-500">{basket.missingItems.join(', ')}</p>
      </div>
    )}
  </div>
);

const BasketBreakdownView: React.FC<BasketBreakdownViewProps> = ({
  comparison,
  selected,
  isOnline,
  singleStoreItems,
}) => {
  const { isRTL } = useLanguage();

  if (selected === 'single') {
    return (
      <SingleStoreView
        basket={comparison.single}
        items={singleStoreItems}
        isOnline={isOnline}
        isRTL={isRTL}
      />
    );
  }

  return (
    <MultiStoreView
      basket={comparison.multi}
      isOnline={isOnline}
      isRTL={isRTL}
    />
  );
};

export default BasketBreakdownView;
