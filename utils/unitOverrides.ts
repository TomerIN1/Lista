/**
 * Per-product unit overrides.
 *
 * Some products are technically sold by weight in supermarkets (is_weighted=true
 * in the XML feed), but the natural purchase unit for shoppers is "1 of the thing"
 * — e.g., cabbage heads, cauliflower. Rami Levy solves this by letting shoppers
 * pick a quantity of units; the final price is computed against a typical weight.
 *
 * This module is a name-pattern → estimated-kg-per-unit lookup. When a match is
 * found, the cart uses 'pcs' as the selling unit and multiplies price × kg × amount.
 */

export interface UnitOverride {
  estimatedKgPerUnit: number;
}

const UNIT_OVERRIDE_PATTERNS: Array<{ pattern: RegExp; kg: number }> = [
  { pattern: /כרוב\s*לבן/, kg: 1.2 },
  { pattern: /כרוב\s*אדום/, kg: 1.2 },
  { pattern: /כרובית/, kg: 0.8 },
  { pattern: /אבטיח/, kg: 5.0 },
  { pattern: /אננס/, kg: 1.3 },
];

export function getUnitOverride(name?: string | null): UnitOverride | null {
  if (!name) return null;
  const match = UNIT_OVERRIDE_PATTERNS.find(({ pattern }) => pattern.test(name));
  return match ? { estimatedKgPerUnit: match.kg } : null;
}
