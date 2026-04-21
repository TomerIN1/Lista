// utils/calculateSavings.ts
import { ChainTotal, LiveComparisonResult } from '../hooks/useLiveComparison';

/** Savings (₪) shown on the KPIHero pill.
 *  - When the user is viewing the cheapest chain, this is the delta to the next-cheapest.
 *  - When the user is viewing a non-cheapest chain, this is the delta to the cheapest
 *    (will be negative; KPIHero hides the pill when savings <= 0).
 *  - Returns null when there is nothing to compare. */
export function calculateSavings(
  comparison: LiveComparisonResult | null,
  selectedChain: ChainTotal | null,
): number | null {
  if (!comparison || !selectedChain) return null;
  const cheapest = comparison.cheapest;
  if (!cheapest) return null;
  if (selectedChain.chain === cheapest.chain) {
    return comparison.savingsVsNext;
  }
  const sel = selectedChain.totalWithDelivery ?? selectedChain.total;
  const ch = cheapest.totalWithDelivery ?? cheapest.total;
  return ch - sel;
}
