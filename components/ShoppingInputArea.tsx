import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight, ArrowLeft, ShoppingCart, Trash2, Pencil, Check,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { DbProduct, ShoppingProduct, Unit } from '../types';
import ProductCatalogArea from './ProductCatalogArea';

const UNITS: Unit[] = ['pcs', 'g', 'kg', 'L', 'ml'];

interface ShoppingInputAreaProps {
  products: ShoppingProduct[];
  onProductsChange: (products: ShoppingProduct[]) => void;
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
  const { t, isRTL, tUnit } = useLanguage();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title || '');
  const [isCartExpanded, setIsCartExpanded] = useState(false);
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

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const handleSelectProduct = (product: ShoppingProduct) => {
    onProductsChange([...products, product]);
  };

  const handleRemoveProduct = (barcode: string) => {
    onProductsChange(products.filter((p) => p.barcode !== barcode));
  };

  const handleUpdateProduct = (barcode: string, updates: { amount?: number; unit?: Unit }) => {
    onProductsChange(products.map((p) => p.barcode === barcode ? { ...p, ...updates } : p));
  };

  const handleClear = () => {
    onProductsChange([]);
    setIsCartExpanded(false);
  };

  const formatPrice = (min: number, max?: number) => {
    if (!max || min === max) return `₪${min.toFixed(2)}`;
    return `₪${min.toFixed(2)} – ₪${max.toFixed(2)}`;
  };

  const hasContent = products.length > 0;

  return (
    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-visible transition-shadow focus-within:shadow-[0_8px_40px_rgb(99,102,241,0.12)] focus-within:border-emerald-100 flex flex-col">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center px-4 py-4 border-b border-slate-100 bg-emerald-50/30 rounded-t-3xl">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors flex-shrink-0"
          >
            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            <span className="hidden sm:inline">{t('appMode.backToSetup')}</span>
          </button>
        ) : (
          <div className="w-0" />
        )}
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          <ShoppingCart className="w-5 h-5 text-emerald-600 flex-shrink-0" />
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
        {onBack ? <div className="w-[68px] sm:w-[120px] flex-shrink-0" /> : <div className="w-0" />}
      </div>

      {/* ── Catalog (browse + search) ───────────────────── */}
      <ProductCatalogArea
        selectedProducts={products}
        onSelectProduct={handleSelectProduct}
        onRemoveProduct={handleRemoveProduct}
        onUpdateProduct={handleUpdateProduct}
        disabled={isLoading}
        city={city}
        storeType={storeType}
      />

      {/* ── Collapsible cart bar ────────────────────────── */}
      <div className="border-t border-slate-100 rounded-b-3xl overflow-hidden">
        {/* Expanded cart list */}
        {isCartExpanded && hasContent && (
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {products.map((product) => (
              <div
                key={product.barcode}
                className="flex items-start gap-3 px-4 py-3 bg-white hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="text-sm font-semibold text-slate-800 leading-snug">{product.name}</div>
                  {/* Manufacturer */}
                  {product.manufacturer && (
                    <div className="text-xs text-slate-500 mt-0.5">{product.manufacturer}</div>
                  )}
                  {/* Category breadcrumb */}
                  {product.category && (
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {[product.category, product.subcategory, product.sub_subcategory]
                        .filter(Boolean).join(' › ')}
                    </div>
                  )}
                  {/* Barcode */}
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{product.barcode}</div>
                  {product.min_price > 0 && (
                    <div className="text-xs font-bold text-emerald-600 mt-1">
                      {formatPrice(product.min_price, product.max_price)}
                    </div>
                  )}
                </div>
                {/* Amount & Unit Controls */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input
                    type="number"
                    min={product.unit === 'pcs' ? 1 : 0.5}
                    max="100"
                    step={product.unit === 'pcs' ? 1 : 0.5}
                    value={product.amount}
                    onChange={(e) => {
                      const raw = parseFloat(e.target.value);
                      if (isNaN(raw) || raw <= 0) return;
                      const val = product.unit === 'pcs' ? Math.round(raw) : Math.round(raw * 2) / 2;
                      handleUpdateProduct(product.barcode, { amount: val });
                    }}
                    className="w-14 h-7 text-xs font-semibold text-center border border-slate-200 focus:border-indigo-400 rounded-md outline-none bg-white text-slate-600"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <select
                    value={product.unit}
                    onChange={(e) => {
                      const newUnit = e.target.value as Unit;
                      const snappedAmount = newUnit === 'pcs' ? Math.max(1, Math.round(product.amount)) : product.amount;
                      handleUpdateProduct(product.barcode, { unit: newUnit, amount: snappedAmount });
                    }}
                    className="h-7 ps-1.5 pe-5 text-[11px] font-bold uppercase tracking-wider bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-md border border-slate-200 focus:border-indigo-400 outline-none appearance-none cursor-pointer text-end w-14"
                  >
                    {UNITS.map(u => (
                      <option key={u} value={u}>{tUnit(u)}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveProduct(product.barcode)}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Clear button inside expanded cart */}
            <div className="px-4 py-2 bg-slate-50/70 flex justify-end">
              <button
                type="button"
                onClick={handleClear}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('productBrowse.clearAll')}
              </button>
            </div>
          </div>
        )}

        {/* Cart bar */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50/60">
          {/* Toggle / count */}
          <button
            type="button"
            onClick={() => hasContent && setIsCartExpanded((v) => !v)}
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${
              hasContent ? 'text-emerald-700 hover:text-emerald-800' : 'text-slate-400 cursor-default'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            {hasContent ? (
              <>
                <span>{products.length} {t('productBrowse.cartItems')}</span>
                {isCartExpanded
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronUp className="w-4 h-4" />
                }
              </>
            ) : (
              <span>{t('productBrowse.cartEmpty')}</span>
            )}
          </button>

          {/* Compare button */}
          <button
            type="button"
            onClick={onCompare}
            disabled={!hasContent || isLoading}
            className={`
              flex items-center gap-1.5 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-semibold text-sm text-white shadow-md transition-all duration-300
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
                <span>{t('appMode.proceedToCompare')}</span>
                <ArrowIcon className="w-4 h-4 opacity-70" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShoppingInputArea;
