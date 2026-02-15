import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, ArrowLeft, ShoppingCart, Trash2, Pencil, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { DbProduct } from '../types';
import ProductSearchInput from './ProductSearchInput';

interface ShoppingInputAreaProps {
  products: DbProduct[];
  onProductsChange: (products: DbProduct[]) => void;
  onCompare: () => void;
  isLoading: boolean;
  title?: string;
  onTitleChange?: (title: string) => void;
  city?: string;
  storeType?: string;
  onBack?: () => void;
}

const ShoppingInputArea: React.FC<ShoppingInputAreaProps> = ({
  products,
  onProductsChange,
  onCompare,
  isLoading,
  title,
  onTitleChange,
  city,
  storeType,
  onBack,
}) => {
  const { t, isRTL } = useLanguage();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title || '');
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditTitle(title || '');
  }, [title]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const commitTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== title && onTitleChange) {
      onTitleChange(trimmed);
    }
    setIsEditingTitle(false);
  };

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
      <div className="flex items-center justify-center gap-2 px-6 py-4 border-b border-slate-100 bg-emerald-50/30 rounded-t-3xl relative">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="absolute start-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            <span>{t('appMode.backToSetup')}</span>
          </button>
        )}
        <ShoppingCart className="w-5 h-5 text-emerald-600" />
        {isEditingTitle ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={titleInputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle();
                if (e.key === 'Escape') { setEditTitle(title || ''); setIsEditingTitle(false); }
              }}
              className="text-sm font-semibold text-emerald-800 bg-white border border-emerald-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-300 w-48"
            />
            <button onClick={commitTitle} className="p-1 text-emerald-600 hover:text-emerald-800">
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onTitleChange && setIsEditingTitle(true)}
            className="flex items-center gap-1.5 group"
            title={onTitleChange ? (isRTL ? 'שנה שם' : 'Rename') : undefined}
          >
            <span className="text-sm font-semibold text-emerald-800">{title || t('appMode.buildList')}</span>
            {onTitleChange && (
              <Pencil className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        )}
      </div>

      {/* Product Search (prominent) */}
      <ProductSearchInput
        selectedProducts={products}
        onSelectProduct={handleSelectProduct}
        onRemoveProduct={handleRemoveProduct}
        disabled={isLoading}
        prominent
        city={city}
        storeType={storeType}
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
