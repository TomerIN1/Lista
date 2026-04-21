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
import { useLiveComparison, ChainTotal } from '../hooks/useLiveComparison';
import LiveBasketPanel from './LiveBasketPanel';
import StoresStripV2 from './StoresStripV2';
import MobileBasketBar from './MobileBasketBar';
import MobileBasketSheet from './MobileBasketSheet';

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
  const [selectedChains, setSelectedChains] = useState<string[]>([]);
  const [internalShowSmartList, setInternalShowSmartList] = useState(false);
  // Controlled or uncontrolled — prefer external state if provided
  const showSmartList = externalShowSmartList !== undefined ? externalShowSmartList : internalShowSmartList;
  const setShowSmartList = (v: boolean) => {
    if (onShowSmartListChange) onShowSmartListChange(v);
    else setInternalShowSmartList(v);
  };
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [selectedChainCode, setSelectedChainCode] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const liveCmp = useLiveComparison({
    products,
    city,
    storeType,
    deliveryCheck,
  });

  // Default the selected chain to the cheapest when comparison loads.
  useEffect(() => {
    if (!liveCmp.data) return;
    if (selectedChainCode == null && liveCmp.data.cheapest) {
      setSelectedChainCode(liveCmp.data.cheapest.chain);
    }
  }, [liveCmp.data, selectedChainCode]);

  const selectedChain: ChainTotal | null = (() => {
    if (!liveCmp.data) return null;
    if (selectedChainCode) {
      return liveCmp.data.chains.find(c => c.chain === selectedChainCode) ?? liveCmp.data.cheapest;
    }
    return liveCmp.data.cheapest;
  })();

  const handleSendToPricePilot = () => {
    // Reuse the existing compare flow.
    onCompare();
  };

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
    <>
      <div className="pb-20 lg:pb-4" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* ── Stores strip — per-chain cart totals ─── */}
      <StoresStripV2
        chains={liveCmp.data?.chains ?? []}
        selectedChain={selectedChainCode}
        onSelectChain={setSelectedChainCode}
        loading={liveCmp.loading}
      />

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

      {/* desktop panel */}
      <LiveBasketPanel
        products={products}
        comparison={liveCmp.data}
        selectedChain={selectedChain}
        onUpdate={handleUpdateProduct}
        onRemove={handleRemoveProduct}
        onClear={handleClear}
        onSendToPricePilot={handleSendToPricePilot}
      />

      {/* mobile bar + sheet */}
      <MobileBasketBar
        cheapest={liveCmp.data?.cheapest ?? null}
        itemCount={products.length}
        onTap={() => setMobileSheetOpen(true)}
      />
      <MobileBasketSheet
        open={mobileSheetOpen}
        onClose={() => setMobileSheetOpen(false)}
        products={products}
        comparison={liveCmp.data}
        selectedChain={selectedChain}
        onUpdate={handleUpdateProduct}
        onRemove={handleRemoveProduct}
        onClear={handleClear}
        onSendToPricePilot={() => { setMobileSheetOpen(false); handleSendToPricePilot(); }}
      />
    </>
  );
};

export default ShoppingInputArea;
