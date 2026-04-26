// components/BasketList.tsx
import React from 'react';
import { ShoppingCart, Trash2, Minus, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ShoppingProduct, Unit } from '../types';
import { computeWeightedTotal, getQuantityStep, roundQuantity } from '../utils/priceFormat';
import { CATEGORY_ORDER, getCategoryIconSrc } from './ProductCatalogArea';

const UNCATEGORIZED_HE = 'אחר ולא מסווג';
const UNCATEGORIZED_EN = 'Other';

type Group = { category: string; items: ShoppingProduct[] };

function groupByCategory(products: ShoppingProduct[]): Group[] {
  const buckets = new Map<string, ShoppingProduct[]>();
  for (const p of products) {
    const key = (p.category && p.category.trim()) || UNCATEGORIZED_HE;
    const list = buckets.get(key);
    if (list) list.push(p); else buckets.set(key, [p]);
  }
  const orderMap = new Map(CATEGORY_ORDER.map((c, i) => [c, i]));
  return Array.from(buckets.entries())
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => {
      const ai = orderMap.get(a.category) ?? 999;
      const bi = orderMap.get(b.category) ?? 999;
      if (ai !== bi) return ai - bi;
      return a.category.localeCompare(b.category, 'he');
    });
}

interface BasketListProps {
  products: ShoppingProduct[];
  onUpdate: (barcode: string, updates: { amount?: number; unit?: Unit }) => void;
  onRemove: (barcode: string) => void;
  onClear: () => void;
  /** Selected chain subtotal (no delivery). Aligns the footer total with KPIHero,
   *  which shows the same chain's total WITH delivery. Null → fall back to the
   *  cross-store min-price estimate. */
  storeTotal?: number | null;
}

const BasketList: React.FC<BasketListProps> = ({ products, onUpdate, onRemove, onClear, storeTotal }) => {
  const { t, tUnit, isRTL } = useLanguage();
  const hasContent = products.length > 0;

  const estimatedTotal = products.reduce((sum, p) => {
    if (!p.min_price) return sum;
    const promoUnitPrice = p.promotion_summary?.discounted_price;
    if (promoUnitPrice != null) return sum + promoUnitPrice * p.amount;
    const wt = computeWeightedTotal(p.min_price, p.amount, p.unit, p.unit_of_measure, p.is_weighted, p.name);
    return sum + (wt ?? p.min_price * p.amount);
  }, 0);

  const footerTotal = storeTotal != null ? storeTotal : estimatedTotal;

  const handleDecrement = (p: ShoppingProduct) => {
    const step = getQuantityStep(p);
    const next = roundQuantity(p.amount - step, step);
    // Remove when the next value would fall below one full step (with epsilon
    // to survive float drift). Matches ProductCard's "minQty === step" floor.
    if (next < step - 1e-6) onRemove(p.barcode);
    else onUpdate(p.barcode, { amount: next });
  };

  const handleIncrement = (p: ShoppingProduct) => {
    const step = getQuantityStep(p);
    onUpdate(p.barcode, { amount: roundQuantity(p.amount + step, step) });
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
            {isRTL ? 'הרשימה שלי' : 'My List'}
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
        {groupByCategory(products).map(group => (
          <section key={group.category}>
            <header
              className="flex items-center gap-2 px-3 py-1.5 sticky top-0 z-[1]"
              style={{
                background: 'var(--paper-surface-alt)',
                borderBottom: '1px solid var(--line)',
                borderTop: '1px solid var(--line)',
              }}
            >
              <img
                src={getCategoryIconSrc(group.category)}
                alt=""
                className="w-4 h-4 flex-shrink-0 opacity-80"
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-wider flex-1 truncate"
                style={{ color: 'var(--ink-muted)' }}
              >
                {isRTL ? group.category : (group.category === UNCATEGORIZED_HE ? UNCATEGORIZED_EN : group.category)}
              </span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--paper-surface)', color: 'var(--ink-soft)' }}
              >
                {group.items.length}
              </span>
            </header>
            {group.items.map(p => {
              const wt = computeWeightedTotal(p.min_price, p.amount, p.unit, p.unit_of_measure, p.is_weighted, p.name);
              const regularLine = wt ?? p.min_price * p.amount;
              const promoUnitPrice = p.promotion_summary?.discounted_price;
              const promoLine = promoUnitPrice != null ? promoUnitPrice * p.amount : null;
              const hasPromo = !!p.has_promotion;
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
                    <div className="flex items-center gap-1.5">
                      <div className="text-[10px] font-semibold leading-tight truncate" style={{ color: 'var(--ink)' }}>
                        {p.name}
                      </div>
                      {hasPromo && (
                        <span
                          className="text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                          title={p.promotion_summary?.description || (isRTL ? 'מבצע פעיל' : 'Active promo')}
                        >
                          {isRTL ? 'מבצע' : 'PROMO'}
                        </span>
                      )}
                    </div>
                    <div className="text-[8px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                      {p.amount} {tUnit(p.unit)}
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
                    <span className="min-w-[22px] text-center">{p.amount}</span>
                    <button
                      type="button"
                      onClick={() => handleIncrement(p)}
                      aria-label="+"
                      className="w-[18px] h-[18px] rounded flex items-center justify-center"
                      style={{ background: 'var(--paper-surface-alt)' }}
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <div className="flex flex-col items-end min-w-[40px]" style={{ fontFamily: 'var(--font-mono)' }}>
                    {promoLine != null ? (
                      <>
                        <span className="text-[8px] line-through" style={{ color: 'var(--ink-soft)' }}>
                          ₪{regularLine.toFixed(0)}
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: 'var(--accent)' }}>
                          ₪{promoLine.toFixed(0)}
                        </span>
                      </>
                    ) : (
                      <span className={`text-[10px] font-bold`} style={{ color: hasPromo ? 'var(--accent)' : 'var(--ink)' }}>
                        ₪{regularLine.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
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
            ₪{footerTotal.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};

export default BasketList;
