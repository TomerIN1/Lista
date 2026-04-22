// components/StoresStripV2.tsx
import React from 'react';
import { Store } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChainTotal } from '../hooks/useLiveComparison';
import { chainBadgeColor } from '../utils/chainBranding';

interface StoresStripV2Props {
  chains: ChainTotal[];           // already sorted cheapest-first
  selectedChain: string | null;   // canonical chain code
  onSelectChain: (chain: string) => void;
  loading?: boolean;
}

const StoresStripV2: React.FC<StoresStripV2Props> = ({
  chains, selectedChain, onSelectChain, loading,
}) => {
  const { t } = useLanguage();

  if (chains.length === 0 && !loading) return null;

  const cheapest = chains[0];

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 overflow-x-auto no-scrollbar"
      style={{
        background: 'var(--paper-surface)',
        borderBottom: '1px solid var(--line)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
        maskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
      }}
    >
      <div
        className="flex items-center gap-1 text-[10px] flex-shrink-0"
        style={{ color: 'var(--ink-soft)' }}
      >
        <Store className="w-3.5 h-3.5" />
        <span>{t('productBrowse.basketForYou')}</span>
      </div>
      {loading && chains.length === 0 && (
        <>
          {[0, 1, 2].map(i => (
            <div key={i} className="h-6 w-24 rounded-full animate-pulse"
              style={{ background: 'var(--paper-surface-alt)' }} />
          ))}
        </>
      )}
      {chains.map(c => {
        const isBest = c.chain === cheapest?.chain;
        const isSelected = c.chain === selectedChain;
        const totalToShow = c.totalWithDelivery ?? c.total;
        return (
          <button
            key={c.chain}
            type="button"
            onClick={() => onSelectChain(c.chain)}
            aria-label={totalToShow > 0
              ? `${c.displayName} ₪${Math.round(totalToShow)}`
              : c.displayName}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] whitespace-nowrap flex-shrink-0 transition-all"
            style={
              isBest
                ? {
                    background: 'var(--save)',
                    color: '#fff',
                    boxShadow: '0 1px 4px rgba(47,107,60,0.25)',
                    border: isSelected ? '2px solid var(--ink)' : '1px solid var(--save)',
                  }
                : {
                    background: 'var(--save-bg)',
                    color: 'var(--save)',
                    border: isSelected ? '2px solid var(--ink)' : '1px solid transparent',
                  }
            }
          >
            {isBest && <span aria-hidden>⭐</span>}
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: chainBadgeColor(c.chain) }}
              aria-hidden
            />
            <span className="font-bold">{c.displayName}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {totalToShow > 0 ? `₪${Math.round(totalToShow)}` : '—'}
            </span>
            {c.deliveryFee != null && (
              <span className="text-[9px]" style={{
                color: isBest ? 'rgba(255,255,255,0.85)' : 'var(--ink-muted)',
              }}>
                🚚 ₪{c.deliveryFee}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default StoresStripV2;
