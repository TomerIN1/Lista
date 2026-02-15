import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ShoppingMode } from '../types';
import ModeSelector from './ModeSelector';

interface ShoppingSetupStepProps {
  selectedCity: string;
  selectedMode: ShoppingMode | null;
  onCityChange: (city: string) => void;
  onSelectMode: (mode: ShoppingMode) => void;
  onProceed: () => void;
  cities: string[];
  isLoadingCities: boolean;
}

const ShoppingSetupStep: React.FC<ShoppingSetupStepProps> = ({
  selectedCity,
  selectedMode,
  onCityChange,
  onSelectMode,
  onProceed,
  cities,
  isLoadingCities,
}) => {
  const { t, isRTL } = useLanguage();
  const [cityQuery, setCityQuery] = useState(selectedCity);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  // Sync external city changes
  useEffect(() => {
    setCityQuery(selectedCity);
  }, [selectedCity]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCities = cityQuery
    ? cities.filter((c) => c.toLowerCase().includes(cityQuery.toLowerCase()))
    : cities;

  const handleCitySelect = (city: string) => {
    onCityChange(city);
    setCityQuery(city);
    setIsCityDropdownOpen(false);
  };

  const canProceed = selectedCity && selectedMode;

  return (
    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-visible transition-shadow animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-center gap-2 px-6 py-4 border-b border-slate-100 bg-emerald-50/30 rounded-t-3xl">
        <MapPin className="w-5 h-5 text-emerald-600" />
        <span className="text-sm font-semibold text-emerald-800">{t('appMode.setupTitle')}</span>
      </div>

      <div className="p-6 space-y-6">
        {/* City Selector */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            {t('appMode.selectCity')}
          </label>
          <div className="relative">
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-3 focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
              {isLoadingCities ? (
                <Loader2 className="w-4 h-4 text-emerald-500 animate-spin flex-shrink-0" />
              ) : (
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={cityQuery}
                onChange={(e) => {
                  setCityQuery(e.target.value);
                  setIsCityDropdownOpen(true);
                  // Accept typed text as city (allows manual entry even without dropdown)
                  onCityChange(e.target.value);
                }}
                onFocus={() => {
                  if (cities.length > 0) setIsCityDropdownOpen(true);
                }}
                placeholder={t('appMode.cityPlaceholder')}
                className="w-full bg-transparent text-slate-700 placeholder:text-slate-400 focus:outline-none text-sm"
                disabled={isLoadingCities}
              />
            </div>

            {/* City Dropdown */}
            {isCityDropdownOpen && !isLoadingCities && (
              <div
                ref={dropdownRef}
                className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto"
              >
                {filteredCities.length > 0 ? (
                  filteredCities.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => handleCitySelect(city)}
                      className={`w-full text-start px-4 py-2.5 text-sm transition-colors hover:bg-emerald-50 ${
                        city === selectedCity
                          ? 'bg-emerald-50 text-emerald-700 font-medium'
                          : 'text-slate-700'
                      }`}
                    >
                      {city}
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-3 text-sm text-slate-500 text-center">
                    {t('appMode.noCity')}
                  </p>
                )}
              </div>
            )}

            {isLoadingCities && (
              <p className="mt-1 text-xs text-slate-400">{t('appMode.loadingCities')}</p>
            )}
          </div>
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
