import React, { useState } from 'react';
import { Package, Weight, Plus, Minus } from 'lucide-react';
import { DbProductEnhanced } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { formatPriceLabel, normalizeUnitQty, formatUnitPriceLine, isWeightedProduct } from '../utils/priceFormat';

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
  const step = weighted ? 0.5 : 1;
  const minQty = weighted ? 0.5 : 1;
  const [qty, setQty] = useState(minQty);
  const displayUnitQty = normalizeUnitQty(product.unit_qty);
  const unitPriceLine = formatUnitPriceLine(product.min_price, product.unit_qty, product.is_weighted);
  const hasPromo = product.max_price != null && product.min_price < product.max_price;
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
                <span className="text-sm font-black text-rose-600">
                  {weighted
                    ? formatPriceLabel(product.min_price, product.unit_of_measure, product.is_weighted)
                    : `₪${product.min_price.toFixed(2)} ${isRTL ? 'ליח׳' : '/unit'}`}
                </span>
                <span className="text-xs font-normal text-slate-400 line-through">₪{product.max_price.toFixed(2)}</span>
              </div>
              {!weighted && unitPriceLine && (
                <p className="text-[10px] text-slate-400">{unitPriceLine}</p>
              )}
              <p className="text-[11px] text-rose-500 font-semibold">
                {isRTL ? `חיסכון ₪${(product.max_price - product.min_price).toFixed(2)}` : `Save ₪${(product.max_price - product.min_price).toFixed(2)}`}
              </p>
            </>
          ) : (
            <>
              <span className="text-sm font-bold text-emerald-600">
                {weighted
                  ? formatPriceLabel(product.min_price, product.unit_of_measure, product.is_weighted)
                  : `₪${product.min_price.toFixed(2)} ${isRTL ? 'ליח׳' : '/unit'}`}
              </span>
              {!weighted && unitPriceLine && (
                <p className="text-[10px] text-slate-400">{unitPriceLine}</p>
              )}
            </>
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
