// components/BasketList.tsx
import React from 'react';
import { ShoppingCart, Trash2, Minus, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ShoppingProduct, Unit } from '../types';
import { computeWeightedTotal } from '../utils/priceFormat';

interface BasketListProps {
  products: ShoppingProduct[];
  onUpdate: (barcode: string, updates: { amount?: number; unit?: Unit }) => void;
  onRemove: (barcode: string) => void;
  onClear: () => void;
}

const BasketList: React.FC<BasketListProps> = ({ products, onUpdate, onRemove, onClear }) => {
  const { t, isRTL } = useLanguage();
  const hasContent = products.length > 0;

  const estimatedTotal = products.reduce((sum, p) => {
    if (!p.min_price) return sum;
    const wt = computeWeightedTotal(p.min_price, p.amount, p.unit, p.unit_of_measure, p.is_weighted, p.name);
    return sum + (wt ?? p.min_price * p.amount);
  }, 0);

  const handleDecrement = (p: ShoppingProduct) => {
    if (p.amount <= 1) onRemove(p.barcode);
    else onUpdate(p.barcode, { amount: p.amount - 1 });
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: 'var(--paper-surface-alt)', borderBottom: '1px solid var(--line)' }}
      >
        <div className="flex items-baseline gap-2">
          <b className="text-[14px]" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>
            {isRTL ? 'הסל שלי' : 'My basket'}
          </b>
          <span className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>
            {hasContent
              ? `${products.length} ${t('productBrowse.cartItems')}`
              : (isRTL ? 'ריק' : 'empty')}
          </span>
        </div>
        {hasContent && (
          <button
            onClick={onClear}
            aria-label={t('productBrowse.clearAll')}
            className="p-1"
            style={{ color: 'var(--ink-soft)' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {!hasContent && (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <ShoppingCart className="w-8 h-8 mb-2" style={{ color: 'var(--ink-soft)' }} />
            <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
              {isRTL ? 'התחל לקנות!' : 'Start shopping!'}
            </p>
          </div>
        )}
        {products.map(p => {
          const wt = computeWeightedTotal(p.min_price, p.amount, p.unit, p.unit_of_measure, p.is_weighted, p.name);
          const linePrice = wt ?? p.min_price * p.amount;
          return (
            <div key={p.barcode} className="flex items-center gap-2 px-3 py-2"
              style={{ borderBottom: '1px solid var(--line)' }}>
              <div
                className="w-[30px] h-[30px] rounded-md flex-shrink-0 overflow-hidden"
                style={{ background: 'var(--paper-surface-alt)' }}
              >
                {p.image_url && (
                  <img src={p.image_url} alt="" className="w-full h-full object-contain" loading="lazy" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                  {p.name}
                </div>
                <div className="text-[8px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                  {p.amount} {p.unit}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--ink)' }}>
                <button
                  type="button"
                  onClick={() => handleDecrement(p)}
                  aria-label="−"
                  className="w-[18px] h-[18px] rounded flex items-center justify-center"
                  style={{ background: 'var(--paper-surface-alt)' }}
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <span className="min-w-[14px] text-center">{p.amount}</span>
                <button
                  type="button"
                  onClick={() => onUpdate(p.barcode, { amount: p.amount + 1 })}
                  aria-label="+"
                  className="w-[18px] h-[18px] rounded flex items-center justify-center"
                  style={{ background: 'var(--paper-surface-alt)' }}
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
              <div className="text-[10px] font-bold min-w-[32px] text-start"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>
                ₪{linePrice.toFixed(0)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer total */}
      {hasContent && (
        <div
          className="flex items-center justify-between px-3 py-2.5"
          style={{ background: 'var(--paper-surface-alt)', borderTop: '1px solid var(--line)' }}
        >
          <span className="text-[10px]" style={{ color: 'var(--ink-muted)' }}>
            {t('productBrowse.basketTotal')}
          </span>
          <span className="text-[14px]" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>
            ₪{estimatedTotal.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};

export default BasketList;
