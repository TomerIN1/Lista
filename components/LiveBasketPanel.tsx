// components/LiveBasketPanel.tsx
import React from 'react';
import { ShoppingProduct, Unit } from '../types';
import { ChainTotal, LiveComparisonResult } from '../hooks/useLiveComparison';
import KPIHero from './KPIHero';
import BasketList from './BasketList';
import { calculateSavings } from '../utils/calculateSavings';

interface LiveBasketPanelProps {
  products: ShoppingProduct[];
  comparison: LiveComparisonResult | null;
  /** The chain currently shown in KPIHero — defaults to comparison.cheapest. */
  selectedChain: ChainTotal | null;
  onUpdate: (barcode: string, updates: { amount?: number; unit?: Unit }) => void;
  onRemove: (barcode: string) => void;
  onClear: () => void;
  onSendToPricePilot: () => void;
}

const LiveBasketPanel: React.FC<LiveBasketPanelProps> = ({
  products, comparison, selectedChain,
  onUpdate, onRemove, onClear, onSendToPricePilot,
}) => {
  const savings = calculateSavings(comparison, selectedChain);

  const promoCount = products.filter(p => p.has_promotion).length;

  return (
    <aside
      className="hidden lg:flex flex-col fixed top-[52px] bottom-0 z-30 w-[300px]"
      style={{
        insetInlineEnd: 0,
        background: 'var(--paper-surface)',
        boxShadow: 'inset 1px 0 0 var(--line), -8px 0 24px -16px rgba(0,0,0,0.08)',
      }}
    >
      <KPIHero
        selectedChain={selectedChain}
        savings={savings}
        promoCount={promoCount}
        itemCount={products.length}
        onSendToPricePilot={onSendToPricePilot}
      />
      {/* Tip row — v1: hidden until tip data exists. Render nothing. */}
      {/* See spec §5: row will light up when delivery-threshold lookup ships. */}
      <BasketList
        products={products}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onClear={onClear}
      />
    </aside>
  );
};

export default LiveBasketPanel;
