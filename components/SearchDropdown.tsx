import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { DbProduct, DbProductEnhanced } from '../types';
import { searchProducts, getProductGroups, ProductGroupSummary } from '../services/priceDbService';
import { useDebounce } from '../hooks/useDebounce';
import { useLanguage } from '../contexts/LanguageContext';
import ProductCard from './ProductCard';

interface SearchDropdownProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: DbProduct, amount: number) => void;
  onOpenProduct: (product: DbProduct) => void;
  onSeeAllResults: () => void;
  storeType?: string;
  selectedBarcodes?: Set<string>;
}

const MIN_CHARS = 2;
// Fetch a few extras since we collapse duplicates by product_group_id below.
const RESULT_LIMIT = 20;
const DISPLAY_LIMIT = 10;

const SearchDropdown: React.FC<SearchDropdownProps> = ({
  query,
  isOpen,
  onClose,
  onAddProduct,
  onOpenProduct,
  onSeeAllResults,
  storeType,
  selectedBarcodes,
}) => {
  const { isRTL } = useLanguage();
  const debouncedQuery = useDebounce(query.trim(), 250);
  const [rawResults, setRawResults] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [productGroups, setProductGroups] = useState<Map<number, ProductGroupSummary>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Load product groups once (cached at the service level) so we can merge
  // duplicates that share a product_group_id (e.g. tomatoes from 3 chains).
  useEffect(() => {
    let cancelled = false;
    getProductGroups(storeType)
      .then((groups) => {
        if (cancelled) return;
        const map = new Map<number, ProductGroupSummary>();
        groups.forEach((g) => map.set(g.id, g));
        setProductGroups(map);
      })
      .catch(() => { /* non-fatal — dedup just falls back to the raw image */ });
    return () => { cancelled = true; };
  }, [storeType]);

  useEffect(() => {
    if (!isOpen || debouncedQuery.length < MIN_CHARS) {
      setRawResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchProducts(debouncedQuery, RESULT_LIMIT, 0, undefined, storeType)
      .then((res) => { if (!cancelled) setRawResults(res.products || []); })
      .catch(() => { if (!cancelled) setRawResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, isOpen, storeType]);

  // Mirror ProductCatalogArea: collapse products sharing a product_group_id,
  // keep the cheapest as the representative, and override the image with the
  // group's curated one when available.
  const results = useMemo(() => {
    const seen = new Map<number, DbProduct>();
    const out: DbProduct[] = [];
    for (const p of rawResults) {
      const gid = p.product_group_id ?? null;
      if (gid != null) {
        const existing = seen.get(gid);
        if (!existing) {
          const groupInfo = productGroups.get(gid);
          const rep = groupInfo?.image_url ? { ...p, image_url: groupInfo.image_url } : p;
          seen.set(gid, rep);
          out.push(rep);
        } else if (p.min_price < existing.min_price) {
          const rep = { ...p, image_url: existing.image_url };
          out[out.indexOf(existing)] = rep;
          seen.set(gid, rep);
        }
      } else {
        out.push(p);
      }
    }
    return out.slice(0, DISPLAY_LIMIT);
  }, [rawResults, productGroups]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Don't close if clicking the search input itself (handled by header)
        const target = e.target as HTMLElement;
        if (target.closest('[data-search-input]')) return;
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || query.trim().length < MIN_CHARS) return null;

  const showEmpty = !loading && results.length === 0;

  return (
    <div
      ref={containerRef}
      className="absolute left-0 right-0 top-full mt-2 z-30 rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
      style={{
        background: 'var(--paper-surface)',
        borderColor: 'var(--line)',
        maxHeight: 'min(70vh, 560px)',
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Body — two panes on desktop, stacked on mobile */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
        {/* Right pane (RTL-first): text list of names */}
        <div
          className="md:w-2/5 md:border-l overflow-y-auto py-2"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="px-3 pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
              {isRTL ? 'תוצאות חיפוש' : 'Search results'}
            </span>
          </div>

          {loading && results.length === 0 && (
            <div className="px-3 py-4 flex items-center gap-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isRTL ? 'מחפש...' : 'Searching…'}
            </div>
          )}

          {showEmpty && (
            <div className="px-3 py-4 text-sm" style={{ color: 'var(--ink-soft)' }}>
              {isRTL ? 'לא נמצאו מוצרים' : 'No products found'}
            </div>
          )}

          <ul className="flex flex-col">
            {results.map((p) => (
              <li key={p.barcode}>
                <button
                  type="button"
                  onClick={() => onOpenProduct(p)}
                  className="w-full text-start px-3 py-2 hover:bg-[var(--paper-surface-alt)] transition-colors flex items-baseline gap-2"
                >
                  <span className="font-bold text-sm truncate" style={{ color: 'var(--ink)' }}>
                    {highlightMatch(p.name, query)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Left pane: visual cards */}
        <div className="md:w-3/5 overflow-y-auto p-2 md:p-3 border-t md:border-t-0" style={{ borderColor: 'var(--line)' }}>
          {loading && results.length === 0 && (
            <div className="hidden md:flex items-center justify-center h-full text-sm" style={{ color: 'var(--ink-soft)' }}>
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}

          {results.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {results.map((p) => (
                <ProductCard
                  key={p.barcode}
                  product={p as DbProductEnhanced}
                  isSelected={selectedBarcodes?.has(p.barcode) ?? false}
                  onAdd={(amount) => onAddProduct(p, amount)}
                  onClick={() => onOpenProduct(p)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom CTA */}
      <button
        type="button"
        onClick={onSeeAllResults}
        className="w-full px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 border-t transition-colors hover:opacity-90"
        style={{
          background: 'var(--accent)',
          color: '#FFFFFF',
          borderColor: 'var(--line)',
        }}
      >
        {isRTL ? `לכל התוצאות של "${query.trim()}"` : `All results for "${query.trim()}"`}
        <ArrowLeft className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} />
      </button>
    </div>
  );
};

// Bold the matched substring inside a product name
function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: 'var(--accent)' }}>{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}

export default SearchDropdown;
