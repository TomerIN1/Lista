// components/BuyPhaseEntry.tsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChainTotal } from '../hooks/useLiveComparison';
import { chainBadgeColor, chainAbbrev } from '../utils/chainBranding';

interface BuyPhaseEntryProps {
  open: boolean;
  onClose: () => void;
  /** Pre-sorted (cheapest-first) and pre-filtered for deliverable chains
   *  by useLiveComparison. Index 0 is the "Best" chain. */
  chains: ChainTotal[];
  /** Unique items in the cart — used to compute "missing N" per chain. */
  totalItems: number;
  /** Called with the chosen chain when the user taps a card. The caller is
   *  responsible for closing the modal and launching the agent with
   *  chain.displayName as storeName. */
  onPickChain: (chain: ChainTotal) => void;
}

const BuyPhaseEntry: React.FC<BuyPhaseEntryProps> = ({
  open, onClose, chains, totalItems, onPickChain,
}) => {
  const { t, isRTL } = useLanguage();

  // Lock body scroll + Esc-to-close while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
        aria-hidden
      />
      {/* Surface — bottom-sheet on mobile, centered modal on desktop */}
      <div
        className="
          absolute inset-x-0 bottom-0 max-h-[88vh] flex flex-col overflow-hidden
          lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2
          lg:w-[440px] lg:max-h-[80vh] lg:rounded-2xl
        "
        style={{
          background: 'var(--paper-surface)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.2)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={t('productBrowse.buyEntryTitle')}
      >
        {/* Header: drag handle (mobile) + title + close */}
        <div className="relative pt-2 pb-3 px-4">
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden w-full py-1 flex justify-center"
            aria-hidden="true"
            tabIndex={-1}
          >
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--paper-surface-alt)' }} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('result.close')}
            className="absolute top-2 end-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--paper-surface-alt)', color: 'var(--ink)' }}
          >
            <X className="w-4 h-4" />
          </button>
          <div
            className="text-[20px] mt-2"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}
          >
            {t('productBrowse.buyEntryTitle')}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
            {t('productBrowse.buyEntrySubtitle')}
          </div>
        </div>

        {/* Card list */}
        <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-2.5">
          {chains.map((c, i) => {
            const isBest = i === 0;
            const totalToShow = c.totalWithDelivery ?? c.total;
            const whole = Math.floor(totalToShow);
            const decimals = (totalToShow - whole).toFixed(2).slice(1); // ".40"
            const missing = Math.max(0, totalItems - c.matchedItems);

            return (
              <button
                key={c.chain}
                type="button"
                onClick={() => onPickChain(c)}
                className="w-full p-3 rounded-xl flex items-center gap-3 text-start transition-all"
                style={{
                  background: 'var(--paper-surface-alt)',
                  border: isBest ? '2px solid var(--save)' : '1px solid var(--line)',
                }}
              >
                {/* Brand badge */}
                <div
                  className="w-[42px] h-[42px] rounded-[9px] flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0"
                  style={{ background: chainBadgeColor(c.chain) }}
                >
                  {chainAbbrev(c.chain)}
                </div>

                {/* Chain meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="text-sm font-bold truncate"
                      style={{ color: 'var(--ink)' }}
                    >
                      {c.displayName}
                    </span>
                    {isBest && (
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0"
                        style={{ background: 'var(--save)', color: '#fff' }}
                      >
                        {t('productBrowse.buyEntryBestBadge')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--ink-muted)' }}>
                    <span>
                      {c.matchedItems}/{totalItems}
                    </span>
                    {c.deliveryFee != null && c.deliveryFee > 0 && (
                      <span>
                        🚚 {t('productBrowse.buyEntryDeliveryFee')} ₪{c.deliveryFee}
                      </span>
                    )}
                    {missing > 0 && (
                      <span
                        className="px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: 'rgba(215,53,45,0.12)', color: 'var(--accent)' }}
                      >
                        {t('productBrowse.buyEntryItemsMissing').replace('{n}', String(missing))}
                      </span>
                    )}
                  </div>
                </div>

                {/* Total price */}
                <div
                  className="text-end leading-none flex-shrink-0"
                  style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}
                >
                  <span style={{ fontSize: 22 }}>{whole}</span>
                  <span className="text-xs align-top" style={{ color: 'var(--ink-muted)' }}>
                    {decimals} ₪
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BuyPhaseEntry;
