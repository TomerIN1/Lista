import {
  DbProduct,
  DbProductSearchResult,
  DbPriceComparison,
  DbPromotion,
  DbSupermarket,
  ListPriceComparison,
  StorePriceSummary,
  CategoryGroup,
} from '../types';

// ============================================
// Configuration
// ============================================

// In dev, use Vite proxy to avoid CORS; in production, hit the API directly
const API_BASE = import.meta.env.DEV
  ? '/price-api'
  : 'https://israeli-food-prices-database-and-ap-one.vercel.app';

// Map English API names → Hebrew display names
const SUPERMARKET_NAME_MAP: Record<string, string> = {
  'Shufersal': 'שופרסל',
  'Victory': 'ויקטורי',
  'Market Warehouses': 'מחסני השוק',
  'H. Cohen': 'ח. כהן',
};

// ============================================
// LRU Cache
// ============================================

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class LRUCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;

  constructor(maxSize: number = 200) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, { data, expiry: Date.now() + ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }
}

const cache = new LRUCache(200);

// TTLs
const SEARCH_TTL = 5 * 60 * 1000;       // 5 minutes
const PRICES_TTL = 10 * 60 * 1000;      // 10 minutes
const SUPERMARKETS_TTL = 30 * 60 * 1000; // 30 minutes

// ============================================
// API Client
// ============================================

async function apiFetch<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const fullPath = `${API_BASE}${path}`;
  const url = fullPath.startsWith('http')
    ? new URL(fullPath)
    : new URL(fullPath, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// ============================================
// Public API Functions
// ============================================

export async function searchProducts(
  query: string,
  limit: number = 20,
  offset: number = 0
): Promise<DbProductSearchResult> {
  const cacheKey = `search:${query}:${limit}:${offset}`;
  const cached = cache.get<DbProductSearchResult>(cacheKey);
  if (cached) return cached;

  const result = await apiFetch<DbProductSearchResult>('/api/products/search', {
    q: query,
    limit,
    offset,
  });

  cache.set(cacheKey, result, SEARCH_TTL);
  return result;
}

export async function getProductByBarcode(barcode: string): Promise<DbProduct | null> {
  const cacheKey = `barcode:${barcode}`;
  const cached = cache.get<DbProduct | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    const result = await apiFetch<DbProduct>(`/api/products/${barcode}`);
    cache.set(cacheKey, result, PRICES_TTL);
    return result;
  } catch {
    return null;
  }
}

export async function comparePrices(barcode: string): Promise<DbPriceComparison | null> {
  const cacheKey = `compare:${barcode}`;
  const cached = cache.get<DbPriceComparison | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    // The price data comes from the product detail endpoint (not a separate /prices route)
    const result = await apiFetch<DbPriceComparison>(`/api/products/${barcode}`);
    cache.set(cacheKey, result, PRICES_TTL);
    return result;
  } catch {
    return null;
  }
}

export async function getActivePromotions(
  supermarketId?: number,
  limit: number = 50
): Promise<DbPromotion[]> {
  const cacheKey = `promos:${supermarketId || 'all'}:${limit}`;
  const cached = cache.get<DbPromotion[]>(cacheKey);
  if (cached) return cached;

  const params: Record<string, string | number> = { limit };
  if (supermarketId) params.supermarket_id = supermarketId;

  const result = await apiFetch<DbPromotion[]>('/api/promotions', params);
  cache.set(cacheKey, result, SEARCH_TTL);
  return result;
}

export async function getSupermarkets(): Promise<DbSupermarket[]> {
  const cacheKey = 'supermarkets';
  const cached = cache.get<DbSupermarket[]>(cacheKey);
  if (cached) return cached;

  const result = await apiFetch<DbSupermarket[]>('/api/supermarkets');
  cache.set(cacheKey, result, SUPERMARKETS_TTL);
  return result;
}

// ============================================
// Core: Compare Entire Shopping List
// ============================================

interface ItemForComparison {
  name: string;
  amount: number;
  barcode?: string;
}

// Concurrency limiter
async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p = task()
      .then((value) => ({ status: 'fulfilled' as const, value }))
      .catch((reason) => ({ status: 'rejected' as const, reason }))
      .then((result) => {
        results.push(result);
      });

    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
      // Remove completed promises
      executing.splice(
        0,
        executing.length,
        ...executing.filter((e) => {
          // Keep promises that haven't settled yet
          let settled = false;
          e.then(() => { settled = true; });
          return !settled;
        })
      );
    }
  }

  await Promise.all(executing);
  return results;
}

export async function compareListPrices(
  groups: CategoryGroup[]
): Promise<ListPriceComparison> {
  // Flatten all items from groups
  const items: ItemForComparison[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (!item.checked) {
        items.push({
          name: item.name,
          amount: item.amount,
          barcode: item.barcode,
        });
      }
    }
  }

  // For each item, get price comparison data
  const tasks = items.map((item) => async () => {
    let barcode = item.barcode;

    // If no barcode, search by name and pick best match
    if (!barcode) {
      const searchResult = await searchProducts(item.name, 1);
      if (searchResult.products && searchResult.products.length > 0) {
        barcode = searchResult.products[0].barcode;
      }
    }

    if (!barcode) {
      return { item, priceData: null };
    }

    const priceData = await comparePrices(barcode);
    return { item, priceData };
  });

  const results = await withConcurrencyLimit(tasks, 5);

  // Build per-store totals
  const storeMap = new Map<string, StorePriceSummary>();
  const unmatchedItems: string[] = [];

  for (const result of results) {
    if (result.status === 'rejected') continue;

    const { item, priceData } = result.value;
    if (!priceData || !priceData.prices || priceData.prices.length === 0) {
      unmatchedItems.push(item.name);
      continue;
    }

    for (const storePrice of priceData.prices) {
      const storeName = SUPERMARKET_NAME_MAP[storePrice.supermarket] || storePrice.supermarket;
      if (!storeMap.has(storeName)) {
        storeMap.set(storeName, {
          supermarketName: storeName,
          totalCost: 0,
          matchedItems: 0,
          unmatchedItems: [],
          itemPrices: [],
        });
      }

      const summary = storeMap.get(storeName)!;
      const itemTotal = storePrice.price * item.amount;

      summary.totalCost += itemTotal;
      summary.matchedItems += 1;
      summary.itemPrices.push({
        itemName: item.name,
        price: storePrice.price,
        amount: item.amount,
        total: itemTotal,
      });
    }
  }

  // Add unmatched items to each store
  for (const [, summary] of storeMap) {
    summary.unmatchedItems = [...unmatchedItems];
  }

  const stores = Array.from(storeMap.values()).sort((a, b) => a.totalCost - b.totalCost);

  const cheapestStore = stores[0];
  const mostExpensiveStore = stores[stores.length - 1];

  const cheapestTotal = cheapestStore?.totalCost ?? 0;
  const mostExpensiveTotal = mostExpensiveStore?.totalCost ?? 0;
  const savingsAmount = mostExpensiveTotal - cheapestTotal;
  const savingsPercent = mostExpensiveTotal > 0 ? (savingsAmount / mostExpensiveTotal) * 100 : 0;

  return {
    stores,
    cheapestStoreId: cheapestStore?.supermarketName ?? '',
    cheapestTotal,
    mostExpensiveTotal,
    savingsAmount,
    savingsPercent,
    unmatchedItems,
  };
}

export function clearCache(): void {
  cache.clear();
}
