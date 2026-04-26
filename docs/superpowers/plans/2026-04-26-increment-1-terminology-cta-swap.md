# Increment 1: Terminology + CTA Swap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop "סל" / "basket" from user-visible copy and rename the "Send to PricePilot" CTA to "Buy this list" / "קנה את הרשימה". The CTA already opens `PriceAgentChat` with the currently-selected chain — preserving the working flow end-to-end. No new components, no agent changes.

**Architecture:** Pure-UI rename. Modify translation values (keys unchanged) and two hardcoded JSX strings in `BasketList` + `RightRail`. All consumers of the renamed values (`KPIHero`, `StoresStripV2`, `MobileBasketSheet`, `MobileBasketBar`, `LiveBasketPanel`, `BasketList`) automatically pick up the new copy.

**Tech Stack:** React + TypeScript, custom translation system in `contexts/LanguageContext` (used via `t('section.key')`).

---

## Spec Reference

This plan implements **Increment 1** from `docs/superpowers/specs/2026-04-25-plan-buy-phase-separation-design.md` §10. It is the first of 4 increments in the Plan/Buy phase separation. Subsequent increments (Buy phase entry screen, edge-case polish, substitution confirm cards) get their own plan files when their predecessors ship.

## File Structure

- **Modify**: `constants/translations.ts` — value-only updates to 12 strings (5 EN, 7 HE). Keys unchanged.
- **Modify**: `components/BasketList.tsx:80` — hardcoded basket-header text.
- **Modify**: `components/RightRail.tsx:117` — hardcoded sidebar nav-label text.

No new files. No internal identifier renames (deferred per spec §11). The translation key `sendToPricePilot` keeps its name even though its value becomes "Buy this list" — renaming that key would touch the agent-side and is out of scope for an "agents-last" increment (per `feedback_agents_touch_last.md`).

## Testing Strategy

This codebase has **no automated test runner configured** (verified via `package.json` scan — no `vitest`, `jest`, `playwright` present). Verification gate for this increment:

1. `npx tsc --noEmit` returns 0 errors.
2. `npm run dev` boots without runtime errors.
3. Manual browser walkthrough of every affected surface, in **both Hebrew and English**.
4. Visual confirmation that no "basket" / "סל" remains in any user-facing string within the affected screens.

Per `CLAUDE.md` "Debugging Discipline": account for browser/service-worker caching when verifying — do a hard refresh (Cmd+Shift+R) after the dev server hot-reloads.

---

## Tasks

### Task 1: English translation values

**Files:**
- Modify: `constants/translations.ts:231,240,241,242,246`

- [ ] **Step 1: Replace `promoBanner` (EN)**

In `constants/translations.ts`, replace the existing line 231:

```ts
      promoBanner: "Compare prices across all supermarkets — find the cheapest basket",
```

with:

```ts
      promoBanner: "Compare prices across all supermarkets — find the cheapest list",
```

- [ ] **Step 2: Replace `basketForYou` (EN)**

Replace line 240:

```ts
      basketForYou: "For your basket:",
```

with:

```ts
      basketForYou: "For your list:",
```

- [ ] **Step 3: Replace `bestPriceLabel` (EN)**

Replace line 241:

```ts
      bestPriceLabel: "Best price for your basket",
```

with:

```ts
      bestPriceLabel: "Best price for your list",
```

- [ ] **Step 4: Replace `sendToPricePilot` (EN) — the CTA**

Replace line 242:

```ts
      sendToPricePilot: "Send to PricePilot",
```

with:

```ts
      sendToPricePilot: "Buy this list",
```

- [ ] **Step 5: Replace `basketTotal` (EN)**

Replace line 246:

```ts
      basketTotal: "Basket total",
```

with:

```ts
      basketTotal: "List total",
```

- [ ] **Step 6: Type-check passes**

Run: `npx tsc --noEmit`
Expected: 0 errors. The `Translations` type in `contexts/LanguageContext` is structural — value changes don't break it.

---

### Task 2: Hebrew translation values

**Files:**
- Modify: `constants/translations.ts:290,291,515,524,525,526,530`

- [ ] **Step 1: Replace landing-page subtitle (HE)**

Replace line 290:

```ts
      subtitle: "השוו מחירים, חסכו כסף וקנו את סל הקניות הזול ביותר — הכל במקום אחד.",
```

with:

```ts
      subtitle: "השוו מחירים, חסכו כסף וקנו את הרשימה הזולה ביותר — הכל במקום אחד.",
```

- [ ] **Step 2: Replace landing-page highlight (HE)**

Replace line 291:

```ts
      highlight: "סל הקניות הזול ביותר",
```

with:

```ts
      highlight: "הרשימה הזולה ביותר",
```

- [ ] **Step 3: Replace `promoBanner` (HE)**

Replace line 515:

```ts
      promoBanner: "השוו מחירים בכל הסופרים — מצאו את סל הקניות הזול ביותר",
```

with:

```ts
      promoBanner: "השוו מחירים בכל הסופרים — מצאו את הרשימה הזולה ביותר",
```

- [ ] **Step 4: Replace `basketForYou` (HE)**

