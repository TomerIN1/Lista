# Live Summary + Persistent Basket — Design Spec

**Date**: 2026-04-21
**Owner**: Tomer (@tomerikoka)
**Status**: Brainstorm complete; ready for implementation plan

---

## 1. Goal

Make the **cross-chain price comparison** — Lista's core differentiator — *always visible* during the shopping flow, while preserving the **basket items** as a permanent panel (the convention every online supermarket follows). Today the basket lives behind a click and the comparison only surfaces on the comparison results screen. After this work, both are first-class citizens of the shopping layout.

## 2. Layout (Desktop, ≥ lg breakpoint)

Three vertical regions left → right (RTL inline-end → inline-start):

1. **Left panel — `LiveBasketPanel`** (~300px, fixed inline-end). New component. Two stacked sections:
    1. **`KPIHero`** — Cheapest-chain summary card.
    2. **`BasketList`** — Scrollable basket items with quantity controls and a sticky total footer.
2. **Center — Catalog** (existing `ProductCatalogArea`). Unchanged.
3. **Right rail — `RightRail`** (existing, 280px). Unchanged.

A horizontal **`StoresStrip`** sits below the header spanning the full content width (catalog + left panel together). It already exists today as `חנויות אונליין זמינות באזורך`; it gets *upgraded* (see §3).

