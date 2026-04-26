# Increment 3a — Data-Derived Badges in BuyPhaseEntry: Design Spec

**Date**: 2026-04-26
**Owner**: Tomer (@tomerikoka)
**Status**: Brainstorm complete; ready for implementation plan
**Parent spec**: `docs/superpowers/specs/2026-04-25-plan-buy-phase-separation-design.md` §10 #3

---

## 1. Goal

Make the BuyPhaseEntry cards informative enough that users can judge a chain's viability before paying the agent's runtime cost. Specifically: surface (a) which items are missing at this chain, by name; and (b) whether the chain is below minimum order.

Increment 2 ships with chain-level summary only — total, item count, delivery fee, and a "1 חסרים" count badge. Post-deploy review confirmed the cards work but that the count alone forces users into the chat blind. This increment closes that gap on the data side.

## 2. Why this matters now

- Missing-item names is the user's flagged top priority following Increment 2 review (memory: `project_buy_phase_summary_priority.md`).
- Below-min-order detection is already specced (parent §10 #3, §7.4) and shares the same data-threading pathway as missing items — no point doing them separately.
- Both are pure-UI work; agent surface stays untouched per the agents-last principle.

## 3. v1 scope (3a)

### 3.1 What ships
- Two new fields on `ChainTotal`: `unmatchedItems: string[]` and `minimumOrder: number | null`. Plus `belowMinimum: boolean` derived in `toLiveComparison`.
- Source: existing `StorePriceSummary` from `compareListPrices` (already wired through `useLiveComparison`). No new API call, no backend change.
- BuyPhaseEntry cards gain:
  - An amber "מתחת למינימום" pill (matching `BasketStrategyPicker.tsx:118-125` styling) when `belowMinimum === true`.
  - A chevron icon at the end of the card.
  - Per-card local expand/collapse state.
  - On expand: a heading + comma-separated list of missing item names.
- Both the existing "{n} חסרים" pill **and** the new chevron toggle expansion. Tapping anywhere else on the card still picks the chain (existing behaviour).

### 3.2 What does NOT ship in 3a
- Edit-freeze of `BasketList` while the agent is running → Increment 3b.
- Honest cancel copy when the user closes the chat mid-flow → Increment 3b.
- Per-item prices / category / amount inside the expanded section → deferred (future increment, separately scoped).
- Renaming internal identifiers → still deferred per parent §11.
- Any change to `PriceAgentChat`, `agentService`, or the Python agent.

## 4. The design

### 4.1 Data layer

`hooks/useLiveComparison.ts`:

```ts
export interface ChainTotal {
  chain: string;
  displayName: string;
  total: number;
  totalWithDelivery?: number;
  deliveryFee?: number;
  matchedItems: number;
  // NEW
  unmatchedItems: string[];
  minimumOrder: number | null;
  belowMinimum: boolean;
}
```

`unmatchedItems` is sourced from `StorePriceSummary.unmatchedItems` (already present in the comparison response).
`minimumOrder` is sourced from `StorePriceSummary.minimumOrder`.
`belowMinimum` is derived in `toLiveComparison`:

```ts
const cost = (s.totalWithDelivery ?? s.totalCost);
const belowMinimum =
  s.minimumOrder != null && s.minimumOrder > 0 && cost < s.minimumOrder;
```

Cost-vs-min uses subtotal-with-delivery if available, matching how the chain itself enforces the minimum at checkout.

### 4.2 UI layer

`components/BuyPhaseEntry.tsx` per-card structure:

**Collapsed row** (one extra pill and one icon vs. Increment 2):
- Brand badge · chain name · "מומלץ" pill (if best)
- `matched/total` · `🚚 משלוח ₪X` (if delivery fee > 0)
- `{n} חסרים` red pill (existing — now tappable)
- `מתחת למינימום` amber pill (NEW — only when `belowMinimum`)
- Total price (whole + decimals as today)
- Chevron icon (NEW — rotates 180° when expanded)

**Expanded section** (revealed when the missing-pill OR chevron is tapped):
- Heading: `חסרים בחנות זו:` / `Missing at this store:`
- Comma-separated list of `unmatchedItems`, wrapping naturally
- If `unmatchedItems.length === 0`: do NOT render the missing-pill, the chevron, or the expanded section. The card is non-expandable and only acts as a chain picker. (This is the simpler implementation and matches the acceptance criteria in §8.)

Tap targets:
- Tap card body (anywhere except missing-pill or chevron) → calls `onPickChain(chain)` — picks the chain.
- Tap missing-pill → toggles expansion (does NOT pick the chain).
- Tap chevron → toggles expansion (does NOT pick the chain).
- Both pill and chevron should `e.stopPropagation()` to prevent the card-level click handler from firing.

### 4.3 Edge cases
| Case | Handling |
|---|---|
| `unmatchedItems` is empty | Don't render the missing pill (already today's behaviour); don't render the chevron either (cleaner). |
| `belowMinimum === true` with no `minimumOrder` | Cannot happen — `belowMinimum` derives from `minimumOrder != null`. Type system enforces. |
| Card pre-expanded after a list edit | Re-collapse on `chains` array reference change is unnecessary; per-card state stays as long as the modal is open. Closing the modal resets everything (component unmounts). |
| RTL layout | Chevron sits at logical-end of the card row. Use `inset-inline-end` Tailwind utility, no hardcoded `right`. Heading + names list flips naturally via the parent `direction: rtl`. |
| Mobile | Same expand mechanic; tap targets sized ≥ 32px for touch. |
| Many missing items (e.g., 20+) | Names wrap inside the expanded section. The collapsed row stays compact and scannable. |

