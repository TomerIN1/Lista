/**
 * Product Discovery Assistant — Orchestration Service
 *
 * Coordinates the flow between AI services and the product search API:
 * - buildSmartList: Batch mode — parse list → parallel search → return matches
 * - processSmartChat: Chat mode — AI intent → parallel search → context-aware response
 *
 * Both functions use a concurrency-limited semaphore for parallel API calls.
 */

import { ParsedShoppingItem, SmartListMatch, Language, DbProduct, SmartProductGroup, SmartItemGroup, SearchIntent } from '../../types';
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
  // Weighted and group-indexed products (fresh produce, deli counter items)
  // are aggregated across chains and frequently carry null category in the
  // search response. The DB's own grouping system is stronger signal than
  // the taxonomy here — trust it and pass them through.
  if (product.is_weighted === true || product.product_group_id != null) return true;

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
// ─── Ranking (Phase 2) ──────────────────────────────────────────────────────

const STOP_CHARS = /[״"׳'().,/\-_]/g;

function normalizeForMatch(s: string): string {
  return (s || '').toLowerCase().replace(STOP_CHARS, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Relevance tier for a product name vs. a search query.
 * 3 = exact, 2 = starts-with or name-is-substring-of-query, 1 = all query tokens present, 0 = none.
 *
 * The "name-is-substring-of-query" case handles singular/plural mismatches
 * like query="לימונים" product="לימון": the product name is a prefix of the
 * user's phrase, so it's highly relevant even though name.includes(query) is
 * false. Without this, short fresh-produce names lose ranking to longer
 * processed variants (e.g. "משקה קל לימונים") that literally contain the
 * query string.
 */
function relevanceTier(productName: string, query: string): number {
  const name = normalizeForMatch(productName);
  const q = normalizeForMatch(query);
  if (!q) return 0;
  if (name === q) return 3;
  if (name.startsWith(q)) return 2;
  if (name.length >= 3 && q.includes(name)) return 2;
  const qTokens = q.split(' ').filter((t) => t.length >= 2);
  if (qTokens.length > 0 && qTokens.every((t) => name.includes(t))) return 1;
  if (name.includes(q)) return 1;
  return 0;
}

/**
 * Rank products by relevance tier first, cheapest within each tier.
 * The head of the returned list is the "recommended" pick.
 */
function rankProducts(products: DbProduct[], query: string): DbProduct[] {
  return [...products].sort((a, b) => {
    const tierA = relevanceTier(a.name, query);
    const tierB = relevanceTier(b.name, query);
    if (tierA !== tierB) return tierB - tierA;
    return (a.min_price || Infinity) - (b.min_price || Infinity);
  });
}

/**
 * Fetches additional products for an already-matched item — used by the
 * "+ עוד אפשרויות" button on the results UI. Runs the same filtering pipeline
 * (category alignment, fresh-first, dedup) as the main flow, then excludes
 * any barcode already shown to the user so we only surface genuinely-new
 * alternatives.
 */
export async function loadMoreAlternatives(
  query: string,
  listaCategory: string | undefined,
  excludeBarcodes: Set<string>,
  city?: string,
  storeType?: string,
  selectedChains?: string[],
  limit: number = 30
): Promise<DbProduct[]> {
  const result = await searchProducts(
    query,
    limit,
    0,
    city,
    storeType,
    undefined,
    undefined,
    undefined,
    undefined,
    selectedChains
  );

  const category = listaCategory && isValidCategory(listaCategory) ? listaCategory : DEFAULT_CATEGORY;
  const preferFresh = FRESH_CATEGORIES.has(category);

  let products = result.products.filter((p) => productMatchesCategory(p, category));
  products = dedupeByProductGroup(products);

  if (preferFresh) {
    const fresh = pickFreshBest(products);
    if (fresh.length > 0) products = fresh;
  }

  products = dedupeNearDuplicates(products);
  products = products.filter((p) => !excludeBarcodes.has(p.barcode));

  return products;
}

export async function processSmartChat(
  userMessage: string,
  language: Language,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  city?: string,
  storeType?: string,
  selectedChains?: string[],
  /** When provided AND a valid Lista taxonomy category, overrides the AI's
   *  per-search `listaCategory` tag. Used by the substitution flow where the
   *  caller already knows the correct category from the user's basket and
   *  doesn't want the AI re-tagging to drag the result into a different
   *  bucket (e.g. "אגוזי מלך" → snacks "אגוזי" chocolate). */
  forcedListaCategory?: string,
): Promise<{
  message: string;
  products: DbProduct[];
  groups: SmartProductGroup[];
  itemGroups: SmartItemGroup[];
  notFound: string[];
}> {
  // Step 1: AI determines intent and search queries
  const aiResponse = await smartAssistant(userMessage, language, conversationHistory);

  if (aiResponse.searches.length === 0) {
    return { message: aiResponse.message, products: [], groups: [], itemGroups: [], notFound: [] };
  }

  // Per-search results, tagged with listaCategory + fresh metadata
  type SearchOutcome = {
    category: string;
    products: DbProduct[];
    freshFallback: boolean;
    missingFresh: boolean;
    query: string;
    search: SearchIntent;
  };

  const outcomes: SearchOutcome[] = [];
  const executing = new Set<Promise<void>>();

  for (const search of aiResponse.searches) {
    const p = (async () => {
      try {
        const result = await searchProducts(
          search.query,
          // Bump default from 5 to 10 so short/generic queries ("שמן", "פסטה")
          // have enough candidates to survive category alignment. The AI can
          // still override with an explicit higher limit for "cheapest X"
          // style queries where it already asks for 8-10.
          search.limit && search.limit > 5 ? search.limit : 10,
          0,
          city,
          storeType,
          search.is_vegan,
          undefined,
          search.sort_by,
          search.sort_order,
          selectedChains
        );

        // Caller-forced category wins over AI's per-search tag. Used by the
        // substitution flow where the basket-side category is authoritative
        // and the AI's re-tagging is the source of cross-category mismatches.
        const category =
          forcedListaCategory && isValidCategory(forcedListaCategory)
            ? forcedListaCategory
            : (isValidCategory(search.listaCategory) ? search.listaCategory! : DEFAULT_CATEGORY);
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
          search,
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

  // ─── Retry fallback (Phase 2+) ──────────────────────────────────────────
  // For any user item whose searches all returned zero products, retry once
  // with just the BASE noun (first word of the primary query) and re-apply
  // the same category alignment + preferFresh logic. This rescues items
  // where the DB uses a different phrasing than the user (e.g. the catalog
  // stores "מלפפון בחומץ" but the user typed "מלפפון חמוץ").
  const outcomesByItem = new Map<string, SearchOutcome[]>();
  for (const o of outcomes) {
    const key = (o.search.originalText || o.search.query || '').trim();
    const bucket = outcomesByItem.get(key) ?? [];
    bucket.push(o);
    outcomesByItem.set(key, bucket);
  }

  const retryPromises: Promise<void>[] = [];
  for (const [, bucket] of outcomesByItem) {
    const totalProducts = bucket.reduce((sum, o) => sum + o.products.length, 0);
    if (totalProducts > 0) continue;
    const primary = bucket[0];
    if (!primary) continue;
    const words = (primary.search.query || '').trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) continue; // single-word queries have nothing simpler to try
    const baseNoun = words[0];
    if (!baseNoun || baseNoun.length < 2) continue;

    retryPromises.push((async () => {
      try {
        const result = await searchProducts(
          baseNoun,
          15, // broader limit — we'll filter hard via category alignment
          0,
          city,
          storeType,
          primary.search.is_vegan,
          undefined,
          primary.search.sort_by,
          primary.search.sort_order,
          selectedChains
        );

        const preferFresh =
          primary.search.preferFresh === true || FRESH_CATEGORIES.has(primary.category);

        let products = result.products.filter((p) =>
          productMatchesCategory(p, primary.category)
        );
        products = dedupeByProductGroup(products);

        let freshFallback = false;
        if (preferFresh) {
          const fresh = pickFreshBest(products);
          if (fresh.length > 0) {
            products = fresh;
          } else if (products.length > 0) {
            freshFallback = true;
          }
        }

        if (products.length > 0) {
          outcomes.push({
            category: primary.category,
            products,
            freshFallback,
            missingFresh: false,
            query: baseNoun,
            search: primary.search, // preserve originalText so item grouping merges
          });
        }
      } catch {
        // Silently skip retry failures — the item simply stays not-found.
      }
    })());
  }
  if (retryPromises.length > 0) await Promise.all(retryPromises);

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

  // ─── Per-item grouping (Phase 2) ───────────────────────────────────────────
  // Group outcomes by `originalText` (the user's phrase). Multiple searches
  // sharing the same originalText — e.g. plural + singular variants for fresh
  // produce — merge into one user-facing item section.
  type ItemAcc = {
    originalText: string;
    listaCategory: string;
    quantity: number;
    firstQuery: string;
    firstSeen: number;
    products: DbProduct[];
    freshFallback: boolean;
    anyMatched: boolean;
    /** True if any search variant for this item asked for fresh. Drives the
     * post-merge fresh-prevails rule below. */
    preferFresh: boolean;
  };

  const itemAcc = new Map<string, ItemAcc>();
  const seenItemBarcodes = new Map<string, Set<string>>();
  let seenOrder = 0;

  // Track which originalTexts are still candidates for notFound — we only
  // report missing if the item ended up with zero products across all its
  // query variants.
  for (const o of outcomes) {
    const key = (o.search.originalText || o.search.query || '').trim() || `#${seenOrder}`;
    let acc = itemAcc.get(key);
    if (!acc) {
      acc = {
        originalText: o.search.originalText || o.search.query || '',
        listaCategory: o.category,
        quantity: o.search.quantity && o.search.quantity > 0 ? o.search.quantity : 1,
        firstQuery: o.search.query,
        firstSeen: seenOrder++,
        products: [],
        freshFallback: false,
        anyMatched: false,
        preferFresh: false,
      };
      itemAcc.set(key, acc);
      seenItemBarcodes.set(key, new Set());
    }
    const barcodes = seenItemBarcodes.get(key)!;

    if (o.freshFallback) acc.freshFallback = true;
    if (!o.missingFresh && o.products.length > 0) acc.anyMatched = true;
    if (o.search.preferFresh === true || FRESH_CATEGORIES.has(o.category)) {
      acc.preferFresh = true;
    }

    for (const p of o.products) {
      if (barcodes.has(p.barcode)) continue;
      barcodes.add(p.barcode);
      acc.products.push(p);
    }
  }

  // Apply the same brand filter & dedup to per-item groups so ranking sees
  // the same product pool that the category view shows.
  if (brandKeywords) {
    const b = brandKeywords.toLowerCase();
    for (const acc of itemAcc.values()) {
      const filtered = acc.products.filter(
        (p) => p.manufacturer?.toLowerCase().includes(b) || p.name?.toLowerCase().includes(b)
      );
      if (filtered.length > 0) acc.products = filtered;
    }
  }

  // ─── Fresh prevails (cross-variant) ─────────────────────────────────────
  // If an item is fresh-oriented AND any search variant surfaced real fresh
  // produce (is_weighted=true), discard any non-weighted products that only
  // got here via a freshFallback outcome, and clear the "no fresh" badge.
  // Without this, the merge pool can still contain processed drinks that
  // technically match the query string (e.g. "משקה קל לימונים" for "לימונים")
  // and then win ranking against shorter fresh names like "לימון".
  for (const acc of itemAcc.values()) {
    if (!acc.preferFresh) continue;
    const weighted = acc.products.filter((p) => p.is_weighted === true);
    if (weighted.length > 0) {
      acc.products = weighted;
      acc.freshFallback = false;
    }
  }

  // First pass: rank per item
  const rankedByItem = Array.from(itemAcc.values())
    .sort((a, b) => a.firstSeen - b.firstSeen)
    .map((acc) => ({
      acc,
      ranked: rankProducts(dedupeNearDuplicates(acc.products), acc.firstQuery),
    }));

  // Second pass: cross-item dedup. If the top-ranked product for item N is
  // already claimed by an earlier item (e.g. both "גבינת לבנה" and
  // "גבינה לבנה" resolve to the same product), walk down the alternatives to
  // find a fresh pick. If every candidate is taken, leave it as-is — the user
  // can change the radio manually.
  const claimed = new Set<string>();
  const itemGroups: SmartItemGroup[] = rankedByItem.map(({ acc, ranked }) => {
    let recommended: DbProduct | null = null;
    let alternatives: DbProduct[] = [];
    for (let i = 0; i < ranked.length; i++) {
      if (!claimed.has(ranked[i].barcode)) {
        recommended = ranked[i];
        alternatives = [...ranked.slice(0, i), ...ranked.slice(i + 1)].slice(0, 4);
        break;
      }
    }
    if (!recommended && ranked.length > 0) {
      // Every candidate is claimed by another item — fall back to the
      // top-ranked result anyway so the user at least sees something.
      recommended = ranked[0];
      alternatives = ranked.slice(1, 5);
    }
    if (recommended) claimed.add(recommended.barcode);
    const matched = recommended !== null;
    return {
      id: `${acc.firstSeen}-${acc.originalText}`,
      originalText: acc.originalText,
      listaCategory: acc.listaCategory,
      quantity: acc.quantity,
      recommended,
      alternatives,
      freshFallback: acc.freshFallback && matched,
      status: matched ? ('matched' as const) : ('no_match' as const),
    };
  });

  // Not-found list: items the user asked for whose item group has no products.
  const notFound = itemGroups
    .filter((g) => g.status === 'no_match' && g.originalText)
    .map((g) => g.originalText);

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

  return { message: contextualMessage, products: flatProducts, groups, itemGroups, notFound };
}
