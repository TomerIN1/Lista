import React from 'react';
import { MapPin } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface LocationInputProps {
  value: string;
  onChange: (value: string) => void;
}

const LocationInput: React.FC<LocationInputProps> = ({ value, onChange }) => {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
      <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('priceComparison.locationPlaceholder')}
        className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
      />
    </div>
  );
};

export default LocationInput;
