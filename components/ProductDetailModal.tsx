import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, Leaf, Tag, TrendingDown, AlertCircle } from 'lucide-react';
import { DbProductDetail, DbProductEnhanced, ProductStorePrice } from '../types';
import { getProductDetail } from '../services/priceDbService';
import { useLanguage } from '../contexts/LanguageContext';

interface ProductDetailModalProps {
  barcode: string;
  onClose: () => void;
  onAdd: (product: DbProductEnhanced) => void;
  isAdded: boolean;
  fallbackImageUrl?: string | null;
  fallbackProduct?: DbProductEnhanced | null;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ barcode, onClose, onAdd, isAdded, fallbackImageUrl, fallbackProduct }) => {
  const { t, isRTL } = useLanguage();
  const [product, setProduct] = useState<DbProductDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setImgFailed(false);
    getProductDetail(barcode)
      .then(setProduct)
      .catch(() => setProduct(null))
      .finally(() => setIsLoading(false));
  }, [barcode]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const imageUrl = product?.image_url || fallbackImageUrl || null;
  // Merge detail response with browse data — detail API omits several fields
  const info = {
    barcode:         product?.barcode         || fallbackProduct?.barcode         || barcode,
    manufacturer:    product?.manufacturer    || fallbackProduct?.manufacturer    || null,
    category:        product?.category        || fallbackProduct?.category        || null,
    subcategory:     product?.subcategory     || fallbackProduct?.subcategory     || null,
    sub_subcategory: product?.sub_subcategory || fallbackProduct?.sub_subcategory || null,
    name:            product?.name            || fallbackProduct?.name            || '',
  };

  const allergenList = product?.allergens
    ? product.allergens.split(',').map((a) => a.trim()).filter(Boolean)
    : [];

  const labelList = product?.labels
    ? product.labels.split(',').map((l) => l.trim()).filter(Boolean)
    : [];

  // Sort prices cheapest first
  const sortedPrices: ProductStorePrice[] = product?.prices
    ? [...product.prices].sort((a, b) => a.effective_price - b.effective_price)
    : [];

  const cheapestPrice = sortedPrices[0]?.effective_price ?? null;
  const mostExpensivePrice = sortedPrices[sortedPrices.length - 1]?.effective_price ?? null;
  const maxSavings = cheapestPrice != null && mostExpensivePrice != null
    ? mostExpensivePrice - cheapestPrice
    : 0;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col z-10">

        {/* ── Image + name overlay ─────────────────────────── */}
        <div className="relative flex-shrink-0 h-52 sm:h-60 bg-slate-50 rounded-t-3xl sm:rounded-t-2xl overflow-hidden">
          {imageUrl && !imgFailed ? (
            <img
              src={imageUrl}
              alt={product?.name ?? ''}
              className="w-full h-full object-contain p-4"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-20 h-20 text-slate-200" />
            </div>
          )}

          {/* Gradient overlay at the bottom */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Product name on the image */}
          {(product || fallbackProduct) && (
            <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
              <p className="text-white font-bold text-base leading-snug line-clamp-2 drop-shadow">
                {info.name}
              </p>
              {info.manufacturer && (
                <p className="text-white/80 text-xs mt-0.5 drop-shadow">{info.manufacturer}</p>
              )}
            </div>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 end-3 z-20 p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-600 shadow transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────── */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : !product ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              {t('productSearch.noResults')}
            </div>
          ) : (
            <div className="p-4 space-y-4">

              {/* ── Product info table ───────────────────────── */}
              <div className="rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
                {[
                  { label: isRTL ? 'ברקוד' : 'Barcode', value: info.barcode, mono: true },
                  { label: isRTL ? 'יצרן' : 'Manufacturer', value: info.manufacturer },
                  { label: isRTL ? 'קטגוריה' : 'Category', value: info.category },
                  { label: isRTL ? 'תת-קטגוריה' : 'Subcategory', value: info.subcategory },
                  { label: isRTL ? 'תת-תת-קטגוריה' : 'Sub-subcategory', value: info.sub_subcategory },
                ]
                  .filter(row => row.value)
                  .map(row => (
                    <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-xs text-slate-400 flex-shrink-0">{row.label}</span>
                      <span className={`text-xs font-medium text-slate-700 text-end ${row.mono ? 'font-mono' : ''}`}>
                        {row.value}
                      </span>
                    </div>
                  ))
                }
              </div>

              {/* ── Price hero ──────────────────────────────── */}
              {cheapestPrice != null && (
                <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-emerald-600 font-semibold uppercase tracking-wide mb-0.5">
                      {isRTL ? 'מחיר מינימלי' : 'Best Price'}
                    </p>
                    <p className="text-3xl font-black text-emerald-700 leading-none">
                      ₪{cheapestPrice.toFixed(2)}
                    </p>
                    {mostExpensivePrice != null && mostExpensivePrice !== cheapestPrice && (
                      <p className="text-xs text-slate-400 mt-1">
                        {isRTL ? 'עד' : 'up to'}{' '}
                        <span className="line-through">₪{mostExpensivePrice.toFixed(2)}</span>
                        {' '}{isRTL ? 'בחנויות אחרות' : 'elsewhere'}
                      </p>
                    )}
                  </div>
                  {maxSavings > 0.01 && (
                    <div className="flex flex-col items-center bg-emerald-600 text-white rounded-xl px-3 py-2 text-center flex-shrink-0">
                      <TrendingDown className="w-4 h-4 mb-0.5" />
                      <p className="text-xs font-semibold leading-tight">
                        {isRTL ? 'חסוך' : 'Save'}
                      </p>
                      <p className="text-sm font-black">₪{maxSavings.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Badges row ──────────────────────────────── */}
              {(product.is_vegan === true || labelList.length > 0 || allergenList.length > 0) && (
                <div className="space-y-2">
                  {(product.is_vegan === true || labelList.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {product.is_vegan === true && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold border border-green-200">
                          <Leaf className="w-3 h-3" />
                          {t('productBrowse.vegan')}
                        </span>
                      )}
                      {labelList.map((label) => (
                        <span key={label} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                  {allergenList.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        <p className="text-xs font-semibold text-amber-600">{t('productBrowse.allergens')}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {allergenList.map((a) => (
                          <span key={a} className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Price table ─────────────────────────────── */}
              {sortedPrices.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">{t('productBrowse.pricesAt')}</p>
                  <div className="rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
                    {sortedPrices.map((p, i) => {
                      const isCheapest = i === 0;
                      const diff = cheapestPrice != null ? p.effective_price - cheapestPrice : 0;
                      const hasDiscount = p.effective_price < p.price - 0.01;
                      const discountPct = hasDiscount
                        ? Math.round((1 - p.effective_price / p.price) * 100)
                        : 0;
                      const promoLabel = p.promotion?.description
                        || (hasDiscount ? (isRTL ? 'מחיר מבצע' : 'Sale price') : null);

                      return (
                        <div
                          key={i}
                          className={`flex items-start gap-3 px-3 py-2.5 transition-colors ${
                            isCheapest ? 'bg-emerald-50/80' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          {/* Store name + promo label */}
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className={`text-sm font-semibold ${isCheapest ? 'text-emerald-800' : 'text-slate-700'}`}>
                                {p.supermarket}
                              </p>
                              {isCheapest && (
                                <span className="text-[10px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">
                                  {isRTL ? 'הכי זול' : 'Best'}
                                </span>
                              )}
                              {hasDiscount && (
                                <span className="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">
                                  -{discountPct}%
                                </span>
                              )}
                            </div>
                            {promoLabel && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Tag className="w-3 h-3 text-rose-500 flex-shrink-0" />
                                <p className="text-[11px] text-rose-600 font-medium">{promoLabel}</p>
                              </div>
                            )}
                          </div>

                          {/* Price column */}
                          <div className="text-end flex-shrink-0">
                            <p className={`text-sm font-black ${isCheapest ? 'text-emerald-700' : hasDiscount ? 'text-rose-600' : 'text-slate-700'}`}>
                              ₪{p.effective_price.toFixed(2)}
                            </p>
                            {hasDiscount && (
                              <p className="text-[11px] text-slate-400 line-through">₪{p.price.toFixed(2)}</p>
                            )}
                            {!isCheapest && diff > 0.01 && (
                              <p className="text-[11px] text-slate-400 font-medium">+₪{diff.toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sticky Add button ────────────────────────────── */}
        {!isLoading && product && (
          <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100 bg-white rounded-b-3xl sm:rounded-b-2xl">
            <button
              type="button"
              onClick={() => { if (!isAdded) onAdd(product); }}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                isAdded
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-lg shadow-emerald-100'
              }`}
            >
              {isAdded ? t('productBrowse.added') : t('productBrowse.addToList')}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default ProductDetailModal;
