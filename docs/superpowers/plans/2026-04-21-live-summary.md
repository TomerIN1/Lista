# Live Summary + Persistent Basket — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the cross-chain price comparison always visible during shopping by replacing the current cart UI with a `LiveBasketPanel` (desktop) and a sticky `MobileBasketBar` + `MobileBasketSheet` (mobile). Upgrade the existing stores strip in place to show per-chain cart totals with the cheapest highlighted.

**Architecture:** Single new hook (`useLiveComparison`) calls the existing `compareListPrices()` API on cart change (debounced) and produces `{ chains: ChainTotal[], cheapest, savingsVsNext }`. Six new presentational components consume this data. The existing `ShoppingInputArea.tsx` cart sidebar (lines 144-260) is removed; the existing stores strip (lines 278-344) is replaced by `StoresStripV2`.

**Tech Stack:** React 18 + TypeScript + Tailwind + Vite. Lista's existing `compareListPrices()` from `services/priceDbService.ts`. Paper design tokens from `index.html` (`var(--paper-*)`, `var(--ink*)`, `var(--accent)`, `var(--save)`, `var(--font-serif)`).

**Verification approach:** This codebase has no test runner. Each task is verified with (a) `npx tsc --noEmit` for type safety, and (b) the running dev server (`npm run dev` → http://localhost:3000) for visual review of the actual feature. The plan is structured so each commit produces a working state.

**Spec:** `docs/superpowers/specs/2026-04-21-live-summary-design.md`

---

## File Structure

**New files:**
- `hooks/useLiveComparison.ts` — debounced cart → per-chain totals
- `utils/chainBranding.ts` — chain code → display name + badge color
- `components/KPIHero.tsx` — best-chain hero card
- `components/BasketList.tsx` — basket items + qty steppers + total footer
- `components/LiveBasketPanel.tsx` — desktop left panel composing the above
- `components/StoresStripV2.tsx` — upgraded stores strip with per-chain totals
- `components/MobileBasketBar.tsx` — sticky bottom bar (mobile)
- `components/MobileBasketSheet.tsx` — slide-up sheet hosting KPIHero + BasketList (mobile)

**Modified files:**
- `components/ShoppingInputArea.tsx` — remove old cart sidebar + old strip; mount new components
- `components/ProductCatalogArea.tsx` — adjust outer offset so the catalog leaves room for the new left panel on desktop
- `App.tsx` — add `mobileBasketOpen` state for the sheet
- `constants/translations.ts` — add new strings used by the new components

---

## Task 1: Chain branding helper

**Files:**
- Create: `utils/chainBranding.ts`

- [ ] **Step 1: Create the helper**

```ts
// utils/chainBranding.ts
import { SUPERMARKET_NAME_MAP } from '../services/priceDbService';

/** Brand colors per chain — used for KPIHero badge + StoresStripV2 chip dots.
 *  Keys are the canonical chain codes (English, lowercase) used by the API. */
const CHAIN_COLORS: Record<string, string> = {
  victory: '#E88B3C',
  rami_levy: '#D7352D',
  shufersal: '#2F6B3C',
  yenot_bitan: '#1A2B3C',
  tiv_taam: '#7A3CC4',
  yochananof: '#0F4C81',
  super_pharm: '#5BA3D0',
  hatzi_hinam: '#C8932E',
};

const FALLBACK_COLOR = '#6B655A'; // var(--ink-muted)

export function chainBadgeColor(chain: string): string {
  return CHAIN_COLORS[chain.toLowerCase()] ?? FALLBACK_COLOR;
}

export function chainDisplayName(chain: string): string {
  return SUPERMARKET_NAME_MAP[chain] || chain;
}

/** Two-letter abbreviation for the badge square (e.g. "Victory" → "VV"). */
export function chainAbbrev(chain: string): string {
  const name = chainDisplayName(chain);
  // Hebrew → take first two non-space chars; English → take initials of first two words.
  const isHebrew = /[֐-׿]/.test(name);
  if (isHebrew) {
    const stripped = name.replace(/\s+/g, '');
    return stripped.slice(0, 2);
  }
  const words = name.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: no new errors (the two pre-existing errors in `ProductCatalogArea.tsx:1004` and `RightRail.tsx:200` may still appear — that is OK).

- [ ] **Step 3: Commit**

```bash
git add utils/chainBranding.ts
git commit -m "feat(live-summary): add chain branding helper (color + display name + abbrev)"
```

---

## Task 2: Translations for the new UI

**Files:**
- Modify: `constants/translations.ts`

- [ ] **Step 1: Find the existing `productBrowse` namespace**

Run: `grep -n "productBrowse:" constants/translations.ts | head -5`

Open `constants/translations.ts`. Locate the `he` and `en` `productBrowse` blocks (used by the existing strip). New keys go inside both.

- [ ] **Step 2: Add the new keys to both locales**

Add these keys inside the `productBrowse` block in `he`:

```ts
basketForYou: 'לסל שלך:',
bestPriceLabel: 'המחיר הכי טוב לסל שלך',
sendToPricePilot: 'שליחה ל-PricePilot',
itemsPromo: (n: number) => `${n} פריטים במבצע`,
savingsAmount: (n: number) => `↗ חיסכון ₪${n}`,
basketEmptyHint: 'הוסיפו פריטים כדי להשוות מחירים',
basketTotal: 'סה״כ סל',
mobileCheapestLabel: 'הכי זול',
mobileItemsCount: (n: number) => `🛒 ${n} פריטים`,
```

And inside the `productBrowse` block in `en`:

```ts
basketForYou: 'For your basket:',
bestPriceLabel: 'Best price for your basket',
sendToPricePilot: 'Send to PricePilot',
itemsPromo: (n: number) => `${n} items on sale`,
savingsAmount: (n: number) => `↗ Save ₪${n}`,
basketEmptyHint: 'Add items to compare prices',
basketTotal: 'Basket total',
mobileCheapestLabel: 'Cheapest',
mobileItemsCount: (n: number) => `🛒 ${n} items`,
```

If the file uses string-only translations (no functions), adapt: replace function values with placeholder syntax used elsewhere in the file (search for an existing `(n)` to confirm convention).

- [ ] **Step 3: Verify type-check + the existing app still loads**

Run: `npx tsc --noEmit`
Run: `npm run dev` (if not already running). Open http://localhost:3000, navigate to shopping mode. The page should still render — these strings aren't used anywhere yet.

- [ ] **Step 4: Commit**

```bash
git add constants/translations.ts
git commit -m "feat(live-summary): add translations for KPIHero, BasketList, StoresStripV2"
```

---

## Task 3: `useLiveComparison` hook

**Files:**
- Create: `hooks/useLiveComparison.ts`

This hook is the data backbone. It debounces cart changes, calls `compareListPrices`, and exposes the per-chain totals.

- [ ] **Step 1: Create the hook**

```ts
// hooks/useLiveComparison.ts
import { useEffect, useState, useMemo, useRef } from 'react';
import { ShoppingProduct, DeliveryCheckResult, ListPriceComparison, StorePriceSummary } from '../types';
import { compareListPrices, SUPERMARKET_NAME_MAP } from '../services/priceDbService';

/** Reverse-lookup: turn a display name (e.g. "ויקטורי") back into a canonical
 *  chain code (e.g. "victory") so we can call into chainBranding helpers. */
function chainCodeFromDisplay(displayName: string): string {
  for (const [code, name] of Object.entries(SUPERMARKET_NAME_MAP)) {
    if (name === displayName) return code;
  }
  return displayName.toLowerCase();
}

export interface ChainTotal {
  chain: string;          // canonical code, e.g. "victory"
  displayName: string;    // SUPERMARKET_NAME_MAP-resolved, e.g. "ויקטורי"
  total: number;          // subtotal at this chain
  totalWithDelivery?: number;
  deliveryFee?: number;
  matchedItems: number;
}

export interface LiveComparisonResult {
  chains: ChainTotal[];   // sorted: cheapest first (totalWithDelivery preferred when present)
  cheapest: ChainTotal | null;
  /** Difference between cheapest and the chain at index 1. Null if < 2 chains. */
  savingsVsNext: number | null;
}

interface UseLiveComparisonInput {
  products: ShoppingProduct[];
  city?: string;
  cityCode?: number;
  storeType?: string;     // 'online' | 'physical' | undefined
  deliveryCheck?: DeliveryCheckResult | null;
}

const DEBOUNCE_MS = 600;

export function useLiveComparison(input: UseLiveComparisonInput): {
  data: LiveComparisonResult | null;
  loading: boolean;
  error: string | null;
} {
  const { products, city, cityCode, storeType, deliveryCheck } = input;
  const [data, setData] = useState<LiveComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build a stable signature of the cart so we only refetch when items change.
  const cartSignature = useMemo(
    () => products
      .map(p => `${p.barcode}:${p.amount}`)
      .sort()
      .join(','),
    [products],
  );

  // Pull eligible store ids + delivery fee map from deliveryCheck (if present).
  const eligibleStoreIds = useMemo(
    () => deliveryCheck?.eligible_store_ref_ids ?? undefined,
    [deliveryCheck],
  );
  const deliveryFees = useMemo(() => {
    if (!deliveryCheck) return undefined;
    const map: Record<number, number> = {};
    for (const c of deliveryCheck.chains) {
      if (c.delivery_fee != null) map[c.store_ref_id] = c.delivery_fee;
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [deliveryCheck]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (products.length === 0) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const result: ListPriceComparison = await compareListPrices({
          items: products.map(p => ({ barcode: p.barcode, quantity: p.amount })),
          city,
          city_code: cityCode,
          store_type: storeType,
          eligible_store_ref_ids: eligibleStoreIds,
          delivery_fees: deliveryFees,
        });
        setData(toLiveComparison(result));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Comparison failed');
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSignature, city, cityCode, storeType, eligibleStoreIds, deliveryFees]);

  return { data, loading, error };
}

function toLiveComparison(r: ListPriceComparison): LiveComparisonResult {
  // Map StorePriceSummary → ChainTotal; the API names are display-strings, so map back to canonical code.
  // We rely on r.stores already being sorted by matchedItems desc, then cost asc.
  const chains: ChainTotal[] = r.stores.map((s: StorePriceSummary) => ({
    chain: chainCodeFromDisplay(s.supermarketName), // canonical code, used by chainBranding helpers
    displayName: s.supermarketName,                  // human-readable, used in UI text
    total: s.totalCost,
    totalWithDelivery: s.totalWithDelivery,
    deliveryFee: s.deliveryFee,
    matchedItems: s.matchedItems,
  }));

  // Resort here too for safety: prefer totalWithDelivery when available.
  chains.sort((a, b) => {
    const aCost = a.totalWithDelivery ?? a.total;
    const bCost = b.totalWithDelivery ?? b.total;
    return aCost - bCost;
  });

  const cheapest = chains[0] ?? null;
  const next = chains[1] ?? null;
  const savingsVsNext = cheapest && next
    ? (next.totalWithDelivery ?? next.total) - (cheapest.totalWithDelivery ?? cheapest.total)
    : null;

  return { chains, cheapest, savingsVsNext };
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no new errors related to the hook. (Pre-existing errors elsewhere are OK.)

- [ ] **Step 3: Commit**

```bash
git add hooks/useLiveComparison.ts
git commit -m "feat(live-summary): add useLiveComparison hook (debounced per-chain totals)"
```

---

## Task 4: `KPIHero` component

**Files:**
- Create: `components/KPIHero.tsx`

Pure presentational. Receives a `selectedChain: ChainTotal | null` plus savings.

- [ ] **Step 1: Create the component**

```tsx
// components/KPIHero.tsx
import React from 'react';
import { Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChainTotal } from '../hooks/useLiveComparison';
import { chainBadgeColor, chainAbbrev } from '../utils/chainBranding';

interface KPIHeroProps {
  selectedChain: ChainTotal | null;
  /** Savings (₪) vs next-cheapest if best is selected, vs cheapest otherwise.
   *  Null hides the savings pill. Only renders when > 0. */
  savings: number | null;
  /** Number of items on promotion in the basket. 0 hides the pill. */
  promoCount: number;
  /** Cart length. When 0, render the empty-state fallback. */
  itemCount: number;
  onSendToPricePilot: () => void;
}

const KPIHero: React.FC<KPIHeroProps> = ({
  selectedChain, savings, promoCount, itemCount, onSendToPricePilot,
}) => {
  const { t } = useLanguage();
  const totalToDisplay = selectedChain
    ? (selectedChain.totalWithDelivery ?? selectedChain.total)
    : 0;

  if (itemCount === 0 || !selectedChain) {
    return (
      <div className="p-4" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--ink-soft)' }}>
          {t('productBrowse.bestPriceLabel')}
        </div>
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('productBrowse.basketEmptyHint')}
        </p>
      </div>
    );
  }

  const wholeShekels = Math.floor(totalToDisplay);
  const decimals = (totalToDisplay - wholeShekels).toFixed(2).slice(1); // ".40"

  return (
    <div className="p-4" style={{ borderBottom: '1px solid var(--line)' }}>
      <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--ink-soft)' }}>
        {t('productBrowse.bestPriceLabel')}
      </div>
      <div className="flex items-center gap-2.5 mb-1.5">
        <div
          className="w-[42px] h-[42px] rounded-[9px] flex items-center justify-center text-white font-extrabold text-sm"
          style={{ background: chainBadgeColor(selectedChain.chain) }}
        >
          {chainAbbrev(selectedChain.chain)}
        </div>
        <div className="text-[22px] leading-none" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>
          {selectedChain.displayName}
        </div>
      </div>
      <div className="leading-none my-2" style={{ fontFamily: 'var(--font-serif)', fontSize: 38, color: 'var(--ink)' }}>
        {wholeShekels}
        <span className="text-sm align-top" style={{ color: 'var(--ink-muted)' }}>{decimals} ₪</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {promoCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px]"
            style={{ background: 'var(--paper-surface-alt)', color: 'var(--ink)' }}>
            {t('productBrowse.itemsPromo')(promoCount)}
          </span>
        )}
        {savings != null && savings > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: 'var(--save-bg)', color: 'var(--save)' }}>
            {t('productBrowse.savingsAmount')(Math.round(savings))}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onSendToPricePilot}
        className="w-full py-2.5 rounded-lg text-white font-bold text-[11px] flex items-center justify-center gap-1.5"
        style={{ background: 'var(--accent)', boxShadow: '0 1px 3px rgba(215,53,45,0.25)' }}
      >
        <Sparkles className="w-3.5 h-3.5" />
        {t('productBrowse.sendToPricePilot')}
      </button>
    </div>
  );
};

export default KPIHero;
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/KPIHero.tsx
git commit -m "feat(live-summary): KPIHero card (best-chain badge, serif price, savings, CTA)"
```

---

## Task 5: `BasketList` component

**Files:**
- Create: `components/BasketList.tsx`

Lifts the cart-items rendering out of `ShoppingInputArea.tsx:166-260` into a reusable component.

- [ ] **Step 1: Create the component**

```tsx
// components/BasketList.tsx
import React from 'react';
import { ShoppingCart, Trash2, Minus, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ShoppingProduct, Unit } from '../types';
import { computeWeightedTotal } from '../utils/priceFormat';

interface BasketListProps {
  products: ShoppingProduct[];
  onUpdate: (barcode: string, updates: { amount?: number; unit?: Unit }) => void;
  onRemove: (barcode: string) => void;
  onClear: () => void;
}

const BasketList: React.FC<BasketListProps> = ({ products, onUpdate, onRemove, onClear }) => {
  const { t, isRTL } = useLanguage();
  const hasContent = products.length > 0;

  const estimatedTotal = products.reduce((sum, p) => {
    if (!p.min_price) return sum;
    const wt = computeWeightedTotal(p.min_price, p.amount, p.unit, p.unit_of_measure, p.is_weighted, p.name);
    return sum + (wt ?? p.min_price * p.amount);
  }, 0);

  const handleDecrement = (p: ShoppingProduct) => {
    if (p.amount <= 1) onRemove(p.barcode);
    else onUpdate(p.barcode, { amount: p.amount - 1 });
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: 'var(--paper-surface-alt)', borderBottom: '1px solid var(--line)' }}
      >
        <div className="flex items-baseline gap-2">
          <b className="text-[14px]" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>
            {isRTL ? 'הסל שלי' : 'My basket'}
          </b>
          <span className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>
            {hasContent
              ? `${products.length} ${t('productBrowse.cartItems')}`
              : (isRTL ? 'ריק' : 'empty')}
          </span>
        </div>
        {hasContent && (
          <button onClick={onClear} className="p-1" style={{ color: 'var(--ink-soft)' }}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {!hasContent && (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <ShoppingCart className="w-8 h-8 mb-2" style={{ color: 'var(--ink-soft)' }} />
            <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
              {isRTL ? 'התחל לקנות!' : 'Start shopping!'}
            </p>
          </div>
        )}
        {products.map(p => {
          const wt = computeWeightedTotal(p.min_price, p.amount, p.unit, p.unit_of_measure, p.is_weighted, p.name);
          const linePrice = wt ?? p.min_price * p.amount;
          return (
            <div key={p.barcode} className="flex items-center gap-2 px-3 py-2"
              style={{ borderBottom: '1px solid var(--line)' }}>
              <div
                className="w-[30px] h-[30px] rounded-md flex-shrink-0 overflow-hidden"
                style={{ background: 'var(--paper-surface-alt)' }}
              >
                {p.image_url && (
                  <img src={p.image_url} alt="" className="w-full h-full object-contain" loading="lazy" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                  {p.name}
                </div>
                <div className="text-[8px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                  {p.amount} {t(`units.${p.unit}` as any) || p.unit}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--ink)' }}>
                <button
                  type="button"
                  onClick={() => handleDecrement(p)}
                  className="w-[18px] h-[18px] rounded flex items-center justify-center"
                  style={{ background: 'var(--paper-surface-alt)' }}
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <span className="min-w-[14px] text-center">{p.amount}</span>
                <button
                  type="button"
                  onClick={() => onUpdate(p.barcode, { amount: p.amount + 1 })}
                  className="w-[18px] h-[18px] rounded flex items-center justify-center"
                  style={{ background: 'var(--paper-surface-alt)' }}
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
              <div className="text-[10px] font-bold min-w-[32px] text-start"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>
                ₪{linePrice.toFixed(0)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer total */}
      {hasContent && (
        <div
          className="flex items-center justify-between px-3 py-2.5"
          style={{ background: 'var(--paper-surface-alt)', borderTop: '1px solid var(--line)' }}
        >
          <span className="text-[10px]" style={{ color: 'var(--ink-muted)' }}>
            {t('productBrowse.basketTotal')}
          </span>
          <span className="text-[14px]" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>
            ₪{estimatedTotal.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};

export default BasketList;
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/BasketList.tsx
git commit -m "feat(live-summary): BasketList component (lifted from ShoppingInputArea)"
```

---

## Task 6: `LiveBasketPanel` desktop container

**Files:**
- Create: `components/LiveBasketPanel.tsx`

Composes `KPIHero` + tip placeholder + `BasketList`. The panel is fixed to the inline-end edge of the catalog area.

- [ ] **Step 1: Create the panel**

```tsx
// components/LiveBasketPanel.tsx
import React from 'react';
import { ShoppingProduct, Unit } from '../types';
import { ChainTotal, LiveComparisonResult } from '../hooks/useLiveComparison';
import KPIHero from './KPIHero';
import BasketList from './BasketList';

interface LiveBasketPanelProps {
  products: ShoppingProduct[];
  comparison: LiveComparisonResult | null;
  /** The chain currently shown in KPIHero — defaults to comparison.cheapest. */
  selectedChain: ChainTotal | null;
  onUpdate: (barcode: string, updates: { amount?: number; unit?: Unit }) => void;
  onRemove: (barcode: string) => void;
  onClear: () => void;
  onSendToPricePilot: () => void;
}

const LiveBasketPanel: React.FC<LiveBasketPanelProps> = ({
  products, comparison, selectedChain,
  onUpdate, onRemove, onClear, onSendToPricePilot,
}) => {
  // Savings = if user is viewing the cheapest, compare to next; else compare to cheapest.
  const savings: number | null = (() => {
    if (!comparison || !selectedChain) return null;
    const cheapest = comparison.cheapest;
    if (!cheapest) return null;
    if (selectedChain.chain === cheapest.chain) {
      return comparison.savingsVsNext;
    }
    const sel = selectedChain.totalWithDelivery ?? selectedChain.total;
    const ch = cheapest.totalWithDelivery ?? cheapest.total;
    return ch - sel; // negative when not best, KPIHero hides it
  })();

  const promoCount = products.filter(p => p.has_promotion).length;

  return (
    <aside
      className="hidden lg:flex flex-col fixed top-[60px] bottom-0 z-30 w-[300px]"
      style={{
        insetInlineEnd: 0,
        background: 'var(--paper-surface)',
        borderInlineStart: '1px solid var(--line)',
      }}
    >
      <KPIHero
        selectedChain={selectedChain}
        savings={savings}
        promoCount={promoCount}
        itemCount={products.length}
        onSendToPricePilot={onSendToPricePilot}
      />
      {/* Tip row — v1: hidden until tip data exists. Render nothing. */}
      {/* See spec §5: row will light up when delivery-threshold lookup ships. */}
      <BasketList
        products={products}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onClear={onClear}
      />
    </aside>
  );
};

export default LiveBasketPanel;
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/LiveBasketPanel.tsx
git commit -m "feat(live-summary): LiveBasketPanel desktop container (KPIHero + BasketList)"
```

---

## Task 7: `StoresStripV2` — upgraded chain comparison strip

**Files:**
- Create: `components/StoresStripV2.tsx`

Replaces the chain-filter chips with cart-total chips.

- [ ] **Step 1: Create the strip**

```tsx
// components/StoresStripV2.tsx
import React from 'react';
import { Store } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChainTotal } from '../hooks/useLiveComparison';
import { chainBadgeColor } from '../utils/chainBranding';

interface StoresStripV2Props {
  chains: ChainTotal[];           // already sorted cheapest-first
  selectedChain: string | null;   // canonical chain code
  onSelectChain: (chain: string) => void;
  loading?: boolean;
}

const StoresStripV2: React.FC<StoresStripV2Props> = ({
  chains, selectedChain, onSelectChain, loading,
}) => {
  const { t } = useLanguage();

  if (chains.length === 0 && !loading) return null;

  const cheapest = chains[0];

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 overflow-x-auto"
      style={{ background: 'var(--paper-surface)', borderBottom: '1px solid var(--line)' }}
    >
      <div
        className="flex items-center gap-1 text-[10px] flex-shrink-0"
        style={{ color: 'var(--ink-soft)' }}
      >
        <Store className="w-3.5 h-3.5" />
        <span>{t('productBrowse.basketForYou')}</span>
      </div>
      {loading && chains.length === 0 && (
        // Skeleton chips while we wait for the first comparison.
        <>
          {[0, 1, 2].map(i => (
            <div key={i} className="h-6 w-24 rounded-full animate-pulse"
              style={{ background: 'var(--paper-surface-alt)' }} />
          ))}
        </>
      )}
      {chains.map(c => {
        const isBest = c.chain === cheapest?.chain;
        const isSelected = c.chain === selectedChain;
        const totalToShow = c.totalWithDelivery ?? c.total;
        return (
          <button
            key={c.chain}
            type="button"
            onClick={() => onSelectChain(c.chain)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] whitespace-nowrap flex-shrink-0 transition-all"
            style={
              isBest
                ? {
                    background: 'var(--save)',
                    color: '#fff',
                    boxShadow: '0 1px 4px rgba(47,107,60,0.25)',
                    border: isSelected ? '2px solid var(--ink)' : '1px solid var(--save)',
                  }
                : {
                    background: 'var(--save-bg)',
                    color: 'var(--save)',
                    border: isSelected ? '2px solid var(--ink)' : '1px solid transparent',
                  }
            }
          >
            {isBest && <span aria-hidden>⭐</span>}
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: chainBadgeColor(c.chain) }}
              aria-hidden
            />
            <span className="font-bold">{c.displayName}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              ₪{Math.round(totalToShow)}
            </span>
            {c.deliveryFee != null && (
              <span className="text-[9px]" style={{
                color: isBest ? 'rgba(255,255,255,0.85)' : 'var(--ink-muted)',
              }}>
                🚚 ₪{c.deliveryFee}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default StoresStripV2;
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/StoresStripV2.tsx
git commit -m "feat(live-summary): StoresStripV2 (chips show cart total per chain, cheapest highlighted)"
```

---

## Task 8: `MobileBasketBar` — sticky bottom bar

**Files:**
- Create: `components/MobileBasketBar.tsx`

- [ ] **Step 1: Create the bar**

```tsx
// components/MobileBasketBar.tsx
import React from 'react';
import { ChevronUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChainTotal } from '../hooks/useLiveComparison';
import { chainAbbrev, chainBadgeColor } from '../utils/chainBranding';

interface MobileBasketBarProps {
  cheapest: ChainTotal | null;
  itemCount: number;
  onTap: () => void;
}

const MobileBasketBar: React.FC<MobileBasketBarProps> = ({ cheapest, itemCount, onTap }) => {
  const { t } = useLanguage();
  if (itemCount === 0 || !cheapest) return null;

  const total = cheapest.totalWithDelivery ?? cheapest.total;
  const whole = Math.floor(total);
  const dec = (total - whole).toFixed(2).slice(1);

  return (
    <button
      type="button"
      onClick={onTap}
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-4 py-3 flex items-center gap-3 text-white"
      style={{
        background: 'var(--ink)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
      }}
      aria-label={t('productBrowse.mobileItemsCount')(itemCount)}
    >
      <div className="flex flex-col gap-0.5 flex-1 text-start">
        <span className="text-[10px] uppercase tracking-wider flex items-center gap-1.5"
          style={{ color: 'rgba(255,255,255,0.7)' }}>
          {t('productBrowse.mobileCheapestLabel')}
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
            style={{ background: chainBadgeColor(cheapest.chain) }}
          >
            {chainAbbrev(cheapest.chain)} {cheapest.displayName}
          </span>
        </span>
        <span className="text-[20px] leading-none" style={{ fontFamily: 'var(--font-serif)' }}>
          {whole}
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{dec} ₪</span>
        </span>
      </div>
      <span className="px-3 py-1.5 rounded-full text-[11px] font-bold"
        style={{ background: 'var(--accent)' }}>
        {t('productBrowse.mobileItemsCount')(itemCount)}
      </span>
      <ChevronUp className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.7)' }} />
    </button>
  );
};

export default MobileBasketBar;
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/MobileBasketBar.tsx
git commit -m "feat(live-summary): MobileBasketBar sticky bottom bar"
```

---

## Task 9: `MobileBasketSheet` — bottom sheet

**Files:**
- Create: `components/MobileBasketSheet.tsx`

Slide-up sheet hosting `KPIHero` + `BasketList`. Closes on backdrop tap or drag handle.

- [ ] **Step 1: Create the sheet**

```tsx
// components/MobileBasketSheet.tsx
import React, { useEffect } from 'react';
import { ShoppingProduct, Unit } from '../types';
import { ChainTotal, LiveComparisonResult } from '../hooks/useLiveComparison';
import KPIHero from './KPIHero';
import BasketList from './BasketList';

interface MobileBasketSheetProps {
  open: boolean;
  onClose: () => void;
  products: ShoppingProduct[];
  comparison: LiveComparisonResult | null;
  selectedChain: ChainTotal | null;
  onUpdate: (barcode: string, updates: { amount?: number; unit?: Unit }) => void;
  onRemove: (barcode: string) => void;
  onClear: () => void;
  onSendToPricePilot: () => void;
}

const MobileBasketSheet: React.FC<MobileBasketSheetProps> = ({
  open, onClose, products, comparison, selectedChain,
  onUpdate, onRemove, onClear, onSendToPricePilot,
}) => {
  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const savings: number | null = (() => {
    if (!comparison || !selectedChain) return null;
    if (!comparison.cheapest) return null;
    if (selectedChain.chain === comparison.cheapest.chain) return comparison.savingsVsNext;
    const sel = selectedChain.totalWithDelivery ?? selectedChain.total;
    const ch = comparison.cheapest.totalWithDelivery ?? comparison.cheapest.total;
    return ch - sel;
  })();

  const promoCount = products.filter(p => p.has_promotion).length;

  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
        aria-hidden
      />
      {/* Sheet */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden"
        style={{
          background: 'var(--paper-surface)',
          borderRadius: '20px 20px 0 0',
          maxHeight: '88vh',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.2)',
        }}
      >
        {/* Drag handle */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 flex justify-center"
          aria-label="Close"
        >
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--paper-surface-alt)' }} />
        </button>
        <div className="overflow-y-auto flex-1">
          <KPIHero
            selectedChain={selectedChain}
            savings={savings}
            promoCount={promoCount}
            itemCount={products.length}
            onSendToPricePilot={onSendToPricePilot}
          />
          {/* Tip row hidden in v1 — see spec §5 */}
          <BasketList
            products={products}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onClear={onClear}
          />
        </div>
      </div>
    </div>
  );
};

export default MobileBasketSheet;
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/MobileBasketSheet.tsx
git commit -m "feat(live-summary): MobileBasketSheet (bottom sheet hosting KPIHero + BasketList)"
```

---

## Task 10: Wire everything into `ShoppingInputArea`

**Files:**
- Modify: `components/ShoppingInputArea.tsx`

Remove the old desktop cart sidebar (lines ~144-260) and the old stores strip (lines ~278-344). Replace with the new components.

- [ ] **Step 1: Read the current file to find exact replacement boundaries**

Run: `grep -n "Available stores banner\|Left-side Cart Sidebar" components/ShoppingInputArea.tsx`

Note the line numbers — they will be the anchors for the edits.

- [ ] **Step 2: Add imports + lift state to the top of the component**

Add at the top of `components/ShoppingInputArea.tsx`:

```ts
import { useLiveComparison, ChainTotal } from '../hooks/useLiveComparison';
import LiveBasketPanel from './LiveBasketPanel';
import StoresStripV2 from './StoresStripV2';
import MobileBasketBar from './MobileBasketBar';
import MobileBasketSheet from './MobileBasketSheet';
```

Inside the component body (next to the other `useState` calls), add:

```ts
const [selectedChainCode, setSelectedChainCode] = useState<string | null>(null);
const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

const liveCmp = useLiveComparison({
  products,
  city,
  cityCode: undefined, // wire if available in props later
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
```

- [ ] **Step 3: Replace the old stores strip (lines ~278-344) with `<StoresStripV2 />`**

Find this region in the file:

```tsx
{/* ── Available stores banner ─────────────────── */}
{deliveryCheck && (() => {
  // ... ~65 lines of existing chip rendering ...
})()}
```

Replace it with:

```tsx
{/* ── Stores strip — per-chain cart totals ─── */}
<StoresStripV2
  chains={liveCmp.data?.chains ?? []}
  selectedChain={selectedChainCode}
  onSelectChain={setSelectedChainCode}
  loading={liveCmp.loading}
/>
```

- [ ] **Step 4: Replace the old desktop cart sidebar (lines ~144-260) with `<LiveBasketPanel />`**

Find this region:

```tsx
{/* Desktop cart sidebar — always on the left via direction:ltr on parent */}
<div className="hidden lg:flex flex-col w-72 xl:w-80 2xl:w-96 ...">
  // ... ~115 lines of existing cart rendering ...
</div>
```

Delete the entire `<div className="hidden lg:flex …">` block.

The outer `<div className="flex gap-4" style={{ direction: 'ltr' }}>` wrapper at line 144 was needed to flip the cart to the left. Now that the panel is `position: fixed`, remove that wrapper too — replace it with a plain `<div>`. The inner `<div className="flex-1 min-w-0 pb-20 lg:pb-4">` becomes the new top-level child.

After the JSX body, just before the component returns, mount the new components:

```tsx
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
```

- [ ] **Step 5: Remove the old mobile cart bottom bar if one exists**

Run: `grep -n "lg:hidden.*fixed.*bottom" components/ShoppingInputArea.tsx`

If a match is found (an existing mobile cart drawer/bar), delete it entirely — `MobileBasketBar` replaces it. If no match, skip this step.

- [ ] **Step 6: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. If one of the removed pieces was referenced elsewhere (e.g. `setIsCartExpanded`), remove the now-unused state declaration.

- [ ] **Step 7: Commit**

```bash
git add components/ShoppingInputArea.tsx
git commit -m "feat(live-summary): wire LiveBasketPanel + StoresStripV2 + mobile bar/sheet into ShoppingInputArea"
```

---

## Task 11: Adjust catalog padding to make room for the new panel

**Files:**
- Modify: `components/ProductCatalogArea.tsx`

The `LiveBasketPanel` is `position: fixed; inset-inline-end: 0; w-[300px]`. The catalog needs `padding-inline-end: 300px` on `lg+` to avoid being covered.

- [ ] **Step 1: Find the outermost wrapper class string**

Run: `grep -n "lg:ps-\[280px\]\|lg:pe-" components/ProductCatalogArea.tsx | head -5`

The current wrapper has `lg:ps-[280px]` for the RightRail offset. Add `lg:pe-[300px]` next to it.

- [ ] **Step 2: Add the padding-inline-end**

Use the Edit tool to find the existing `lg:ps-[280px]` token in the wrapper className and replace with `lg:ps-[280px] lg:pe-[300px]`.

- [ ] **Step 3: Verify type-check + browser**

Run: `npx tsc --noEmit`
Run: `npm run dev` and open http://localhost:3000. Enter shopping mode with a non-empty city. The catalog should not extend behind the new left panel.

- [ ] **Step 4: Commit**

```bash
git add components/ProductCatalogArea.tsx
git commit -m "feat(live-summary): reserve catalog padding-inline-end for LiveBasketPanel"
```

---

## Task 12: End-to-end visual verification

No new files — this task is the manual smoke test and any small fixes that fall out of it.

- [ ] **Step 1: Make sure the dev server is running**

Run: `lsof -i :3000` → if nothing returned, run `npm run dev` (background).

- [ ] **Step 2: Desktop walk-through**

Open http://localhost:3000 in a wide-window browser (≥ lg breakpoint, ~1280px+). Sign in if needed; pick a city with delivering chains. Then:

1. Enter shopping mode → land in catalog. Confirm the **right-side rail** is the existing `RightRail` (categories, profile etc.).
2. Confirm the **left-side panel** is the new `LiveBasketPanel`. Cart is empty → KPIHero shows the `bestPriceLabel` + empty hint, BasketList shows the "התחל לקנות" placeholder.
3. Confirm the **stores strip** below the header shows `🏪 לסל שלך:` + skeleton chips while empty (or no chips if no chains).
4. Add 3 products from the catalog. Within ~600ms the strip populates with chain chips, the cheapest highlighted green with ⭐. KPIHero updates to the cheapest chain's hero card.
5. Click a non-cheapest chip. KPIHero re-renders with that chain. Catalog prices remain unchanged (per spec §3).
6. Adjust quantities in BasketList (`+`/`−`). Strip totals update after debounce.
7. Click the CTA `שליחה ל-PricePilot` → existing compare flow fires.

- [ ] **Step 3: Mobile walk-through**

Use Chrome DevTools device toolbar → iPhone 14 Pro (or any ≤ md width). Reload. Then:

1. The catalog fills the screen. The `RightRail` is hidden (drawer-only on mobile).
2. The `MobileBasketBar` appears at the bottom *only* once cart is non-empty. It shows "הכי זול VV ויקטורי · ₪208".
3. Tap the bar → `MobileBasketSheet` slides up. Backdrop dims. Sheet shows KPIHero on top, BasketList below.
4. Adjust quantities — items update.
5. Tap CTA → sheet closes and the compare flow fires.
6. Drag-handle tap or backdrop tap dismisses.

- [ ] **Step 4: Fix any visual breakage**

If any element overlaps, has wrong color, or breaks the Paper palette, edit the offending component file. Re-run type-check.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(live-summary): visual polish from end-to-end review"
```

(Skip if nothing changed.)

---

## Task 13: Update docs

**Files:**
- Modify: `DESIGN_SYSTEM.md` — document the new components
- Modify: `PROJECT_DOCUMENTATION.md` — add session entry

- [ ] **Step 1: Append a new section to `DESIGN_SYSTEM.md`**

Add under §4 (Core Component Patterns) a new subsection "4.6 LiveBasketPanel + StoresStripV2 + Mobile basket sheet" describing the layout pattern, fixed positioning, mobile sticky bar, KPIHero structure, and BasketList qty stepper conventions. Keep it short (a paragraph each).

- [ ] **Step 2: Add a session log entry to `PROJECT_DOCUMENTATION.md`**

At the top of the session-log area (look for the `## Session: April 21, 2026 — Category Icons` block — insert *above* it):

```markdown
## Session: April 21, 2026 — Live Summary + Persistent Basket

### Overview
Replaced the cart sidebar with a `LiveBasketPanel` (KPIHero + BasketList) on the inline-end side, plus a sticky `MobileBasketBar` and slide-up `MobileBasketSheet` for mobile. Upgraded the stores strip in place to show per-chain cart totals with the cheapest highlighted; clicking any chip switches the KPIHero view.

### Files Changed
- `hooks/useLiveComparison.ts` — NEW — debounced per-chain totals via existing `compareListPrices`.
- `utils/chainBranding.ts` — NEW — chain code → display name + badge color + abbrev.
- `components/KPIHero.tsx` — NEW.
- `components/BasketList.tsx` — NEW (lifted from `ShoppingInputArea`).
- `components/LiveBasketPanel.tsx` — NEW.
- `components/StoresStripV2.tsx` — NEW (replaces old chain-filter strip).
- `components/MobileBasketBar.tsx` — NEW.
- `components/MobileBasketSheet.tsx` — NEW.
- `components/ShoppingInputArea.tsx` — wires the new components; old desktop cart sidebar + old stores strip removed.
- `components/ProductCatalogArea.tsx` — added `lg:pe-[300px]` so catalog doesn't sit under the panel.
- `constants/translations.ts` — new strings for KPIHero + StoresStripV2 + mobile bar.
- `DESIGN_SYSTEM.md` — documented new layout pattern.

### Out of scope (v2)
- 💡 Delivery-threshold tip data — UI is designed; row stays hidden in v1.
- Re-pricing the catalog grid based on the selected chain.

---
```

- [ ] **Step 3: Commit**

```bash
git add DESIGN_SYSTEM.md PROJECT_DOCUMENTATION.md
git commit -m "docs(live-summary): document new layout in DESIGN_SYSTEM.md + session log"
```

---

## Task 14: Push

- [ ] **Step 1: Push to origin**

```bash
git push origin main
```

- [ ] **Step 2: Confirm Vercel preview**

Open the Vercel dashboard for `lista-six-psi` (or run the `vercel:status` skill). Wait for the production deployment to go green. Open the live URL → repeat the desktop and mobile walk-throughs from Task 12 against production.

---

## Spec coverage check (self-review)

| Spec section | Implemented in |
|---|---|
| §2 Layout — three regions | Tasks 6, 10, 11 |
| §3 StoresStripV2 — cheapest highlighted, click switches KPI | Task 7, 10 |
| §4 KPIHero — badge / serif price / pills / CTA | Task 4 |
| §5 Tip row — hidden in v1 (data not pulled yet) | Task 6, 9 (placeholder comment, no UI) |
| §6 BasketList — items + qty + footer total | Task 5 |
| §7 Mobile — sticky bar + bottom sheet | Tasks 8, 9, 10 |
| §8 File structure | All tasks |
| §9 Data — `useLiveComparison` hook | Task 3 |
| §10 RTL/LTR — logical-property spacing | Tasks 6, 11 (`insetInlineEnd`, `lg:pe-[…]`) |
| §11 Migration — old strip replaced in place | Task 10 |
| §12 Out of scope (tip data) | Tasks 6, 9 (explicit comment) |
| §13 Standing rules — mobile parity, Paper tokens, no `pl/pr-*`, no pure black | All tasks (tokens enforced; `var(--ink)` allowed in MobileBasketBar by spec) |
