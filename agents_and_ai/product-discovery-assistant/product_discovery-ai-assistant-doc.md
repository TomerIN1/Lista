# Product Discovery Assistant

AI-powered conversational assistant that helps users find grocery products faster. Instead of browsing categories one by one, users can paste a shopping list, ask questions, or search naturally — the AI interprets intent, searches the product database, and shows results with honest, context-aware responses.

## How It Works

```
User input (text/list/question)
       │
       ▼
┌─────────────────────────┐
│  smartAssistant() [AI]  │  ← Interprets intent, generates search queries
│  gpt-4o-mini            │     Multiple query variations for tricky searches
└───────────┬─────────────┘
            │  SearchIntent[]
            ▼
┌─────────────────────────┐
│  searchProducts() [API] │  ← Parallel execution (max 5 concurrent)
│  /price-api/search      │     Supports sort, vegan filter, chain filter
└───────────┬─────────────┘
            │  DbProduct[]
            ▼
┌─────────────────────────┐
│  summarizeResults() [AI]│  ← Sees ACTUAL product names/prices
│  gpt-4o-mini            │     Generates honest, context-aware response
└───────────┬─────────────┘
            │  { message, products }
            ▼
┌─────────────────────────┐
│  SmartListPanel [UI]    │  ← Chat feed with inline product cards
│  React component        │     Click to see detail, button to add to cart
└─────────────────────────┘
```

### Two-Pass AI Architecture

The key design decision: **two separate AI calls** instead of one.

**Pass 1 — Intent & Queries** (`smartAssistant`):
- Interprets what the user wants (list, search, question)
- Generates optimized Hebrew search queries with parameters (sort, filters)
- Returns only a placeholder message ("Searching...") — never promises results

**Pass 2 — Contextual Response** (`summarizeResults`):
- Runs AFTER real search results come back
- Sees actual product names, manufacturers, and prices
- If products found → references them by name, highlights best match
- If nothing found → honestly says so, suggests alternative search terms

This prevents the trust-damaging pattern of "Here's what I found!" followed by empty results.

## Files

| File | Description |
|------|-------------|
| `SmartListPanel.tsx` | Chat UI component — messages feed, product cards, input area |
| `smartListService.ts` | Orchestration — coordinates AI + search API, concurrency control |
| `aiService.ts` | All AI/LLM functions — parsing, intent detection, result summarization |
| `product_discovery-ai-assistant-doc.md` | This documentation |

### External Dependencies

| File | Location | What's Used |
|------|----------|-------------|
| `types.ts` | `/types.ts` | `ParsedShoppingItem`, `SmartListMatch`, `SmartChatMessage`, `SearchIntent`, `DbProduct` |
| `translations.ts` | `/constants/translations.ts` | `smartList.*` namespace (EN + HE) |
| `priceDbService.ts` | `/services/priceDbService.ts` | `searchProducts()` API client |
| `ProductDetailModal.tsx` | `/components/ProductDetailModal.tsx` | Product detail/price comparison modal |
| `ShoppingInputArea.tsx` | `/components/ShoppingInputArea.tsx` | Parent component — mounts SmartListPanel |
| `LanguageContext` | `/contexts/LanguageContext` | `useLanguage()` hook for i18n and RTL |

## User Capabilities

| Action | Example | How It Works |
|--------|---------|--------------|
| Paste shopping list | "חלב, ביצים, גבינה צהובה" | AI extracts items → parallel search → results with "Add All" |
| Find cheapest product | "החלב הכי זול" | `sort_by: min_price, sort_order: asc` |
| Specific product type | "חלב בשקית" | Multiple query variations: "חלב שקית", "חלב בשקית" |
| Brand-specific search | "יוגורט של שטראוס" | Brand in query + post-filter by manufacturer |
| Vegan filter | "חטיפים טבעוניים" | `is_vegan: true` filter |
| Follow-up questions | "יש יותר זול?" | Conversation history maintained in session |
| Click product for detail | Tap product name/image | Opens `ProductDetailModal` with store prices |
| Add to cart | Tap "Add" button | Product added to shopping list with barcode |

## AI Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Model | `gpt-4o-mini` | Fast (~300ms), cheap (~$0.0002/call), sufficient for intent detection |
| Temperature (intent) | 0.3 | Low for consistent query generation |
| Temperature (summary) | 0.3 | Low for factual, reliable responses |
| Response format | `json_object` | Structured output for reliable parsing |
| Max tokens (summary) | 250 | Keeps responses concise (2-3 sentences for large results, 1-2 for small) |
| Search concurrency | 5 | Balances speed vs API load |

## Performance

| Step | Time | Cost |
|------|------|------|
| AI intent detection | ~300ms | ~$0.0002 |
| Parallel search (5 items) | ~400ms | Free (API) |
| AI result summarization | ~200ms | ~$0.0001 |
| **Total (single query)** | **~900ms** | **~$0.0003** |
| **Total (20-item list)** | **~1.5s** | **~$0.0005** |

