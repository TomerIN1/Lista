// hooks/useLiveComparison.ts
import { useEffect, useState, useMemo, useRef } from 'react';
import { ShoppingProduct, DeliveryCheckResult, ListPriceComparison, StorePriceSummary } from '../types';
import { compareListPrices, SUPERMARKET_NAME_MAP } from '../services/priceDbService';

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
}

export interface LiveComparisonResult {
  chains: ChainTotal[];   // sorted: cheapest first (totalWithDelivery preferred when present)
  cheapest: ChainTotal | null;
  /** Difference between cheapest and the chain at index 1. Null if < 2 chains. */
  savingsVsNext: number | null;
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
        setData(toLiveComparison(result));
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSignature, city, cityCode, storeType, eligibleStoreIds, deliveryFees]);

  return { data, loading, error };
}

function toLiveComparison(r: ListPriceComparison): LiveComparisonResult {
  const chains: ChainTotal[] = r.stores.map((s: StorePriceSummary) => ({
    chain: chainCodeFromDisplay(s.supermarketName), // canonical code, used by chainBranding helpers
    displayName: s.supermarketName,                  // human-readable, used in UI text
    total: s.totalCost,
    totalWithDelivery: s.totalWithDelivery,
    deliveryFee: s.deliveryFee,
    matchedItems: s.matchedItems,
  }));

  // Resort here too for safety: prefer totalWithDelivery when available.
  chains.sort((a, b) => {
    const aCost = a.totalWithDelivery ?? a.total;
    const bCost = b.totalWithDelivery ?? b.total;
    return aCost - bCost;
  });

  const cheapest = chains[0] ?? null;
  const next = chains[1] ?? null;
  const savingsVsNext = cheapest && next
    ? (next.totalWithDelivery ?? next.total) - (cheapest.totalWithDelivery ?? cheapest.total)
    : null;

  return { chains, cheapest, savingsVsNext };
}
