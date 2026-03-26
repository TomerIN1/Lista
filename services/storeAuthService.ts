/**
 * Store authentication helpers for PWA context.
 *
 * Since Lista is a PWA (not a native app), we can't use WebView JS injection.
 * We open the store's website in a popup for the user to log in. Token
 * extraction is handled automatically when possible, or via user paste.
 */

export interface StoreLoginConfig {
  loginUrl: string;
  nameHe: string;
  /** JS expression to extract the JWT from the store's localStorage */
  tokenExtractionJs: string;
}

export const STORE_LOGIN_CONFIG: Record<string, StoreLoginConfig> = {
  'רמי לוי': {
    loginUrl: 'https://www.rami-levy.co.il/he',
    nameHe: 'רמי לוי',
    tokenExtractionJs: 'JSON.parse(localStorage.ramilevy).authuser.user.token',
  },
  'Rami Levy': {
    loginUrl: 'https://www.rami-levy.co.il/he',
    nameHe: 'רמי לוי',
    tokenExtractionJs: 'JSON.parse(localStorage.ramilevy).authuser.user.token',
  },
};

/**
 * Open the store's login page in a popup window.
 * Returns the popup window reference.
 */
export function openStoreLoginPopup(storeName: string): Window | null {
  const config = STORE_LOGIN_CONFIG[storeName];
  if (!config) return null;

  return window.open(
    config.loginUrl,
    `${storeName}-login`,
    'width=500,height=700,scrollbars=yes'
  );
}

/**
 * Check if a string looks like a JWT token (starts with "ey", has 2+ dots).
 */
export function looksLikeJwt(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('ey') && trimmed.split('.').length >= 3 && trimmed.length > 50;
}
