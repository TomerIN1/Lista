/**
 * Price formatting utilities for products with unit_of_measure + is_weighted.
 *
 * is_weighted (from supermarket XML bIsWeighted field) is the source of truth:
 *   true  → sold by weight — use unit_of_measure for the selling unit
 *   false → packaged product — ignore unit_of_measure (it's regulatory)
 *   null  → unknown — fall back to unit_of_measure heuristic
 *
 * Raw API unit_of_measure values observed:
 *   "kg", "ק"ג", "קילוגרמים", "קילו"   → per kilogram
 *   "100 גרם", "ל 100 גרם"              → per 100 grams
 *   "ליטר", "ליטרים"                     → per liter
 *   null                                 → regular packaged product
 */

type NormalizedUnit = 'kg' | '100g' | 'liter' | null;

/**
 * Normalizes the raw API unit_of_measure value to a canonical type.
 */
function normalizeUnit(raw?: string | null): NormalizedUnit {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();

  // Per-kg variants
  if (v === 'kg' || v === 'ק"ג' || v === 'ק״ג' || v === 'קילוגרמים' || v === 'קילו' || v === 'קג') return 'kg';

  // Per-100g variants
  if (v.includes('100') && v.includes('גרם')) return '100g';

  // Per-liter variants
  if (v === 'ליטר' || v === 'ליטרים' || v === 'liter' || v === 'l') return 'liter';

  // Fallback: unknown — treat as null
  return null;
}

/**
 * Returns the effective selling unit, gated by is_weighted.
 * - is_weighted === false → null (packaged, ignore unit_of_measure)
 * - is_weighted === true  → use unit_of_measure
 * - is_weighted === null/undefined → fallback to unit_of_measure heuristic
 */
function effectiveUnit(unitOfMeasure?: string | null, isWeighted?: boolean | null): NormalizedUnit {
  if (isWeighted === false) return null;
  return normalizeUnit(unitOfMeasure);
}

/** Map normalized unit to display suffix */
function unitSuffix(unitOfMeasure?: string | null, isWeighted?: boolean | null): string {
  const unit = effectiveUnit(unitOfMeasure, isWeighted);
  switch (unit) {
    case 'kg': return ' / ק״ג';
    case '100g': return ' / 100 ג׳';
    case 'liter': return ' / ליטר';
    default: return '';
  }
}

/**
 * Formats a single price with unit suffix.
 * e.g. "₪8.90 / ק״ג", "₪82.00 / 100 ג׳", "₪7.20 / ליטר", "₪7.20"
 */
export function formatPriceLabel(price: number, unitOfMeasure?: string | null, isWeighted?: boolean | null): string {
  return `₪${price.toFixed(2)}${unitSuffix(unitOfMeasure, isWeighted)}`;
}

/**
 * Formats a price range (min–max) with unit suffix.
 */
export function formatPriceRange(min: number, max?: number, unitOfMeasure?: string | null, isWeighted?: boolean | null): string {
  const suffix = unitSuffix(unitOfMeasure, isWeighted);
  if (!max || min === max) return `₪${min.toFixed(2)}${suffix}`;
  return `₪${min.toFixed(2)} – ₪${max.toFixed(2)}${suffix}`;
}

/**
 * Returns true if the product is sold by weight (not a regular packaged item).
 */
export function isWeightedProduct(unitOfMeasure?: string | null, isWeighted?: boolean | null): boolean {
  if (isWeighted === true) return true;
  if (isWeighted === false) return false;
  // Fallback: infer from unit_of_measure
  const unit = normalizeUnit(unitOfMeasure);
  return unit === 'kg' || unit === '100g';
}

/**
 * Returns the display label for the unit badge on product cards.
 * e.g. "ק״ג", "100ג׳", "ליטר"
 */
export function unitBadgeLabel(unitOfMeasure?: string | null, isWeighted?: boolean | null): string | null {
  const unit = effectiveUnit(unitOfMeasure, isWeighted);
  switch (unit) {
    case 'kg': return 'ק״ג';
    case '100g': return '100ג׳';
    case 'liter': return 'ליטר';
    default: return null;
  }
}

/**
 * Returns the default shopping cart unit for a product.
 * Per-kg products default to 'kg', others to 'pcs'.
 */
export function defaultCartUnit(unitOfMeasure?: string | null, isWeighted?: boolean | null): 'kg' | 'pcs' {
  return effectiveUnit(unitOfMeasure, isWeighted) === 'kg' ? 'kg' : 'pcs';
}
