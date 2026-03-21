import React, { useState } from 'react';
import { Package, Weight } from 'lucide-react';
import { DbProductEnhanced } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { formatPriceLabel, unitBadgeLabel, normalizeUnitQty, formatUnitPriceLine } from '../utils/priceFormat';

interface ProductCardProps {
  product: DbProductEnhanced;
  isSelected: boolean;
  onAdd: () => void;
  onClick: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, isSelected, onAdd, onClick }) => {
  const { t, isRTL } = useLanguage();
  const [imgFailed, setImgFailed] = useState(false);
  const badge = unitBadgeLabel(product.unit_of_measure, product.is_weighted);
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
        {badge && (
          <span className="absolute top-1.5 end-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-tight shadow-sm flex items-center gap-0.5">
            <Weight className="w-2.5 h-2.5" />{badge}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-2.5 flex-1">
        <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight">
          {product.name}
        </p>
        {(product.manufacturer || displayUnitQty) && (
          <p className="text-[11px] text-slate-400 truncate">
            {[product.manufacturer, displayUnitQty].filter(Boolean).join(' | ')}
          </p>
        )}
        <div className="mt-auto pt-1">
          {hasPromo && product.max_price != null ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-black text-rose-600">{formatPriceLabel(product.min_price, product.unit_of_measure, product.is_weighted)}</span>
                <span className="text-xs font-normal text-slate-400 line-through">₪{product.max_price.toFixed(2)}</span>
              </div>
              {unitPriceLine && (
                <p className="text-[10px] text-slate-400">{unitPriceLine}</p>
              )}
              <p className="text-[11px] text-rose-500 font-semibold">
                {isRTL ? `חיסכון ₪${(product.max_price - product.min_price).toFixed(2)}` : `Save ₪${(product.max_price - product.min_price).toFixed(2)}`}
              </p>
            </>
          ) : (
            <>
              <span className="text-sm font-bold text-emerald-600">{formatPriceLabel(product.min_price, product.unit_of_measure, product.is_weighted)}</span>
              {unitPriceLine && (
                <p className="text-[10px] text-slate-400">{unitPriceLine}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add button */}
      <div className="px-2.5 pb-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isSelected) onAdd();
          }}
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
