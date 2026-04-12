/**
 * Product Discovery Assistant — Orchestration Service
 *
 * Coordinates the flow between AI services and the product search API:
 * - buildSmartList: Batch mode — parse list → parallel search → return matches
 * - processSmartChat: Chat mode — AI intent → parallel search → context-aware response
 *
 * Both functions use a concurrency-limited semaphore for parallel API calls.
 */

import { ParsedShoppingItem, SmartListMatch, Language, DbProduct, SmartProductGroup } from '../../types';
import { parseShoppingList, smartAssistant, summarizeResults } from './aiService';
import { searchProducts } from '../../services/priceDbService';
import {
  LISTA_CATEGORIES,
  DEFAULT_CATEGORY,
  FRESH_CATEGORIES,
  PROCESSED_TOKENS,
  isValidCategory,
} from './listaCategories';

/**
 * Filters a product list to keep only non-processed items (for fresh-first).
 * Returns all products whose name does NOT contain any PROCESSED_TOKENS.
 */
function filterFresh(products: DbProduct[]): DbProduct[] {
  return products.filter((p) => {
    const hay = `${p.name || ''} ${p.subcategory || ''} ${p.sub_subcategory || ''}`.toLowerCase();
    return !PROCESSED_TOKENS.some((token) => hay.includes(token.toLowerCase()));
  });
}

/**
 * For fresh categories, weighted products (is_weighted === true) are almost
 * always real fresh produce in the DB. Prefer them when available.
 */
function pickFreshBest(products: DbProduct[]): DbProduct[] {
  const weighted = products.filter((p) => p.is_weighted === true);
  // If any real fresh produce (weighted) exists, show ONLY those — don't mix
  // in packaged alternatives. Keeps the fresh section clean.
  if (weighted.length > 0) return weighted;
  return filterFresh(products);
}

/**
 * Category alignment: checks that a product's DB category/subcategory has at
 * least one non-trivial token overlap with the expected Lista category label.
 * This prevents the assistant from showing cleaning products ("וניש") under
 * snacks when a keyword happens to match.
 */
const STOP_TOKENS = new Set(['ו', 'של', 'את', 'על', 'עם', 'ללא']);

