// components/SubstitutionSheet.tsx
//
// Single-item, single-chain substitution picker. Opened from a missing-item
// line on a BuyPhaseEntry chain card. Calls processSmartChat() with a
// chain-scoped filter so results come ONLY from the target chain's catalog,
// then lets the user pick a recommended product or one of a few alternatives
// to "swap into" their list before the PricePilot agent runs.
//
// This is intentionally a slim, dedicated UX — NOT the full SmartListPanel /
// SmartResultsList chat surface. We render product cards inline and emit a
// single accept/skip event per substitution.

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Minus, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { DbProduct, SmartItemGroup } from '../types';
import { processSmartChat } from '../agents_and_ai/product-discovery-assistant/smartListService';
import { getQuantityStep, roundQuantity, formatDisplayPrice } from '../utils/priceFormat';

const IMAGE_FALLBACK =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="%23f1f5f9" width="40" height="40" rx="8"/><text x="20" y="24" text-anchor="middle" font-size="16">📦</text></svg>';

interface SubstitutionSheetProps {
  open: boolean;
  onClose: () => void;
  /** Canonical chain code (e.g. "rami-levy") used to filter the search. */
  chainCode: string;
  /** Human-readable chain name shown in copy ("רמי לוי"). */
  chainDisplayName: string;
  /** The missing item's display name (the user's typed name from the basket). */
  itemName: string;
  city?: string;
  storeType?: string;
  /** User picked a substitute. Replacement + chosen quantity. */
  onAccept: (replacement: DbProduct, quantity: number) => void;
}

/**
 * Slot one product card. Selecting a card stages it as the candidate
 * replacement; pressing Replace commits via onAccept.
 */
interface ProductRowProps {
  product: DbProduct;
  selected: boolean;
  isHe: boolean;
  onSelect: () => void;
}

