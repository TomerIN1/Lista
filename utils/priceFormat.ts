/**
 * Price formatting utilities for products with unit_of_measure.
 *
 * The API returns inconsistent values from different supermarket chains.
 * We normalize them into 3 canonical types: 'kg', '100g', 'liter'.
 *
 * Raw API values observed:
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

  // Fallback: if it mentions גרם without 100, or unknown — treat as null
  return null;
}

/** Map normalized unit to display suffix */
function unitSuffix(unitOfMeasure?: string | null): string {
  const unit = normalizeUnit(unitOfMeasure);
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
export function formatPriceLabel(price: number, unitOfMeasure?: string | null): string {
  return `₪${price.toFixed(2)}${unitSuffix(unitOfMeasure)}`;
}

/**
 * Formats a price range (min–max) with unit suffix.
 */
export function formatPriceRange(min: number, max?: number, unitOfMeasure?: string | null): string {
  const suffix = unitSuffix(unitOfMeasure);
  if (!max || min === max) return `₪${min.toFixed(2)}${suffix}`;
  return `₪${min.toFixed(2)} – ₪${max.toFixed(2)}${suffix}`;
}

/**
 * Returns true if the product is sold by weight (not a regular packaged item).
 */
export function isWeightedProduct(unitOfMeasure?: string | null): boolean {
  const unit = normalizeUnit(unitOfMeasure);
  return unit === 'kg' || unit === '100g';
}

/**
 * Returns the display label for the unit badge on product cards.
 * e.g. "ק״ג", "100ג׳", "ליטר"
 */
export function unitBadgeLabel(unitOfMeasure?: string | null): string | null {
  const unit = normalizeUnit(unitOfMeasure);
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
export function defaultCartUnit(unitOfMeasure?: string | null): 'kg' | 'pcs' {
  return normalizeUnit(unitOfMeasure) === 'kg' ? 'kg' : 'pcs';
}
