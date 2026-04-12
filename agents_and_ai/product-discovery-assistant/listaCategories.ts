/**
 * The 23 fixed Lista categories (Hebrew), mirrored from /public/category-icons/.
 * Used by the Product Discovery Assistant to classify search results into
 * consistent buckets with visual separation in the chat panel.
 */

export const LISTA_CATEGORIES = [
  'פירות וירקות',
  'מוצרי חלב וביצים',
  'בשר עוף דגים ומעדניה',
  'לחם מאפים ודגני בוקר',
  'קפואים',
  'שימורים רטבים וממרחים',
  'מזווה בישול ואפייה',
  'חטיפים מתוקים ופיצוחים',
  'משקאות',
  'יין בירה ואלכוהול',
  'ניקיון כביסה וחד פעמי',
  'פארם טיפוח אישי ובריאות',
  'בית מטבח ואירוח',
  'תינוקות',
  'חיות מחמד',
  'בריאות טבע וללא גלוטן',
  'חשמל אלקטרוניקה וסוללות',
  'טקסטיל והלבשה בסיסית',
  'פנאי נסיעות ועונתי',
  'פרחים גינה וחוץ',
  'טבק ועישון',
  'מבצעים',
  'אחר ולא מסווג',
] as const;

export type ListaCategory = typeof LISTA_CATEGORIES[number];

export const DEFAULT_CATEGORY: ListaCategory = 'אחר ולא מסווג';

export function iconUrl(category: string): string {
  return `/category-icons/${encodeURIComponent(category)}.svg`;
}

export function isValidCategory(c: string | undefined): c is ListaCategory {
  return !!c && (LISTA_CATEGORIES as readonly string[]).includes(c);
}

/**
 * Fresh-first filtering: tokens that indicate a PROCESSED version of a
 * fresh product (pickled, canned, frozen, dried, sliced, flavored, etc.).
 * When preferFresh is true, products whose name contains any of these
 * tokens are filtered out. If nothing remains, we fall back to all results.
 */
export const PROCESSED_TOKENS: string[] = [
  'חמוץ', 'כבוש', 'כבושים', 'בחומץ', 'חמוצים', 'במלח',
  'קפוא', 'קפואה', 'קפואים',
  'משומר', 'משומרים', 'שימור', 'שימורי',
  'מיובש', 'מיובשים', 'יבש', 'יבשים',
  'מטוגן', 'מטוגנים', 'צ׳יפס', "צ'יפס", 'חטיף',
  'ממולא', 'ממולאים',
  'רוטב', 'רסק', 'ממרח', 'פירה',
  'משקה', 'מיץ',
  'מרוכז',
  'בטעם',
  'פרוס', 'פרוסים', 'פרוסות',
  'מעושן', 'מעושנים',
  'אבקה', 'אבקת',
  'פסטה',
];

/**
 * Product categories that should be treated as "fresh-first" when the user
 * asks for them generically. Maps Lista category → whether fresh filtering
 * should apply to searches tagged with that category.
 */
export const FRESH_CATEGORIES: ReadonlySet<string> = new Set([
  'פירות וירקות',
  'בשר עוף דגים ומעדניה',
  'לחם מאפים ודגני בוקר',
  'מוצרי חלב וביצים',
]);