## Integration Point

The feature is mounted in `ShoppingInputArea.tsx` via a toggle button:

```tsx
// In ShoppingInputArea.tsx
import SmartListPanel from '../agents_and_ai/product-discovery-assistant/SmartListPanel';

// "AI Assistant" button above catalog — toggles showSmartList state
// When active, SmartListPanel replaces ProductCatalogArea
// Cart bar remains visible at bottom
```

### Store/Chain Filtering

`ShoppingInputArea` computes `effectiveChains` — the chain filter actually sent to the search API:

- **User explicitly selected chains** → those specific chains are used
- **No explicit selection** → ALL available chains from the user's area (from `deliveryCheck`) are used as the filter

This ensures both the AI assistant and the catalog only return products available at stores in the user's city/area, preventing irrelevant results from chains not present there (e.g., no h-cohen products when searching in Jerusalem where only רמי לוי, שופרסל, ויקטורי are available).

## Translation Keys

All UI strings are in `constants/translations.ts` under the `smartList` namespace:

```
smartList.pasteList        → "AI Assistant" / "עוזר AI"
smartList.title            → "Smart Assistant" / "עוזר חכם"
smartList.textPlaceholder  → input placeholder
smartList.processing       → loading text
smartList.addToCart         → add button label
smartList.alreadyInCart     → already-added badge
smartList.addAllResults     → bulk add button
smartList.welcome           → initial greeting message
smartList.backToCatalog     → back button label
```

## Edge Cases Handled

- **Nonsense/gibberish input**: AI detects gibberish, returns no searches, responds with "I don't understand" — does NOT re-search items from conversation history
- **No search results**: `summarizeResults` honestly reports failure, suggests alternatives
- **Duplicate barcodes**: Products already in cart show "In cart" badge, excluded from "Add All"
- **Large lists (50+ items)**: Concurrency limit (5) prevents API overload
- **API errors**: Individual search failures silently skipped, others still shown
- **RTL layout**: Panel uses `dir={isRTL ? 'rtl' : 'ltr'}`, send button flipped
- **Conversation context**: Last 6 messages passed to AI (prevents context pollution from long sessions)
- **"Cheapest X" queries**: AI searches broadly for the product category, not biased by specific variants from history
- **Brand-specific queries**: Post-filtering by manufacturer name ensures only matching brand products are returned
- **Fresh produce**: AI notes when results may be processed versions (pickled, frozen) due to DB limitations
- **Large result summaries**: AI highlights mismatches and items that may not match what user asked for

## Robustness Improvements (v4.8.1)

Five fixes implemented based on user simulation testing:

1. **Nonsense input handling**: AI prompt explicitly instructs to return empty searches for gibberish — prevents re-searching from conversation history
2. **Fresh produce awareness**: AI prompt notes DB limitation with fresh items, `summarizeResults` can mention when results are processed versions
3. **Broad "cheapest X" search**: AI searches broadly for product category without carrying specific variants from history, uses higher limits (8-10)
4. **Brand post-filtering**: `smartListService.ts` extracts brand from user message and filters results by manufacturer after search (common Israeli brands: תנובה, שטראוס, טרה, אסם, etc.)
5. **Informative large-list summaries**: `summarizeResults` highlights mismatches, missing items, and fresh produce notes for large result sets (max tokens increased to 250)

## Weighted Products Support (v4.9.0)

**Problem**: Products sold by weight (per-kg) like fresh produce showed prices without indicating it's per-kg, and were added to cart with 'pcs' unit instead of 'kg'.

**Changes**:
- Price display now shows `₪X.XX / ק״ג` for weighted products across all views (product cards, detail modal, search results, cart, AI assistant)
- Weighted products auto-default to `kg` unit when added to cart (instead of `pcs`)
- Product cards show a small ק״ג badge for weighted products
- ProductDetailModal shows "Sold by weight" indicator
- Shared utility `utils/priceFormat.ts` provides `formatPriceLabel()`, `formatPriceRange()`, `isWeightedProduct()`
- `DbProduct.unit_of_measure` field added to types (value: `"kg"` for weighted, `null` for regular)

## is_weighted Field Integration (v4.9.3)

**Problem**: `unit_of_measure` alone was unreliable — it's a regulatory comparison unit, not a selling method indicator. Packaged milk showed "ל 100 מ"ל", packaged almonds showed "kg", and deli cheeses had price/unit mismatches.

**Solution**: The API now provides `is_weighted` (boolean | null), sourced from the `bIsWeighted` field in supermarket XML price files. This is the authoritative source of truth for whether a product is sold by weight.

