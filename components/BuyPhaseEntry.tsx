// components/BuyPhaseEntry.tsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChainTotal, UnmatchedItem } from '../hooks/useLiveComparison';
import { chainBadgeColor, chainAbbrev } from '../utils/chainBranding';
import { LISTA_CATEGORIES, DEFAULT_CATEGORY } from '../agents_and_ai/product-discovery-assistant/listaCategories';

/** Group missing items by their Lista category and emit them in
 *  LISTA_CATEGORIES order so the user sees produce → dairy → ... in
 *  the natural shopping flow. Unknown categories fall through into
 *  DEFAULT_CATEGORY ("אחר ולא מסווג") at the end. */
function groupByCategory(items: UnmatchedItem[]): Array<{ category: string; names: string[] }> {
  const buckets = new Map<string, string[]>();
  for (const it of items) {
    const cat = it.category || DEFAULT_CATEGORY;
    const arr = buckets.get(cat) ?? [];
    arr.push(it.name);
    buckets.set(cat, arr);
  }
  const ordered: Array<{ category: string; names: string[] }> = [];
  for (const cat of LISTA_CATEGORIES) {
    const names = buckets.get(cat);
    if (names && names.length > 0) {
      ordered.push({ category: cat, names });
      buckets.delete(cat);
    }
  }
  // Anything not in the canonical taxonomy goes at the end.
  for (const [cat, names] of buckets) {
    ordered.push({ category: cat, names });
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
                          className="px-1.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1"
                          style={{
                            background: 'rgba(215,53,45,0.12)',
                            color: 'var(--accent)',
                            textDecoration: 'underline',
                            textUnderlineOffset: 2,
                          }}
                        >
                          {t('productBrowse.buyEntryItemsMissing').replace('{n}', String(missing))}
                          <ChevronDown
                            className="w-3 h-3"
                            style={{
                              transform: isExpanded(c.chain) ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s',
                            }}
                          />
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

                  {/* Chevron — only when hasMissing */}
                  {hasMissing && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleExpanded(c.chain); }}
                      aria-expanded={isExpanded(c.chain)}
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

                {/* Expanded section — missing items list */}
                {isExpanded(c.chain) && hasMissing && (
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: '1px dashed var(--line)',
                      fontSize: 11,
                      color: 'var(--ink-muted)',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>
                      {t('productBrowse.buyEntryMissingHeading')}
                    </div>
                    <div
                      style={{
                        maxHeight: 240,
                        overflowY: 'auto',
                      }}
                    >
                      {groupByCategory(c.unmatchedItems).map(group => (
                        <div key={group.category} style={{ marginBottom: 8 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: 'var(--ink)',
                              marginBottom: 2,
                            }}
                          >
                            {group.category}
                          </div>
                          <ul
                            style={{
                              listStyleType: 'disc',
                              paddingInlineStart: 18,
                              margin: 0,
                            }}
                          >
                            {group.names.map((name, idx) => (
                              <li
                                key={`${group.category}-${name}-${idx}`}
                                style={{ marginBottom: 2, lineHeight: 1.5 }}
                              >
                                {name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
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
