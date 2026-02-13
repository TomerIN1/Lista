import { useState, useEffect } from 'react';
import { useDebounce } from './useDebounce';
import { DbProduct } from '../types';
import { searchProducts } from '../services/priceDbService';

interface UseProductSearchResult {
  results: DbProduct[];
  isSearching: boolean;
  query: string;
  setQuery: (q: string) => void;
  clearResults: () => void;
}

export function useProductSearch(minChars: number = 2, debounceMs: number = 300): UseProductSearchResult {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DbProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const debouncedQuery = useDebounce(query, debounceMs);

  useEffect(() => {
    if (debouncedQuery.trim().length < minChars) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    searchProducts(debouncedQuery.trim(), 10)
      .then((result) => {
        if (!cancelled) {
          setResults(result.products || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSearching(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, minChars]);

  const clearResults = () => {
    setQuery('');
    setResults([]);
  };

  return { results, isSearching, query, setQuery, clearResults };
}
