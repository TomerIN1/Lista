import React from 'react';
import { ArrowRight, ArrowLeft, ShoppingCart, Trash2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { DbProduct } from '../types';
import ProductSearchInput from './ProductSearchInput';

interface ShoppingInputAreaProps {
  products: DbProduct[];
  onProductsChange: (products: DbProduct[]) => void;
  onCompare: () => void;
  isLoading: boolean;
}

const ShoppingInputArea: React.FC<ShoppingInputAreaProps> = ({
  products,
  onProductsChange,
  onCompare,
  isLoading,
}) => {
  const { t, isRTL } = useLanguage();

  const hasContent = products.length > 0;
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const handleSelectProduct = (product: DbProduct) => {
    onProductsChange([...products, product]);
  };

  const handleRemoveProduct = (barcode: string) => {
    onProductsChange(products.filter((p) => p.barcode !== barcode));
  };

  const handleClear = () => {
    onProductsChange([]);
  };

  return (
    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-visible transition-shadow focus-within:shadow-[0_8px_40px_rgb(99,102,241,0.12)] focus-within:border-emerald-100">
      {/* Header */}
      <div className="flex items-center justify-center gap-2 px-6 py-4 border-b border-slate-100 bg-emerald-50/30 rounded-t-3xl">
        <ShoppingCart className="w-5 h-5 text-emerald-600" />
        <span className="text-sm font-semibold text-emerald-800">{t('appMode.buildList')}</span>
      </div>

      {/* Product Search (prominent) */}
      <ProductSearchInput
        selectedProducts={products}
        onSelectProduct={handleSelectProduct}
        onRemoveProduct={handleRemoveProduct}
        disabled={isLoading}
        prominent
      />

      {/* Empty state hint */}
      {!hasContent && (
        <div className="px-6 py-4">
          <p className="text-xs text-slate-400 text-center">{t('appMode.shoppingListEmpty')}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-6 pb-6 pt-2 rounded-b-3xl">
        <div className="flex items-center gap-2">
          {hasContent && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isLoading}
              className="group flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t('input.clear')}</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onCompare}
          disabled={!hasContent || isLoading}
          className={`
            group flex items-center justify-center gap-2 px-8 py-3 rounded-full font-semibold text-white shadow-lg transition-all duration-300 overflow-hidden
            ${!hasContent || isLoading
              ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5 active:translate-y-0'
            }
          `}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{t('input.processing')}</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-5 h-5" />
              <span>{t('appMode.proceedToCompare')}</span>
              <ArrowIcon className="w-4 h-4 opacity-70 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ShoppingInputArea;
