/**
 * Product Discovery Assistant — Orchestration Service
 *
 * Coordinates the flow between AI services and the product search API:
 * - buildSmartList: Batch mode — parse list → parallel search → return matches
 * - processSmartChat: Chat mode — AI intent → parallel search → context-aware response
 *
 * Both functions use a concurrency-limited semaphore for parallel API calls.
 */

import { ParsedShoppingItem, SmartListMatch, Language, DbProduct } from '../../types';
import { parseShoppingList, smartAssistant, summarizeResults } from './aiService';
import { searchProducts } from '../../services/priceDbService';

const MAX_CONCURRENT = 5;

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
): Promise<{ message: string; products: DbProduct[] }> {
  // Step 1: AI determines intent and search queries
  const aiResponse = await smartAssistant(userMessage, language, conversationHistory);

  if (aiResponse.searches.length === 0) {
    return { message: aiResponse.message, products: [] };
  }

  // Step 2: Execute all searches in parallel (with concurrency limit)
  const allProducts: DbProduct[] = [];
  const executing = new Set<Promise<void>>();

  for (const search of aiResponse.searches) {
    const p = (async () => {
      try {
        const result = await searchProducts(
          search.query,
          search.limit || 3,
          0,
          city,
          storeType,
          search.is_vegan,
          undefined,
          search.sort_by,
          search.sort_order,
          selectedChains
        );
        allProducts.push(...result.products);
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

  // Deduplicate by barcode
  const seen = new Set<string>();
  const uniqueProducts = allProducts.filter((p) => {
    if (seen.has(p.barcode)) return false;
    seen.add(p.barcode);
    return true;
  });

  // Step 3: Generate context-aware response based on actual results
  const productSummaries = uniqueProducts.map((p) => ({
    name: p.name,
    manufacturer: p.manufacturer,
    price: p.min_price,
  }));

  const contextualMessage = await summarizeResults(userMessage, productSummaries, language);

  return { message: contextualMessage, products: uniqueProducts };
}