### 4.4 Translation keys (added under `productBrowse`)

| Key | EN | HE |
|---|---|---|
| `buyEntryBelowMin` | "Below min order" | "מתחת למינימום" |
| `buyEntryMissingHeading` | "Missing at this store:" | "חסרים בחנות זו:" |

(`buyEntryItemsMissing` already exists from Increment 2 — reused for the count pill.)

## 5. Reuse vs. change vs. new

### 5.1 Keep as-is
| Component | Why it stays |
|---|---|
| `chainBranding`, `useLanguage`, portal pattern | All still apply unchanged. |
| `compareListPrices` API + `priceDbService` | Already returns `unmatchedItems` and `minimumOrder` per store. No backend change. |
| Card-body click → `onPickChain` | Existing CTA behaviour preserved. |

### 5.2 Reroute / repurpose
| Component | Change |
|---|---|
| `useLiveComparison.toLiveComparison` | Adds three fields to the `ChainTotal` it builds. |
| `BuyPhaseEntry` card render | Adds amber pill, chevron, expanded section, per-card expand state. |

### 5.3 New code
- Per-card expand state in `BuyPhaseEntry`. Likely a `useState<Record<string, boolean>>` keyed by `chain.chain` (canonical code), so each chain expands independently.
- A small `lucide-react` icon import for the chevron (`ChevronDown` rotated when expanded).

## 6. Implementation sequencing

This is one focused increment, but the work splits cleanly into two committable steps that each leave the build green:

1. **Data threading.** Add the three fields to `ChainTotal`, populate them in `toLiveComparison`. No UI consumer reads them yet; verification = `npx tsc --noEmit` passes and existing UI is unchanged. Optionally log them to confirm values.
2. **UI rendering.** Wire the new fields into `BuyPhaseEntry`: amber pill, chevron, expanded section, per-card state, stopPropagation. Add the two translation keys.

Both ship together as one commit (one increment, one PR/push), but the implementation plan can sequence them as Tasks 1 and 2 for clarity. Manual visual verification (Task 3) covers HE + EN × desktop + mobile per the project pattern.

## 7. Out of scope / non-goals

- Edit-freeze during agent runs and honest cancel copy → Increment 3b (separately specced when 3a ships).
- Per-item price / category / amount in the expanded section → future increment, separately scoped.
- Multi-store routes (auto-split, manual-split) → v2.
- Renaming internal identifiers → still deferred per parent §11.
- Any agent / `PriceAgentChat` / Python-agent change.

## 8. Acceptance criteria

A reviewer can validate this increment by clicking through the dev server and confirming, in **both Hebrew and English**, on **both desktop and mobile** viewports:

1. The `מתחת למינימום` amber pill appears on cards where the chain's `total + deliveryFee < minimumOrder`.
2. The chevron is visible at the end of every card that has at least one missing item.
3. Tapping the missing-pill expands the card to show item names; tapping again collapses.
4. Tapping the chevron does the same.
5. Tapping anywhere else on the card opens `PriceAgentChat` with that chain (Increment 2 behaviour preserved).
6. RTL layout: chevron is on the LEFT in Hebrew (logical-end flips); names list reads right-to-left.
7. Cards with `unmatchedItems.length === 0` show no chevron, no missing-pill, and the card is still picker-clickable.
