import React, { useState } from 'react';
import { Package, Weight, Plus, Minus, Tag } from 'lucide-react';
import { DbProductEnhanced } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { formatDisplayPrice, normalizeUnitQty, formatUnitPriceLine, isWeightedProduct } from '../utils/priceFormat';
import { SUPERMARKET_NAME_MAP } from '../services/priceDbService';

interface ProductCardProps {
  product: DbProductEnhanced;
  isSelected: boolean;
  onAdd: (amount: number) => void;
  onClick: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, isSelected, onAdd, onClick }) => {
  const { t, isRTL } = useLanguage();
  const [imgFailed, setImgFailed] = useState(false);
  const weighted = isWeightedProduct(product.unit_of_measure, product.is_weighted);
  const fineCategoryStep = product.category === 'מוצרי חלב וביצים' || product.category === 'בשר עוף דגים ומעדניה';
  const step = weighted ? (fineCategoryStep ? 0.1 : 0.5) : 1;
  const minQty = weighted ? (fineCategoryStep ? 0.1 : 0.5) : 1;
  const [qty, setQty] = useState(minQty);
  const displayUnitQty = normalizeUnitQty(product.unit_qty);
  const unitPriceLine = formatUnitPriceLine(product.min_price, product.unit_qty, product.is_weighted);
  const hasPromo = product.max_price != null && product.min_price < product.max_price;
  // Use backend-computed display fields for correct price labels
  const cardPrice = product.display_min_price ?? product.min_price;
  const cardPriceLabel = formatDisplayPrice(cardPrice, product.display_unit);
  const discountPct = hasPromo && product.max_price
    ? Math.round((1 - product.min_price / product.max_price) * 100)
    : 0;

  return (
    <div
      className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col overflow-hidden"
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
        {product.image_url && !imgFailed ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-contain p-2"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <Package className="w-12 h-12 text-slate-200" />
        )}
        {hasPromo && (
          <span className="absolute top-1.5 start-1.5 bg-rose-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full leading-tight shadow-sm">
            -{discountPct}%
          </span>
        )}
        {product.has_promotion && (
          <span className="absolute top-1.5 end-1.5 flex items-center gap-0.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-tight shadow-sm">
            <Tag className="w-2.5 h-2.5" />
            {isRTL ? 'במבצע' : 'Promo'}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-2.5 flex-1">
        <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight">
          {product.name}
        </p>

        {weighted ? (
          /* ── Weighted product meta ── */
          <div className="flex items-center gap-1">
            <Weight className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] text-amber-600 font-semibold">
              {isRTL ? 'נמכר במשקל' : 'Sold by weight'}
            </span>
          </div>
        ) : (
          /* ── Unit product meta ── */
          <p className="text-[11px] text-slate-400 truncate">
            {[isRTL ? 'יחידה' : 'Unit', displayUnitQty].filter(Boolean).join(' | ')}
          </p>
        )}

        <div className="mt-auto pt-1">
          {hasPromo && product.max_price != null ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-black text-rose-600">{cardPriceLabel}</span>
                <span className="text-xs font-normal text-slate-400 line-through">₪{product.max_price.toFixed(2)}</span>
              </div>
              {weighted && product.min_price_per_100g != null && (
                <p className="text-[10px] text-slate-400">₪{product.min_price_per_100g.toFixed(2)} / 100 גרם</p>
              )}
              {!weighted && unitPriceLine && (
                <p className="text-[10px] text-slate-400">{unitPriceLine}</p>
              )}
              <p className="text-[11px] text-rose-500 font-semibold">
                {isRTL ? `חיסכון ₪${(product.max_price - product.min_price).toFixed(2)}` : `Save ₪${(product.max_price - product.min_price).toFixed(2)}`}
              </p>
            </>
          ) : (
            <>
              <span className="text-sm font-bold text-emerald-600">{cardPriceLabel}</span>
              {weighted && product.min_price_per_100g != null && (
                <p className="text-[10px] text-slate-400">₪{product.min_price_per_100g.toFixed(2)} / 100 גרם</p>
              )}
              {!weighted && unitPriceLine && (
                <p className="text-[10px] text-slate-400">{unitPriceLine}</p>
              )}
            </>
          )}
          {product.promotion_summary && (
            <div className="mt-1.5 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
              <p className="text-[10px] font-semibold text-amber-700">
                <Tag className="w-2.5 h-2.5 inline -mt-0.5" />{' '}
                {isRTL ? 'במבצע ב-' : 'Promo at '}{SUPERMARKET_NAME_MAP[product.promotion_summary.supermarket] || product.promotion_summary.supermarket}
              </p>
              <p className="text-[10px] text-amber-600 line-clamp-1">
                {(() => {
                  const ps = product.promotion_summary!;
                  const mq = ps.min_qty;
                  const dp = ps.discounted_price;
                  if (mq != null && mq >= 2 && dp != null) {
                    return `${mq} ב-₪${dp % 1 === 0 ? dp : dp.toFixed(2)} (₪${(dp / mq).toFixed(2)} ליחידה)`;
                  }
                  if (dp != null) {
                    return `₪${dp % 1 === 0 ? dp : dp.toFixed(2)}`;
                  }
                  return ps.description;
                })()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quantity selector + Add button */}
      <div className="px-2.5 pb-2.5 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
        {!isSelected && (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setQty(Math.max(minQty, +(qty - step).toFixed(1)))}
              disabled={qty <= minQty}
              className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors disabled:opacity-30 disabled:cursor-default"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <div className="flex flex-col items-center min-w-[3rem]">
              <span className="text-sm font-bold text-slate-700">{qty}</span>
              <span className="text-[10px] text-slate-400 leading-none">{weighted ? (isRTL ? 'ק״ג' : 'kg') : (isRTL ? 'יח׳' : 'pcs')}</span>
            </div>
            <button
              type="button"
              onClick={() => setQty(+(qty + step).toFixed(1))}
              className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => { if (!isSelected) onAdd(qty); }}
          className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isSelected
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {isSelected ? t('productBrowse.added') : t('productBrowse.addToList')}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
