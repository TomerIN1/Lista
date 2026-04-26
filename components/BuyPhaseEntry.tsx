// components/BuyPhaseEntry.tsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChainTotal, UnmatchedItem, PricedItem } from '../hooks/useLiveComparison';
import { chainBadgeColor, chainAbbrev } from '../utils/chainBranding';
import { LISTA_CATEGORIES, DEFAULT_CATEGORY } from '../agents_and_ai/product-discovery-assistant/listaCategories';

/** A single line in the receipt — either a priced item (matched) or a
 *  missing-name placeholder (unmatched at this chain). The receipt
 *  renderer treats them in one stream so a category section shows both
 *  what's available and what's not in one place. */
type ReceiptLine =
  | { kind: 'priced'; item: PricedItem }
  | { kind: 'missing'; name: string };

interface ReceiptCategoryGroup {
  category: string;
  lines: ReceiptLine[];
  subtotal: number; // sum of priced lines only
}

/** Build receipt-style category groups from the chain's matched + unmatched
 *  items, ordered by canonical LISTA_CATEGORIES so the user reads
 *  produce → dairy → ... in the natural shopping flow. */
function buildReceipt(priced: PricedItem[], missing: UnmatchedItem[]): ReceiptCategoryGroup[] {
  const buckets = new Map<string, { lines: ReceiptLine[]; subtotal: number }>();
  const ensure = (cat: string) => {
    let b = buckets.get(cat);
    if (!b) {
      b = { lines: [], subtotal: 0 };
      buckets.set(cat, b);
    }
    return b;
  };

  for (const ip of priced) {
    const b = ensure(ip.category || DEFAULT_CATEGORY);
    b.lines.push({ kind: 'priced', item: ip });
    b.subtotal += ip.total;
  }
  for (const um of missing) {
    const b = ensure(um.category || DEFAULT_CATEGORY);
    b.lines.push({ kind: 'missing', name: um.name });
  }

  const ordered: ReceiptCategoryGroup[] = [];
  for (const cat of LISTA_CATEGORIES) {
    const b = buckets.get(cat);
    if (b && b.lines.length > 0) {
      ordered.push({ category: cat, lines: b.lines, subtotal: b.subtotal });
      buckets.delete(cat);
    }
  }
  for (const [cat, b] of buckets) {
    ordered.push({ category: cat, lines: b.lines, subtotal: b.subtotal });
  }
  return ordered;
}

interface BuyPhaseEntryProps {
  open: boolean;
  onClose: () => void;
  /** Pre-sorted (cheapest-first) and pre-filtered for deliverable chains
   *  by useLiveComparison. Index 0 is the "Best" chain. */
  chains: ChainTotal[];
  /** Unique items in the cart — used to compute "missing N" per chain. */
  totalItems: number;
  /** Called with the chosen chain when the user taps a card. The caller is
   *  responsible for closing the modal and launching the agent with
   *  chain.displayName as storeName. */
  onPickChain: (chain: ChainTotal) => void;
}

