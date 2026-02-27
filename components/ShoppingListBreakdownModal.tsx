import React, { useState } from 'react';
import { ShoppingProduct } from '../types';
import { X, ShoppingCart, Package } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ShoppingListBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ShoppingProduct[];
  listTitle: string;
}

const ProductImage: React.FC<{ src: string | null; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Package className="w-6 h-6 text-slate-300" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-14 h-14 object-contain rounded-lg bg-white flex-shrink-0"
      onError={() => setFailed(true)}
    />
  );
};

const ShoppingListBreakdownModal: React.FC<ShoppingListBreakdownModalProps> = ({
  isOpen,
  onClose,
  products,
  listTitle,
}) => {
  const { t, tUnit, isRTL } = useLanguage();

  if (!isOpen) return null;

  const formatPrice = (min: number, max?: number) => {
    if (!max || min === max) return `₪${min.toFixed(2)}`;
    return `₪${min.toFixed(2)} - ₪${max.toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-emerald-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-display font-bold text-slate-800 truncate">
              {listTitle}
            </h2>
            <span className="text-sm text-slate-500 flex-shrink-0">
              ({products.length} {t('sidebar.products')})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-lg transition-colors text-slate-600 hover:text-slate-900 flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product List */}
        <div className="overflow-y-auto max-h-[calc(85vh-140px)] p-4 space-y-2">
          {products.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">
              {t('appMode.shoppingListEmpty')}
            </div>
          ) : (
            products.map((product, index) => (
              <div
                key={product.barcode}
                className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-100 hover:shadow-sm transition-shadow"
              >
                <ProductImage src={product.image_url} alt={product.name} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">
                    {product.name}
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">
                    {product.manufacturer && (
                      <span className="text-slate-500">{product.manufacturer}</span>
                    )}
                    {product.manufacturer && ' · '}
                    {product.barcode}
                  </div>
                  {product.min_price > 0 && (
                    <div className="text-xs text-emerald-600 font-medium mt-0.5">
                      {formatPrice(product.min_price, product.max_price)}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0 px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-100">
                  <span className="text-base font-bold text-emerald-700">
                    {product.amount}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                    {tUnit(product.unit)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
          >
            {t('result.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShoppingListBreakdownModal;
