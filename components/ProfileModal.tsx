import React, { useState, useEffect, useRef } from 'react';
import { X, User as UserIcon, MapPin, ShoppingCart, Monitor, Globe, Check, Loader2, Search } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { UserProfile, UserLocation, ShoppingMode } from '../types';
import { saveUserProfile } from '../services/firestoreService';
import { useAddressAutocomplete } from '../hooks/useAddressAutocomplete';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  city: string;
  location: UserLocation | null;
  shoppingMode: ShoppingMode | null;
  onProfileSaved: (data: { city: string; location: UserLocation | null; shoppingMode: ShoppingMode }) => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen, onClose, user, city, location, shoppingMode, onProfileSaved,
}) => {
  const { language, setLanguage, isRTL } = useLanguage();
  const [draftCity, setDraftCity] = useState(city);
  const [draftStreet, setDraftStreet] = useState(location?.streetName || '');
  const [draftCityCode, setDraftCityCode] = useState<number | undefined>(location?.cityCode);
  const [draftHouse, setDraftHouse] = useState(() => {
    // "address" has historically held the full display text (street + city) after
    // autocomplete, OR just the house/entrance if the user typed it in the older
    // free-text profile. Treat it as house/entrance only when it clearly isn't a
    // full address (no comma, short, not equal to city or street).
    const a = location?.address?.trim() || '';
    if (!a) return '';
    if (a.includes(',')) return '';
    if (a === location?.city || a === location?.streetName) return '';
    return a;
  });
  const [draftMode, setDraftMode] = useState<ShoppingMode>(shoppingMode || 'online');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync the drafts from the selected autocomplete address.
  useEffect(() => {
    if (!selectedAddress) return;
    setDraftCity(selectedAddress.city);
    setDraftStreet(selectedAddress.streetName || '');
    setDraftCityCode(selectedAddress.cityCode);
  }, [selectedAddress]);

  // When the modal opens, pre-seed the autocomplete from the saved location so
  // the user sees their existing address instead of an empty search.
  useEffect(() => {
    if (!isOpen) return;
    setDraftCity(city);
    setDraftStreet(location?.streetName || '');
    setDraftCityCode(location?.cityCode);
    setDraftMode(shoppingMode || 'online');
    setJustSaved(false);
    if (city || location?.streetName) {
      selectAddress({
        streetName: location?.streetName || '',
        cityName: city,
        cityCode: location?.cityCode ?? 0,
        streetCode: 0,
        displayText: location?.address || (location?.streetName ? `${location.streetName}, ${city}` : city),
      });
    } else {
      clearSelection();
    }
  }, [isOpen, city, location, shoppingMode]);

  // Open dropdown as suggestions arrive, close on outside click.
  useEffect(() => {
    if (suggestions.length > 0 && !selectedAddress) setIsDropdownOpen(true);
  }, [suggestions, selectedAddress]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleChangeAddress = () => {
    clearSelection();
    setQuery('');
    setDraftCity('');
    setDraftStreet('');
    setDraftCityCode(undefined);
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Firestore rejects undefined — only include defined fields
      const newLocation: UserLocation = { city: draftCity };
      if (draftStreet.trim()) newLocation.streetName = draftStreet.trim();
      const displayText = draftStreet.trim()
        ? `${draftStreet.trim()}, ${draftCity}`
        : draftCity;
      const finalAddress = draftHouse.trim()
        ? `${displayText} ${draftHouse.trim()}`
        : displayText;
      if (finalAddress) newLocation.address = finalAddress;
      if (draftCityCode !== undefined) newLocation.cityCode = draftCityCode;
      await saveUserProfile(user.uid, {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        city: draftCity,
        location: newLocation,
        shoppingMode: draftMode,
        language,
      });
      onProfileSaved({ city: draftCity, location: newLocation, shoppingMode: draftMode });
      setJustSaved(true);
      setTimeout(() => { setJustSaved(false); onClose(); }, 900);
    } catch (e: any) {
      console.error('[ProfileModal save]', e);
      setSaveError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-6 backdrop-blur-sm"
      style={{ background: 'rgba(26,26,23,0.4)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto sm:rounded-[20px] shadow-2xl flex flex-col"
        style={{ background: 'var(--paper-surface)', border: '1px solid var(--line)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--ink-soft)' }}>
              {isRTL ? 'הפרופיל שלי' : 'My profile'}
            </div>
            <h2 className="mt-1" style={{ fontFamily: 'var(--font-serif)', fontSize: 28, lineHeight: 1.1, color: 'var(--ink)' }}>
              {isRTL ? 'פרטים אישיים ומשלוח' : 'Personal & delivery'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full" style={{ color: 'var(--ink-muted)' }} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Identity (read-only) */}
        <div className="px-6 pt-5">
          <SectionLabel>{isRTL ? 'זהות' : 'Identity'}</SectionLabel>
          <div className="mt-2 flex items-center gap-3 p-3 rounded-[14px]" style={{ background: 'var(--paper-surface-alt)' }}>
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full" />
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: 'linear-gradient(135deg, #E88B3C, #D7352D)' }}
              >
                {(user.displayName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{user.displayName || '—'}</div>
              <div className="text-xs truncate" style={{ color: 'var(--ink-muted)' }}>{user.email || '—'}</div>
            </div>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
              style={{ background: 'var(--paper-surface)', color: 'var(--ink-soft)' }}
            >
              {isRTL ? 'Google' : 'Google'}
            </span>
          </div>
        </div>

        {/* Address */}
        <div className="px-6 pt-6">
          <SectionLabel>{isRTL ? 'כתובת למשלוח' : 'Delivery address'}</SectionLabel>
          <div className="mt-2 space-y-2">
            {selectedAddress && !isDropdownOpen ? (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-[12px] border"
                style={{ background: 'var(--paper-bg)', borderColor: 'var(--line)' }}
              >
                <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ink-soft)' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" style={{ color: 'var(--ink)' }}>
                    {selectedAddress.address || selectedAddress.city}
                  </div>
                  {selectedAddress.city && selectedAddress.streetName && (
                    <div className="text-[11px] truncate" style={{ color: 'var(--ink-soft)' }}>{selectedAddress.city}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleChangeAddress}
                  className="text-[11px] font-medium flex items-center gap-1 flex-shrink-0"
                  style={{ color: 'var(--accent)' }}
                >
                  <X className="w-3.5 h-3.5" />
                  {isRTL ? 'שנה' : 'Change'}
                </button>
              </div>
            ) : (
              <div className="relative">
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-[12px] border"
                  style={{ background: 'var(--paper-bg)', borderColor: 'var(--line)' }}
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: 'var(--ink-soft)' }} />
                  ) : (
                    <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ink-soft)' }} />
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => { if (suggestions.length > 0) setIsDropdownOpen(true); }}
                    placeholder={isRTL ? 'חפש רחוב ועיר' : 'Search street and city'}
                    className="flex-1 bg-transparent text-sm focus:outline-none"
                    style={{ color: 'var(--ink)', textAlign: isRTL ? 'right' : 'left' }}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                </div>
                {isDropdownOpen && (
                  <div
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-1 rounded-[12px] shadow-lg max-h-56 overflow-y-auto"
                    style={{ background: 'var(--paper-surface)', border: '1px solid var(--line)' }}
                  >
                    {isSearching ? (
                      <div className="px-4 py-3 text-xs text-center flex items-center justify-center gap-2" style={{ color: 'var(--ink-soft)' }}>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {isRTL ? 'מחפש…' : 'Searching…'}
                      </div>
                    ) : suggestions.length > 0 ? (
                      suggestions.map((s, i) => (
                        <button
                          key={`${s.streetCode}-${s.cityCode}-${i}`}
                          type="button"
                          onClick={() => { selectAddress(s); setIsDropdownOpen(false); }}
                          className="w-full text-start px-4 py-2.5 text-sm"
                          style={{ color: 'var(--ink)' }}
                        >
                          {s.streetName ? (
                            <>
                              <span className="font-medium">{s.streetName}</span>
                              <span className="mx-1" style={{ color: 'var(--ink-soft)' }}>,</span>
                              <span style={{ color: 'var(--ink-muted)' }}>{s.cityName}</span>
                            </>
                          ) : (
                            <span className="font-medium">{s.cityName}</span>
                          )}
                        </button>
                      ))
                    ) : query.trim().length >= 2 ? (
                      <div className="px-4 py-3 text-xs text-center" style={{ color: 'var(--ink-soft)' }}>
                        {isRTL ? 'אין תוצאות' : 'No results'}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
            <Field
              placeholder={isRTL ? 'בית / דירה / כניסה' : 'House / apt / entrance'}
              value={draftHouse}
              onChange={setDraftHouse}
              isRTL={isRTL}
            />
          </div>
        </div>

        {/* Language */}
        <div className="px-6 pt-6">
          <SectionLabel>{isRTL ? 'שפה' : 'Language'}</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ModeCard
              active={language === 'he'}
              onClick={() => setLanguage('he')}
              icon={<Globe className="w-5 h-5" />}
              title="עברית"
              hint="Hebrew"
            />
            <ModeCard
              active={language === 'en'}
              onClick={() => setLanguage('en')}
              icon={<Globe className="w-5 h-5" />}
              title="English"
              hint="English"
            />
          </div>
        </div>

        {/* Error banner */}
        {saveError && (
          <div className="mx-6 mt-4 p-3 rounded-[12px] text-xs" style={{ background: '#FDECEA', color: '#B02A1F', border: '1px solid #F5B9B4' }}>
            {saveError}
          </div>
        )}

        {/* Footer / Save */}
        <div className="mt-auto px-6 pt-6 pb-6 flex gap-2 sticky bottom-0" style={{ background: 'var(--paper-surface)', borderTop: '1px solid var(--line)' }}>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full text-sm font-semibold"
            style={{ background: 'var(--paper-surface-alt)', color: 'var(--ink-muted)' }}
          >
            {isRTL ? 'ביטול' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !draftCity.trim()}
            className="flex-[2] py-3 rounded-full text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'var(--ink)', color: 'var(--paper-bg)' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : justSaved ? <Check className="w-4 h-4" /> : null}
            <span>{justSaved ? (isRTL ? 'נשמר' : 'Saved') : saving ? (isRTL ? 'שומר...' : 'Saving...') : (isRTL ? 'שמור פרופיל' : 'Save profile')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--ink-soft)' }}>
    {children}
  </div>
);

const Field: React.FC<{ icon?: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; isRTL: boolean }> = ({ icon, placeholder, value, onChange, isRTL }) => (
  <div
    className="flex items-center gap-2 px-3 py-2.5 rounded-[12px] border"
    style={{ background: 'var(--paper-bg)', borderColor: 'var(--line)' }}
  >
    {icon && <span style={{ color: 'var(--ink-soft)' }}>{icon}</span>}
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 bg-transparent text-sm focus:outline-none"
      style={{ color: 'var(--ink)', textAlign: isRTL ? 'right' : 'left' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    />
  </div>
);

const ModeCard: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; title: string; hint: string }> = ({ active, onClick, icon, title, hint }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-start gap-1 p-3 rounded-[14px] text-start transition-colors border-2"
    style={active
      ? { background: 'var(--paper-surface-alt)', borderColor: 'var(--ink)', color: 'var(--ink)' }
      : { background: 'var(--paper-bg)', borderColor: 'var(--line)', color: 'var(--ink-muted)' }}
  >
    <span style={{ color: active ? 'var(--accent)' : 'var(--ink-soft)' }}>{icon}</span>
    <span className="text-sm font-semibold">{title}</span>
    <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{hint}</span>
  </button>
);

export default ProfileModal;