Replace line 524:

```ts
      basketForYou: "לסל שלך:",
```

with:

```ts
      basketForYou: "לרשימה שלך:",
```

- [ ] **Step 5: Replace `bestPriceLabel` (HE)**

Replace line 525:

```ts
      bestPriceLabel: "המחיר הכי טוב לסל שלך",
```

with:

```ts
      bestPriceLabel: "המחיר הכי טוב לרשימה שלך",
```

- [ ] **Step 6: Replace `sendToPricePilot` (HE) — the CTA**

Replace line 526:

```ts
      sendToPricePilot: "שליחה ל-PricePilot",
```

with:

```ts
      sendToPricePilot: "קנה את הרשימה",
```

- [ ] **Step 7: Replace `basketTotal` (HE)**

Replace line 530:

```ts
      basketTotal: "סה״כ סל",
```

with:

```ts
      basketTotal: "סה״כ רשימה",
```

- [ ] **Step 8: Type-check passes**

Run: `npx tsc --noEmit`
Expected: 0 errors.

---

### Task 3: BasketList header hardcoded text

**Files:**
- Modify: `components/BasketList.tsx:80`

- [ ] **Step 1: Replace the hardcoded header**

In `components/BasketList.tsx`, line 80:

```tsx
            {isRTL ? 'הסל שלי' : 'My basket'}
```

Replace with:

```tsx
            {isRTL ? 'הרשימה שלי' : 'My List'}
```

Rationale: locked terminology per spec §9. "My List" with capital L matches the user-visible English term.

- [ ] **Step 2: Type-check passes**

Run: `npx tsc --noEmit`
Expected: 0 errors.

---

### Task 4: RightRail sidebar nav label

**Files:**
- Modify: `components/RightRail.tsx:117`

- [ ] **Step 1: Replace the nav-item label**

In `components/RightRail.tsx`, line 117:

```tsx
    { id: 'basket',     label: isRTL ? 'הסל'     : 'Basket',      Icon: ShoppingBasket, badge: cartItemCount || undefined },
```

Replace with:

```tsx
    { id: 'basket',     label: isRTL ? 'הרשימה'  : 'List',        Icon: ShoppingBasket, badge: cartItemCount || undefined },
```

