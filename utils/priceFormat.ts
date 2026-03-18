/**
 * Price formatting utilities for weighted (per-kg) and regular products.
 */

/**
 * Formats a single price with optional "/ק״ג" suffix for weighted products.
 */
export function formatPriceLabel(price: number, unitOfMeasure?: string | null): string {
  const formatted = `₪${price.toFixed(2)}`;
  if (unitOfMeasure === 'kg') return `${formatted} / ק״ג`;
  return formatted;
}

/**
 * Formats a price range (min–max) with optional "/ק״ג" suffix.
 */
export function formatPriceRange(min: number, max?: number, unitOfMeasure?: string | null): string {
  const suffix = unitOfMeasure === 'kg' ? ' / ק״ג' : '';
  if (!max || min === max) return `₪${min.toFixed(2)}${suffix}`;
  return `₪${min.toFixed(2)} – ₪${max.toFixed(2)}${suffix}`;
}

/**
 * Returns true if the product is sold by weight (per kg).
 */
export function isWeightedProduct(unitOfMeasure?: string | null): boolean {
  return unitOfMeasure === 'kg';
}
