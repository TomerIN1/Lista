# Increment 2: Buy Phase Entry Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace today's CTA → `ShoppingPriceStep` → store-pick flow with a single modal/sheet ("How to buy") that lists per-chain cards. Clicking a card opens `PriceAgentChat` with that chain's display name, identical to the existing agent flow. Pure-UI; `PriceAgentChat`, `agentService`, and the Python agent are untouched.

**Architecture:** One new component (`BuyPhaseEntry`) rendered via portal, used as a centered modal on desktop and a bottom-sheet on mobile. Reads per-chain data from `useLiveComparison`'s already-deliverable, already-sorted `chains` array — no extra fetch. The "Buy this list" CTA in `KPIHero` (already wired in Increment 1) now opens this entry screen instead of `handleShoppingCompare`. The `App.handleShoppingOnline` guard is loosened from "requires `priceComparison`" to "requires non-empty list", since the entry screen already has chain data via `useLiveComparison` and the agent only needs `shoppingProducts` + a `storeName`.

**Tech Stack:** React + TypeScript, `react-dom` `createPortal`, Tailwind utility classes, custom translation system (`t('section.key')` + `isRTL`), `lucide-react` icons.

---

## Spec Reference

This plan implements **Increment 2** from `docs/superpowers/specs/2026-04-25-plan-buy-phase-separation-design.md` §10 #2 and §7.1. Increment 1 (terminology + CTA copy) shipped at commit `2eff54f`. Increment 3 (edge-case polish — below-min badge, list-edit freeze during agent runs, honest cancel copy) and Increment 4 (substitution confirm cards) get their own plan files when this one ships.

**Explicitly deferred** (do NOT include in this increment):
- Below-min-order warning badge → Increment 3.
- `BasketList` edit-freeze while agent runs → Increment 3.
- Substitution confirm cards in chat → Increment 4.
- Routes 2 (auto-split) and 3 (manual-split) → v2.
- Renaming internal identifiers (`BasketList`, `MobileBasketSheet`, etc.) → spec §11 deferred.

## File Structure

- **Create**: `components/BuyPhaseEntry.tsx` — new portal modal/sheet. Single component handles both desktop modal and mobile bottom-sheet via responsive Tailwind classes (mirrors the pattern in `MobileBasketSheet.tsx`).
- **Modify**: `constants/translations.ts` — add 5 keys × 2 languages = 10 new string entries under the `productBrowse` section.
- **Modify**: `components/ShoppingInputArea.tsx` — replace the direct `onCompare()` call inside `handleSendToPricePilot` with opening `BuyPhaseEntry`; add `onStartOnlineAgent` prop; render the new component at root.
- **Modify**: `App.tsx` — pass `onStartOnlineAgent={handleShoppingOnline}` to `ShoppingInputArea`; loosen `handleShoppingOnline`'s guard from `!priceComparison` to `shoppingProducts.length === 0`.
- **Modify**: `PROJECT_DOCUMENTATION.md` — append Session 2026-04-26 (cont.) entry; bump "Last Updated".

No agent/chat code is touched. `ShoppingPriceStep` and `handleShoppingCompare` remain in the codebase but become unreachable from the Plan-phase CTA in v1; cleaning them up is out of scope (and not a v1 goal per spec §11).

## Testing Strategy

