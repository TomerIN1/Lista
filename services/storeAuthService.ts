/**
 * Store authentication helpers for PWA context.
 *
 * Since Lista is a PWA (not a native app), we can't use WebView JS injection.
 * Instead, we open the store's website in a popup for the user to log in,
 * then guide them to extract the auth token.
 */

export interface StoreLoginConfig {
  loginUrl: string;
  nameHe: string;
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
 * Get instructions for token extraction (shown in the chat).
 */
export function getTokenExtractionInstructions(storeName: string, language: 'he' | 'en'): string {
  const config = STORE_LOGIN_CONFIG[storeName];
  if (!config) return '';

  if (language === 'he') {
    return [
      `1. היכנס לחשבון שלך ב-${config.nameHe}`,
      '2. פתח את כלי המפתחים (F12)',
      '3. עבור ללשונית Console',
      `4. הדבק: ${config.tokenExtractionJs}`,
      '5. העתק את התוצאה והדבק אותה כאן',
    ].join('\n');
  }

  return [
    `1. Log in to your ${storeName} account`,
    '2. Open Developer Tools (F12)',
    '3. Go to the Console tab',
    `4. Paste: ${config.tokenExtractionJs}`,
    '5. Copy the result and paste it here',
  ].join('\n');
}
