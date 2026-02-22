import {
  DbProduct,
  DbProductSearchResult,
  DbPriceComparison,
  DbPromotion,
  DbSupermarket,
  ListPriceComparison,
  StorePriceSummary,
  StoreBranch,
  ItemPriceDetail,
  ItemPromotion,
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
// Core: Compare Entire Shopping List (single POST call)
// ============================================

export interface ShoppingListCompareRequest {
  items: { barcode: string; quantity: number }[];
  city?: string;
  city_code?: number;
  store_type?: string;
}

// API response types for POST /api/shopping-list/compare
interface ApiStoreItemPromotion {
  description: string;
  type: string;
  ends_at: string | null;
}

interface ApiStoreItem {
  barcode: string;
  name: string | null;
  quantity: number;
  unit_price: number | null;
  effective_unit_price: number | null;
  total_price: number | null;
  promotion: ApiStoreItemPromotion | null;
  available: boolean;
}

interface ApiStore {
  store_ref_id: number;
  store_name: string;
  store_chain_id: string;
  city: string;
  address: string | null;
  is_online: boolean;
  matched_items: number;
  total_items: number;
  subtotal: number;
  delivery_fee: number | null;
  minimum_order: number | null;
  free_delivery_threshold: number | null;
  below_minimum_order: boolean;
  total: number;
  items: ApiStoreItem[];
  missing_items: string[];
}

interface ApiCompareResponse {
  stores: ApiStore[];
  cheapest_store: number | null;
  cheapest_per_item: Record<string, { store_ref_id: number; store_name: string; effective_unit_price: number; promotion_description: string | null }>;
  savings_vs_most_expensive: number | null;
}

// Map a barcode → name from the API response items (for unmatched items display)
function buildBarcodeNameMap(stores: ApiStore[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const store of stores) {
    for (const item of store.items) {
      if (item.name && !map.has(item.barcode)) {
        map.set(item.barcode, item.name);
      }
    }
  }
  return map;
}

export async function compareListPrices(
  request: ShoppingListCompareRequest
): Promise<ListPriceComparison> {
  const cacheKey = `compare-list:${JSON.stringify(request.items.map(i => i.barcode).sort())}:${request.city || ''}:${request.store_type || ''}`;
  const cached = cache.get<ListPriceComparison>(cacheKey);
  if (cached) return cached;

  const url = `${API_BASE}/api/shopping-list/compare`;
  const response = await fetch(url.startsWith('http') ? url : `${window.location.origin}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data: ApiCompareResponse = await response.json();
  const barcodeNames = buildBarcodeNameMap(data.stores);

  // Group branches by chain name (same store_name may have multiple branches)
  const chainMap = new Map<string, ApiStore[]>();
  for (const store of data.stores) {
    const displayName = SUPERMARKET_NAME_MAP[store.store_name] || store.store_name;
    const existing = chainMap.get(displayName) || [];
    existing.push(store);
    chainMap.set(displayName, existing);
  }

  // Map an API item to our ItemPriceDetail (with promotion data)
  const mapItemPrice = (item: ApiStoreItem): ItemPriceDetail => {
    const detail: ItemPriceDetail = {
      itemName: item.name || item.barcode,
      price: item.effective_unit_price!,
      amount: item.quantity,
      total: item.total_price!,
    };
    // Include original price if there's a discount
    if (item.promotion && item.unit_price != null && item.unit_price !== item.effective_unit_price) {
      detail.originalPrice = item.unit_price;
      detail.promotion = {
        description: item.promotion.description,
        type: item.promotion.type,
        endsAt: item.promotion.ends_at,
      };
    }
    return detail;
  };

  const isOnlineMode = request.store_type === 'online';
  const stores: StorePriceSummary[] = [];

  for (const [chainName, branches] of chainMap) {
    // Sort branches: most matched first, then cheapest
    branches.sort((a, b) => {
      if (b.matched_items !== a.matched_items) return b.matched_items - a.matched_items;
      return a.total - b.total;
    });

    const best = branches[0];

    // Build item price details from best branch
    const itemPrices: ItemPriceDetail[] = best.items
      .filter((item) => item.available && item.effective_unit_price != null)
      .map(mapItemPrice);

    // Unmatched items: missing from this store
    const unmatchedItems = best.missing_items.map(
      (barcode) => barcodeNames.get(barcode) || barcode
    );

    // Build available branches list for branch selector
    const availableBranches: StoreBranch[] = branches.map((b) => ({
      storeId: String(b.store_ref_id),
      address: b.address,
      totalCost: b.total,
      itemPrices: b.items
        .filter((item) => item.available && item.effective_unit_price != null)
        .map(mapItemPrice),
    }));

    const summary: StorePriceSummary = {
      supermarketName: chainName,
      totalCost: best.subtotal,
      matchedItems: best.matched_items,
      unmatchedItems,
      itemPrices,
      storeAddress: best.address || undefined,
      selectedStoreId: String(best.store_ref_id),
      availableBranches: branches.length > 1 ? availableBranches : undefined,
      deliveryFee: best.delivery_fee ?? undefined,
      minimumOrder: best.minimum_order,
    };

    if (isOnlineMode && best.delivery_fee != null) {
      summary.totalWithDelivery = best.subtotal + best.delivery_fee;
    }

    stores.push(summary);
  }

  // Sort: most matched items first, then cheapest within same match count
  stores.sort((a, b) => {
    if (b.matchedItems !== a.matchedItems) return b.matchedItems - a.matchedItems;
    const aCost = a.totalWithDelivery ?? a.totalCost;
    const bCost = b.totalWithDelivery ?? b.totalCost;
    return aCost - bCost;
  });

  // Savings: compare only within the top coverage tier
  const topTierMatched = stores[0]?.matchedItems ?? 0;
  const topTierStores = stores.filter((s) => s.matchedItems === topTierMatched);
  const cheapestStore = topTierStores[0];
  const mostExpensiveStore = topTierStores[topTierStores.length - 1];
  const cheapestTotal = cheapestStore?.totalWithDelivery ?? cheapestStore?.totalCost ?? 0;
  const mostExpensiveTotal = mostExpensiveStore?.totalWithDelivery ?? mostExpensiveStore?.totalCost ?? 0;
  const savingsAmount = mostExpensiveTotal - cheapestTotal;
  const savingsPercent = mostExpensiveTotal > 0 ? (savingsAmount / mostExpensiveTotal) * 100 : 0;

  // Global unmatched: items not carried by any store
  const globalUnmatched: string[] = [];
  const allBarcodes = new Set(request.items.map((i) => i.barcode));
  for (const barcode of allBarcodes) {
    const carriedAnywhere = data.stores.some((s) =>
      s.items.some((item) => item.barcode === barcode && item.available)
    );
    if (!carriedAnywhere) {
      globalUnmatched.push(barcodeNames.get(barcode) || barcode);
    }
  }

  const result: ListPriceComparison = {
    stores,
    cheapestStoreId: cheapestStore?.supermarketName ?? '',
    cheapestTotal,
    mostExpensiveTotal,
    savingsAmount,
    savingsPercent,
    unmatchedItems: globalUnmatched,
    totalListItems: request.items.length,
  };

  cache.set(cacheKey, result, PRICES_TTL);
  return result;
}

export function clearCache(): void {
  cache.clear();
}
