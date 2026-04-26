// hooks/useLiveComparison.ts
import { useEffect, useState, useMemo, useRef } from 'react';
import { ShoppingProduct, DeliveryCheckResult, ListPriceComparison, StorePriceSummary } from '../types';
import { compareListPrices, SUPERMARKET_NAME_MAP } from '../services/priceDbService';
import { DEFAULT_CATEGORY } from '../agents_and_ai/product-discovery-assistant/listaCategories';

/** Missing item enriched with the user's basket-side category (Lista taxonomy)
 *  so the BuyPhaseEntry expanded view can group + sort by category. */
export interface UnmatchedItem {
  name: string;
  category: string;
}

/** Reverse-lookup: turn a display name (e.g. "ויקטורי") back into a canonical
 *  chain code (e.g. "victory") so we can call into chainBranding helpers. */
function chainCodeFromDisplay(displayName: string): string {
  for (const [code, name] of Object.entries(SUPERMARKET_NAME_MAP)) {
    if (name === displayName) return code;
  }
  return displayName.toLowerCase();
}

export interface ChainTotal {
  chain: string;          // canonical code, e.g. "victory"
  displayName: string;    // SUPERMARKET_NAME_MAP-resolved, e.g. "ויקטורי"
  total: number;          // subtotal at this chain
  totalWithDelivery?: number;
  deliveryFee?: number;
  matchedItems: number;
  // NEW: data-derived badge fields
  unmatchedItems: UnmatchedItem[];
  minimumOrder: number | null;
  belowMinimum: boolean;
}

export interface LiveComparisonResult {
  chains: ChainTotal[];   // sorted: cheapest first (totalWithDelivery preferred when present)
  cheapest: ChainTotal | null;
  /** Difference between cheapest and the chain at index 1. Null if < 2 chains. */
  savingsVsNext: number | null;
  /** Unique items in the cart at comparison time. Consumers compute per-chain
   *  "missing N" as totalItems - chain.matchedItems — comparing against a
   *  leader chain is wrong when every chain is short by the same item. */
  totalItems: number;
}

interface UseLiveComparisonInput {
  products: ShoppingProduct[];
  city?: string;
  cityCode?: number;
  storeType?: string;     // 'online' | 'physical' | undefined
  deliveryCheck?: DeliveryCheckResult | null;
}

const DEBOUNCE_MS = 600;

