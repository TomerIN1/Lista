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

// ============================================
// unit_qty helpers (package size from price entries)
// ============================================

/**
 * Normalize whitespace in unit_qty strings.
 * API may return "1  ליטר" (double space) or "400 גרם".
 */
export function normalizeUnitQty(raw?: string | null): string | null {
  if (!raw) return null;
  return raw.replace(/\s+/g, ' ').trim() || null;
}

interface ParsedUnitQty {
  value: number;
  unit: 'g' | 'kg' | 'ml' | 'l' | 'units';
  unitLabel: string; // Hebrew display label
}

/**
 * Parse unit_qty string into structured form.
 * "400 גרם" → { value: 400, unit: 'g', unitLabel: 'גרם' }
 * "1 ליטר"  → { value: 1, unit: 'l', unitLabel: 'ליטר' }
 * "1 ק"ג"   → { value: 1, unit: 'kg', unitLabel: 'ק"ג' }
 */
export function parseUnitQty(raw?: string | null): ParsedUnitQty | null {
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, ' ').trim();

  // Extract leading number (int or decimal)
  const numMatch = normalized.match(/^([\d.]+)\s*/);
  if (!numMatch) return null;
  const value = parseFloat(numMatch[1]);
  if (isNaN(value) || value <= 0) return null;

  const rest = normalized.slice(numMatch[0].length).trim().toLowerCase();

  // Detect unit
  if (rest.includes('ק"ג') || rest.includes('ק״ג') || rest === 'קג' || rest === 'kg' || rest.includes('קילו')) {
    return { value, unit: 'kg', unitLabel: 'ק״ג' };
  }
  if (rest.includes('גרם') || rest === 'g' || rest === 'gr') {
    return { value, unit: 'g', unitLabel: 'גרם' };
  }
  if (rest.includes('ליטר') || rest === 'l' || rest === 'liter') {
    return { value, unit: 'l', unitLabel: 'ליטר' };
  }
  if (rest.includes('מ"ל') || rest.includes('מ״ל') || rest === 'ml') {
    return { value, unit: 'ml', unitLabel: 'מ״ל' };
  }
  if (rest.includes('יחידה') || rest.includes('יחידות') || rest === 'units' || rest === 'unit') {
    return { value, unit: 'units', unitLabel: 'יח׳' };
  }

  return null;
}

/**
 * Compute and format a unit price line for packaged products.
 * For weight-based: "₪7.48 ל-100 גרם" (for a 400g product at ₪29.90)
 * For volume-based: "₪8.60 לליטר" (for a 500ml product at ₪4.30)
 * Returns null for weighted products (price IS already per-unit) or if unit_qty is missing/unparseable.
 */
export function formatUnitPriceLine(
  price: number,
  unitQty?: string | null,
  isWeighted?: boolean | null
): string | null {
  // Weighted products already show price per unit — no conversion needed
  if (isWeighted === true) return null;

  const parsed = parseUnitQty(unitQty);
  if (!parsed) return null;

  // Convert to a standard reference unit and format
  let perUnitPrice: number;
  let label: string;

  switch (parsed.unit) {
    case 'g': {
      // Show price per 100g
      if (parsed.value <= 0) return null;
      perUnitPrice = (price / parsed.value) * 100;
      label = 'ל-100 גרם';
      break;
    }
    case 'kg': {
      // Show price per kg (already in kg)
      if (parsed.value <= 0) return null;
      perUnitPrice = price / parsed.value;
      label = 'לק״ג';
      break;
    }
    case 'ml': {
      // Show price per liter
      if (parsed.value <= 0) return null;
      perUnitPrice = (price / parsed.value) * 1000;
      label = 'לליטר';
      break;
    }
    case 'l': {
      // Show price per liter
      if (parsed.value <= 0) return null;
      perUnitPrice = price / parsed.value;
      label = 'לליטר';
      break;
    }
    default:
      return null;
  }

  return `₪${perUnitPrice.toFixed(2)} ${label}`;
}
