import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, Leaf } from 'lucide-react';
import { DbProductDetail, DbProductEnhanced } from '../types';
import { getProductDetail } from '../services/priceDbService';
import { useLanguage } from '../contexts/LanguageContext';

interface ProductDetailModalProps {
  barcode: string;
  onClose: () => void;
  onAdd: (product: DbProductEnhanced) => void;
  isAdded: boolean;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ barcode, onClose, onAdd, isAdded }) => {
  const { t } = useLanguage();
  const [product, setProduct] = useState<DbProductDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    getProductDetail(barcode)
      .then(setProduct)
      .catch(() => setProduct(null))
      .finally(() => setIsLoading(false));
  }, [barcode]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const allergenList = product?.allergens
    ? product.allergens.split(',').map((a) => a.trim()).filter(Boolean)
    : [];

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90dvh] overflow-y-auto z-10">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 end-3 z-20 p-1.5 rounded-full bg-white/80 hover:bg-slate-100 text-slate-500 shadow"
        >
          <X className="w-4 h-4" />
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : !product ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            {t('productSearch.noResults')}
          </div>
        ) : (
          <>
            {/* Image */}
            <div className="w-full aspect-video bg-slate-50 flex items-center justify-center rounded-t-3xl sm:rounded-t-2xl overflow-hidden">
              {product.image_url && !imgFailed ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-contain p-6"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <Package className="w-20 h-20 text-slate-200" />
              )}
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1 text-xs text-slate-400 flex-wrap">
                <span>{product.category}</span>
                {product.subcategory && <><span>›</span><span>{product.subcategory}</span></>}
                {product.sub_subcategory && <><span>›</span><span>{product.sub_subcategory}</span></>}
              </div>

              {/* Name + badges */}
              <div>
                <h2 className="text-lg font-bold text-slate-800 leading-snug">{product.name}</h2>
                {product.manufacturer && (
                  <p className="text-sm text-slate-500 mt-0.5">{product.manufacturer}</p>
                )}
                <p className="text-xs text-slate-400 mt-0.5">{product.barcode}</p>
              </div>

              {/* Vegan + labels */}
              <div className="flex flex-wrap gap-2">
                {product.is_vegan === true && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold border border-green-200">
                    <Leaf className="w-3 h-3" />
                    {t('productBrowse.vegan')}
                  </span>
                )}
                {product.labels && product.labels.split(',').map((l) => l.trim()).filter(Boolean).map((label) => (
                  <span key={label} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{label}</span>
                ))}
              </div>

              {/* Allergens */}
              {allergenList.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">{t('productBrowse.allergens')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allergenList.map((a) => (
                      <span key={a} className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs border border-amber-200">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Prices */}
              {product.prices && product.prices.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">{t('productBrowse.pricesAt')}</p>
                  <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
                    {product.prices.map((p, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{p.supermarket}</p>
                          {p.promotion && (
                            <p className="text-[11px] text-rose-500 mt-0.5">{p.promotion.description}</p>
                          )}
                        </div>
                        <div className="text-end">
                          <p className="text-sm font-bold text-emerald-600">₪{p.effective_price.toFixed(2)}</p>
                          {p.effective_price !== p.price && (
                            <p className="text-[11px] text-slate-400 line-through">₪{p.price.toFixed(2)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add button */}
              <button
                type="button"
                onClick={() => { if (!isAdded) onAdd(product); }}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                  isAdded
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100'
                }`}
              >
                {isAdded ? t('productBrowse.added') : t('productBrowse.addToList')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default ProductDetailModal;
