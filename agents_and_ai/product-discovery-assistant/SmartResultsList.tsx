/**
 * Phase-2 selection UI for the Product Discovery Assistant.
 *
 * One section per user-facing item (SmartItemGroup). Each section shows:
 * - Checkbox to include/exclude the item
 * - Radio-selected "recommended" product
 * - Collapsible list of alternatives (also radio-selectable)
 * - Quantity stepper
 * - Missing items appear as a warning row (no recommended product)
 *
 * Footer: sticky running total + "add selected to cart" button that adds only
 * the checked items with their chosen variant + quantity.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, ChevronUp, Loader2, Minus, Plus, Search, Send, ShoppingCart, Sparkles, Wand2, X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { DbProduct, ShoppingProduct, SmartItemGroup } from '../../types';
import { defaultCartUnit, formatPriceLabel, formatPriceRange } from '../../utils/priceFormat';
import { iconUrl, LISTA_CATEGORIES } from './listaCategories';
import { AlternativeSuggestion, suggestAlternatives } from './aiService';

const IMAGE_FALLBACK =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="%23f1f5f9" width="40" height="40" rx="8"/><text x="20" y="24" text-anchor="middle" font-size="16">📦</text></svg>';

interface ItemSelection {
  checked: boolean;
  selectedBarcode: string;
  quantity: number;
  expanded: boolean;
}

interface SmartResultsListProps {
  itemGroups: SmartItemGroup[];
  existingBarcodes: Set<string>;
  addedInSession: Set<string>;
  onAdd: (products: ShoppingProduct[]) => void;
  onOpenDetail: (product: DbProduct) => void;
  /**
   * Optional — fired when the user clicks an alternative-query chip (on a
   * missing item OR inside the matched-item "refine" panel), or submits a
   * custom refine query. Parent runs a scoped search and replaces the item
   * in-place.
   */
  onRetryItem?: (itemId: string, query: string) => Promise<void>;
  /**
   * Optional — fired when the user clicks "+ עוד אפשרויות" on a matched
   * item. Parent fetches more products for the item's query and appends the
   * deduped new ones to the alternatives list.
   */
  onLoadMore?: (itemId: string) => Promise<number>;
}

