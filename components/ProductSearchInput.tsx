import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2, X, Package } from 'lucide-react';
import { useProductSearch } from '../hooks/useProductSearch';
import { useLanguage } from '../contexts/LanguageContext';
import { DbProduct } from '../types';

const ProductThumb: React.FC<{ src: string | null; alt: string; size?: string }> = ({ src, alt, size = 'w-10 h-10' }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`${size} rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0`}>
        <Package className="w-1/2 h-1/2 text-slate-300" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${size} object-contain rounded-lg bg-white flex-shrink-0`}
      onError={() => setFailed(true)}
    />
  );
};

interface ProductSearchInputProps {
  selectedProducts: DbProduct[];
  onSelectProduct: (product: DbProduct) => void;
  onRemoveProduct: (barcode: string) => void;
  disabled?: boolean;
  prominent?: boolean;
}

const ProductSearchInput: React.FC<ProductSearchInputProps> = ({
  selectedProducts,
  onSelectProduct,
  onRemoveProduct,
  disabled = false,
  prominent = false,
}) => {
  const { t, isRTL } = useLanguage();
  const { results, isSearching, query, setQuery, clearResults } = useProductSearch();
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show dropdown when results arrive
  useEffect(() => {
    if (results.length > 0 && query.length >= 2) {
      setIsDropdownOpen(true);
      setHighlightedIndex(-1);
    } else if (query.length < 2) {
      setIsDropdownOpen(false);
    }
  }, [results, query]);

  const handleSelect = (product: DbProduct) => {
    // Don't add duplicates
    if (selectedProducts.some((p) => p.barcode === product.barcode)) return;
    onSelectProduct(product);
    clearResults();
    setIsDropdownOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          handleSelect(results[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsDropdownOpen(false);
        break;
    }
  };

  const formatPrice = (min: number, max: number) => {
    if (min === max) return `₪${min.toFixed(2)}`;
    return `₪${min.toFixed(2)} - ₪${max.toFixed(2)}`;
  };

  return (
    <div className="relative z-20">
      {/* Search Input */}
      <div className={`flex items-center gap-2 border-b border-slate-100 ${
        prominent
          ? 'px-6 py-4 bg-emerald-50/40'
          : 'px-4 py-3 bg-indigo-50/30'
      }`}>
        {isSearching ? (
          <Loader2 className={`${prominent ? 'w-5 h-5 text-emerald-500' : 'w-4 h-4 text-indigo-400'} animate-spin flex-shrink-0`} />
        ) : (
          <Search className={`${prominent ? 'w-5 h-5 text-emerald-500' : 'w-4 h-4 text-indigo-400'} flex-shrink-0`} />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsDropdownOpen(true);
          }}
          placeholder={t('productSearch.searchPlaceholder')}
          className={`w-full bg-transparent text-slate-700 placeholder:text-slate-400 focus:outline-none ${
            prominent ? 'text-base font-medium' : 'text-sm'
          }`}
          disabled={disabled}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              clearResults();
              setIsDropdownOpen(false);
            }}
            className="p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isDropdownOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full bg-white border border-slate-200 rounded-b-xl shadow-lg max-h-[28rem] overflow-y-auto"
        >
          {results.map((product, index) => (
            <button
              key={product.barcode}
              type="button"
              onClick={() => handleSelect(product)}
              className={`w-full text-start px-4 py-3.5 flex items-center gap-4 transition-colors border-b border-slate-50 last:border-b-0 ${
                index === highlightedIndex
                  ? 'bg-indigo-50'
                  : 'hover:bg-slate-50'
              } ${
                selectedProducts.some((p) => p.barcode === product.barcode)
                  ? 'opacity-40 cursor-not-allowed'
                  : ''
              }`}
              disabled={selectedProducts.some((p) => p.barcode === product.barcode)}
            >
              <ProductThumb src={product.image_url} alt={product.name} size="w-14 h-14" />
              <div className="flex-1 min-w-0">
                <div className="text-base font-medium text-slate-800 truncate">
                  {product.name}
                </div>
                <div className="text-sm text-slate-500 truncate mt-0.5">
                  {product.manufacturer && <span>{product.manufacturer}</span>}
                  {product.manufacturer && ' · '}
                  <span className="text-slate-400">{product.barcode}</span>
                </div>
              </div>
              <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">
                {formatPrice(product.min_price, product.max_price)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {isDropdownOpen && query.length >= 2 && !isSearching && results.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full bg-white border border-slate-200 rounded-b-xl shadow-lg px-4 py-3"
        >
          <p className="text-sm text-slate-500 text-center">
            {t('productSearch.noResults')}
          </p>
        </div>
      )}

      {/* Selected Products List */}
      {selectedProducts.length > 0 && (
        <div className="divide-y divide-slate-100 border-b border-slate-100">
          {selectedProducts.map((product) => (
            <div
              key={product.barcode}
              className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50/50 transition-colors"
            >
              <ProductThumb src={product.image_url} alt={product.name} size="w-14 h-14" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{product.name}</div>
                <div className="text-xs text-slate-400 truncate mt-0.5">
                  {product.manufacturer && <span className="text-slate-500">{product.manufacturer}</span>}
                  {product.manufacturer && ' · '}
                  {product.barcode}
                </div>
                {product.min_price > 0 && (
                  <div className="text-sm font-bold text-emerald-600 mt-0.5">
                    {formatPrice(product.min_price, product.max_price)}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemoveProduct(product.barcode)}
                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductSearchInput;
