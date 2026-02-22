import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ArrowRight, ArrowLeft, Loader2, X, Search } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ShoppingMode, UserLocation } from '../types';
import { useAddressAutocomplete } from '../hooks/useAddressAutocomplete';
import ModeSelector from './ModeSelector';

interface ShoppingSetupStepProps {
  selectedCity: string;
  selectedMode: ShoppingMode | null;
  onCityChange: (city: string) => void;
  onLocationChange: (location: UserLocation | null) => void;
  onSelectMode: (mode: ShoppingMode) => void;
  onProceed: () => void;
  cities: string[];
  isLoadingCities: boolean;
  selectedLocation?: UserLocation | null;
}

const ShoppingSetupStep: React.FC<ShoppingSetupStepProps> = ({
  selectedCity,
  selectedMode,
  onCityChange,
  onLocationChange,
  onSelectMode,
  onProceed,
  cities,
  isLoadingCities,
  selectedLocation,
}) => {
  const { t, isRTL } = useLanguage();
  const {
    query,
    setQuery,
    suggestions,
    isSearching,
    selectedAddress,
    selectAddress,
    clearSelection,
  } = useAddressAutocomplete();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  // Initialize from selectedLocation prop (restoring from saved state)
  useEffect(() => {
    if (selectedLocation && !selectedAddress) {
      selectAddress({
        streetName: selectedLocation.streetName || '',
        cityName: selectedLocation.city,
        cityCode: selectedLocation.cityCode || 0,
        streetCode: 0,
        displayText: selectedLocation.address || selectedLocation.city,
      });
    }
  }, []); // Only on mount

  // Sync address selection up to parent
  useEffect(() => {
    if (selectedAddress) {
      onLocationChange(selectedAddress);
      onCityChange(selectedAddress.city);
    }
  }, [selectedAddress]);

  // Open dropdown when suggestions arrive
  useEffect(() => {
    if (suggestions.length > 0) {
      setIsDropdownOpen(true);
    }
  }, [suggestions]);

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

  const handleSuggestionSelect = (suggestion: typeof suggestions[0]) => {
    selectAddress(suggestion);
    setIsDropdownOpen(false);
    setIsFallbackMode(false);
  };

  const handleClearAddress = () => {
    clearSelection();
    onLocationChange(null);
    onCityChange('');
    setIsFallbackMode(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (isFallbackMode) {
      // In fallback mode, treat typed text as city name directly
      onCityChange(e.target.value);
    }
  };

  const handleSwitchToFallback = () => {
    setIsFallbackMode(true);
    setIsDropdownOpen(false);
    clearSelection();
    setQuery('');
    onLocationChange(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Fallback: filter from the API cities list
  const filteredFallbackCities = isFallbackMode && query
    ? cities.filter((c) => c.includes(query))
    : [];

  const handleFallbackCitySelect = (city: string) => {
    onCityChange(city);
    onLocationChange({ city, address: city });
    setQuery(city);
    setIsDropdownOpen(false);
  };

  const canProceed = (selectedAddress || (isFallbackMode && selectedCity)) && selectedMode;

  return (
    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-visible transition-shadow animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-center gap-2 px-6 py-4 border-b border-slate-100 bg-emerald-50/30 rounded-t-3xl">
        <MapPin className="w-5 h-5 text-emerald-600" />
        <span className="text-sm font-semibold text-emerald-800">{t('appMode.setupTitle')}</span>
      </div>

      <div className="p-6 space-y-6">
        {/* Address Autocomplete */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            {t('appMode.selectCity')}
          </label>

          {/* Show selected address badge */}
          {(selectedAddress || (isFallbackMode && selectedCity)) && !isDropdownOpen ? (
            <div className="flex items-center gap-2 border border-emerald-200 bg-emerald-50/50 rounded-xl px-4 py-3">
              <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {selectedAddress?.address || selectedCity}
                </p>
                {selectedAddress?.city && selectedAddress.streetName && (
                  <p className="text-xs text-slate-500">{selectedAddress.city}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleClearAddress}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                {t('appMode.changeLocation')}
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-3 focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
                {isSearching ? (
                  <Loader2 className="w-4 h-4 text-emerald-500 animate-spin flex-shrink-0" />
                ) : (
                  <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={handleInputChange}
                  onFocus={() => {
                    if (suggestions.length > 0 || (isFallbackMode && filteredFallbackCities.length > 0)) {
                      setIsDropdownOpen(true);
                    }
                  }}
                  placeholder={isFallbackMode ? t('appMode.cityPlaceholder') : t('appMode.searchAddress')}
                  className="w-full bg-transparent text-slate-700 placeholder:text-slate-400 focus:outline-none text-sm"
                />
              </div>

              {/* Suggestions Dropdown */}
              {isDropdownOpen && !isFallbackMode && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto"
                >
                  {isSearching ? (
                    <p className="px-4 py-3 text-sm text-slate-500 text-center flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {t('appMode.searchingAddresses')}
                    </p>
                  ) : suggestions.length > 0 ? (
                    suggestions.map((s, i) => (
                      <button
                        key={`${s.streetCode}-${s.cityCode}-${i}`}
                        type="button"
                        onClick={() => handleSuggestionSelect(s)}
                        className="w-full text-start px-4 py-2.5 text-sm transition-colors hover:bg-emerald-50"
                      >
                        {s.streetName ? (
                          <>
                            <span className="font-medium text-slate-800">{s.streetName}</span>
                            <span className="text-slate-400 mx-1">,</span>
                            <span className="text-slate-500">{s.cityName}</span>
                          </>
                        ) : (
                          <span className="font-medium text-slate-800">{s.cityName}</span>
                        )}
                      </button>
                    ))
                  ) : query.trim().length >= 2 ? (
                    <div className="px-4 py-3 text-center">
                      <p className="text-sm text-slate-500">{t('appMode.noAddressResults')}</p>
                      <button
                        type="button"
                        onClick={handleSwitchToFallback}
                        className="mt-1 text-xs text-emerald-600 hover:text-emerald-700 underline"
                      >
                        {t('appMode.cityPlaceholder')}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Fallback city dropdown */}
              {isDropdownOpen && isFallbackMode && filteredFallbackCities.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto"
                >
                  {isLoadingCities ? (
                    <p className="px-4 py-3 text-sm text-slate-500 text-center">
                      {t('appMode.loadingCities')}
                    </p>
                  ) : (
                    filteredFallbackCities.map((city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => handleFallbackCitySelect(city)}
                        className={`w-full text-start px-4 py-2.5 text-sm transition-colors hover:bg-emerald-50 ${
                          city === selectedCity
                            ? 'bg-emerald-50 text-emerald-700 font-medium'
                            : 'text-slate-700'
                        }`}
                      >
                        {city}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mode Selector */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            {t('appMode.selectMode')}
          </label>
          <ModeSelector selectedMode={selectedMode} onSelectMode={onSelectMode} />
        </div>
      </div>

      {/* Continue Button */}
      <div className="px-6 pb-6">
        <button
          type="button"
          onClick={onProceed}
          disabled={!canProceed}
          className={`
            w-full group flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-white shadow-lg transition-all duration-300
            ${!canProceed
              ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5 active:translate-y-0'
            }
          `}
        >
          <span>{t('appMode.continueToList')}</span>
          <ArrowIcon className="w-4 h-4 opacity-70 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default ShoppingSetupStep;
