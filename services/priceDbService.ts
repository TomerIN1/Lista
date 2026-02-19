import {
  DbProduct,
  DbProductSearchResult,
  DbPriceComparison,
  DbPromotion,
  DbSupermarket,
  DbStorePrice,
  ListPriceComparison,
  StorePriceSummary,
  StoreBranch,
  ItemPriceDetail,
  CategoryGroup,
} from '../types';

// ============================================
// Configuration
// ============================================

// Use /price-api proxy in both dev (Vite proxy) and production (Vercel rewrite) to avoid CORS
const API_BASE = '/price-api';

// Map English API names → Hebrew display names
const SUPERMARKET_NAME_MAP: Record<string, string> = {
  'Shufersal': 'שופרסל',
  'Victory': 'ויקטורי',
  'Market Warehouses': 'מחסני השוק',
  'H. Cohen': 'ח. כהן',
  'Rami Levy': 'רמי לוי',
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
  offset: number = 0,
  city?: string,
  storeType?: string
): Promise<DbProductSearchResult> {
  const cacheKey = `search:${query}:${limit}:${offset}:${city || ''}:${storeType || ''}`;
  const cached = cache.get<DbProductSearchResult>(cacheKey);
  if (cached) return cached;

  const params: Record<string, string | number> = { q: query, limit, offset };
  // Note: city is NOT passed to the search endpoint — the API's /api/products/search
  // does not support city filtering (returns 0 results). City filtering is handled
  // by the price comparison endpoints instead. storeType works and filters by store kind.
  if (storeType) params.store_type = storeType;

  const result = await apiFetch<DbProductSearchResult>('/api/products/search', params);

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

export async function comparePrices(
  barcode: string,
  city?: string,
  storeType?: string
): Promise<DbPriceComparison | null> {
  const cacheKey = `compare:${barcode}:${city || ''}:${storeType || ''}`;
  const cached = cache.get<DbPriceComparison | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    const params: Record<string, string | number> = {};
    if (city) params.city = city;
    if (storeType) params.store_type = storeType;

    // The price data comes from the product detail endpoint (not a separate /prices route)
    const result = await apiFetch<DbPriceComparison>(`/api/products/${barcode}`, params);
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

export async function getCities(storeType?: string): Promise<string[]> {
  const cacheKey = `cities:${storeType || 'all'}`;
  const cached = cache.get<string[]>(cacheKey);
  if (cached) return cached;

  const params: Record<string, string | number> = {};
  if (storeType) params.store_type = storeType;

  const result = await apiFetch<{ cities: string[] }>('/api/cities', params);
  cache.set(cacheKey, result.cities, SUPERMARKETS_TTL);
  return result.cities;
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
  groups: CategoryGroup[],
  city?: string,
  storeType?: string
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
      const searchResult = await searchProducts(item.name, 1, 0, city, storeType);
      if (searchResult.products && searchResult.products.length > 0) {
        barcode = searchResult.products[0].barcode;
      }
    }

    if (!barcode) {
      return { item, priceData: null };
    }

    const priceData = await comparePrices(barcode, city, storeType);
    return { item, priceData };
  });

  const results = await withConcurrencyLimit(tasks, 5);

  // Determine if we have branch-level data (physical mode)
  const hasBranchData = results.some(
    (r) =>
      r.status === 'fulfilled' &&
      r.value.priceData?.prices?.some((sp: DbStorePrice) => sp.store && !sp.store.is_online)
  );

  // Build per-store totals
  const storeMap = new Map<string, StorePriceSummary>();
  const unmatchedItems: string[] = [];

  // For branch-aware mode: track per-branch item prices
  // Key: "chainName::storeId", Value: { itemPrices, totalCost }
  const branchMap = new Map<
    string,
    { chainName: string; storeId: string; address: string | null; totalCost: number; itemPrices: ItemPriceDetail[] }
  >();

  for (const result of results) {
    if (result.status === 'rejected') continue;

    const { item, priceData } = result.value;
    if (!priceData || !priceData.prices || priceData.prices.length === 0) {
      unmatchedItems.push(item.name);
      continue;
    }

    if (hasBranchData) {
      // Branch-aware grouping: group by chain+storeId
      for (const sp of priceData.prices) {
        const chainName = SUPERMARKET_NAME_MAP[sp.supermarket] || sp.supermarket;
        const storeId = sp.store?.store_id || '_default';
        const address = sp.store?.address || null;
        const branchKey = `${chainName}::${storeId}`;

        if (!branchMap.has(branchKey)) {
          branchMap.set(branchKey, { chainName, storeId, address, totalCost: 0, itemPrices: [] });
        }

        const branch = branchMap.get(branchKey)!;
        const itemTotal = sp.price * item.amount;
        branch.totalCost += itemTotal;
        branch.itemPrices.push({
          itemName: item.name,
          price: sp.price,
          amount: item.amount,
          total: itemTotal,
        });
      }
    } else {
      // Online / no-branch mode: original dedup (cheapest per chain)
      const dedupedPrices = new Map<string, { supermarket: string; price: number; store?: typeof priceData.prices[0]['store'] }>();
      for (const sp of priceData.prices) {
        const name = SUPERMARKET_NAME_MAP[sp.supermarket] || sp.supermarket;
        const existing = dedupedPrices.get(name);
        if (!existing || sp.price < existing.price) {
          dedupedPrices.set(name, { supermarket: name, price: sp.price, store: sp.store });
        }
      }

      for (const [storeName, storePrice] of dedupedPrices) {
        if (!storeMap.has(storeName)) {
          storeMap.set(storeName, {
            supermarketName: storeName,
            totalCost: 0,
            matchedItems: 0,
            unmatchedItems: [],
            itemPrices: [],
            deliveryFee: storePrice.store?.delivery_fee,
            minimumOrder: storePrice.store?.minimum_order,
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
  }

  // If branch-aware mode, collapse branches into StorePriceSummary entries
  if (hasBranchData) {
    // Group branches by chain name
    const chainBranches = new Map<string, typeof branchMap extends Map<string, infer V> ? V[] : never>();
    for (const branch of branchMap.values()) {
      const existing = chainBranches.get(branch.chainName) || [];
      existing.push(branch);
      chainBranches.set(branch.chainName, existing);
    }

    for (const [chainName, branches] of chainBranches) {
      // Sort branches: cheapest total first
      branches.sort((a, b) => a.totalCost - b.totalCost);
      const cheapest = branches[0];

      const availableBranches: StoreBranch[] = branches.map((b) => ({
        storeId: b.storeId,
        address: b.address,
        totalCost: b.totalCost,
        itemPrices: b.itemPrices,
      }));

      storeMap.set(chainName, {
        supermarketName: chainName,
        totalCost: cheapest.totalCost,
        matchedItems: cheapest.itemPrices.length,
        unmatchedItems: [],
        itemPrices: cheapest.itemPrices,
        storeAddress: cheapest.address || undefined,
        selectedStoreId: cheapest.storeId,
        availableBranches,
      });
    }
  }

  // Build the full list of item names for per-store unavailable tracking
  const allItemNames = items.map((item) => item.name);

  // For each store, compute unavailable items and delivery-inclusive totals
  const isOnlineMode = storeType === 'online';
  for (const [, summary] of storeMap) {
    const matchedSet = new Set(summary.itemPrices.map((ip) => ip.itemName));
    summary.unmatchedItems = allItemNames.filter((name) => !matchedSet.has(name));

    // Compute total with delivery for online stores
    if (isOnlineMode && summary.deliveryFee != null) {
      summary.totalWithDelivery = summary.totalCost + summary.deliveryFee;
    }
  }

  // Sort: most matched items first, then cheapest within same match count
  // For online mode, use totalWithDelivery when available
  const stores = Array.from(storeMap.values()).sort((a, b) => {
    if (b.matchedItems !== a.matchedItems) return b.matchedItems - a.matchedItems;
    const aCost = a.totalWithDelivery ?? a.totalCost;
    const bCost = b.totalWithDelivery ?? b.totalCost;
    return aCost - bCost;
  });

  // Savings: compare only within the top coverage tier (stores with the most items)
  const topTierMatched = stores[0]?.matchedItems ?? 0;
  const topTierStores = stores.filter((s) => s.matchedItems === topTierMatched);

  const cheapestStore = topTierStores[0];
  const mostExpensiveStore = topTierStores[topTierStores.length - 1];

  // Use delivery-inclusive totals for savings in online mode
  const cheapestTotal = cheapestStore?.totalWithDelivery ?? cheapestStore?.totalCost ?? 0;
  const mostExpensiveTotal = mostExpensiveStore?.totalWithDelivery ?? mostExpensiveStore?.totalCost ?? 0;
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
    totalListItems: items.length,
  };
}

export function clearCache(): void {
  cache.clear();
}
