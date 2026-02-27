import React, { useState } from 'react';
import { Package } from 'lucide-react';
import { DbProductEnhanced } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface ProductCardProps {
  product: DbProductEnhanced;
  isSelected: boolean;
  onAdd: () => void;
  onClick: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, isSelected, onAdd, onClick }) => {
  const { t, isRTL } = useLanguage();
  const [imgFailed, setImgFailed] = useState(false);
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
        {product.manufacturer && (
          <p className="text-[11px] text-slate-400 truncate">{product.manufacturer}</p>
        )}
        <div className="mt-auto pt-1">
          {hasPromo && product.max_price != null ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-black text-rose-600">₪{product.min_price.toFixed(2)}</span>
                <span className="text-xs font-normal text-slate-400 line-through">₪{product.max_price.toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-rose-500 font-semibold">
                {isRTL ? `חיסכון ₪${(product.max_price - product.min_price).toFixed(2)}` : `Save ₪${(product.max_price - product.min_price).toFixed(2)}`}
              </p>
            </>
          ) : (
            <span className="text-sm font-bold text-emerald-600">₪{product.min_price.toFixed(2)}</span>
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
