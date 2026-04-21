// components/KPIHero.tsx
import React from 'react';
import { Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChainTotal } from '../hooks/useLiveComparison';
import { chainBadgeColor, chainAbbrev } from '../utils/chainBranding';

interface KPIHeroProps {
  selectedChain: ChainTotal | null;
  /** Savings (₪) vs next-cheapest if best is selected, vs cheapest otherwise.
   *  Null hides the savings pill. Only renders when > 0. */
  savings: number | null;
  /** Number of items on promotion in the basket. 0 hides the pill. */
  promoCount: number;
  /** Cart length. When 0, render the empty-state fallback. */
  itemCount: number;
  onSendToPricePilot: () => void;
}

const KPIHero: React.FC<KPIHeroProps> = ({
  selectedChain, savings, promoCount, itemCount, onSendToPricePilot,
}) => {
  const { t } = useLanguage();
  const totalToDisplay = selectedChain
    ? (selectedChain.totalWithDelivery ?? selectedChain.total)
    : 0;

  if (itemCount === 0 || !selectedChain) {
    return (
      <div className="p-4" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--ink-soft)' }}>
          {t('productBrowse.bestPriceLabel')}
        </div>
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('productBrowse.basketEmptyHint')}
        </p>
      </div>
    );
  }

  const wholeShekels = Math.floor(totalToDisplay);
  const decimals = (totalToDisplay - wholeShekels).toFixed(2).slice(1); // ".40"

  return (
    <div className="p-4" style={{ borderBottom: '1px solid var(--line)' }}>
      <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--ink-soft)' }}>
        {t('productBrowse.bestPriceLabel')}
      </div>
      <div className="flex items-center gap-2.5 mb-1.5">
        <div
          className="w-[42px] h-[42px] rounded-[9px] flex items-center justify-center text-white font-extrabold text-sm"
          style={{ background: chainBadgeColor(selectedChain.chain) }}
        >
          {chainAbbrev(selectedChain.chain)}
        </div>
        <div className="text-[22px] leading-none" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>
          {selectedChain.displayName}
        </div>
      </div>
      <div className="leading-none my-2" style={{ fontFamily: 'var(--font-serif)', fontSize: 38, color: 'var(--ink)' }}>
        {wholeShekels}
        <span className="text-sm align-top" style={{ color: 'var(--ink-muted)' }}>{decimals} ₪</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {promoCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px]"
            style={{ background: 'var(--paper-surface-alt)', color: 'var(--ink)' }}>
            {t('productBrowse.itemsPromo').replace('{n}', String(promoCount))}
          </span>
        )}
        {savings != null && savings > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: 'var(--save-bg)', color: 'var(--save)' }}>
            {t('productBrowse.savingsAmount').replace('{n}', String(Math.round(savings)))}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onSendToPricePilot}
        aria-label={t('productBrowse.sendToPricePilot')}
        className="w-full py-2.5 rounded-lg text-white font-bold text-[11px] flex items-center justify-center gap-1.5"
        style={{ background: 'var(--accent)', boxShadow: '0 1px 3px rgba(215,53,45,0.25)' }}
      >
        <Sparkles className="w-3.5 h-3.5" />
        {t('productBrowse.sendToPricePilot')}
      </button>
    </div>
  );
};

export default KPIHero;
