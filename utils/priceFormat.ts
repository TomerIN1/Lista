/**
 * Price formatting utilities for products with unit_of_measure.
 *
 * API values:
 *   "kg"       → produce, bulk goods (price per kilogram)
 *   "100 גרם"  → deli counter items (price per 100g)
 *   "ליטר"     → liquids sold by volume (price per liter)
 *   null       → regular packaged products (price per unit)
 */

/** Map API unit_of_measure values to display suffixes */
function unitSuffix(unitOfMeasure?: string | null): string {
  if (!unitOfMeasure) return '';
  switch (unitOfMeasure) {
    case 'kg': return ' / ק״ג';
    case '100 גרם': return ' / 100 ג׳';
    case 'ליטר': return ' / ליטר';
    default: return ` / ${unitOfMeasure}`;
  }
}

/**
 * Formats a single price with unit suffix.
 * e.g. "₪8.90 / ק״ג", "₪82.00 / 100 ג׳", "₪7.20"
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
 * Returns true if the product is sold by weight/volume (not a regular packaged item).
 */
export function isWeightedProduct(unitOfMeasure?: string | null): boolean {
  return unitOfMeasure === 'kg' || unitOfMeasure === '100 גרם';
}

/**
 * Returns the display label for the unit badge on product cards.
 * e.g. "ק״ג", "100ג׳", "ליטר"
 */
export function unitBadgeLabel(unitOfMeasure?: string | null): string | null {
  switch (unitOfMeasure) {
    case 'kg': return 'ק״ג';
    case '100 גרם': return '100ג׳';
    case 'ליטר': return 'ליטר';
    default: return null;
  }
}

/**
 * Returns the default shopping cart unit for a product.
 * Weighted products default to 'kg', others to 'pcs'.
 */
export function defaultCartUnit(unitOfMeasure?: string | null): 'kg' | 'pcs' {
  return unitOfMeasure === 'kg' ? 'kg' : 'pcs';
}