const ProductRow: React.FC<ProductRowProps> = ({ product, selected, isHe, onSelect }) => {
  const priceLabel = product.display_min_price != null
    ? formatDisplayPrice(product.display_min_price, product.display_unit ?? null)
    : `₪${(product.min_price ?? 0).toFixed(2)}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-start p-2.5 rounded-lg flex items-center gap-2.5 transition-all"
      style={{
        background: selected ? 'rgba(55,166,67,0.08)' : 'var(--paper-surface-alt)',
        border: selected ? '1.5px solid var(--save)' : '1px solid var(--line)',
      }}
    >
      <img
        src={product.image_url || IMAGE_FALLBACK}
        alt=""
        className="w-10 h-10 rounded-md flex-shrink-0 object-cover"
        style={{ background: '#f1f5f9' }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = IMAGE_FALLBACK; }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="text-[13px] font-semibold truncate"
          style={{ color: 'var(--ink)' }}
        >
          {product.name}
        </div>
        {product.manufacturer && (
          <div className="text-[10px] truncate" style={{ color: 'var(--ink-muted)' }}>
            {product.manufacturer}
          </div>
        )}
      </div>
      <div className="text-end flex-shrink-0">
        <div
          className="text-[13px] font-bold"
          style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}
        >
          {priceLabel}
        </div>
      </div>
    </button>
  );
};

const SubstitutionSheet: React.FC<SubstitutionSheetProps> = ({
  open, onClose, chainCode, chainDisplayName, itemName, city, storeType, onAccept,
}) => {
  const { t, language, isRTL } = useLanguage();
  const isHe = language === 'he';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemGroup, setItemGroup] = useState<SmartItemGroup | null>(null);
  const [selectedBarcode, setSelectedBarcode] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Lock body scroll + Esc-to-close while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // Fetch alternatives whenever the sheet opens for a new (chain,item) pair.
  useEffect(() => {
    if (!open || !itemName) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItemGroup(null);
    setSelectedBarcode(null);
    setQuantity(1);

    (async () => {
      try {
        const result = await processSmartChat(
          itemName,
          language,
          [],
          city,
          storeType,
          [chainCode],
        );
        if (cancelled) return;
        const group = result.itemGroups[0] ?? null;
        setItemGroup(group);
        if (group?.recommended) {
          setSelectedBarcode(group.recommended.barcode);
          // Default qty to 1 (kg or pcs depending on weighted flag).
          setQuantity(1);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, itemName, chainCode, city, storeType, language]);

  // Build the visible product list: recommended + up to 3 alternatives.
  const products: DbProduct[] = useMemo(() => {
    if (!itemGroup) return [];
    const list: DbProduct[] = [];
    if (itemGroup.recommended) list.push(itemGroup.recommended);
    for (const alt of itemGroup.alternatives.slice(0, 3)) {
      if (!list.find(p => p.barcode === alt.barcode)) list.push(alt);
    }
    return list;
  }, [itemGroup]);

  const selectedProduct = useMemo(
    () => products.find(p => p.barcode === selectedBarcode) ?? null,
    [products, selectedBarcode],
  );

  // Quantity step: weighted defaults to its category step; packaged is 1.
  const qtyStep = useMemo(() => {
    if (!selectedProduct) return 1;
    return getQuantityStep(selectedProduct);
  }, [selectedProduct]);

  const decQty = () => {
    setQuantity(q => Math.max(qtyStep, roundQuantity(q - qtyStep, qtyStep)));
  };
  const incQty = () => {
    setQuantity(q => roundQuantity(q + qtyStep, qtyStep));
  };

  const handleReplace = () => {
    if (!selectedProduct) return;
    onAccept(selectedProduct, quantity);
    onClose();
  };

  if (!open) return null;

  const titleText = t('productBrowse.buyEntrySubSheetTitle').replace('{name}', itemName);
  const subtitleText = t('productBrowse.buyEntrySubSheetSubtitle').replace('{chain}', chainDisplayName);
  const searchingText = t('productBrowse.buyEntrySubSheetSearching').replace('{chain}', chainDisplayName);
  const noMatchText = t('productBrowse.buyEntrySubSheetNoMatch').replace('{chain}', chainDisplayName);

  const showNoMatch = !loading && !error && products.length === 0;
  const showWeightedStepper = selectedProduct?.is_weighted === true;

  return createPortal(
    <div
      className="fixed inset-0 z-[60]"
      style={{ direction: isRTL ? 'rtl' : 'ltr' }}
      role="dialog"
      aria-modal="true"
      aria-label={titleText}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
        aria-hidden
      />
      {/* Surface — bottom sheet on mobile, centered modal on desktop */}
      <div
        className="
          absolute inset-x-0 bottom-0 max-h-[85vh] flex flex-col overflow-hidden
          lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2
          lg:w-[420px] lg:max-h-[80vh] lg:rounded-2xl
        "
        style={{
          background: 'var(--paper-surface)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div className="relative pt-2 pb-3 px-4">
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden w-full py-1 flex justify-center"
            aria-hidden="true"
            tabIndex={-1}
          >
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--paper-surface-alt)' }} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('result.close')}
            className="absolute top-2 end-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--paper-surface-alt)', color: 'var(--ink)' }}
          >
            <X className="w-4 h-4" />
          </button>
          <div
            className="text-[18px] mt-2 pe-10"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}
          >
            {titleText}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
            {subtitleText}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {loading && (
            <div
              className="flex flex-col items-center justify-center py-10 gap-2"
              style={{ color: 'var(--ink-muted)' }}
            >
              <Loader2 className="w-6 h-6 animate-spin" />
              <div className="text-xs text-center">{searchingText}</div>
            </div>
          )}

          {error && !loading && (
            <div
              className="text-center text-xs py-8"
              style={{ color: 'var(--accent)' }}
            >
              {error}
            </div>
          )}

          {showNoMatch && (
            <div
              className="text-center text-sm py-8"
              style={{ color: 'var(--ink-muted)' }}
            >
              {noMatchText}
            </div>
          )}

          {!loading && !error && products.length > 0 && (
            <div className="flex flex-col gap-2">
              {products.map((p, i) => (
                <React.Fragment key={p.barcode}>
                  {i === 1 && (
                    <div
                      className="text-[10px] font-semibold mt-1.5 mb-0.5"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      {t('productBrowse.buyEntrySubAlternativesHeading')}
                    </div>
                  )}
                  <ProductRow
                    product={p}
                    selected={p.barcode === selectedBarcode}
                    isHe={isHe}
                    onSelect={() => setSelectedBarcode(p.barcode)}
                  />
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Footer: quantity stepper (weighted only) + actions */}
        <div
          className="px-4 pt-3 pb-4 flex items-center gap-2"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          {showWeightedStepper && (
            <div
              className="flex items-center gap-2 px-2 py-1 rounded-lg"
              style={{ background: 'var(--paper-surface-alt)' }}
            >
              <button
                type="button"
                onClick={decQty}
                aria-label="−"
                className="w-7 h-7 flex items-center justify-center rounded-md"
                style={{ color: 'var(--ink)' }}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div
                className="text-sm font-semibold min-w-[40px] text-center"
                style={{ color: 'var(--ink)' }}
              >
                {quantity} {selectedProduct?.is_weighted ? 'kg' : ''}
              </div>
              <button
                type="button"
                onClick={incQty}
                aria-label="+"
                className="w-7 h-7 flex items-center justify-center rounded-md"
                style={{ color: 'var(--ink)' }}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-lg"
            style={{
              color: 'var(--ink)',
              background: 'var(--paper-surface-alt)',
            }}
          >
            {t('productBrowse.buyEntrySubSkip')}
          </button>
          <button
            type="button"
            onClick={handleReplace}
            disabled={!selectedProduct}
            className="flex-1 px-3 py-2 text-sm font-bold rounded-lg disabled:opacity-50"
            style={{
              background: 'var(--save)',
              color: '#fff',
            }}
          >
            {t('productBrowse.buyEntrySubReplace')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SubstitutionSheet;
