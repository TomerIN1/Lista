/**
 * Basket strategy computation utilities.
 *
 * Given a ListPriceComparison (from the compare API), computes two strategies:
 * - Single Store: cheapest single store for the full list
 * - Multi-Store: buy each item at whichever store has the cheapest price
 *
 * Pure functions, no side effects.
 */

import {
  ListPriceComparison,
  ItemPriceDetail,
  SingleStoreBasket,
  MultiStoreBasket,
  StoreBasketBreakdown,
  BasketComparison,
} from '../types';

/** Minimum savings threshold (₪) to recommend multi-store over single */
const MIN_SAVINGS_THRESHOLD = 2;

/**
 * Compute both basket strategies and determine which is recommended.
 *
 * @param comparison - The full price comparison result (must include cheapestPerItem)
 * @param isOnline - Whether this is online mode (delivery fees apply)
 * @returns BasketComparison with both strategies and a recommendation
 */
export function computeBasketComparison(
  comparison: ListPriceComparison,
  isOnline: boolean
): BasketComparison {
  const single = computeSingleStore(comparison, isOnline);
  const multi = computeMultiStore(comparison, isOnline);

  const savingsAmount = single.total - multi.total; // positive = multi is cheaper
  const recommended = savingsAmount >= MIN_SAVINGS_THRESHOLD ? 'multi' : 'single';

  return { single, multi, recommended, savingsAmount };
}

/**
 * Single-store strategy: take the best-ranked store from the comparison.
 */
function computeSingleStore(
  comparison: ListPriceComparison,
  isOnline: boolean
): SingleStoreBasket {
  const best = comparison.stores[0];
  if (!best) {
    return {
      type: 'single',
      storeName: '',
      subtotal: 0,
      deliveryFee: 0,
      total: 0,
      matchedItems: 0,
      missingItems: [],
    };
  }

  const deliveryFee = isOnline ? (best.deliveryFee ?? 0) : 0;

  return {
    type: 'single',
    storeName: best.supermarketName,
    subtotal: best.totalCost,
    deliveryFee,
    total: best.totalCost + deliveryFee,
    matchedItems: best.matchedItems,
    missingItems: best.unmatchedItems,
  };
}

/**
 * Multi-store strategy: for each item, buy from whichever store is cheapest.
 * Groups items by store, sums per-store subtotals, adds delivery fees.
 */
function computeMultiStore(
  comparison: ListPriceComparison,
  isOnline: boolean
): MultiStoreBasket {
  const cheapestPerItem = comparison.cheapestPerItem;

  if (!cheapestPerItem || Object.keys(cheapestPerItem).length === 0) {
    // No per-item data — fall back to single store equivalent
    const single = computeSingleStore(comparison, isOnline);
    return {
      type: 'multi',
      storeBreakdowns: [{
        storeName: single.storeName,
        items: comparison.stores[0]?.itemPrices ?? [],
        subtotal: single.subtotal,
        deliveryFee: single.deliveryFee,
        total: single.total,
        belowMinimum: false,
        minimumOrder: null,
      }],
      subtotal: single.subtotal,
      totalDeliveryFees: single.deliveryFee,
      total: single.total,
      storeCount: 1,
      matchedItems: single.matchedItems,
      missingItems: single.missingItems,
    };
  }

  // Build a lookup: storeName → StorePriceSummary (for delivery fees, minimum orders)
  const storeInfoMap = new Map(
    comparison.stores.map(s => [s.supermarketName, s])
  );

  // Build a lookup: storeName → per-item prices from that store
  // We need to find the actual ItemPriceDetail for each item at its cheapest store
  const storeItemMap = new Map<string, Map<string, ItemPriceDetail>>();
  for (const store of comparison.stores) {
    const itemMap = new Map<string, ItemPriceDetail>();
    for (const item of store.itemPrices) {
      itemMap.set(item.itemName, item);
    }
    storeItemMap.set(store.supermarketName, itemMap);
  }

  // Group items by their cheapest store
  const groupedByStore = new Map<string, ItemPriceDetail[]>();
  const missingItems: string[] = [];
  let totalMatchedItems = 0;

  for (const [barcode, info] of Object.entries(cheapestPerItem)) {
    const storeName = info.storeName;

    // Find the ItemPriceDetail for this item at this store
    const storeItems = storeItemMap.get(storeName);
    // Find by matching price (we don't have barcode in ItemPriceDetail, so match by price)
    let itemDetail: ItemPriceDetail | undefined;
    if (storeItems) {
      // Try to find matching item — iterate all items looking for matching price
      for (const [, detail] of storeItems) {
        if (Math.abs(detail.price - info.price) < 0.01) {
          // Check if this item wasn't already assigned
          const existingGroup = groupedByStore.get(storeName);
          if (!existingGroup?.includes(detail)) {
            itemDetail = detail;
            break;
          }
        }
      }
    }

    if (!itemDetail) {
      // Build a synthetic ItemPriceDetail from cheapestPerItem data
      // We need the item name — look across all stores
      let itemName = barcode;
      for (const store of comparison.stores) {
        const found = store.itemPrices.find(ip => Math.abs(ip.price - info.price) < 0.01);
        if (found) { itemName = found.itemName; break; }
      }
      itemDetail = {
        itemName,
        price: info.price,
        amount: 1,
        total: info.price,
      };
    }

    const group = groupedByStore.get(storeName) ?? [];
    group.push(itemDetail);
    groupedByStore.set(storeName, group);
    totalMatchedItems++;
  }

  // Items not in cheapestPerItem are globally unmatched
  missingItems.push(...comparison.unmatchedItems);

  // Build per-store breakdowns
  const storeBreakdowns: StoreBasketBreakdown[] = [];
  let totalSubtotal = 0;
  let totalDeliveryFees = 0;

  for (const [storeName, items] of groupedByStore) {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const storeInfo = storeInfoMap.get(storeName);
    const deliveryFee = isOnline ? (storeInfo?.deliveryFee ?? 0) : 0;
    const minimumOrder = storeInfo?.minimumOrder ?? null;
    const belowMinimum = minimumOrder != null && minimumOrder > 0 && subtotal < minimumOrder;

    storeBreakdowns.push({
      storeName,
      items,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      belowMinimum,
      minimumOrder,
    });

    totalSubtotal += subtotal;
    totalDeliveryFees += deliveryFee;
  }

  // Sort breakdowns: most items first, then by subtotal
  storeBreakdowns.sort((a, b) => b.items.length - a.items.length || b.subtotal - a.subtotal);

  return {
    type: 'multi',
    storeBreakdowns,
    subtotal: totalSubtotal,
    totalDeliveryFees,
    total: totalSubtotal + totalDeliveryFees,
    storeCount: storeBreakdowns.length,
    matchedItems: totalMatchedItems,
    missingItems,
  };
}
