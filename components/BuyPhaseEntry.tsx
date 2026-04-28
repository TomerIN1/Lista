// components/BuyPhaseEntry.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, Loader2, ShoppingCart } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChainTotal, UnmatchedItem, PricedItem } from '../hooks/useLiveComparison';
import { chainBadgeColor, chainAbbrev } from '../utils/chainBranding';
import { LISTA_CATEGORIES, DEFAULT_CATEGORY } from '../agents_and_ai/product-discovery-assistant/listaCategories';
import { processSmartChat } from '../agents_and_ai/product-discovery-assistant/smartListService';
import { DbProduct, DbProductEnhanced, ShoppingProduct } from '../types';
import ProductDetailModal from './ProductDetailModal';
import GroupDetailModal from './GroupDetailModal';

/** Per-chain substitution: user picked a replacement DB product for a
 *  missing item name. Stored locally in ShoppingInputArea, applied at
 *  chain-pick time and surfaced visually here as synthetic priced lines. */
export interface ChainSubstitution {
  originalName: string;
  replacement: DbProduct;
  quantity: number;
}

/** A single line in the receipt — a real priced item, a missing-name
 *  placeholder, or a synthetic substitution line (a user-picked replacement
 *  for a missing item). The receipt renderer treats them in one stream so
 *  a category section shows both what's available and what's not in one
 *  place. */
type ReceiptLine =
  | { kind: 'priced'; item: PricedItem }
  | { kind: 'missing'; name: string }
  | { kind: 'sub'; originalName: string; replacement: DbProduct; quantity: number };

interface ReceiptCategoryGroup {
  category: string;
  lines: ReceiptLine[];
  subtotal: number; // sum of priced lines only
}

/** Build receipt-style category groups from the chain's matched + unmatched
 *  items, ordered by canonical LISTA_CATEGORIES so the user reads
 *  produce → dairy → ... in the natural shopping flow.
 *
 *  Substitutions are merged in: for each `subs` entry, the matching
 *  unmatched item is dropped from the missing-list and a synthetic priced
 *  "sub" line is appended in the original missing item's category bucket. */