const SmartResultsList: React.FC<SmartResultsListProps> = ({
  itemGroups,
  existingBarcodes,
  addedInSession,
  onAdd,
  onOpenDetail,
  onRetryItem,
  onLoadMore,
}) => {
  const { t, language } = useLanguage();
  const isHe = language === 'he';

  // Lazily fetch "maybe try..." chips for each missing item. State is keyed
  // by group.id so each no-match row gets its own set of chips. We kick
  // fetches off in an effect rather than eagerly so the initial render is
  // fast and un-opened messages don't pay the extra Gemini call.
  const [altsByGroup, setAltsByGroup] = useState<
    Record<string, { status: 'loading' | 'ready' | 'error'; items: AlternativeSuggestion[] }>
  >({});

  // Track which items are currently being retried via a "maybe try..." chip.
  // Cleared by the parent callback's promise resolving (success or failure).
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  // Matched items with the refine sub-panel expanded
  const [refiningIds, setRefiningIds] = useState<Set<string>>(new Set());
  // Per-item free-text refine input value
  const [refineDrafts, setRefineDrafts] = useState<Record<string, string>>({});
  // Items currently loading more alternatives
  const [loadingMoreIds, setLoadingMoreIds] = useState<Set<string>>(new Set());
  // Items that exhausted their "load more" pool — hides the button
  const [exhaustedIds, setExhaustedIds] = useState<Set<string>>(new Set());

  const loadAltsFor = (group: SmartItemGroup) => {
    if (altsByGroup[group.id]) return; // already fetched or in flight
    setAltsByGroup((prev) => ({ ...prev, [group.id]: { status: 'loading', items: [] } }));
    suggestAlternatives(group.originalText, group.listaCategory, language)
      .then((items) => {
        setAltsByGroup((prev) => ({ ...prev, [group.id]: { status: 'ready', items } }));
      })
      .catch(() => {
        setAltsByGroup((prev) => ({ ...prev, [group.id]: { status: 'error', items: [] } }));
      });
  };

  const handleChipClick = async (groupId: string, query: string) => {
    if (!onRetryItem || retryingIds.has(groupId)) return;
    setRetryingIds((prev) => new Set(prev).add(groupId));
    try {
      await onRetryItem(groupId, query);
      // Close the refine panel if it was open
      setRefiningIds((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  };

  const handleToggleRefine = (group: SmartItemGroup) => {
    const open = !refiningIds.has(group.id);
    setRefiningIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(group.id);
      else next.delete(group.id);
      return next;
    });
    if (open) loadAltsFor(group);
  };

  const handleRefineSubmit = async (groupId: string) => {
    const draft = (refineDrafts[groupId] || '').trim();
    if (!draft) return;
    await handleChipClick(groupId, draft);
    setRefineDrafts((prev) => ({ ...prev, [groupId]: '' }));
  };

  const handleLoadMore = async (groupId: string) => {
    if (!onLoadMore || loadingMoreIds.has(groupId) || exhaustedIds.has(groupId)) return;
    setLoadingMoreIds((prev) => new Set(prev).add(groupId));
    try {
      const added = await onLoadMore(groupId);
      if (added === 0) {
        setExhaustedIds((prev) => new Set(prev).add(groupId));
      }
    } finally {
      setLoadingMoreIds((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  };

  useEffect(() => {
    // Auto-load chips for missing items. For matched items the chips load
    // lazily only when the user opens the refine panel.
    const missing = itemGroups.filter((g) => g.status === 'no_match' && g.originalText);
    for (const g of missing) loadAltsFor(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemGroups, language]);

  const isInCart = (barcode: string) => existingBarcodes.has(barcode) || addedInSession.has(barcode);

  // Build initial selection state (one entry per itemGroup.id)
  const [selections, setSelections] = useState<Record<string, ItemSelection>>(() => {
    const init: Record<string, ItemSelection> = {};
    for (const g of itemGroups) {
      if (g.status === 'matched' && g.recommended) {
        init[g.id] = {
          checked: !isInCart(g.recommended.barcode),
          selectedBarcode: g.recommended.barcode,
          quantity: Math.max(1, Math.round(g.quantity || 1)),
          expanded: false,
        };
      }
    }
    return init;
  });

  // Keep `selections` in sync with incoming itemGroups. When the parent
  // performs an in-place retry (chip click on a missing item), the group
  // flips from status: "no_match" to "matched" — but selections was
  // initialized once at mount with nothing for that id, so renderMatchedItem
  // would short-circuit to null and the card would vanish. Add an entry for
  // any newly-matched group; also refresh selectedBarcode if the new
  // recommended product differs from what we had. Never overwrite user-set
  // checked/quantity/expanded values.
  useEffect(() => {
    setSelections((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const g of itemGroups) {
        if (g.status !== 'matched' || !g.recommended) continue;
        const existing = next[g.id];
        if (!existing) {
          next[g.id] = {
            checked: !isInCart(g.recommended.barcode),
            selectedBarcode: g.recommended.barcode,
            quantity: Math.max(1, Math.round(g.quantity || 1)),
            expanded: false,
          };
          changed = true;
        } else if (
          // Parent swapped in a different product under the same group id
          // (retry landed on a different barcode). Reset the selection to
          // the new recommendation and collapse alternatives.
          existing.selectedBarcode !== g.recommended.barcode &&
          !g.alternatives.some((a) => a.barcode === existing.selectedBarcode) &&
          g.recommended.barcode !== existing.selectedBarcode
        ) {
          next[g.id] = {
            ...existing,
            selectedBarcode: g.recommended.barcode,
            expanded: false,
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemGroups]);

  const updateSelection = (id: string, patch: Partial<ItemSelection>) => {
    setSelections((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const resolveProduct = (g: SmartItemGroup, barcode: string): DbProduct | null => {
    if (g.recommended?.barcode === barcode) return g.recommended;
    return g.alternatives.find((p) => p.barcode === barcode) ?? null;
  };

  // Running total across checked + selected products
  const { runningTotal, selectedCount } = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const g of itemGroups) {
      const sel = selections[g.id];
      if (!sel?.checked) continue;
      const product = resolveProduct(g, sel.selectedBarcode);
      if (!product) continue;
      total += (product.min_price || 0) * sel.quantity;
      count += 1;
    }
    return { runningTotal: total, selectedCount: count };
  }, [itemGroups, selections]);

  const handleAddSelected = () => {
    const products: ShoppingProduct[] = [];
    for (const g of itemGroups) {
      const sel = selections[g.id];
      if (!sel?.checked) continue;
      const product = resolveProduct(g, sel.selectedBarcode);
      if (!product) continue;
      if (isInCart(product.barcode)) continue;
      products.push({
        ...product,
        amount: sel.quantity,
        unit: defaultCartUnit(product.unit_of_measure, product.is_weighted, product.name),
      });
    }
    if (products.length > 0) onAdd(products);
  };

  const renderProductRow = (
    group: SmartItemGroup,
    product: DbProduct,
    isSelected: boolean,
    disabled: boolean
  ) => {
    const inCart = isInCart(product.barcode);
    return (
      <label
        key={product.barcode}
        className={`flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer ${
          isSelected
            ? 'border-indigo-300 bg-indigo-50/50'
            : 'border-slate-150 bg-white hover:border-slate-200'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <input
          type="radio"
          name={`variant-${group.id}`}
          checked={isSelected}
          onChange={() => updateSelection(group.id, { selectedBarcode: product.barcode })}
          disabled={disabled}
          className="w-4 h-4 text-indigo-600 flex-shrink-0"
        />
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); onOpenDetail(product); }}
          className="flex items-center gap-2 flex-1 min-w-0 text-start"
        >
          <img
            src={product.image_url || IMAGE_FALLBACK}
            alt=""
            className="w-9 h-9 rounded-lg object-cover flex-shrink-0 bg-slate-100"
            onError={(e) => { (e.target as HTMLImageElement).src = IMAGE_FALLBACK; }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800 leading-snug truncate">
              {product.name}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-slate-400">{product.manufacturer}</span>
              {product.min_price > 0 && (
                <span className="text-xs font-bold text-emerald-600">
                  {product.max_price && product.max_price > product.min_price
                    ? formatPriceRange(product.min_price, product.max_price, product.unit_of_measure, product.is_weighted)
                    : formatPriceLabel(product.min_price, product.unit_of_measure, product.is_weighted)}
                </span>
              )}
              {inCart && (
                <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                  <Check className="w-3 h-3" /> {t('smartList.alreadyInCart')}
                </span>
              )}
            </div>
          </div>
        </button>
      </label>
    );
  };

  const renderMatchedItem = (group: SmartItemGroup) => {
    const sel = selections[group.id];
    if (!sel || !group.recommended) return null;
    const alternativesCount = group.alternatives.length;

    return (
      <div key={group.id} className="rounded-xl border border-slate-200 bg-white p-3">
        {/* Header: checkbox + label + quantity stepper */}
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={sel.checked}
            onChange={(e) => updateSelection(group.id, { checked: e.target.checked })}
            className="w-4 h-4 text-indigo-600 rounded flex-shrink-0"
          />
          <span className="text-sm font-semibold text-slate-700 flex-1 min-w-0 truncate">
            {group.originalText}
          </span>
          {group.freshFallback && (
            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
              {isHe ? 'לא נמצא טרי' : 'No fresh'}
            </span>
          )}
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg flex-shrink-0">
            <button
              type="button"
              onClick={() => updateSelection(group.id, { quantity: Math.max(1, sel.quantity - 1) })}
              disabled={!sel.checked || sel.quantity <= 1}
              className="p-1 rounded text-slate-600 hover:bg-slate-200 disabled:opacity-30"
              aria-label="decrease"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-xs font-semibold text-slate-700 min-w-[1.5rem] text-center">
              {sel.quantity}
            </span>
            <button
              type="button"
              onClick={() => updateSelection(group.id, { quantity: sel.quantity + 1 })}
              disabled={!sel.checked}
              className="p-1 rounded text-slate-600 hover:bg-slate-200 disabled:opacity-30"
              aria-label="increase"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Recommended */}
        <div className="space-y-1.5">
          {renderProductRow(group, group.recommended, sel.selectedBarcode === group.recommended.barcode, !sel.checked)}

          {/* Alternatives expander */}
          {alternativesCount > 0 && (
            <>
              <button
                type="button"
                onClick={() => updateSelection(group.id, { expanded: !sel.expanded })}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 px-1"
                disabled={!sel.checked}
              >
                {sel.expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    {t('smartList.hideOptions')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    {t('smartList.showMoreOptions').replace('{n}', String(alternativesCount))}
                  </>
                )}
              </button>
              {sel.expanded && (
                <div className="space-y-1.5 pl-3 border-s-2 border-slate-100">
                  {group.alternatives.map((p) =>
                    renderProductRow(group, p, sel.selectedBarcode === p.barcode, !sel.checked)
                  )}
                </div>
              )}
            </>
          )}

          {/* Refine + load-more action row — only shown when alternatives are
              expanded (or when there are no alternatives but the user might
              still want to refine a clearly-wrong match). */}
          {sel.checked && (sel.expanded || alternativesCount === 0) && (onRetryItem || onLoadMore) && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {onRetryItem && (
                <button
                  type="button"
                  onClick={() => handleToggleRefine(group)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors border ${
                    refiningIds.has(group.id)
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  <Wand2 className="w-3 h-3" />
                  <span>{t('smartList.refineSearch')}</span>
                </button>
              )}
              {onLoadMore && !exhaustedIds.has(group.id) && (
                <button
                  type="button"
                  onClick={() => handleLoadMore(group.id)}
                  disabled={loadingMoreIds.has(group.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-50 transition-colors"
                >
                  {loadingMoreIds.has(group.id) ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>{t('smartList.loadingMore')}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      <span>{t('smartList.loadMore')}</span>
                    </>
                  )}
                </button>
              )}
              {exhaustedIds.has(group.id) && (
                <span className="text-[10px] text-slate-400 italic">
                  {t('smartList.noMoreResults')}
                </span>
              )}
            </div>
          )}

          {/* Refine sub-panel — chips from suggestAlternatives + free-text input */}
          {sel.checked && refiningIds.has(group.id) && (
            <div className="mt-2 p-2.5 rounded-lg border border-indigo-200 bg-indigo-50/40 space-y-2">
              {retryingIds.has(group.id) ? (
                <div className="flex items-center gap-1.5 text-[11px] text-indigo-600">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{isHe ? 'מחפש…' : 'Searching…'}</span>
                </div>
              ) : (
                <>
                  {(() => {
                    const alts = altsByGroup[group.id];
                    return (
                      <>
                        {alts?.status === 'loading' && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>{isHe ? 'מחפש הצעות…' : 'Finding suggestions…'}</span>
                          </div>
                        )}
                        {alts?.status === 'ready' && alts.items.length > 0 && (
                          <>
                            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                              <Sparkles className="w-3 h-3 text-indigo-500" />
                              <span>{isHe ? 'אולי תנסה:' : 'Maybe try:'}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {alts.items.map((a, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => handleChipClick(group.id, a.query)}
                                  title={a.reason}
                                  className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                                >
                                  <Search className="w-3 h-3" />
                                  <span>{a.query}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}

                  {/* Free-text refine input — user describes the product
                      more accurately; submit reruns an in-place retry. */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      value={refineDrafts[group.id] || ''}
                      onChange={(e) =>
                        setRefineDrafts((prev) => ({ ...prev, [group.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleRefineSubmit(group.id);
                        }
                      }}
                      placeholder={t('smartList.refinePlaceholder')}
                      dir="auto"
                      className="flex-1 min-w-0 text-xs px-2 py-1.5 rounded-md border border-slate-200 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRefineSubmit(group.id)}
                      disabled={!(refineDrafts[group.id] || '').trim()}
                      className="p-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400"
                      aria-label="submit"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleRefine(group)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-600"
                      aria-label="close"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMissingItem = (group: SmartItemGroup) => {
    const alts = altsByGroup[group.id];
    const hasSuggestions = alts?.status === 'ready' && alts.items.length > 0;
    const isRetrying = retryingIds.has(group.id);

    return (
      <div
        key={group.id}
        className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-700 truncate">
              {group.originalText}
            </div>
            <div className="text-[11px] text-amber-700">{t('smartList.notInCatalog')}</div>
          </div>
        </div>

        {/* In-flight retry — replaces the chip strip while a search is running */}
        {isRetrying && (
          <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 pt-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{isHe ? 'מחפש…' : 'Searching…'}</span>
          </div>
        )}

        {/* Alternative-query helper */}
        {!isRetrying && onRetryItem && (
          <>
            {alts?.status === 'loading' && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{isHe ? 'מחפש אלטרנטיבות…' : 'Finding alternatives…'}</span>
              </div>
            )}
            {hasSuggestions && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span>{isHe ? 'אולי תנסה:' : 'Maybe try:'}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {alts.items.map((a, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleChipClick(group.id, a.query)}
                      title={a.reason}
                      className="group flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                    >
                      <Search className="w-3 h-3" />
                      <span>{a.query}</span>
                    </button>
                  ))}
                </div>
                {/* Reasons line (only shows the first — tooltip has the rest) */}
                {alts.items[0]?.reason && (
                  <div className="text-[10px] text-slate-500 italic leading-snug">
                    {alts.items[0].reason}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  if (itemGroups.length === 0) return null;

  // Bucket item-groups under their canonical Lista category, then sort
  // categories by the canonical LISTA_CATEGORIES order so layout is stable.
  const orderIndex = new Map<string, number>(
    LISTA_CATEGORIES.map((c, i) => [c as string, i])
  );
  const categoryBuckets = new Map<string, typeof itemGroups>();
  for (const g of itemGroups) {
    const cat = g.listaCategory || 'אחר ולא מסווג';
    const bucket = categoryBuckets.get(cat) ?? [];
    bucket.push(g);
    categoryBuckets.set(cat, bucket);
  }
  const orderedCategories = Array.from(categoryBuckets.keys()).sort(
    (a, b) => (orderIndex.get(a) ?? 999) - (orderIndex.get(b) ?? 999)
  );

  return (
    <div className="space-y-4">
      {orderedCategories.map((category) => {
        const items = categoryBuckets.get(category)!;
        return (
          <div key={category} className="space-y-2">
            {/* Category header */}
            <div className="flex items-center gap-2 px-1 pt-1">
              <img
                src={iconUrl(category)}
                alt=""
                className="w-5 h-5 flex-shrink-0 opacity-80"
                onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
              />
              <span className="text-xs font-bold text-slate-700 tracking-wide">
                {category}
              </span>
              <span className="text-[11px] text-slate-400">({items.length})</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            {/* Items in this category */}
            <div className="space-y-2">
              {items.map((g) =>
                g.status === 'matched' ? renderMatchedItem(g) : renderMissingItem(g)
              )}
            </div>
          </div>
        );
      })}

      {/* Running total + bulk-add footer */}
      {selectedCount > 0 && (
        <div className="sticky bottom-0 bg-white border border-emerald-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-slate-700">
              {t('smartList.runningTotal')
                .replace('{price}', runningTotal.toFixed(2))
                .replace('{n}', String(selectedCount))}
            </div>
            <button
              type="button"
              onClick={handleAddSelected}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              {t('smartList.addSelectedToCart')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartResultsList;
