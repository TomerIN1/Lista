# Lista Design System — "Paper"

The Paper visual language powers Lista 2.0. It is warm, editorial, and grocery-native: butcher-paper background, serif pricing, tomato accent for actions, signal-green for savings. This doc is the source of truth for tokens, components, and patterns.

> Edit this file whenever a token changes or a new shared pattern ships. Keep it shorter than the app. Don't document one-off component internals — document the rules that apply across the app.

---

## 1. Design Tokens

All tokens live as CSS custom properties in `index.html` under `:root`. Components read them via `var(--token)` — **do not hardcode hex values in components**.

### Color

| Token | Value | Usage |
|---|---|---|
| `--paper-bg` | `#F5F1E8` | App canvas. Warm butcher-paper. |
| `--paper-surface` | `#FFFEFB` | Cards, modals, pills, rail, header — the "raised" paper. |
| `--paper-surface-alt` | `#EFEADD` | Recessed surfaces: search input, hover, inactive toggle track. |
| `--ink` | `#1A1A17` | Primary text. Also used as CTA background (dark chip). |
| `--ink-muted` | `#6B655A` | Secondary text, inactive pill text/icons, borders for active pills. |
| `--ink-soft` | `#9E978A` | Tertiary / helper / placeholder text. |
| `--accent` | `#D7352D` | **Tomato.** CTAs, hover icons, AI button gradient start, highlight. |
| `--accent-ink` | `#FFFFFF` | Text/icon on accent backgrounds. |
| `--save` | `#2F6B3C` | **Signal green.** Savings, physical-shopping section, "shopping" mode. |
| `--save-bg` | `#E3EEE1` | Soft green pill / badge backgrounds. |
| `--line` | `rgba(26,26,23,0.09)` | Default hairline border. RTL-safe. |
| `--font-serif` | `'Instrument Serif', Georgia, serif` | Editorial display + pricing (LTR). |
| `--font-mono` | `'JetBrains Mono', …` | Tabular numbers, codes. |

### Semantic section colors (RightRail)

Declared in `components/RightRail.tsx` as `SECTION_COLORS`. Keep in sync if moved.

| Section | Color | Meaning |
|---|---|---|
| Online shopping (קניה אונליין) | `#D7352D` (tomato) | Active buying / checkout — uses `--accent`. |
| Physical shopping (ארגון קנייה פיזית) | `#2F6B3C` (signal green) | In-person / grocery run — uses `--save`. |
| Recipes (מתכונים) | `#E88B3C` (warm amber) | Food / discovery. |

### Surfaces & elevation

- Default card/pill: `background: var(--paper-surface); border: 1px solid var(--line);`
- Active/selected pill: same surface, **2px `var(--ink-muted)` border** + `box-shadow: 0 2px 6px rgba(0,0,0,0.06)`.
- Soft hover on pill: `background: var(--paper-surface-alt)`.
- Drop-shadow modals/dropdowns: `shadow-lg` (Tailwind) + `border-b var(--line)` for attachment to header.

**Never use pure black (`#000`) as a fill color.** Use `var(--ink)`. Solid black was too visually heavy — we softened to ink + hairline (see April 2026 session log).

---

## 2. Typography