A **💡 tip row** sits between the KPI hero and the basket list. Independent content (the tip refers to a different chain than the KPI's hero chain), so it's a separate row, not nested in the KPI card.

### Layout offsets

- Catalog content padding switches from `lg:ps-[280px]` (RightRail only) to `lg:ps-[280px] lg:pe-[300px]` (RightRail + LiveBasketPanel). Logical-property-only — no `pl-*` / `pr-*`.

## 3. The `StoresStrip` — repurposed

**Today**: each chip shows `{chain logo} משלוח ₪29.9` — passive availability indicator.

**After**: each chip shows `{chain name} {cart total ₪} {shipping ₪}`. Cheapest chip is filled green (`var(--save)`), prefixed with ⭐, and elevated with a subtle shadow. Other chips use `var(--save-bg)` (soft green) text on `var(--paper-surface-alt)`.

**Interaction**: clicking any non-best chip *only switches the KPI view* in the left panel — it does NOT re-price the catalog or change basket prices. (Per user direction: passive comparison.) Cheapest is the default-selected chip.

**Order**: chips ranked cheapest-first, RTL → cheapest is on the right edge (first visible).

**Empty/loading states**:
- 0 chains available in user's area: hide the strip entirely.
- Cart is empty: show chips with `—` for total (`{chain} ₪— {shipping}`), best-chip highlight is suppressed.
- Loading: render skeleton chips.

## 4. The `KPIHero` card

Top of `LiveBasketPanel`. Driven by the *currently selected chain chip* (default = cheapest). Contents top → bottom:

- Eyebrow label `המחיר הכי טוב לסל שלך` (uppercase, `var(--ink-soft)`, letter-spacing `0.06em`).
- Chain badge (42px square, chain brand color) + chain display name in Instrument Serif 22px.
- Big price in Instrument Serif 38px. Format: integer in serif, decimals + ₪ in 14px gray (`var(--ink-muted)`).
- Pills row (wrap): `N פריטים במבצע` (neutral pill, only if N > 0); `↗ חיסכון ₪X` (`var(--save-bg)` + `var(--save)`, only if savings > 0 vs the chain *not currently selected* — i.e., the next-cheapest if best is selected, the cheapest if any other chain is selected).
- CTA button `✦ שליחה ל-PricePilot` — accent fill, full width, `box-shadow: 0 1px 3px rgba(215,53,45,0.25)`.

**Empty cart state**: hide the price + pills + CTA. Show `הוסיפו פריטים כדי להשוות מחירים` in `var(--ink-muted)`.

## 5. The 💡 Tip row

Between KPI and basket list. Background `#FFF8E6`, border `#F2E1B4`, 9–10px text in `var(--ink-muted)`.

**v1 scope**: render the row as static markup with placeholder copy *only when* tip data is available from the API. **The data does not exist yet.** v1 ships with the row absent; v2 wires the delivery-threshold lookup. Mark this clearly in the implementation plan as a v2 follow-up.

## 6. The `BasketList`

Below the tip row. Sub-components:

- **Header**: `הסל שלי` (Instrument Serif 14px) + item count (`var(--ink-soft)`), `var(--paper-surface-alt)` background, separator below.
- **Scrollable list**: each row = thumbnail (30×30, paper-alt placeholder) + name/meta + qty stepper + line price. `border-bottom: 1px solid var(--line)` between rows.
- **Footer (sticky)**: `סה״כ סל` label + total in Instrument Serif 14px. `var(--paper-surface-alt)` background.

**Quantity stepper**: `−` / count / `+`. Each ± button 18×18, `var(--paper-surface-alt)` background. Calls existing `onUpdateProduct(barcode, { amount })` handler from `ShoppingInputArea`. `−` at qty 1 removes the item.

**Empty cart state**: replace the list with a centered placeholder — small basket icon + `התחל לקנות!` (`var(--ink-soft)`).

## 7. Layout (Mobile, < lg breakpoint)

Catalog gets the full screen. The Live Summary collapses into a **sticky bottom bar** that opens a **bottom sheet** on tap.

- **Header** + **`StoresStrip`** (horizontal scroll, `overflow-x: auto`, hidden scrollbar) + **CategoryNavBar** stay at the top, in that order.
- **Catalog** fills the rest, with `padding-bottom` reserved for the bottom bar (~80px) so the last row isn't covered.
- **Sticky bottom bar** (`position: fixed; bottom: 0; left: 0; right: 0`):
    - Background `var(--ink)` (high contrast against the warm paper).
    - Left side: small uppercase label `הכי זול` + chain badge chip + Instrument Serif 20px price.
    - Right side: red accent pill `🛒 N פריטים` + ▲ chevron.
    - Tap anywhere on the bar opens the sheet.
- **Bottom sheet** (`position: fixed`, `border-radius: 20px 20px 0 0`, `max-height: 88vh`, drag-handle on top):
    - Vertical stack: `KPIHero` → tip row (when present) → `BasketList` header + items → `KPI CTA` re-anchored at the very bottom inside the sheet (or absent if cart is empty).
    - Drag-down or backdrop tap dismisses.

**Why this pattern**: matches the universal mobile-grocery convention (Instacart, Wolt, Shufersal app, Rami Levy app). Catalog is the work area — keep it un-cluttered; surface the *one* number that proves value (cheapest total) in a sticky element; one tap reveals the rest.

## 8. Components — file structure

New files:
- `components/LiveBasketPanel.tsx` — desktop left panel container; renders `KPIHero` + tip + `BasketList`.
- `components/KPIHero.tsx` — the hero card.
- `components/BasketList.tsx` — list + header + footer total.
- `components/StoresStripV2.tsx` — upgraded version of the existing strip. (See §11.)
- `components/MobileBasketBar.tsx` — sticky bottom bar.
- `components/MobileBasketSheet.tsx` — bottom sheet shell that hosts the same `KPIHero` + `BasketList` components.

Edited files:
- `components/ShoppingInputArea.tsx` — wire `LiveBasketPanel` (desktop) and `MobileBasketBar` + `MobileBasketSheet` (mobile) into the existing layout. Replace the current cart UI in this file.
- `components/ProductCatalogArea.tsx` — adjust outer padding to `lg:ps-[280px] lg:pe-[300px]`.
- `App.tsx` — add `mobileBasketOpen` state.

## 9. Data — what each component needs

| Component | Inputs | Source |
|---|---|---|
| `StoresStripV2` | `availableChains: { chain, name, shipping }[]`, `cartTotalsByChain: Record<chain, number>`, `selectedChain: string`, `onSelectChain(chain)` | `availableChains` from `deliveryCheck.chains`; `cartTotalsByChain` from a new selector that sums basket prices per chain (uses existing per-chain price data on each `ShoppingProduct`). |
| `KPIHero` | `chain` (the currently selected one), `chainName`, `chainBadgeColor`, `total`, `promoCount`, `savingsVsNext` | Computed from same selector + the strip's `selectedChain`. |
| `BasketList` | `products: ShoppingProduct[]`, `onUpdate`, `onRemove` | Existing — just lifted into the new component. |
| Tip row | `tip: string \| null` | **v2** — set to `null` in v1. |

A new helper `selectors/basketTotals.ts` (or co-located in `utils/`) computes `cartTotalsByChain` once and memoizes — used by both the strip and the KPI hero.

## 10. RTL / LTR

- All padding/margin uses logical properties (`ps-*`, `pe-*`, `border-inline-*`).
- `LiveBasketPanel` sits on the inline-end of the catalog. `RightRail` sits on the inline-start of the catalog. (RTL: `RightRail` on the right, `LiveBasketPanel` on the left.)
- Mobile sheet slides up from the bottom — direction-agnostic.
- Strip chips are rendered cheapest-first in DOM order. RTL reverses visually so cheapest lands on the right edge — that's the desired result; no special handling needed.

## 11. Migration from the existing strip

The current strip in `ShoppingInputArea.tsx` (the one in the screenshot showing `חנויות אונליין זמינות באזורך · רמי לוי משלוח 29.9₪ …`) is replaced *in place* by `StoresStripV2`. The label changes to `🏪 לסל שלך:` since the chips now describe the cart, not just availability.

The previous "compare" results screen and the floating `BasketBreakdownView` modal stay untouched in this v1 — they're orthogonal flows. We may simplify them in a follow-up once `LiveBasketPanel` proves out.

## 12. Out of scope (v1)

- **Delivery-threshold tip data** — UI is designed but row stays hidden until the API/data lookup ships. v2.
- Re-pricing the catalog grid based on the selected chain (KPI switcher only). Future consideration.
- Click-and-collect-only chains being treated differently from delivers chains in the strip — current `effectiveChains` filter logic already handles this; no changes needed.
- Per-chain savings analysis beyond "vs next-cheapest" / "vs cheapest". v2.

## 13. Standing rules honored

- **Mobile parity**: desktop and mobile both shipping in the same pass.
- **Paper tokens**: no hardcoded hex values; everything reads from `var(--…)`.
- **No pure black**: the only `var(--ink)` fill outside text is the mobile bottom bar, which is intentional contrast against the paper canvas.
- **Logical-side spacing only**: no `pl-*` / `pr-*`.

---

**Next step**: implementation plan via `writing-plans` skill.
