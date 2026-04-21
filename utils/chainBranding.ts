// utils/chainBranding.ts
import { SUPERMARKET_NAME_MAP } from '../services/priceDbService';

/** Brand colors per chain — used for KPIHero badge + StoresStripV2 chip dots.
 *  Keys are the canonical chain codes (English, lowercase) used by the API. */
const CHAIN_COLORS: Record<string, string> = {
  victory: '#E88B3C',
  rami_levy: '#D7352D',
  shufersal: '#2F6B3C',
  yenot_bitan: '#1A2B3C',
  tiv_taam: '#7A3CC4',
  yochananof: '#0F4C81',
  super_pharm: '#5BA3D0',
  hatzi_hinam: '#C8932E',
};

const FALLBACK_COLOR = '#6B655A'; // var(--ink-muted)

export function chainBadgeColor(chain: string): string {
  return CHAIN_COLORS[chain.toLowerCase()] ?? FALLBACK_COLOR;
}

export function chainDisplayName(chain: string): string {
  return SUPERMARKET_NAME_MAP[chain] || chain;
}

/** Two-letter abbreviation for the badge square (e.g. "Victory" → "VV"). */
export function chainAbbrev(chain: string): string {
  const name = chainDisplayName(chain);
  // Hebrew → take first two non-space chars; English → take initials of first two words.
  const isHebrew = /[֐-׿]/.test(name);
  if (isHebrew) {
    const stripped = name.replace(/\s+/g, '');
    return stripped.slice(0, 2);
  }
  const words = name.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
