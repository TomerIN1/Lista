// components/MobileBasketSheet.tsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ShoppingProduct, Unit } from '../types';
import { ChainTotal, LiveComparisonResult } from '../hooks/useLiveComparison';
import KPIHero from './KPIHero';
import BasketList from './BasketList';
import { calculateSavings } from '../utils/calculateSavings';

interface MobileBasketSheetProps {
  open: boolean;
  onClose: () => void;
  products: ShoppingProduct[];
  comparison: LiveComparisonResult | null;
  selectedChain: ChainTotal | null;
  onUpdate: (barcode: string, updates: { amount?: number; unit?: Unit }) => void;
  onRemove: (barcode: string) => void;
  onClear: () => void;
  onSendToPricePilot: () => void;
}

const MobileBasketSheet: React.FC<MobileBasketSheetProps> = ({
  open, onClose, products, comparison, selectedChain,
  onUpdate, onRemove, onClear, onSendToPricePilot,
}) => {
  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const savings = calculateSavings(comparison, selectedChain);

  const promoCount = products.filter(p => p.has_promotion).length;

  if (!open) return null;

  return createPortal(
    <div className="lg:hidden fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
        aria-hidden
      />
      {/* Sheet */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden"
        style={{
          background: 'var(--paper-surface)',
          borderRadius: '20px 20px 0 0',
          maxHeight: '88vh',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.2)',
        }}
      >
        {/* Drag handle + close button */}
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-1 flex justify-center"
            aria-label="Close"
          >
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--paper-surface-alt)' }} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-0.5 end-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--paper-surface-alt)', color: 'var(--ink)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          <KPIHero
            selectedChain={selectedChain}
            savings={savings}
            promoCount={promoCount}
            itemCount={products.length}
            onSendToPricePilot={onSendToPricePilot}
          />
          {/* Tip row hidden in v1 — see spec §5 */}
          <BasketList
            products={products}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onClear={onClear}
            storeTotal={selectedChain?.total ?? null}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MobileBasketSheet;
