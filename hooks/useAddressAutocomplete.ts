import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './useDebounce';
import { searchAddresses, AddressSuggestion } from '../services/govDataService';
import { UserLocation } from '../types';

interface UseAddressAutocompleteResult {
  query: string;
  setQuery: (q: string) => void;
  suggestions: AddressSuggestion[];
  isSearching: boolean;
  selectedAddress: UserLocation | null;
  selectAddress: (suggestion: AddressSuggestion) => void;
  clearSelection: () => void;
}

export function useAddressAutocomplete(debounceMs = 300): UseAddressAutocompleteResult {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<UserLocation | null>(null);

  const debouncedQuery = useDebounce(query, debounceMs);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    // Don't search if we already selected an address matching the current query
    if (selectedAddress && debouncedQuery === selectedAddress.address) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    searchAddresses(debouncedQuery.trim(), 10)
      .then((results) => {
        if (!cancelled) setSuggestions(results);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery, selectedAddress]);

  const selectAddress = useCallback((suggestion: AddressSuggestion) => {
    const location: UserLocation = {
      city: suggestion.cityName,
      address: suggestion.displayText,
      cityCode: suggestion.cityCode,
      streetName: suggestion.streetName,
    };
    setSelectedAddress(location);
    setQuery(suggestion.displayText);
    setSuggestions([]);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedAddress(null);
    setQuery('');
    setSuggestions([]);
  }, []);

  return { query, setQuery, suggestions, isSearching, selectedAddress, selectAddress, clearSelection };
}