function buildReceipt(
  priced: PricedItem[],
  missing: UnmatchedItem[],
  subs: ChainSubstitution[],
): ReceiptCategoryGroup[] {
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

  // Substitutions index by originalName so we can look up a missing item's
  // category and drop the missing line in favour of the replacement.
  const subByName = new Map<string, ChainSubstitution>();
  for (const s of subs) subByName.set(s.originalName, s);

  for (const um of missing) {
    const sub = subByName.get(um.name);
    if (sub) {
      const b = ensure(um.category || DEFAULT_CATEGORY);
      const lineTotal = (sub.replacement.min_price ?? 0) * sub.quantity;
      b.lines.push({
        kind: 'sub',
        originalName: sub.originalName,
        replacement: sub.replacement,
        quantity: sub.quantity,
      });
      b.subtotal += lineTotal;
      subByName.delete(um.name); // consumed
    } else {
      const b = ensure(um.category || DEFAULT_CATEGORY);
      b.lines.push({ kind: 'missing', name: um.name });
    }
  }

  // Stragglers: substitutions whose originalName didn't appear in the
  // missing list (shouldn't normally happen — defensive). Bucket under
  // DEFAULT_CATEGORY so they still surface to the user.
  for (const sub of subByName.values()) {
    const b = ensure(DEFAULT_CATEGORY);
    const lineTotal = (sub.replacement.min_price ?? 0) * sub.quantity;
    b.lines.push({
      kind: 'sub',
      originalName: sub.originalName,
      replacement: sub.replacement,
      quantity: sub.quantity,
    });
    b.subtotal += lineTotal;
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
  /** Per-chain substitutions chosen by the user, keyed by canonical chain
   *  code. Powers the synthetic priced lines and the augmented chain
   *  totals/missing counts. */
  chainSubs?: Record<string, ChainSubstitution[]>;
  /** User tapped a missing-item line — open the substitution sheet. The
   *  third arg carries the missing item's Lista-taxonomy category so the
   *  substitution search can lock results to that category. */
  onRequestSubstitution?: (
    chain: ChainTotal,
    missingItemName: string,
    category: string | undefined,
  ) => void;
  /** User tapped the small ✕ on a substituted line to revert the swap. */
  onUndoSubstitution?: (chain: ChainTotal, originalName: string) => void;
  /** User tapped "Replace all missing items" — auto-pick a recommended
   *  replacement at this chain for every still-missing item, in one batch. */
  onBulkSubstitution?: (chain: ChainTotal, subs: ChainSubstitution[]) => void;
  /** Forwarded to processSmartChat for chain-scoped bulk substitution search. */
  city?: string;
  /** Forwarded to processSmartChat for chain-scoped bulk substitution search. */
  storeType?: string;
  /** Source basket products. Used to look up the underlying DbProduct for a
   *  priced receipt line (so tapping a line opens the ProductDetailModal). */
  shoppingProducts?: ShoppingProduct[];
}

const BuyPhaseEntry: React.FC<BuyPhaseEntryProps> = ({
  open, onClose, chains, totalItems, onPickChain,
  chainSubs, onRequestSubstitution, onUndoSubstitution,
  onBulkSubstitution, city, storeType, shoppingProducts,
}) => {
  const { t, isRTL, language } = useLanguage();

  // Lookup table from the basket: itemName → ShoppingProduct. Built once per
  // mount of the modal (the basket rarely changes while the sheet is open).
  // `ItemPriceDetail.itemName` mirrors `ShoppingProduct.name` directly — no
  // normalization needed.
  const productByName = useMemo(() => {
    const m = new Map<string, ShoppingProduct>();
    for (const p of shoppingProducts ?? []) {
      if (p.name) m.set(p.name, p);
    }
    return m;
  }, [shoppingProducts]);

  // Detail modal target for the per-line product inspector. Holds the full
  // DbProduct so we can route to GroupDetailModal vs ProductDetailModal using
  // the same logic as ProductCatalogArea (weighted + product_group_id).
  const [detailProduct, setDetailProduct] = useState<DbProduct | null>(null);

  // Per-card expand state — one card open at a time.
  // Resets naturally when modal unmounts (component re-mounts on next open).
  const [expandedChain, setExpandedChain] = useState<string | null>(null);
  const isExpanded = (chain: string) => expandedChain === chain;
  const toggleExpanded = (chain: string) =>
    setExpandedChain(prev => (prev === chain ? null : chain));

  // While a bulk substitution batch is running for a chain, keep the chain
  // code here so we can show a spinner and disable the button.
  const [bulkRunningChain, setBulkRunningChain] = useState<string | null>(null);

  // Augmented chain order: re-sort by (deliverable) total + user-chosen
  // substitution cost so the cheapest-first order — and the green
  // "מומלץ" badge at i === 0 — both reflect the post-substitution reality.
  // We never mutate the original `chains` prop.
  const augmentedChains = useMemo(() => {
    return chains
      .map(c => {
        const subsForChain = chainSubs?.[c.chain] ?? [];
        const subsTotal = subsForChain.reduce(
          (sum, s) => sum + (s.replacement.min_price ?? 0) * s.quantity,
          0,
        );
        const effective = (c.totalWithDelivery ?? c.total) + subsTotal;
        return { chain: c, effective };
      })
      .sort((a, b) => a.effective - b.effective);
  }, [chains, chainSubs]);

  const handleBulkReplace = async (chain: ChainTotal, items: UnmatchedItem[]) => {
    if (items.length === 0) return;
    setBulkRunningChain(chain.chain);
    try {
      const results = await Promise.all(
        items.map(async (item) => {
          try {
            const r = await processSmartChat(
              item.name,
              language,
              [],
              city,
              storeType,
              [chain.chain],
              // Forced category — same fix as the per-item sheet path. Without
              // this the AI can re-tag (e.g. "אגוזי מלך" → snacks) and pull a
              // wrong-category replacement past the alignment filter.
              item.category,
            );
            const group = r.itemGroups[0];
            if (group?.status === 'matched' && group.recommended) {
              return {
                originalName: item.name,
                replacement: group.recommended,
                quantity: 1,
              } as ChainSubstitution;
            }
          } catch {
            // swallow — item simply stays missing
          }
          return null;
        }),
      );
      const picked = results.filter((s): s is ChainSubstitution => s !== null);
      if (picked.length > 0) {
        onBulkSubstitution?.(chain, picked);
      }
    } finally {
      setBulkRunningChain(null);
    }
  };

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
          {augmentedChains.map(({ chain: c }, i) => {
            const isBest = i === 0;
            const subsForChain = chainSubs?.[c.chain] ?? [];
            const subsByName = new Map(subsForChain.map(s => [s.originalName, s]));
            // Augment chain totals/counts to reflect user-chosen substitutions:
            // a substituted item moves out of "missing" and into the priced
            // total, so the chain card immediately shows the new state without
            // waiting for a refetch.
            const subsTotal = subsForChain.reduce(
              (sum, s) => sum + (s.replacement.min_price ?? 0) * s.quantity,
              0,
            );
            const effectiveMatched = c.matchedItems + subsForChain.length;
            const baseTotal = c.total + subsTotal;
            const baseTotalWithDelivery = c.totalWithDelivery != null
              ? c.totalWithDelivery + subsTotal
              : undefined;
            const totalToShow = baseTotalWithDelivery ?? baseTotal;
            const whole = Math.floor(totalToShow);
            const decimals = (totalToShow - whole).toFixed(2).slice(1); // ".40"
            const missing = Math.max(0, totalItems - effectiveMatched);
            const remainingMissing = c.unmatchedItems.filter(um => !subsByName.has(um.name));
            const hasMissing = remainingMissing.length > 0;
            const hasReceipt = c.itemPrices.length > 0 || hasMissing || subsForChain.length > 0;
            const receipt = hasReceipt
              ? buildReceipt(c.itemPrices, c.unmatchedItems, subsForChain)
              : [];
            // Recompute belowMinimum locally — the prop is stale once subs are
            // applied. The minimum is checked against the subtotal (no delivery),
            // so use baseTotal, NOT totalToShow.
            const effectiveBelowMinimum =
              c.minimumOrder != null && c.minimumOrder > 0 && baseTotal < c.minimumOrder;
            const isBulkRunning = bulkRunningChain === c.chain;

            return (
              // Outer card. Card body is NO LONGER a click target for picking
              // the chain — that action moved to an explicit
              // "Shop with PricePilot" button below the meta row. The card
              // body / chevron only expand-collapse the receipt.
              <div
                key={c.chain}
                className="w-full p-3 rounded-xl text-start transition-all"
                style={{
                  background: 'var(--paper-surface-alt)',
                  border: isBest ? '2px solid var(--save)' : '1px solid var(--line)',
                }}
              >
                {/* Main row: badge + meta + price + chevron. Tapping anywhere
                    in the main row toggles expand. Inner interactive elements
                    (missing-count pill, chevron) keep their own handlers and
                    use stopPropagation to avoid double-toggling. */}
                <div
                  className={hasReceipt ? 'flex items-center gap-3 cursor-pointer' : 'flex items-center gap-3'}
                  onClick={hasReceipt ? () => toggleExpanded(c.chain) : undefined}
                  role={hasReceipt ? 'button' : undefined}
                  tabIndex={hasReceipt ? 0 : undefined}
                  onKeyDown={hasReceipt ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpanded(c.chain);
                    }
                  } : undefined}
                  aria-expanded={hasReceipt ? isExpanded(c.chain) : undefined}
                >
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
                        {effectiveMatched}/{totalItems}
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
                      {effectiveBelowMinimum && (
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

                {/* Explicit "Shop with PricePilot" CTA. Replaces the previous
                    invisible card-body click target. Always full-width below
                    the meta row so the action is unambiguous on both mobile
                    and desktop. Stays enabled below-min (the warning pill
                    above already flags it). */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onPickChain(c); }}
                  className="w-full mt-3 px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                  style={{
                    background: 'var(--save)',
                    color: '#fff',
                  }}
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>{t('productBrowse.buyEntryShopWithPricepilot')}</span>
                </button>

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

                    {/* Bulk "replace all missing" — visible only while there
                        are still unsubstituted missing items at this chain.
                        While running, swap to a disabled spinner state. */}
                    {remainingMissing.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Re-filter against the freshest subsByName at click
                          // time to dodge any race between rapid taps. Carry
                          // each item's category so the bulk search uses the
                          // basket-side category as the substitution filter.
                          const freshItems = c.unmatchedItems.filter(
                            um => !subsByName.has(um.name),
                          );
                          handleBulkReplace(c, freshItems);
                        }}
                        disabled={isBulkRunning}
                        className="w-full mb-3 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-70"
                        style={{
                          background: 'transparent',
                          color: 'var(--save)',
                          border: '1.5px solid var(--save)',
                        }}
                      >
                        {isBulkRunning ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>
                              {t('productBrowse.buyEntryReplaceAllRunning')
                                .replace('{n}', String(remainingMissing.length))}
                            </span>
                          </>
                        ) : (
                          <span>
                            {t('productBrowse.buyEntryReplaceAll')
                              .replace('{n}', String(remainingMissing.length))}
                          </span>
                        )}
                      </button>
                    )}

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
                              const um = c.unmatchedItems.find(u => u.name === line.name);
                              return (
                                <button
                                  key={`m-${idx}-${line.name}`}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRequestSubstitution?.(c, line.name, um?.category);
                                  }}
                                  className="w-full flex items-baseline gap-2 text-start"
                                  style={{
                                    color: 'var(--ink-muted)',
                                    marginBottom: 2,
                                    background: 'transparent',
                                    padding: 0,
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                  aria-label={`${line.name} — ${t('productBrowse.buyEntryFindAlternative')}`}
                                >
                                  <span
                                    style={{
                                      flex: 1,
                                      textDecoration: 'line-through',
                                      opacity: 0.7,
                                    }}
                                  >
                                    {line.name}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      color: 'var(--accent)',
                                      background: 'rgba(215,53,45,0.10)',
                                      padding: '1px 6px',
                                      borderRadius: 999,
                                    }}
                                  >
                                    {t('productBrowse.buyEntryFindAlternative')}
                                  </span>
                                </button>
                              );
                            }
                            if (line.kind === 'sub') {
                              const repl = line.replacement;
                              const unitPrice = repl.min_price ?? 0;
                              const lineTotal = unitPrice * line.quantity;
                              const qtySuffix = line.quantity !== 1
                                ? ` × ${line.quantity}${repl.is_weighted ? 'kg' : ''}`
                                : '';
                              // Outer click on the sub line opens the
                              // ProductDetailModal for the replacement so the
                              // user can inspect image / cross-store prices.
                              // The inline "Change" pill (separate <button>)
                              // re-opens the substitution sheet, and the ✕
                              // undoes the swap. Both stop propagation.
                              const um = c.unmatchedItems.find(u => u.name === line.originalName);
                              return (
                                <div
                                  key={`s-${idx}-${repl.barcode}`}
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDetailProduct(repl);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setDetailProduct(repl);
                                    }
                                  }}
                                  style={{ marginBottom: 3, cursor: 'pointer' }}
                                  aria-label={repl.name}
                                >
                                  <div className="flex items-baseline gap-2">
                                    <span style={{ flex: 1, color: 'var(--ink)' }}>
                                      <span
                                        style={{
                                          fontSize: 9,
                                          fontWeight: 700,
                                          color: 'var(--save)',
                                          background: 'rgba(55,166,67,0.12)',
                                          padding: '1px 5px',
                                          borderRadius: 999,
                                          marginInlineEnd: 4,
                                        }}
                                      >
                                        {t('productBrowse.buyEntrySubAlternativeBadge')}
                                      </span>
                                      {repl.name}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onRequestSubstitution?.(c, line.originalName, um?.category);
                                        }}
                                        style={{
                                          fontSize: 9,
                                          fontWeight: 600,
                                          color: 'var(--ink-muted)',
                                          marginInlineStart: 6,
                                          textDecoration: 'underline',
                                          textUnderlineOffset: 2,
                                          background: 'transparent',
                                          border: 'none',
                                          padding: 0,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        {t('productBrowse.buyEntrySubChange')}
                                      </button>
                                    </span>
                                    <span
                                      className="flex items-baseline gap-1"
                                      style={{ fontSize: 10, color: 'var(--ink-muted)' }}
                                    >
                                      <span>
                                        ₪{unitPrice.toFixed(2)}{qtySuffix}
                                      </span>
                                    </span>
                                    <span style={{ fontWeight: 600, color: 'var(--ink)', minWidth: 50, textAlign: 'end' }}>
                                      ₪{lineTotal.toFixed(2)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onUndoSubstitution?.(c, line.originalName);
                                      }}
                                      aria-label={t('productBrowse.buyEntrySubUndo')}
                                      style={{
                                        marginInlineStart: 2,
                                        width: 16,
                                        height: 16,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: 999,
                                        color: 'var(--ink-muted)',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 9,
                                      color: 'var(--ink-muted)',
                                      marginTop: 1,
                                      textDecoration: 'line-through',
                                      opacity: 0.7,
                                    }}
                                  >
                                    {line.originalName}
                                  </div>
                                </div>
                              );
                            }
                            const ip = line.item;
                            const unitPrice = ip.displayPrice ?? ip.price;
                            const origUnitPrice = ip.displayOriginalPrice ?? ip.originalPrice;
                            const hasPromo = origUnitPrice != null && origUnitPrice > unitPrice;
                            const unitLabel = ip.displayUnit ? ` / ${ip.displayUnit}` : '';
                            const qtySuffix = ip.amount > 1 ? ` × ${ip.amount}` : '';
                            // Look up the underlying basket product by name —
                            // the compare API echoes itemName verbatim from
                            // the basket. If it's there, the priced line
                            // becomes tappable to open the ProductDetailModal.
                            const sourceProduct = productByName.get(ip.itemName) ?? null;
                            const isTappable = sourceProduct != null;
                            return (
                              <div
                                key={`p-${idx}-${ip.itemName}`}
                                role={isTappable ? 'button' : undefined}
                                tabIndex={isTappable ? 0 : undefined}
                                onClick={isTappable ? (e) => {
                                  e.stopPropagation();
                                  setDetailProduct(sourceProduct!);
                                } : undefined}
                                onKeyDown={isTappable ? (e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDetailProduct(sourceProduct!);
                                  }
                                } : undefined}
                                style={{ marginBottom: 3, cursor: isTappable ? 'pointer' : 'default' }}
                                aria-label={isTappable ? ip.itemName : undefined}
                              >
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
                        <span>₪{totalToShow.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-line product inspector — opened from a priced or substituted
          receipt line. Mirrors the routing in ProductCatalogArea: weighted
          fresh-produce items with a product_group_id go to GroupDetailModal,
          everything else to ProductDetailModal. The Add CTA is intentionally
          a no-op here — the user is mid-buy and already has these items in
          the basket; we only want the inspector view. */}
      {detailProduct && detailProduct.product_group_id != null && detailProduct.is_weighted === true && (
        <GroupDetailModal
          groupId={detailProduct.product_group_id}
          fallbackProduct={detailProduct as DbProductEnhanced}
          onClose={() => setDetailProduct(null)}
          isAdded
        />
      )}
      {detailProduct && !(detailProduct.product_group_id != null && detailProduct.is_weighted === true) && (
        <ProductDetailModal
          barcode={detailProduct.barcode}
          fallbackImageUrl={detailProduct.image_url}
          fallbackProduct={detailProduct as DbProductEnhanced}
          onClose={() => setDetailProduct(null)}
          onAdd={() => setDetailProduct(null)}
          isAdded
          storeType={storeType}
        />
      )}
    </div>,
    document.body
  );
};

export default BuyPhaseEntry;