Rationale: only the visible `label` changes. `id: 'basket'` is an internal identifier and stays per spec §11. The `ShoppingBasket` icon stays (the basket icon is universally understood as "shopping cart" symbology and isn't user-confusing).

- [ ] **Step 2: Type-check passes**

Run: `npx tsc --noEmit`
Expected: 0 errors.

---

### Task 5: Manual visual verification

This task replaces unit tests for this codebase's untested-frontend reality. The verification surface is small but multi-language.

- [ ] **Step 1: Boot the dev server**

Run: `npm run dev`
Expected: Vite dev server starts, no compile errors, no runtime warnings about missing translation keys.

- [ ] **Step 2: Hard-refresh in browser (HE)**

Open the app, set language to Hebrew, hard-refresh (Cmd+Shift+R). Confirm:

- Landing page subtitle reads "...הרשימה הזולה ביותר..." (no "סל הקניות").
- Landing page highlight reads "הרשימה הזולה ביותר".
- Promo banner under search reads "...מצאו את הרשימה הזולה ביותר" (no "סל הקניות").
- Add at least one product to the basket. Open the desktop `LiveBasketPanel`. Confirm:
  - Header reads "הרשימה שלי" (BasketList).
  - `KPIHero` eyebrow label reads "המחיר הכי טוב לרשימה שלך" (no "לסל שלך").
  - Footer total label reads "סה״כ רשימה" (no "סה״כ סל").
  - **CTA button reads "קנה את הרשימה"** (no "שליחה ל-PricePilot"). The Sparkles icon stays.
- `StoresStripV2` reads "לרשימה שלך:" (no "לסל שלך").
- Sidebar (RightRail) shows nav item "הרשימה" (no "הסל").
- Click the CTA. Confirm `PriceAgentChat` opens with the same flow as before.

- [ ] **Step 3: Switch to English, repeat (EN)**

Set language to English, hard-refresh. Confirm:

- Landing page subtitle has no "basket" reference.
- Promo banner under search reads "...find the cheapest list" (no "basket").
- `LiveBasketPanel` header reads "My List".
- `KPIHero` eyebrow reads "Best price for your list".
- Footer reads "List total".
- **CTA button reads "Buy this list"**.
- `StoresStripV2` reads "For your list:".
- Sidebar shows "List".
- Clicking the CTA opens the same `PriceAgentChat` flow.

- [ ] **Step 4: Mobile parity check**

Open the same app on a phone viewport (or DevTools mobile emulation). Verify:
- `MobileBasketBar` and `MobileBasketSheet` render the new strings consistently (they reuse `BasketList` and the same translation keys, so they should pick up automatically — but confirm).
- The new CTA in the mobile sheet reads "קנה את הרשימה" / "Buy this list".

If any surface still shows "basket" / "סל" / "Send to PricePilot", stop and add a follow-up task before committing.

---

### Task 6: Update PROJECT_DOCUMENTATION.md

Per `CLAUDE.md`: "update relevant docs BEFORE committing, not after."

**Files:**
- Modify: `PROJECT_DOCUMENTATION.md` — append a new session entry above the `**Last Updated**` block.

- [ ] **Step 1: Append session entry**

Insert this block immediately above the existing `---\n\n**Last Updated**: April 25, 2026` line (which becomes April 26, 2026):

```markdown
## Session 2026-04-26 — Increment 1: terminology + CTA swap

Implemented Increment 1 of the Plan/Buy phase separation spec (`docs/superpowers/specs/2026-04-25-plan-buy-phase-separation-design.md`). Pure-UI: dropped "סל" / "basket" from user-visible copy, renamed the primary CTA from "Send to PricePilot" / "שליחה ל-PricePilot" to "Buy this list" / "קנה את הרשימה". The CTA already opens `PriceAgentChat` with the currently-selected chain, so the working flow is unchanged.

### Files changed
- `constants/translations.ts` — 12 string-value swaps (5 EN, 7 HE). Keys unchanged.
- `components/BasketList.tsx:80` — hardcoded "My basket" / "הסל שלי" → "My List" / "הרשימה שלי".
- `components/RightRail.tsx:117` — sidebar nav label "Basket" / "הסל" → "List" / "הרשימה".

### Not changed
- Translation key `sendToPricePilot` retained (renaming the key would also touch agent-side strings; deferred per spec §11 and `feedback_agents_touch_last.md`).
- `BasketList` / `LiveBasketPanel` / `MobileBasketSheet` component names unchanged (spec §11 defers these to a later cleanup pass).
- `PriceAgentChat`, agent server, extension — untouched.
```

Also bump the existing `**Last Updated**: April 25, 2026` to `**Last Updated**: April 26, 2026`.

---

### Task 7: Commit

- [ ] **Step 1: Stage the changes**

Run:

```bash
git add constants/translations.ts components/BasketList.tsx components/RightRail.tsx PROJECT_DOCUMENTATION.md
```

- [ ] **Step 2: Verify staged diff**

Run: `git diff --cached --stat`
Expected: 4 files changed, ~30-40 insertions, ~15-20 deletions (rough; PROJECT_DOCUMENTATION.md adds the session block).

- [ ] **Step 3: Commit**

Run:

```bash
git commit -m "$(cat <<'EOF'
feat(ui): rename "basket" → "list" and CTA → "Buy this list"

Implements Increment 1 of the Plan/Buy phase separation spec (pure UI).
Drops "סל" / "basket" from user-visible copy across translations and the
two remaining hardcoded JSX strings (BasketList header, RightRail sidebar
label). Primary CTA renamed from "Send to PricePilot" to "Buy this list"
/ "קנה את הרשימה". No agent or chat changes; translation key sendToPricePilot
retained per agents-last sequencing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Confirm commit landed**

Run: `git log --oneline -1`
Expected: shows the new commit at HEAD on the `main` branch.

---

### Task 8: Pause for user review before pushing

Per `feedback_subagent_workflow.md`: ship to main directly, but pause for explicit user review between tasks/increments. Do **not** auto-push to remote.

- [ ] **Step 1: Surface the change to the user**

Tell the user: "Increment 1 committed locally as `<short-sha>`. Please review the diff (`git show HEAD`) or pull up the dev server. Say 'push' to publish to main + Vercel, or call out anything to fix first."

- [ ] **Step 2: On user 'go', push**

Run:

```bash
git push origin main
```

Expected: push succeeds; Vercel auto-deploys; production URL (`lista-six-psi.vercel.app`) reflects the new copy after the deploy completes.

- [ ] **Step 3: Verify deploy**

Open the production URL in an incognito window (avoids local cache). Confirm at least one HE and one EN string changed (e.g., the CTA reads "קנה את הרשימה" / "Buy this list"). If anything mismatches, investigate before declaring done.

---

## Self-review checklist (already run by spec author)

- **Spec coverage:** Increment 1 in spec §10 #1 covers terminology rename + CTA copy swap → addressed in Tasks 1–4.
- **Placeholder scan:** No TBDs/TODOs. All edits use exact source/target strings.
- **Type consistency:** No new types or function signatures introduced. Only string-value swaps and hardcoded JSX text replacements.
- **No-test reality:** Verified `package.json` has no test runner. Manual gate documented in Task 5.
- **Spec §11 boundary:** Internal identifier renames (component names, key names) explicitly held back. Only user-visible strings touched.

## What this increment intentionally does NOT do

- Doesn't touch `PriceAgentChat` or `agentService` — agent-touching work is held until Increment 4 per spec sequencing.
- Doesn't add new translation keys (`buyThisList`, `myList`, etc.). Increment 2 (Buy phase entry) will introduce keys for new screens; v1 reuses existing keys with new values.
- Doesn't rename `BasketList`, `LiveBasketPanel`, `MobileBasketSheet`, `MobileBasketBar`, or any other component file. Internal renames are spec §11 deferred.
- Doesn't change the icon in the CTA button (Sparkles stays). Icon polish can ship in Increment 2 alongside the Buy phase entry redesign.
