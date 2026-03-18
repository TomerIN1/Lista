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
| `README.md` | This documentation |

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
| Brand-specific search | "חלב של תנובה" | "חלב תנובה" query |
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
| Max tokens (summary) | 150 | Keeps responses concise (1-2 sentences) |
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

- **Empty/nonsense input**: AI returns empty searches → "No items detected" message
- **No search results**: `summarizeResults` honestly reports failure, suggests alternatives
- **Duplicate barcodes**: Products already in cart show "In cart" badge, excluded from "Add All"
- **Large lists (50+ items)**: Concurrency limit (5) prevents API overload
- **API errors**: Individual search failures silently skipped, others still shown
- **RTL layout**: Panel uses `dir={isRTL ? 'rtl' : 'ltr'}`, send button flipped
- **Conversation context**: Previous messages passed to AI for follow-up queries