**How it works**:
- `is_weighted === true` → sold by weight, use `unit_of_measure` for display unit (kg, 100g, liter)
- `is_weighted === false` → packaged product, ignore `unit_of_measure` entirely (it's regulatory)
- `is_weighted === null` → unknown, fall back to `unit_of_measure` heuristic (backward-compatible)

**Changes**:
- `DbProduct.is_weighted` field added to types
- `utils/priceFormat.ts` — new `effectiveUnit()` function gates all formatting by `is_weighted`; all exported functions accept optional `isWeighted` parameter
- All 7 consumer components updated to pass `product.is_weighted` through to price formatting utilities
- Data coverage: 576 products (true) + 8,789 (false) as of initial migration. Products with `null` fall back safely to old logic.

## Category Grouping + Fresh-First (v5.0.0)

**Problem**: Results were a flat list mixing dairy, cleaning, produce together. Fresh produce searches ("עגבניות") returned pickled/canned variants. Products leaked into the wrong sections when DB keywords collided with brand names (e.g., cleaning brand "וניש" under חטיפים because the user typed "קליה וניש").

**Changes**:
- New `listaCategories.ts` — the 23 fixed Lista categories (mirrored from `/public/category-icons/`), `PROCESSED_TOKENS` list (חמוץ, כבוש, קפוא, משומר, במלח, …), and `FRESH_CATEGORIES` set (פירות וירקות, מוצרי חלב וביצים, בשר עוף דגים ומעדניה, לחם מאפים ודגני בוקר).
- `SearchIntent` extended with `listaCategory` and `preferFresh`. `SmartChatMessage` gained `productGroups: SmartProductGroup[]`.
- `smartAssistant` prompt now REQUIRES every search to be tagged with one of the 23 categories and marks fresh categories with `preferFresh: true`. For fresh produce the AI generates BOTH plural and singular Hebrew forms (עגבניות + עגבניה) to maximize matches against weighted DB entries.
- `processSmartChat` pipeline per-search:
  1. **Category alignment** — drops any product whose DB `category/subcategory` has zero token overlap with the tagged Lista category. No fallback: if alignment empties the outcome, that's the correct answer. Kills cross-category keyword leaks.
  2. **Product-group dedup** — collapses barcodes sharing a `product_group_id` (matches how the catalog unifies fresh produce like "עגבניה • 5 ברקודים מאוחדים").
  3. **Fresh-first selection** — `pickFreshBest()`: if any `is_weighted === true` product exists, show ONLY those (no packaged alternatives). Otherwise filter out `PROCESSED_TOKENS`. If nothing survives, flag the outcome for the summary.
  4. **Per-group brand filter** — applied within the grouped outcomes so brands don't collapse across categories.
  5. **Near-duplicate suppression** — collapses rows sharing `manufacturer + rounded price + first 3 name tokens`.
- Groups sorted by the canonical `LISTA_CATEGORIES` order for stable layout.
- Missing-fresh reports are resolved post-merge: a query is only reported missing if its *category* ended up empty (prevents false "no פטריות" when the singular variant matched).
- `summarizeResults` accepts `freshFallbackCategories` + `missingFreshItems` metadata so the AI response is honest about fallbacks and missing items.

**UI changes** (`SmartListPanel.tsx`):
- Grouped rendering: each group has a header row with icon (from `/public/category-icons/`), Hebrew category name, and count. A `mt-3 pt-3 border-t border-slate-200` divider separates groups.
- Amber "לא נמצא טרי — מוצג מעובד" badge on groups where fresh search fell back to processed.
- Card price now renders `₪min–₪max` via `formatPriceRange()` when `max_price > min_price`; falls back to `formatPriceLabel()` otherwise.
- Flat-list renderer retained as a legacy fallback for messages without `productGroups`.

**Files touched**:
- `agents_and_ai/product-discovery-assistant/listaCategories.ts` (new)
- `agents_and_ai/product-discovery-assistant/aiService.ts` (prompt + summarizer)
- `agents_and_ai/product-discovery-assistant/smartListService.ts` (orchestration rewrite)
- `agents_and_ai/product-discovery-assistant/SmartListPanel.tsx` (grouped rendering)
- `types.ts` (SearchIntent fields + SmartProductGroup + SmartChatMessage.productGroups)

## Area-Aware Store Filtering (v4.8.2)

**Problem**: AI assistant returned products from stores not available in the user's area (e.g., h-cohen products when searching in Jerusalem where only רמי לוי, שופרסל, ויקטורי are available).

**Root cause**: `selectedChains` defaulted to `[]` (empty), which meant no chain filter was sent to the search API — so all chains were included.

**Fix**: `ShoppingInputArea` now computes `effectiveChains` — when no chains are explicitly selected, it uses all available chains from `deliveryCheck` (the user's area). This applies to both the AI assistant and the regular product catalog.