This codebase has **no automated test runner configured** (verified by Increment 1's plan). Verification gate for this increment:

1. `npx tsc --noEmit` returns 0 errors.
2. `npm run dev` boots without compile or runtime errors.
3. Manual browser walkthrough of the full Plan → Buy entry → agent flow, in **both Hebrew and English**, on **both desktop and mobile** viewports.
4. Hard-refresh (Cmd+Shift+R) after dev-server reloads (per `CLAUDE.md` "Debugging Discipline" — service-worker cache).

---

## Tasks

### Task 1: Add translation keys

**Files:**
- Modify: `constants/translations.ts:248` (end of EN `productBrowse`) and `:532` (end of HE `productBrowse`).

The plan adds keys under the existing `productBrowse` section so they live with their siblings. Keys are appended just before the closing `}` of each `productBrowse` block — adjust the previous line's trailing comma accordingly.

- [ ] **Step 1: Add EN keys**

In `constants/translations.ts`, find the EN `productBrowse` block ending at line 248:

```ts
      mobileItemsCount: "🛒 {n} items"
    },
```

Replace with:

```ts
      mobileItemsCount: "🛒 {n} items",
      buyEntryTitle: "How to buy",
      buyEntrySubtitle: "Pick a store to send your list to",
      buyEntryBestBadge: "Best",
      buyEntryItemsMissing: "{n} missing",
      buyEntryDeliveryFee: "Delivery"
    },
```

- [ ] **Step 2: Add HE keys**

Find the HE `productBrowse` block ending at line 532:

```ts
      mobileItemsCount: "🛒 {n} פריטים"
    },
```

Replace with:

```ts
      mobileItemsCount: "🛒 {n} פריטים",
      buyEntryTitle: "איך לקנות",
      buyEntrySubtitle: "בחרו חנות לשליחת הרשימה",
      buyEntryBestBadge: "מומלץ",
      buyEntryItemsMissing: "{n} חסרים",
      buyEntryDeliveryFee: "משלוח"
    },
```

- [ ] **Step 3: Type-check passes**

Run: `npx tsc --noEmit`
Expected: 0 errors. The translation type is structural (`Translations` from `contexts/LanguageContext`), so adding keys doesn't break it as long as both EN and HE blocks include the same set.

---

### Task 2: Create `BuyPhaseEntry` component

**Files:**
- Create: `components/BuyPhaseEntry.tsx`

The component:
- Lives behind a `createPortal` to `document.body` (same pattern as `MobileBasketSheet` and `LiveBasketPanel`).
- Renders as a centered modal on `lg:` screens and a bottom-sheet on smaller viewports.
- Locks body scroll while open.
- Closes on backdrop click or Esc key.
- Renders one card per `ChainTotal`. Card click delegates to `onPickChain(chain)`.
- Uses chain branding helpers (`chainBadgeColor`, `chainAbbrev`) for the colored badge square.
- The first chain in the array gets a "Best" badge (chains arrive pre-sorted from `useLiveComparison`).
- Items count displayed as `matched/total` and a red `n missing` pill if `total > matched`.
- Delivery fee shown only when `chain.deliveryFee != null`.
- All copy via the new translation keys; layout flips for RTL automatically via `direction` and Tailwind `inset-inline-*` utilities.

- [ ] **Step 1: Write the component file**

Create `components/BuyPhaseEntry.tsx` with this exact content:

```tsx
// components/BuyPhaseEntry.tsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChainTotal } from '../hooks/useLiveComparison';
import { chainBadgeColor, chainAbbrev } from '../utils/chainBranding';

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
            aria-label="Close"
          >
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--paper-surface-alt)' }} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
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

            return (
              <button
                key={c.chain}
                type="button"
                onClick={() => onPickChain(c)}
                className="w-full p-3 rounded-xl flex items-center gap-3 text-start transition-all"
                style={{
                  background: 'var(--paper-surface-alt)',
                  border: isBest ? '2px solid var(--save)' : '1px solid var(--line)',
                }}
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
                  <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--ink-muted)' }}>
                    <span>
                      {c.matchedItems}/{totalItems}
                    </span>
                    {c.deliveryFee != null && (
                      <span>
                        🚚 {t('productBrowse.buyEntryDeliveryFee')} ₪{c.deliveryFee}
                      </span>
                    )}
                    {missing > 0 && (
                      <span
                        className="px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: 'rgba(215,53,45,0.12)', color: 'var(--accent)' }}
                      >
                        {t('productBrowse.buyEntryItemsMissing').replace('{n}', String(missing))}
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
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BuyPhaseEntry;
```

- [ ] **Step 2: Type-check passes**

Run: `npx tsc --noEmit`
Expected: 0 errors. The component imports `ChainTotal` (already exported from `useLiveComparison`), `chainBadgeColor`/`chainAbbrev` (already exported from `chainBranding`), and `useLanguage` (already exported from `LanguageContext`). All types resolve.

---

### Task 3: Wire `BuyPhaseEntry` into `ShoppingInputArea`

**Files:**
- Modify: `components/ShoppingInputArea.tsx:18-37` (props interface), `:39-58` (destructure), `:97-100` (CTA handler), `:71-72` (state), `:159-235` (render).

This task does four things in `ShoppingInputArea`:
1. Add a new prop `onStartOnlineAgent: (storeDisplayName: string) => void`.
2. Add a `buyPhaseOpen` state.
3. Replace `handleSendToPricePilot`'s body so it opens `BuyPhaseEntry` (instead of calling `onCompare()`).
4. Add a `handlePickChain` helper that closes the modal + delegates to `onStartOnlineAgent`.
5. Render `<BuyPhaseEntry .../>` at root alongside `MobileBasketSheet`.

The existing `onCompare` prop stays in the interface (still wired in App.tsx), but is no longer called from the CTA. Leaving it in place keeps the contract stable; cleaning up is out of scope.

- [ ] **Step 1: Add the import**

In `components/ShoppingInputArea.tsx`, add this import after line 14 (the `MobileBasketSheet` import):

```tsx
import BuyPhaseEntry from './BuyPhaseEntry';
```

- [ ] **Step 2: Add `onStartOnlineAgent` to the props interface**

In `components/ShoppingInputArea.tsx`, find the `ShoppingInputAreaProps` interface (line 18). After the `onShowSmartListChange?: (v: boolean) => void;` line, before the closing `}`:

Find:

```tsx
  showSmartList?: boolean;
  onShowSmartListChange?: (v: boolean) => void;
}
```

Replace with:

```tsx
  showSmartList?: boolean;
  onShowSmartListChange?: (v: boolean) => void;
  /** Called with the chain's display name (e.g. "רמי לוי") when the user
   *  picks a chain in the Buy phase entry screen. Routes to the agent. */
  onStartOnlineAgent: (storeDisplayName: string) => void;
}
```

- [ ] **Step 3: Destructure the new prop**

In the component signature (around line 39-58), add `onStartOnlineAgent` to the destructure list. Find:

```tsx
  showSmartList: externalShowSmartList,
  onShowSmartListChange,
}) => {
```

Replace with:

```tsx
  showSmartList: externalShowSmartList,
  onShowSmartListChange,
  onStartOnlineAgent,
}) => {
```

- [ ] **Step 4: Add `buyPhaseOpen` state**

After the existing `mobileSheetOpen` state (line 72), add:

Find:

```tsx
  const [selectedChainCode, setSelectedChainCode] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
```

Replace with:

```tsx
  const [selectedChainCode, setSelectedChainCode] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [buyPhaseOpen, setBuyPhaseOpen] = useState(false);
```

- [ ] **Step 5: Rewrite `handleSendToPricePilot`**

Replace lines 97-100:

```tsx
  const handleSendToPricePilot = () => {
    if (isLoading) return; // guard against double-submit while a comparison is in flight
    onCompare();
  };
```

With:

```tsx
  const handleSendToPricePilot = () => {
    if (isLoading) return;
    if (!liveCmp.data || liveCmp.data.chains.length === 0) return;
    setBuyPhaseOpen(true);
  };

  const handlePickChain = (chain: ChainTotal) => {
    setBuyPhaseOpen(false);
    onStartOnlineAgent(chain.displayName);
  };
```

The `ChainTotal` type is already imported on line 10 (`import { useLiveComparison, ChainTotal } from '../hooks/useLiveComparison';`).

- [ ] **Step 6: Render `BuyPhaseEntry` at root**

At the bottom of the JSX (after the `<MobileBasketSheet ... />` block, around line 233), add:

Find:

```tsx
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
```

Replace with:

```tsx
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
```

- [ ] **Step 7: Type-check passes**

Run: `npx tsc --noEmit`
Expected: 1 error in `App.tsx` because `ShoppingInputArea`'s new required prop `onStartOnlineAgent` isn't supplied yet. That's the next task. Confirm the error is exactly that and no others.

---

### Task 4: Wire `App.tsx` — pass the new prop and loosen the guard

**Files:**
- Modify: `App.tsx:848-871` (`handleShoppingOnline`), `:1112-1117` (`<ShoppingInputArea ... />` props).

Two edits:
1. Loosen `handleShoppingOnline`'s guard. Today it requires `priceComparison` (which is set by `handleShoppingCompare`). In the new flow, the entry screen already has chain data via `useLiveComparison`, so `priceComparison` may be null. The function only uses `shoppingProducts` internally, so we gate on that instead.
2. Pass `onStartOnlineAgent={handleShoppingOnline}` to `ShoppingInputArea`.

- [ ] **Step 1: Loosen the guard in `handleShoppingOnline`**

Find lines 848-851:

```tsx
  const handleShoppingOnline = (storeName?: string) => {
    if (!priceComparison) return;

    // Build temporary groups from DB products for the agent
```

Replace with:

```tsx
  const handleShoppingOnline = (storeName?: string) => {
    if (shoppingProducts.length === 0) return;

    // Build temporary groups from DB products for the agent
```

The rest of the function body stays untouched. `setLocalGroups`, `setOnlineStoreName`, and `setIsPriceAgentOpen` continue to do their existing work.

- [ ] **Step 2: Pass `onStartOnlineAgent` to `ShoppingInputArea`**

Find the `<ShoppingInputArea ... />` block around line 1112:

```tsx
                      <ShoppingInputArea
                        products={shoppingProducts}
                        onProductsChange={setShoppingProducts}
                        onCompare={handleShoppingCompare}
```

Add the new prop directly after `onCompare`:

```tsx
                      <ShoppingInputArea
                        products={shoppingProducts}
                        onProductsChange={setShoppingProducts}
                        onCompare={handleShoppingCompare}
                        onStartOnlineAgent={handleShoppingOnline}
```

`handleShoppingOnline` is already in scope (defined earlier in the same component). Its signature `(storeName?: string) => void` is structurally assignable to the new prop type `(storeDisplayName: string) => void` — TypeScript allows passing a stricter required argument to an optional parameter contravariantly. (If the type-check complains, see fallback in Step 4 below.)

- [ ] **Step 3: Type-check passes**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: If Step 3 reports a type mismatch on `onStartOnlineAgent`**

Some TS configs are strict about this contravariance. If the check complains, wrap the handler:

```tsx
                        onStartOnlineAgent={(storeDisplayName) => handleShoppingOnline(storeDisplayName)}
```

Re-run `npx tsc --noEmit`. Expected: 0 errors.

---

### Task 5: Manual visual verification

This task replaces unit tests for this codebase's untested-frontend reality. Cover both languages and both viewports.

- [ ] **Step 1: Boot the dev server**

Run: `npm run dev`
Expected: Vite dev server starts. No compile errors. No runtime warnings about missing translation keys (`buyEntryTitle`, etc.).

- [ ] **Step 2: Hard-refresh in browser, Hebrew, desktop**

Set the language to Hebrew. Hard-refresh (Cmd+Shift+R). Add at least 3 products to the basket so multiple chains have non-zero totals. Confirm:

- The `LiveBasketPanel` sidebar shows the "קנה את הרשימה" CTA (Increment 1 already shipped this).
- Click the CTA. **`BuyPhaseEntry` opens as a centered modal**, NOT navigating away from the catalog.
- Modal title reads "איך לקנות".
- Subtitle reads "בחרו חנות לשליחת הרשימה".
- Per-chain cards render: brand badge color square + abbrev, chain name, items count (e.g. "12/12"), delivery fee with 🚚 emoji and "משלוח" label (online mode only), big total price in shekels.
- The first card has a green "מומלץ" badge next to the chain name and a thicker green border.
- If a chain is short on items, a red "{n} חסרים" pill appears next to the items count.
- Esc closes the modal. Backdrop click closes the modal. The `X` button closes the modal.
- Click any chain card. Modal closes. **`PriceAgentChat` opens with that chain set as `storeName`** (verify by reading the chat header — agent says "בונה עגלה ב-{chain}" or similar).
- Walk through the agent flow at least to the "cart ready" state to confirm the agent runs identically to the pre-Increment-2 flow.

- [ ] **Step 3: Hebrew, mobile viewport**

Switch to mobile emulation (DevTools, iPhone preset). Hard-refresh. Same basket. Confirm:

- The `MobileBasketBar` is visible at the bottom. Tap it → `MobileBasketSheet` opens.
- Inside the mobile sheet, tap the "קנה את הרשימה" CTA.
- **`BuyPhaseEntry` slides up as a bottom-sheet** (not a centered modal). Drag handle visible at the top.
- Same card list, same badges, same close behavior.
- Tap a card → mobile sheet path closes its modal → `PriceAgentChat` opens.

- [ ] **Step 4: English, desktop**

Switch the language to English. Hard-refresh. Same basket. Confirm:

- CTA reads "Buy this list".
- Modal title reads "How to buy".
- Subtitle reads "Pick a store to send your list to".
- "Best" badge on the first card.
- Items count, "{n} missing" pill, "Delivery ₪{n}" label all in English.
- Tap a card → agent opens in English (existing translation logic in `agentService` continues to handle this).

- [ ] **Step 5: English, mobile**

Same as Step 3 but in English. Confirm strings + bottom-sheet rendering.

- [ ] **Step 6: Edge case — single deliverable chain**

If your basket + city has only one deliverable chain (e.g., set city to one with limited delivery coverage), confirm:

- `BuyPhaseEntry` shows exactly one card with a "Best" / "מומלץ" badge.
- Tapping it routes correctly.

- [ ] **Step 7: Edge case — RTL polish**

Hebrew mode. Confirm visually that:

- The close `X` is on the LEFT (since `inset-inline-end` flips in RTL).
- The drag handle stays centered.
- Brand badge is on the RIGHT of the card content (RTL flow).
- Total price is on the LEFT.
- No clipped text or overlapping elements.

If any visual regression appears, stop and add a follow-up step before committing.

---

### Task 6: Update `PROJECT_DOCUMENTATION.md`

Per `CLAUDE.md`: "update relevant docs BEFORE committing, not after."

**Files:**
- Modify: `PROJECT_DOCUMENTATION.md` — append a new session entry above the existing `**Last Updated**: April 26, 2026` block (which stays the same date — multiple sessions can land on the same day).

- [ ] **Step 1: Append the session entry**

Insert this block immediately above the existing `---\n\n**Last Updated**: April 26, 2026` line:

```markdown
## Session 2026-04-26 (cont.) — Increment 2: Buy phase entry screen

Implemented Increment 2 of the Plan/Buy phase separation spec (`docs/superpowers/specs/2026-04-25-plan-buy-phase-separation-design.md` §10 #2). Pure-UI: a new `BuyPhaseEntry` modal/sheet replaces the legacy CTA → `ShoppingPriceStep` → store-pick path. The "Buy this list" CTA now opens this entry screen, which lists per-chain cards backed by the existing `useLiveComparison` data (no extra fetch). Tapping a card hands `chain.displayName` to `App.handleShoppingOnline`, which opens `PriceAgentChat` exactly as before. Mobile renders as a bottom-sheet, desktop as a centered modal.

### Files changed
- `components/BuyPhaseEntry.tsx` — new component (~140 lines).
- `components/ShoppingInputArea.tsx` — new `onStartOnlineAgent` prop, `buyPhaseOpen` state, rewired CTA to open the modal instead of calling `onCompare()`.
- `App.tsx` — passes `onStartOnlineAgent={handleShoppingOnline}` to `ShoppingInputArea`; loosened `handleShoppingOnline`'s guard from `!priceComparison` to `shoppingProducts.length === 0` so the agent can launch directly from the entry screen without going through `handleShoppingCompare`.
- `constants/translations.ts` — added 5 new keys (`buyEntryTitle`, `buyEntrySubtitle`, `buyEntryBestBadge`, `buyEntryItemsMissing`, `buyEntryDeliveryFee`) in EN + HE under `productBrowse`.

### Not changed
- `PriceAgentChat`, `agentService`, the Python agent — untouched per agents-last sequencing.
- `ShoppingPriceStep` and `handleShoppingCompare` — kept in the codebase but unreachable from the Plan-phase CTA in v1. Cleanup deferred (spec §11).
- Below-min-order badge, list-edit freeze during agent runs, honest cancel copy — Increment 3 work.
- Substitution confirm cards — Increment 4 work.
```

The existing `**Last Updated**: April 26, 2026` line stays unchanged (same date).

---

### Task 7: Commit

- [ ] **Step 1: Stage the changes**

Run:

```bash
git add components/BuyPhaseEntry.tsx components/ShoppingInputArea.tsx App.tsx constants/translations.ts PROJECT_DOCUMENTATION.md docs/superpowers/plans/2026-04-26-increment-2-buy-phase-entry.md
```

- [ ] **Step 2: Verify staged diff**

Run: `git diff --cached --stat`
Expected: 6 files changed. `BuyPhaseEntry.tsx` is fully new (~140 lines added, 0 deleted). `ShoppingInputArea.tsx` shows ~20 insertions, ~3 deletions. `App.tsx` shows ~2 insertions, ~1 deletion. `translations.ts` shows ~10 insertions, ~2 deletions (the comma-rebalance on the previous line). `PROJECT_DOCUMENTATION.md` shows ~16 insertions, 0 deletions. The plan file shows ~500 insertions.

- [ ] **Step 3: Commit**

Run:

```bash
git commit -m "$(cat <<'EOF'
feat(ui): add Buy phase entry screen — chain-pick modal/sheet

Implements Increment 2 of the Plan/Buy phase separation spec (pure UI).
The "Buy this list" CTA now opens a new BuyPhaseEntry modal/sheet listing
per-chain cards (chain name, items count, delivery fee, total). Card tap
launches PriceAgentChat with that chain's displayName as storeName,
matching the existing agent flow exactly. Mobile = bottom-sheet, desktop
= centered modal. PriceAgentChat, agentService, and the Python agent are
untouched per agents-last sequencing.

App.handleShoppingOnline's guard loosened from !priceComparison to
shoppingProducts.length === 0, since BuyPhaseEntry already has chain
data via useLiveComparison and the agent only needs shoppingProducts +
storeName. ShoppingPriceStep and handleShoppingCompare remain in the
codebase but are unreachable from the Plan-phase CTA in v1; cleanup
deferred.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Confirm the commit landed**

Run: `git log --oneline -1`
Expected: shows the new commit at HEAD on the `main` branch.

---

### Task 8: Pause for user review before pushing

Per `feedback_subagent_workflow.md`: ship to main directly, but pause for explicit user review between increments. Do **not** auto-push to remote.

- [ ] **Step 1: Surface the change to the user**

Tell the user: "Increment 2 committed locally as `<short-sha>`. Please open `BuyPhaseEntry` end-to-end on the dev server (HE + EN, desktop + mobile) or review `git show HEAD`. Say 'push' to publish to main + Vercel, or call out anything to fix first."

- [ ] **Step 2: On user 'go', push**

Run:

```bash
git push origin main
```

Expected: push succeeds; Vercel auto-deploys; production URL (`lista-six-psi.vercel.app`) reflects the new entry screen after the deploy completes.

- [ ] **Step 3: Verify the deploy**

Open the production URL in an incognito window (avoids local cache). Tap "Buy this list" → confirm `BuyPhaseEntry` opens, contains per-chain cards, and tapping a card opens the agent. If anything mismatches, investigate before declaring done.

---

## Self-review checklist

- **Spec coverage:**
  - §7.1 entry screen (title, subtitle, per-chain cards, "Best" badge, items count, delivery fee, missing-items pill, mobile bottom-sheet + desktop centered modal) → Task 2 component code.
  - §7.2 Route 1 flow (CTA → entry → card click → `PriceAgentChat` with `storeName`) → Tasks 3 + 4 wiring.
  - §10 #2 ("Buy phase entry screen — pure UI, `PriceAgentChat` unchanged") → all tasks; verified by Task 5 Step 2 walkthrough.
  - Below-min badge → **explicitly deferred** to Increment 3 (spec §10 #3); not in this plan.
- **Placeholder scan:** no TBDs/TODOs. All edits use exact source/target strings or full code blocks.
- **Type consistency:**
  - `onStartOnlineAgent: (storeDisplayName: string) => void` declared in `ShoppingInputArea` props (Task 3 Step 2), passed from `App.tsx` (Task 4 Step 2). The wrapping arrow in Task 4 Step 4 is a fallback for strict TS configs.
  - `BuyPhaseEntryProps.onPickChain: (chain: ChainTotal) => void` consumed by Task 3's `handlePickChain` which extracts `chain.displayName` before delegating.
  - `ChainTotal` is the same type used everywhere (already exported from `useLiveComparison.ts`).
- **No-test reality:** verified by Increment 1's plan; Task 5 documents the manual gate.
- **Spec §11 boundary:** internal identifier renames (`BasketList`, `MobileBasketSheet`, `LiveBasketPanel`) untouched; `ShoppingPriceStep` not deleted, only orphaned.
- **Mobile parity:** Task 5 explicitly tests Hebrew + English on both desktop and mobile; component is single-source via responsive classes (Step 2 review point).

## What this increment intentionally does NOT do

- Doesn't delete `ShoppingPriceStep` or `handleShoppingCompare`. They become unreachable from the Plan-phase CTA but remain in the codebase. Cleanup is a future task and out of scope here.
- Doesn't add the below-minimum-order badge, the agent-run list-edit freeze, or the missing-item summary copy — all Increment 3 work.
- Doesn't modify `PriceAgentChat`, the substitution UX, `agentService`, or the Python agent. Those are Increment 4 / future work per the agents-last principle.
- Doesn't introduce Routes 2 or 3 (auto-split / manual-split). v2 territory.
- Doesn't change `useLiveComparison`, `computeBasketComparison`, or any data layer. The entry screen reads existing data only.
- Doesn't gate by `selectedShoppingMode` ("online" vs "physical"). Today's CTA is already mode-agnostic; preserving that is consistent and out of scope to change.