function categoryTokens(label: string): string[] {
  return label
    .replace(/[״"׳'().,/]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_TOKENS.has(t));
}

function productMatchesCategory(product: DbProduct, listaCategory: string): boolean {
  const expected = new Set(categoryTokens(listaCategory));
  if (expected.size === 0) return true;
  const dbCat = `${product.category || ''} ${product.subcategory || ''} ${product.sub_subcategory || ''}`;
  const actual = categoryTokens(dbCat);
  return actual.some((t) => expected.has(t));
}

/**
 * Suppresses near-duplicates inside a group. Two products collapse when they
 * have the same manufacturer, the same rounded min_price, and the first
 * 2-3 significant tokens of their names match.
 */
function dedupeNearDuplicates(products: DbProduct[]): DbProduct[] {
  const seen = new Map<string, DbProduct>();
  for (const p of products) {
    const nameKey = (p.name || '')
      .replace(/[״"׳'().,/]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2)
      .slice(0, 3)
      .join(' ')
      .toLowerCase();
    const key = `${(p.manufacturer || '').toLowerCase()}|${Math.round((p.min_price || 0) * 100)}|${nameKey}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  return Array.from(seen.values());
}

/**
 * Fresh produce in the catalog is unified via product_group_id — multiple
 * barcodes collapse into one "עגבניה" entry. The search endpoint returns each
 * barcode separately, so we dedupe by product_group_id (keeping the cheapest
 * min_price representative) before showing the user.
 */
function dedupeByProductGroup(products: DbProduct[]): DbProduct[] {
  const byGroup = new Map<number, DbProduct>();
  const ungrouped: DbProduct[] = [];
  for (const p of products) {
    if (p.product_group_id == null) {
      ungrouped.push(p);
      continue;
    }
    const existing = byGroup.get(p.product_group_id);
    if (!existing || (p.min_price || 0) < (existing.min_price || 0)) {
      byGroup.set(p.product_group_id, p);
    }
  }
  return [...byGroup.values(), ...ungrouped];
}

const MAX_CONCURRENT = 5;

// Common Israeli brand names for post-filtering
const KNOWN_BRANDS = [
  'תנובה', 'שטראוס', 'טרה', 'אסם', 'עלית', 'אוסם',
  'יטבתה', 'מהדרין', 'פרי גת', 'תלמה', 'בייגל',
  'tnuva', 'strauss', 'tara', 'osem', 'elite', 'yotvata',
];

/**
 * Extracts a brand name from the user message if one is mentioned.
 * Handles Hebrew patterns like "של שטראוס" or "תנובה".
 */
function extractBrandFromMessage(message: string): string | null {
  const lower = message.toLowerCase();
  // Check "של <brand>" pattern (Hebrew "of <brand>")
  const shelMatch = message.match(/של\s+(\S+)/);
  if (shelMatch) {
    const candidate = shelMatch[1];
    if (KNOWN_BRANDS.some((b) => candidate.includes(b))) {
      return candidate;
    }
  }
  // Direct brand mention
  for (const brand of KNOWN_BRANDS) {
    if (lower.includes(brand.toLowerCase())) {
      return brand;
    }
  }
  return null;
}

// ─── Batch Mode (Shopping List) ──────────────────────────────────────────────

/**
 * Parses a raw shopping list and matches each item to real products in the DB.
 * Used for bulk "paste a list" flow.
 *
 * Flow: raw text → AI parsing → parallel searchProducts() → SmartListMatch[]
 *
 * @param rawText - Raw shopping list text
 * @param language - User's language
 * @param onProgress - Progress callback (completed, total)
 * @param city - Optional city filter
 * @param storeType - Optional store type filter
 * @param selectedChains - Optional chain filter
 */
export async function buildSmartList(
  rawText: string,
  language: Language,
  onProgress?: (completed: number, total: number) => void,
  city?: string,
  storeType?: string,
  selectedChains?: string[]
): Promise<SmartListMatch[]> {
  const parsedItems = await parseShoppingList(rawText, language);
  if (parsedItems.length === 0) return [];

  const total = parsedItems.length;
  let completed = 0;
  onProgress?.(0, total);

  const results: SmartListMatch[] = [];

  const processItem = async (item: ParsedShoppingItem): Promise<SmartListMatch> => {
    try {
      const searchResult = await searchProducts(
        item.searchQuery,
        3,
        0,
        city,
        storeType,
        undefined,
        undefined,
        undefined,
        undefined,
        selectedChains
      );

      completed++;
      onProgress?.(completed, total);

      if (searchResult.products.length === 0) {
        return { parsedItem: item, matches: [], selectedIndex: 0, status: 'no_match' };
      }

      return {
        parsedItem: item,
        matches: searchResult.products,
        selectedIndex: 0,
        status: 'matched',
      };
    } catch {
      completed++;
      onProgress?.(completed, total);
      return { parsedItem: item, matches: [], selectedIndex: 0, status: 'no_match' };
    }
  };

  const executing = new Set<Promise<void>>();

  for (const item of parsedItems) {
    const p = processItem(item).then((result) => {
      results.push(result);
      executing.delete(p);
    });
    executing.add(p);

    if (executing.size >= MAX_CONCURRENT) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);

  const orderMap = new Map(parsedItems.map((item, i) => [item.id, i]));
  results.sort(
    (a, b) => (orderMap.get(a.parsedItem.id) ?? 0) - (orderMap.get(b.parsedItem.id) ?? 0)
  );

  return results;
}

// ─── Chat Mode (Conversational) ─────────────────────────────────────────────

/**
 * Processes a chat message through the full AI pipeline:
 * 1. AI interprets user intent → generates search queries
 * 2. Parallel product search with concurrency limit
 * 3. AI sees actual results → generates context-aware response
 *
 * This 2-pass AI approach ensures the response always matches reality:
 * - If products found → AI references actual names/prices
 * - If nothing found → AI honestly says so and suggests alternatives
 *
 * @param userMessage - The user's chat input
 * @param language - User's language
 * @param conversationHistory - Previous chat messages for context
 * @param city - Optional city filter
 * @param storeType - Optional store type filter
 * @param selectedChains - Optional chain filter
 */
export async function processSmartChat(
  userMessage: string,
  language: Language,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  city?: string,
  storeType?: string,
  selectedChains?: string[]
): Promise<{ message: string; products: DbProduct[]; groups: SmartProductGroup[] }> {
  // Step 1: AI determines intent and search queries
  const aiResponse = await smartAssistant(userMessage, language, conversationHistory);

  if (aiResponse.searches.length === 0) {
    return { message: aiResponse.message, products: [], groups: [] };
  }

  // Per-search results, tagged with listaCategory + fresh metadata
  type SearchOutcome = {
    category: string;
    products: DbProduct[];
    freshFallback: boolean;
    missingFresh: boolean;
    query: string;
  };

  const outcomes: SearchOutcome[] = [];
  const executing = new Set<Promise<void>>();

  for (const search of aiResponse.searches) {
    const p = (async () => {
      try {
        const result = await searchProducts(
          search.query,
          search.limit || 5,
          0,
          city,
          storeType,
          search.is_vegan,
          undefined,
          search.sort_by,
          search.sort_order,
          selectedChains
        );

        const category =
          isValidCategory(search.listaCategory) ? search.listaCategory! : DEFAULT_CATEGORY;
        const preferFresh =
          search.preferFresh === true || FRESH_CATEGORIES.has(category);

        // Category alignment: drop products whose DB category doesn't overlap
        // with the expected Lista category (e.g., drop "וניש" cleaning spray
        // when the AI tagged the search as "חטיפים"). ALWAYS apply — if it
        // empties the result set, that's the correct answer.
        let products = result.products.filter((p) =>
          productMatchesCategory(p, category)
        );

        // Collapse fresh-produce product groups (many barcodes → one entry)
        products = dedupeByProductGroup(products);

        let freshFallback = false;
        let missingFresh = false;

        if (preferFresh) {
          const fresh = pickFreshBest(products);
          if (fresh.length > 0) {
            products = fresh;
          } else if (products.length > 0) {
            // Nothing fresh — keep processed as fallback and flag it
            freshFallback = true;
          } else {
            missingFresh = true;
          }
        }

        outcomes.push({
          category,
          products,
          freshFallback,
          missingFresh,
          query: search.query,
        });
      } catch {
        // Silently skip failed searches
      }
    })();
    executing.add(p);
    p.then(() => executing.delete(p));

    if (executing.size >= MAX_CONCURRENT) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);

  // Brand post-filtering (applied per-outcome so we don't cross categories)
  const brandKeywords = extractBrandFromMessage(userMessage);
  if (brandKeywords) {
    const b = brandKeywords.toLowerCase();
    for (const o of outcomes) {
      const filtered = o.products.filter(
        (p) =>
          p.manufacturer?.toLowerCase().includes(b) ||
          p.name?.toLowerCase().includes(b)
      );
      if (filtered.length > 0) o.products = filtered;
    }
  }

  // Merge outcomes into groups keyed by category, preserving first-seen order
  const groupMap = new Map<string, SmartProductGroup>();
  const seenBarcodes = new Set<string>();
  const freshFallbackCats = new Set<string>();
  // Track pending "missing" queries per category; drop them later if that
  // category ended up with any products (e.g., singular variant of "פטריות"
  // matches even if plural returned nothing).
  const pendingMissingByCat = new Map<string, Set<string>>();

  for (const o of outcomes) {
    if (o.missingFresh) {
      const set = pendingMissingByCat.get(o.category) ?? new Set<string>();
      set.add(o.query);
      pendingMissingByCat.set(o.category, set);
      continue;
    }
    if (o.freshFallback) freshFallbackCats.add(o.category);

    let group = groupMap.get(o.category);
    if (!group) {
      group = { category: o.category, products: [], freshFallback: false };
      groupMap.set(o.category, group);
    }
    if (o.freshFallback) group.freshFallback = true;

    for (const p of o.products) {
      if (seenBarcodes.has(p.barcode)) continue;
      seenBarcodes.add(p.barcode);
      group.products.push(p);
    }
  }

  // Near-duplicate suppression inside each group
  for (const g of groupMap.values()) {
    g.products = dedupeNearDuplicates(g.products);
  }

  // Resolve missing-fresh items: a query is only truly missing if its target
  // category ended up with zero products.
  const missingFreshItems: string[] = [];
  for (const [cat, queries] of pendingMissingByCat) {
    const group = groupMap.get(cat);
    if (!group || group.products.length === 0) {
      missingFreshItems.push(...queries);
    }
  }

  // Sort groups by the canonical LISTA_CATEGORIES order so layout is stable
  const orderIndex = new Map<string, number>(LISTA_CATEGORIES.map((c, i) => [c as string, i]));
  const groups = Array.from(groupMap.values())
    .filter((g) => g.products.length > 0)
    .sort(
      (a, b) => (orderIndex.get(a.category) ?? 999) - (orderIndex.get(b.category) ?? 999)
    );

  const flatProducts = groups.flatMap((g) => g.products);

  // Step 3: Generate context-aware response based on actual grouped results
  const productSummaries = flatProducts.map((p) => ({
    name: p.name,
    manufacturer: p.manufacturer,
    price: p.min_price,
  }));

  const contextualMessage = await summarizeResults(
    userMessage,
    productSummaries,
    language,
    {
      freshFallbackCategories: Array.from(freshFallbackCats),
      missingFreshItems,
    }
  );

  return { message: contextualMessage, products: flatProducts, groups };
}
