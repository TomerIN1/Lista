import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowRight, ArrowLeft, Pencil, Check,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ShoppingProduct, Unit, DeliveryCheckResult } from '../types';
import ProductCatalogArea from './ProductCatalogArea';
import SmartListPanel from '../agents_and_ai/product-discovery-assistant/SmartListPanel';
import { useLiveComparison, ChainTotal } from '../hooks/useLiveComparison';
import LiveBasketPanel from './LiveBasketPanel';
import StoresStripV2 from './StoresStripV2';
import MobileBasketBar from './MobileBasketBar';
import MobileBasketSheet from './MobileBasketSheet';
import BuyPhaseEntry from './BuyPhaseEntry';

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
  /** Called with the chain's display name (e.g. "רמי לוי") when the user
   *  picks a chain in the Buy phase entry screen. Routes to the agent. */
  onStartOnlineAgent: (storeDisplayName: string) => void;
  /** True while an agent run is in progress. List editing is disabled and a
   *  banner is shown to direct the user to close the order to make changes. */
  agentRunning?: boolean;
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
  onStartOnlineAgent,
  agentRunning,
}) => {
  const { t, isRTL, tUnit } = useLanguage();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title || '');
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
  const [buyPhaseOpen, setBuyPhaseOpen] = useState(false);

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
    if (isLoading) return;
    if (!liveCmp.data || liveCmp.data.chains.length === 0) return;
    setBuyPhaseOpen(true);
  };

  const handlePickChain = (chain: ChainTotal) => {
    setBuyPhaseOpen(false);
    onStartOnlineAgent(chain.displayName);
  };

  // Effective chains: use all available chains from the user's area
  const effectiveChains = useMemo(() => {
    if (!deliveryCheck?.chains) return [];
    const isOnline = shoppingMode === 'online';
    return deliveryCheck.chains
      .filter(c => isOnline ? (c.delivers || c.click_and_collect) : true)
      .map(c => c.chain);
  }, [deliveryCheck, shoppingMode]);

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
    setSelectedChainCode(null); // reset chain selection so next basket opens on cheapest
  };

  const handleSmartListConfirm = (newProducts: ShoppingProduct[]) => {
    onProductsChange([...products, ...newProducts]);
    setShowSmartList(false);
  };

  return (
    <>
      <div className="pb-20 lg:pb-4" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* ── Stores strip — per-chain cart totals ─── */}
      <StoresStripV2
        chains={liveCmp.data?.chains ?? []}
        selectedChain={selectedChainCode}
        onSelectChain={setSelectedChainCode}
        loading={liveCmp.loading}
        totalItems={liveCmp.data?.totalItems ?? products.length}
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
        frozen={agentRunning}
      />

      {/* mobile bar + sheet */}
      <MobileBasketBar
        selectedChain={selectedChain}
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
        frozen={agentRunning}
      />

      <BuyPhaseEntry
        open={buyPhaseOpen}
        onClose={() => setBuyPhaseOpen(false)}
        chains={liveCmp.data?.chains ?? []}
        totalItems={liveCmp.data?.totalItems ?? products.length}
        onPickChain={handlePickChain}
      />
    </>
  );
};

export default ShoppingInputArea;