- **Body (LTR)**: Inter.
- **Body (RTL / Hebrew)**: Heebo with Rubik fallback. Font-family switch happens via `html[dir="rtl"] body` rule in `index.html`.
- **Headings + display**: Instrument Serif (LTR) — applied to `h1-h4` and `.font-display`. In RTL, headings fall back to Heebo (Hebrew doesn't do serif well in this family).
- **Tabular numbers / codes**: JetBrains Mono via `var(--font-mono)`.

Rules:
- Editorial slogans and big prices should use `var(--font-serif)` in LTR. In RTL, the serif stack falls back automatically to Heebo.
- `letter-spacing: -0.01em` is applied to all h1–h4 globally — don't re-declare it per component.
- For multi-line pill labels use `line-clamp-2` + `word-break: break-word` + `leading-[1.15]` (see CategoryNavBar).

---

## 3. Layout & Direction

The app is **Hebrew-first**. Default assumption: `dir="rtl"`.

- Use **logical properties** (`ps-*`, `pe-*`, `ms-*`, `me-*`, `start-*`, `end-*`) not `pl-*`/`pr-*` except when you explicitly want a physical side.
- The RightRail is pinned to the **inline-start** of the shopping layout. In RTL that's the right edge; in LTR it's the left edge — Tailwind `start-0` handles it.
- Main content offsets the rail with `lg:ps-[280px]` (padding-inline-start) — never `pe-*`.
- Drawer slide-in direction: on RTL close use `translate-x-full`; on LTR close use `-translate-x-full`. The `isRTL` boolean from `useLanguage()` picks the right class.
- Icons inside RTL-reversed labels (chevron "View all" etc.) should flip via character swap (`→` vs `←`), not via CSS `transform`.

---

## 4. Core Component Patterns

### 4.1 Header (shopping mode) — `components/Header.tsx`

Slim, two-row-free. Contents:
1. Mobile menu hamburger (visible `< lg`) — opens RightRail drawer.
2. **Smart AI button** — tomato→amber gradient (`#D7352D → #E88B3C`), white text, Sparkles icon, bold, `rounded-full`, `shadow-sm`, hover lifts. Placed before the search so it lands on the RTL start/right.
3. Search input in a paper-alt rounded pill.

Do **not** add location badges, user avatars, or cart counters back to the header. Those belong in the RightRail (location → profile modal, cart → catalog view, user → rail bottom).

### 4.2 CategoryNavBar — `components/CategoryNavBar.tsx`

Horizontal scroller of 100–120px-wide pills. Each pill is `flex-col` with icon + label.

Icon treatment: **CSS mask + background-color** (so a single-color SVG can be tinted to any token).

```ts
const iconStyle = (src, color, size = 56) => ({
  width: size, height: size,
  backgroundColor: color,
  WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`,
  WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',   maskPosition: 'center',
  WebkitMaskSize: 'contain',      maskSize: 'contain',
  transition: 'background-color 150ms',
});
```

Color rules:
- Idle → `var(--ink-muted)`
- Hover → `var(--accent)`
- Active → `var(--ink)` + pill gets 2px `var(--ink-muted)` border + soft shadow.

Icon source — two folders, mapping lives in `getCategoryIconSrc(name)` (`components/ProductCatalogArea.tsx`):
- **Primary**: `/public/listaicons/` — line-art SVG bundle (mixed `en_he` filenames). Mapped via `LISTA_ICON_MAP` (20 categories covered today).
- **Fallback**: `/public/category-icons/` — the original set, filename === Hebrew category name. Used when `LISTA_ICON_MAP` has no entry (`אחר ולא מסווג`, `הכל`, `טבק ועישון`, …).
- The new SVGs ship with two strokes (indigo + gray); CSS-mask collapses them to a single tint, which is the intended Paper behavior. Don't try to preserve the original colors.

Hover reveals a **full-width mega-menu dropdown** below the bar (`position: absolute; start-0; end-0; top-full`) with subcategory + sub-subcategory navigation.

### 4.3 RightRail — `components/RightRail.tsx`

Fixed rail on the inline-start side. `width: 280px` desktop (`lg+`). On mobile it's a slide-in drawer toggled from the header hamburger. RTL/LTR-aware slide direction.

Vertical order:
1. **Brand block** — Lista logo (click → catalog) + "PRICEPILOT" tagline.
2. **Primary nav** — catalog / basket / comparison / orders.
3. **Physical-organizing CTA** — "ארגון קנייה פיזית".
4. **Three collapsible list sections** (see `SECTION_COLORS`): online → physical → recipes.
   - `SectionHeader` with colored dot + label + count + chevron toggle.
   - `AddButton` for "new list / new recipe" **sits above** the list items, not below them.
   - `ListCard` per item: name (inline rename), item count, privacy chip (shared/private), View / Use / Delete actions.
5. **User card** at the bottom — click opens `ProfileModal`. If no user, show a Login button.

Collapsing defaults:
- Online: open.
- Physical: collapsed.
- Recipes: collapsed.

### 4.4 ProfileModal — `components/ProfileModal.tsx`

Three sections:
1. **Identity** — read-only name / email / avatar from Firebase Auth.
2. **Delivery address** — editable city (required) + street + apartment.
3. **Language** — he/en toggle (writes to `LanguageContext` + Firestore profile).

Persists to `users/{uid}` in Firestore. Uses `stripUndefined` helper in `services/firestoreService.ts` because Firestore rejects `undefined` field values. Always build the `location` object **only from defined keys** before calling `saveUserProfile`.

### 4.5 Product Catalog Area — `components/ProductCatalogArea.tsx`

- No inline search bar — search lives only in the Header. Sort + filter controls stay right-aligned.
- Editorial slogan at the top uses Instrument Serif 22px with a tomato "eyebrow" label above.
- Product cards: paper surface, serif price, `-X%` tomato pill for promos, green `"חיסכון ₪X"` for savings.

---

## 5. Firestore Shape

New in this design wave: a `users/{uid}` document stores cross-device profile.

```ts
// types.ts — UserSettings
{
  uid, displayName, email, photoURL,
  city, location: { city, streetName?, address?, cityCode? },
  shoppingMode,          // 'online' | 'physical'
  language,              // 'he' | 'en'
  createdAt, updatedAt,
}
```

Rules (`firestore.rules`):

```
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

`saveUserProfile` in `services/firestoreService.ts` recursively strips `undefined` before the merge-write. Re-use it — don't call `setDoc` with raw objects that may contain `undefined`.

---

## 6. Mobile Parity — Standing Rule

**Every design change must ship for mobile in the same pass.** If you introduce a new panel/rail/modal, add the mobile variant (drawer, full-screen sheet, stacked layout) before declaring the task done. This is enforced in agent memory (`feedback_mobile_parity.md`).

Typical patterns:
- Desktop fixed rail ↔ mobile slide-in drawer (hamburger trigger in header).
- Desktop hover mega-menu ↔ mobile tap-to-expand accordion.
- Always test both breakpoints in the browser before reporting complete.

---

## 7. What NOT To Do

- Don't re-introduce pure black (`#000`) fills. Use `var(--ink)`.
- Don't hardcode hex values in component files; reference tokens.
- Don't style with physical sides (`pl-*`, `pr-*`) when a logical side (`ps-*`, `pe-*`) exists.
- Don't put user/cart/location controls in the header — they live in the rail.
- Don't skip the mobile variant. Parity is the rule.
- Don't call Firestore with `undefined` fields — it throws. Build objects from defined keys only.

---

## 8. Where to Find the Reference Bundle

The original Claude Design bundle (proposals, ideation, Idea_*.jsx mockups for Live Summary, Split Basket, Price Diary, Smart Pantry, Receipt OCR, Family Basket, Personal Inflation) was extracted to `/tmp/lista-design/lista-design/` during the Paper rollout. Those are **reference-only** — we adopt ideas from them incrementally after user review. They are not checked into the repo.

---

**Last updated**: 2026-04-21
**Owner**: Tomer (@tomerikoka)
