// components/MobileBasketBar.tsx
import React from 'react';
import { ChevronUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChainTotal } from '../hooks/useLiveComparison';
import { chainAbbrev, chainBadgeColor } from '../utils/chainBranding';

interface MobileBasketBarProps {
  cheapest: ChainTotal | null;
  itemCount: number;
  onTap: () => void;
}

const MobileBasketBar: React.FC<MobileBasketBarProps> = ({ cheapest, itemCount, onTap }) => {
  const { t } = useLanguage();
  if (itemCount === 0 || !cheapest) return null;

  const total = cheapest.totalWithDelivery ?? cheapest.total;
  const whole = Math.floor(total);
  const dec = (total - whole).toFixed(2).slice(1);
  const itemsLabel = t('productBrowse.mobileItemsCount').replace('{n}', String(itemCount));

  return (
    <button
      type="button"
      onClick={onTap}
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-4 py-3 flex items-center gap-3 text-white"
      style={{
        background: 'var(--ink)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
      }}
      aria-label={itemsLabel}
    >
      <div className="flex flex-col gap-0.5 flex-1 text-start">
        <span className="text-[10px] uppercase tracking-wider flex items-center gap-1.5"
          style={{ color: 'rgba(255,255,255,0.7)' }}>
          {t('productBrowse.mobileCheapestLabel')}
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
            style={{ background: chainBadgeColor(cheapest.chain) }}
          >
            {chainAbbrev(cheapest.chain)} {cheapest.displayName}
          </span>
        </span>
        <span className="text-[20px] leading-none" style={{ fontFamily: 'var(--font-serif)' }}>
          {whole}
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{dec} ₪</span>
        </span>
      </div>
      <span className="px-3 py-1.5 rounded-full text-[11px] font-bold"
        style={{ background: 'var(--accent)' }}>
        {itemsLabel}
      </span>
      <ChevronUp className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.7)' }} />
    </button>
  );
};

export default MobileBasketBar;