export function useLiveComparison(input: UseLiveComparisonInput): {
  data: LiveComparisonResult | null;
  loading: boolean;
  error: string | null;
} {
  const { products, city, cityCode, storeType, deliveryCheck } = input;
  const [data, setData] = useState<LiveComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build a stable signature of the cart so we only refetch when items change.
  const cartSignature = useMemo(
    () => products
      .map(p => `${p.barcode}:${p.amount}`)
      .sort()
      .join(','),
    [products],
  );

  // Pull eligible store ids + delivery fee map from deliveryCheck (if present).
  const eligibleStoreIds = useMemo(
    () => deliveryCheck?.eligible_store_ref_ids ?? undefined,
    [deliveryCheck],
  );
  const deliveryFees = useMemo(() => {
    if (!deliveryCheck) return undefined;
    const map: Record<number, number> = {};
    for (const c of deliveryCheck.chains) {
      if (c.delivery_fee != null) map[c.store_ref_id] = c.delivery_fee;
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [deliveryCheck]);

  // Chains that deliver (or do click-and-collect) to the user's city. Used to
  // filter the comparison so non-deliverable chains (e.g. מחסני השוק when user
  // is in קריית אונו) never appear in the strip, KPI, or mobile bar — even if
  // the backend returns them. Null means "no filter" (physical mode or no
  // delivery check yet).
  //
  // Names are stored BOTH raw (e.g. "Market Warehouses") and translated through
  // SUPERMARKET_NAME_MAP ("מחסני השוק"). The comparison API returns Hebrew
  // display names, the delivery-check API tends to return English — matching
  // on either form keeps us robust to which side changes.
  const deliverableChainNames = useMemo<Set<string> | null>(() => {
    if (!deliveryCheck?.chains) return null;
    if (storeType !== 'online') return null;
    const set = new Set<string>();
    for (const c of deliveryCheck.chains) {
      if (!(c.delivers || c.click_and_collect)) continue;
      set.add(c.chain);
      const translated = SUPERMARKET_NAME_MAP[c.chain];
      if (translated) set.add(translated);
    }
    return set;
  }, [deliveryCheck, storeType]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (products.length === 0) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const result: ListPriceComparison = await compareListPrices({
          items: products.map(p => ({ barcode: p.barcode, quantity: p.amount })),
          city,
          city_code: cityCode,
          store_type: storeType,
          eligible_store_ref_ids: eligibleStoreIds,
          delivery_fees: deliveryFees,
        });
        setData(toLiveComparison(result, deliverableChainNames, products.length, products));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Comparison failed');
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // products is intentionally NOT in deps: cartSignature is the stable
  // canonical representation, and listing products would refetch on every
  // re-render when the array identity changes but contents don't.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSignature, city, cityCode, storeType, eligibleStoreIds, deliveryFees, deliverableChainNames]);

  return { data, loading, error };
}

function toLiveComparison(
  r: ListPriceComparison,
  deliverableChainNames: Set<string> | null,
  totalItems: number,
  products: ShoppingProduct[],
): LiveComparisonResult {
  // Build a name → Lista-taxonomy category lookup from the user's basket.
  // The compare API returns unmatchedItems by name; matching back to the
  // basket gives us the canonical category for grouping in BuyPhaseEntry.
  const categoryByName = new Map<string, string>();
  for (const p of products) {
    if (p.name) categoryByName.set(p.name, p.category || DEFAULT_CATEGORY);
  }

  const allChains: ChainTotal[] = r.stores.map((s: StorePriceSummary) => {
    const cost = s.totalWithDelivery ?? s.totalCost;
    const minimumOrder = s.minimumOrder ?? null;
    const belowMinimum =
      minimumOrder != null && minimumOrder > 0 && cost < minimumOrder;

    return {
      chain: chainCodeFromDisplay(s.supermarketName), // canonical code, used by chainBranding helpers
      displayName: s.supermarketName,                  // human-readable, used in UI text
      total: s.totalCost,
      totalWithDelivery: s.totalWithDelivery,
      deliveryFee: s.deliveryFee,
      // Count only items that actually carry a usable price at this branch.
      // The API's `matchedItems` field counts items flagged `available: true`
      // even when their `effective_unit_price` is null (happens for some weighted
      // deli items whose per-branch weight price wasn't computable). The basket
      // breakdown + PricePilot use the priced-item set as the source of truth, so
      // we align the strip and KPI ranking to the same count.
      matchedItems: s.itemPrices.length,
      unmatchedItems: s.unmatchedItems.map(name => ({
        name,
        category: categoryByName.get(name) ?? DEFAULT_CATEGORY,
      })),
      minimumOrder,
      belowMinimum,
    };
  });

  // Drop chains that don't deliver to the user's city when in online mode.
  // deliveryCheck.chains[].chain is a display name (e.g. "מחסני השוק"), which
  // matches StorePriceSummary.supermarketName → ChainTotal.displayName.
  const chains = deliverableChainNames
    ? allChains.filter(c => deliverableChainNames.has(c.displayName))
    : allChains;

  // Sort: most matched items first (so a chain with partial matches doesn't
  // look "cheapest" just because it's missing items), then by cost asc.
  chains.sort((a, b) => {
    if (b.matchedItems !== a.matchedItems) return b.matchedItems - a.matchedItems;
    const aCost = a.totalWithDelivery ?? a.total;
    const bCost = b.totalWithDelivery ?? b.total;
    return aCost - bCost;
  });

  const cheapest = chains[0] ?? null;
  const next = chains[1] ?? null;
  const savingsVsNext = cheapest && next
    ? (next.totalWithDelivery ?? next.total) - (cheapest.totalWithDelivery ?? cheapest.total)
    : null;

  return { chains, cheapest, savingsVsNext, totalItems };
}
