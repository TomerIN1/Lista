import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowRight, ArrowLeft, ShoppingCart, Trash2, Pencil, Check,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X, Store, Sparkles,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { DbProduct, ShoppingProduct, Unit, DeliveryCheckResult } from '../types';
import { SUPERMARKET_NAME_MAP } from '../services/priceDbService';
import ProductCatalogArea from './ProductCatalogArea';
import SmartListPanel from '../agents_and_ai/product-discovery-assistant/SmartListPanel';
import { formatPriceRange, isWeightedProduct, computeWeightedTotal } from '../utils/priceFormat';

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
  deliveryCheck?: DeliveryCheckResult | null;
  shoppingMode?: string | null;
  onBack?: () => void;
  externalSearchQuery?: string;
  externalCategory?: string | null;
  externalSubcategory?: string | null;
  externalSubSubcategory?: string | null;
  onCategoryChange?: (cat: string | null) => void;
  showSmartList?: boolean;
  onShowSmartListChange?: (v: boolean) => void;
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
  deliveryCheck,
  shoppingMode,
  onBack,
  externalSearchQuery,
  externalCategory,
  externalSubcategory,
  externalSubSubcategory,
  onCategoryChange,
  showSmartList: externalShowSmartList,
  onShowSmartListChange,
}) => {
  const { t, isRTL, tUnit } = useLanguage();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title || '');
  const [isCartExpanded, setIsCartExpanded] = useState(false);
  const [selectedChains, setSelectedChains] = useState<string[]>([]);
  const [internalShowSmartList, setInternalShowSmartList] = useState(false);
  // Controlled or uncontrolled — prefer external state if provided
  const showSmartList = externalShowSmartList !== undefined ? externalShowSmartList : internalShowSmartList;
  const setShowSmartList = (v: boolean) => {
    if (onShowSmartListChange) onShowSmartListChange(v);
    else setInternalShowSmartList(v);
  };
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Effective chains: if user hasn't explicitly filtered, use all available chains from their area
  const effectiveChains = useMemo(() => {
    if (selectedChains.length > 0) return selectedChains;
    if (!deliveryCheck?.chains) return [];
    const isOnline = shoppingMode === 'online';
    return deliveryCheck.chains
      .filter(c => isOnline ? (c.delivers || c.click_and_collect) : true)
      .map(c => c.chain);
  }, [selectedChains, deliveryCheck, shoppingMode]);

  const existingBarcodes = useMemo(
    () => new Set(products.map((p) => p.barcode)),
    [products]
  );

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

  const handleSmartListConfirm = (newProducts: ShoppingProduct[]) => {
    onProductsChange([...products, ...newProducts]);
    setShowSmartList(false);
  };

  const formatPrice = (min: number, max?: number, unitOfMeasure?: string | null, isWeighted?: boolean | null) => {
    return formatPriceRange(min, max, unitOfMeasure, isWeighted);
  };

  const hasContent = products.length > 0;

  // Estimated total price
  const estimatedTotal = useMemo(() => {
    return products.reduce((sum, p) => {
      if (!p.min_price) return sum;
      const wt = computeWeightedTotal(p.min_price, p.amount, p.unit, p.unit_of_measure, p.is_weighted, p.name);
      return sum + (wt ?? p.min_price * p.amount);
    }, 0);
  }, [products]);

  return (
    <div className="flex gap-4" style={{ direction: 'ltr' }}>
      {/* ── Left-side Cart Sidebar (desktop) / Bottom bar (mobile) ── */}
      {/* Desktop cart sidebar — always on the left via direction:ltr on parent */}
      <div className="hidden lg:flex flex-col w-72 xl:w-80 2xl:w-96 flex-shrink-0 sticky top-[52px] h-[calc(100vh-52px)] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
        {/* Cart header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-slate-700">
              {hasContent
                ? `${products.length} ${t('productBrowse.cartItems')}`
                : (isRTL ? 'העגלה ריקה' : 'Cart is empty')
              }
            </span>
          </div>
          {hasContent && (
            <button onClick={handleClear} disabled={isLoading} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {!hasContent && (
            <div className="flex flex-col items-center justify-center h-32 text-center px-4">
              <ShoppingCart className="w-8 h-8 text-slate-200 mb-2" />
              <p className="text-xs text-slate-400">{isRTL ? 'התחל לקנות!' : 'Start shopping!'}</p>
            </div>
          )}
          {products.map((product) => (
            <div key={product.barcode} className="flex items-start gap-2 px-3 py-2.5 hover:bg-slate-50/50 transition-colors">
              {/* Product thumbnail */}
              <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0 overflow-hidden">
                {product.image_url ? (
                  <img src={product.image_url} alt="" className="w-full h-full object-contain" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">{product.name}</div>
                {product.manufacturer && (
                  <div className="text-[10px] text-slate-400 mt-0.5">{product.manufacturer}</div>
                )}
                {product.min_price > 0 && (
                  <div className="text-xs font-bold text-emerald-600 mt-0.5">
                    {formatPrice(product.min_price, product.max_price, product.unit_of_measure, product.is_weighted)}
                  </div>
                )}
                {product.min_price > 0 && isWeightedProduct(product.unit_of_measure, product.is_weighted) && (() => {
                  const est = computeWeightedTotal(product.min_price, product.amount, product.unit, product.unit_of_measure, product.is_weighted, product.name);
                  return est != null ? (
                    <div className="text-[10px] text-amber-600 mt-0.5">≈ ₪{est.toFixed(2)}</div>
                  ) : null;
                })()}
              </div>
              {/* Qty controls */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {(() => {
                  const fineStep = product.category === 'מוצרי חלב וביצים' || product.category === 'בשר עוף דגים ומעדניה';
                  const weightStep = fineStep ? 0.1 : 0.5;
                  const isPcs = product.unit === 'pcs';
                  const step = isPcs ? 1 : weightStep;
                  const min = isPcs ? 1 : weightStep;
                  return (
                    <input
                      type="number"
                      min={min}
                      max="100"
                      step={step}
                      value={product.amount}
                      onChange={(e) => {
                        const raw = parseFloat(e.target.value);
                        if (isNaN(raw) || raw <= 0) return;
                        const val = isPcs ? Math.round(raw) : Math.round(raw / step) * step;
                        handleUpdateProduct(product.barcode, { amount: +val.toFixed(1) });
                      }}
                      className="w-10 h-6 text-[11px] font-semibold text-center border border-slate-200 rounded outline-none bg-white text-slate-600"
                    />
                  );
                })()}
              </div>
              <button onClick={() => handleRemoveProduct(product.barcode)} className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors flex-shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Weighted disclaimer */}
        {products.some(p => isWeightedProduct(p.unit_of_measure, p.is_weighted)) && (
          <div className="px-3 py-1.5 bg-amber-50/60 border-t border-amber-100">
            <p className="text-[10px] text-amber-600">
              {isRTL ? '⚖️ מוצרים במשקל — מחיר סופי עשוי להשתנות' : '⚖️ Weighted — price may vary'}
            </p>
          </div>
        )}

        {/* Cart footer with total + compare */}
        <div className="border-t border-slate-200 bg-emerald-50/50 px-4 py-3">
          {estimatedTotal > 0 && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">{isRTL ? 'סה״כ משוער' : 'Est. total'}</span>
              <span className="text-sm font-bold text-slate-800">₪{estimatedTotal.toFixed(2)}</span>
            </div>
          )}
          <button
            type="button"
            onClick={onCompare}
            disabled={!hasContent || isLoading}
            className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-full font-semibold text-sm text-white shadow-md transition-all ${
              !hasContent || isLoading
                ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t('input.processing')}</span>
              </>
            ) : (
              <span>{t('appMode.proceedToCompare')}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 min-w-0 pb-20 lg:pb-4" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* ── Available stores banner ─────────────────── */}
      {deliveryCheck && (() => {
        const isOnline = shoppingMode === 'online';
        const availableChains = deliveryCheck.chains.filter(c =>
          isOnline ? (c.delivers || c.click_and_collect) : true
        );
        if (availableChains.length === 0) return (
          <div className="px-4 py-2 text-xs text-slate-400 text-center">
            {t('productBrowse.noStoresAvailable')}
          </div>
        );
        const toggleChain = (chain: string) => {
          setSelectedChains(prev =>
            prev.includes(chain) ? prev.filter(c => c !== chain) : [...prev, chain]
          );
        };
        const hasFilter = selectedChains.length > 0;
        return (
          <div className="flex items-center gap-2 px-2 py-2 mb-2 bg-white rounded-xl border border-slate-100 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">
              <Store className="w-3.5 h-3.5" />
              <span>{t('productBrowse.availableStores')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {hasFilter && (
                <button
                  type="button"
                  onClick={() => setSelectedChains([])}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-medium whitespace-nowrap hover:bg-slate-200 transition-colors"
                >
                  {t('productBrowse.allStores')}
                </button>
              )}
              {availableChains.map(c => {
                const isSelected = selectedChains.includes(c.chain);
                return (
                  <button
                    type="button"
                    key={c.chain}
                    onClick={() => toggleChain(c.chain)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      hasFilter && !isSelected
                        ? 'bg-slate-50 text-slate-400 border border-slate-200'
                        : isSelected
                          ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {SUPERMARKET_NAME_MAP[c.chain] || c.chain}
                    {isOnline && c.delivers && c.delivery_fee != null && (
                      <span
                        className={`ms-1 px-1.5 py-0.5 rounded-full text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-[var(--paper-surface)] text-[var(--ink-muted)] border border-[var(--line)]'}`}
                        title={t('priceComparison.deliveryFee')}
                      >
                        🚚 {t('priceComparison.deliveryFee')} ₪{c.delivery_fee}
                      </span>
                    )}
                    {isOnline && !c.delivers && c.click_and_collect && (
                      <span className={isSelected ? 'text-amber-200' : 'text-amber-600'}>{t('productBrowse.collectAvailable')}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Smart List / Catalog toggle ─────────────────── */}
      {showSmartList ? (
        <SmartListPanel
          onClose={() => setShowSmartList(false)}
          onConfirm={handleSmartListConfirm}
          existingBarcodes={existingBarcodes}
          city={city}
          storeType={storeType}
          selectedChains={effectiveChains}
        />
      ) : (
        <>

          {/* Catalog (browse + search) */}
          <ProductCatalogArea
            selectedProducts={products}
            onSelectProduct={handleSelectProduct}
            onRemoveProduct={handleRemoveProduct}
            onUpdateProduct={handleUpdateProduct}
            disabled={isLoading}
            city={city}
            storeType={storeType}
            selectedChains={effectiveChains}
            externalSearchQuery={externalSearchQuery}
            externalCategory={externalCategory}
            externalSubcategory={externalSubcategory}
            externalSubSubcategory={externalSubSubcategory}
            onCategoryChange={onCategoryChange}
          />
        </>
      )}

      </div>{/* end main content area */}

      {/* ── Mobile-only bottom cart bar ────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgb(0,0,0,0.08)]">
        <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50/60">
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
                {estimatedTotal > 0 && (
                  <span className="text-xs text-slate-500 font-normal">· ~₪{estimatedTotal.toFixed(0)}</span>
                )}
                {isCartExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </>
            ) : (
              <span className="text-xs">{isRTL ? 'העגלה ריקה' : 'Cart is empty'}</span>
            )}
          </button>
          <button
            type="button"
            onClick={onCompare}
            disabled={!hasContent || isLoading}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold text-sm text-white shadow-md transition-all ${
              !hasContent || isLoading
                ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
            }`}
          >
            <span>{t('appMode.proceedToCompare')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShoppingInputArea;