const BuyPhaseEntry: React.FC<BuyPhaseEntryProps> = ({
  open, onClose, chains, totalItems, onPickChain,
}) => {
  const { t, isRTL } = useLanguage();

  // Per-card expand state — one card open at a time.
  // Resets naturally when modal unmounts (component re-mounts on next open).
  const [expandedChain, setExpandedChain] = useState<string | null>(null);
  const isExpanded = (chain: string) => expandedChain === chain;
  const toggleExpanded = (chain: string) =>
    setExpandedChain(prev => (prev === chain ? null : chain));

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

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
        aria-hidden
      />
      {/* Surface — bottom-sheet on mobile, centered modal on desktop */}
      <div
        className="
          absolute inset-x-0 bottom-0 max-h-[88vh] flex flex-col overflow-hidden
          lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2
          lg:w-[440px] lg:max-h-[80vh] lg:rounded-2xl
        "
        style={{
          background: 'var(--paper-surface)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.2)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={t('productBrowse.buyEntryTitle')}
      >
        {/* Header: drag handle (mobile) + title + close */}
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
            className="text-[20px] mt-2"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}
          >
            {t('productBrowse.buyEntryTitle')}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
            {t('productBrowse.buyEntrySubtitle')}
          </div>
        </div>

        {/* Card list */}
        <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-2.5">
          {chains.map((c, i) => {
            const isBest = i === 0;
            const totalToShow = c.totalWithDelivery ?? c.total;
            const whole = Math.floor(totalToShow);
            const decimals = (totalToShow - whole).toFixed(2).slice(1); // ".40"
            const missing = Math.max(0, totalItems - c.matchedItems);
            const hasMissing = c.unmatchedItems.length > 0;
            const hasReceipt = c.itemPrices.length > 0 || hasMissing;
            const receipt = hasReceipt ? buildReceipt(c.itemPrices, c.unmatchedItems) : [];

            return (
              // Outer card: div role="button" to allow inner <button> elements (HTML spec
              // forbids nesting interactive content inside <button>).
              <div
                key={c.chain}
                role="button"
                tabIndex={0}
                onClick={() => onPickChain(c)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPickChain(c);
                  }
                }}
                className="w-full p-3 rounded-xl text-start transition-all cursor-pointer"
                style={{
                  background: 'var(--paper-surface-alt)',
                  border: isBest ? '2px solid var(--save)' : '1px solid var(--line)',
                }}
              >
                {/* Main row: badge + meta + price + chevron */}
                <div className="flex items-center gap-3">
                  {/* Brand badge */}
                  <div
                    className="w-[42px] h-[42px] rounded-[9px] flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0"
                    style={{ background: chainBadgeColor(c.chain) }}
                  >
                    {chainAbbrev(c.chain)}
                  </div>

                  {/* Chain meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="text-sm font-bold truncate"
                        style={{ color: 'var(--ink)' }}
                      >
                        {c.displayName}
                      </span>
                      {isBest && (
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0"
                          style={{ background: 'var(--save)', color: '#fff' }}
                        >
                          {t('productBrowse.buyEntryBestBadge')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center flex-wrap gap-2 text-[10px]" style={{ color: 'var(--ink-muted)' }}>
                      <span>
                        {c.matchedItems}/{totalItems}
                      </span>
                      {c.deliveryFee != null && c.deliveryFee > 0 && (
                        <span>
                          🚚 {t('productBrowse.buyEntryDeliveryFee')} ₪{c.deliveryFee}
                        </span>
                      )}
                      {missing > 0 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleExpanded(c.chain); }}
                          aria-expanded={isExpanded(c.chain)}
                          aria-label={`${t('productBrowse.buyEntryItemsMissing').replace('{n}', String(missing))} — ${t('productBrowse.buyEntryMissingHeading')}`}
                          className="px-1.5 py-0.5 rounded-full font-bold"
                          style={{
                            background: 'rgba(215,53,45,0.12)',
                            color: 'var(--accent)',
                            textDecoration: 'underline',
                            textUnderlineOffset: 2,
                          }}
                        >
                          {t('productBrowse.buyEntryItemsMissing').replace('{n}', String(missing))}
                        </button>
                      )}
                      {c.belowMinimum && (
                        <span
                          className="px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background: 'rgba(245,158,11,0.12)', color: '#B45309' }}
                        >
                          {t('productBrowse.buyEntryBelowMin')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Total price */}
                  <div
                    className="text-end leading-none flex-shrink-0"
                    style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}
                  >
                    <span style={{ fontSize: 22 }}>{whole}</span>
                    <span className="text-xs align-top" style={{ color: 'var(--ink-muted)' }}>
                      {decimals} ₪
                    </span>
                  </div>

                  {/* Chevron — opens the receipt view */}
                  {hasReceipt && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleExpanded(c.chain); }}
                      aria-expanded={isExpanded(c.chain)}
                      aria-label={t('productBrowse.buyEntryReceiptHeading')}
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      <ChevronDown
                        className="w-4 h-4"
                        style={{
                          transform: isExpanded(c.chain) ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                        }}
                      />
                    </button>
                  )}
                </div>

                {/* Expanded receipt — items grouped by category, per-category subtotal,
                    delivery + grand total at the bottom. Read-only; tapping anywhere
                    inside still bubbles up to the card body and picks the chain. */}
                {isExpanded(c.chain) && hasReceipt && (
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '1px dashed var(--line)',
                      fontSize: 11,
                      color: 'var(--ink)',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--ink-muted)' }}>
                      {t('productBrowse.buyEntryReceiptHeading')}
                    </div>
                    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                      {receipt.map(group => (
                        <div key={group.category} style={{ marginBottom: 10 }}>
                          {/* Category heading */}
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 11,
                              color: 'var(--ink)',
                              borderBottom: '1px solid var(--line)',
                              paddingBottom: 2,
                              marginBottom: 4,
                            }}
                          >
                            {group.category}
                          </div>

                          {/* Lines */}
                          {group.lines.map((line, idx) => {
                            if (line.kind === 'missing') {
                              return (
                                <div
                                  key={`m-${idx}-${line.name}`}
                                  className="flex items-baseline gap-2"
                                  style={{
                                    color: 'var(--ink-muted)',
                                    opacity: 0.7,
                                    marginBottom: 2,
                                  }}
                                >
                                  <span style={{ flex: 1, textDecoration: 'line-through' }}>
                                    {line.name}
                                  </span>
                                  <span style={{ fontStyle: 'italic', fontSize: 10 }}>
                                    {t('productBrowse.buyEntryUnavailable')}
                                  </span>
                                </div>
                              );
                            }
                            const ip = line.item;
                            const unitPrice = ip.displayPrice ?? ip.price;
                            const origUnitPrice = ip.displayOriginalPrice ?? ip.originalPrice;
                            const hasPromo = origUnitPrice != null && origUnitPrice > unitPrice;
                            const unitLabel = ip.displayUnit ? ` / ${ip.displayUnit}` : '';
                            const qtySuffix = ip.amount > 1 ? ` × ${ip.amount}` : '';
                            return (
                              <div key={`p-${idx}-${ip.itemName}`} style={{ marginBottom: 3 }}>
                                <div className="flex items-baseline gap-2">
                                  <span style={{ flex: 1, color: 'var(--ink)' }}>
                                    {ip.itemName}
                                  </span>
                                  <span
                                    className="flex items-baseline gap-1"
                                    style={{ fontSize: 10, color: 'var(--ink-muted)' }}
                                  >
                                    {hasPromo && (
                                      <span style={{ textDecoration: 'line-through' }}>
                                        ₪{origUnitPrice.toFixed(2)}
                                      </span>
                                    )}
                                    <span style={{ color: hasPromo ? 'var(--accent)' : 'var(--ink-muted)', fontWeight: hasPromo ? 700 : 400 }}>
                                      ₪{unitPrice.toFixed(2)}{unitLabel}{qtySuffix}
                                    </span>
                                  </span>
                                  <span style={{ fontWeight: 600, color: 'var(--ink)', minWidth: 50, textAlign: 'end' }}>
                                    ₪{ip.total.toFixed(2)}
                                  </span>
                                </div>
                                {ip.promotion?.description && (
                                  <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 1 }}>
                                    🏷 {ip.promotion.description}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Category subtotal */}
                          {group.subtotal > 0 && (
                            <div
                              className="flex items-baseline justify-between"
                              style={{
                                fontSize: 10,
                                color: 'var(--ink-muted)',
                                marginTop: 2,
                                fontWeight: 600,
                              }}
                            >
                              <span>{t('productBrowse.buyEntrySubtotal')}</span>
                              <span>₪{group.subtotal.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Footer: delivery + grand total */}
                    <div
                      style={{
                        marginTop: 6,
                        paddingTop: 6,
                        borderTop: '1px solid var(--line)',
                      }}
                    >
                      {c.deliveryFee != null && c.deliveryFee > 0 && (
                        <div className="flex items-baseline justify-between" style={{ marginBottom: 2 }}>
                          <span style={{ color: 'var(--ink-muted)' }}>
                            🚚 {t('productBrowse.buyEntryDeliveryFee')}
                          </span>
                          <span>₪{c.deliveryFee.toFixed(2)}</span>
                        </div>
                      )}
                      <div
                        className="flex items-baseline justify-between"
                        style={{ fontWeight: 700, fontSize: 12, color: 'var(--ink)' }}
                      >
                        <span>{t('productBrowse.buyEntryGrandTotal')}</span>
                        <span>₪{(c.totalWithDelivery ?? c.total).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BuyPhaseEntry;
