import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Globe, LogIn, LogOut, User as UserIcon, Search, MapPin, ShoppingCart, Sparkles, Menu } from 'lucide-react';
import AccessibilityMenu from './AccessibilityMenu';
import { AppMode, UserProfile, DbProduct } from '../types';
import SearchDropdown from './SearchDropdown';

interface HeaderProps {
  user: UserProfile | null;
  onLogin: () => void;
  onLogout: () => void;
  sidebarOpen?: boolean;
  // Shopping mode props
  appMode?: AppMode;
  onModeSwitch?: (mode: AppMode) => void;
  shoppingCity?: string;
  cartItemCount?: number;
  onLocationClick?: () => void;
  onCartClick?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  disabled?: boolean;
  onMenuClick?: () => void;
  onOpenAI?: () => void;
  // Search dropdown — only relevant in shopping mode while building list
  searchDropdownEnabled?: boolean;
  onAddProductFromSearch?: (product: DbProduct, amount: number) => void;
  onOpenProductFromSearch?: (product: DbProduct) => void;
  onSeeAllSearchResults?: () => void;
  searchStoreType?: string;
  selectedSearchBarcodes?: Set<string>;
}

const Header: React.FC<HeaderProps> = ({
  user, onLogin, onLogout, sidebarOpen = false,
  appMode = 'organize', onModeSwitch, shoppingCity, cartItemCount = 0,
  onLocationClick, onCartClick, searchQuery = '', onSearchChange, disabled = false,
  onMenuClick, onOpenAI,
  searchDropdownEnabled = false,
  onAddProductFromSearch, onOpenProductFromSearch, onSeeAllSearchResults,
  searchStoreType, selectedSearchBarcodes,
}) => {
  const { language, setLanguage, t, isRTL } = useLanguage();
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  const isShopping = appMode === 'shopping';

  // Compact mode toggle (used in both modes)
  const ModeToggle = () => (
    <div className="inline-flex items-center rounded-full p-1 gap-0.5" style={{ background: 'var(--paper-surface-alt)' }}>
      <button
        type="button"
        onClick={() => onModeSwitch?.('organize')}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={appMode === 'organize'
          ? { background: 'var(--paper-surface)', color: 'var(--accent)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
          : { color: 'var(--ink-soft)' }}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('appMode.organize')}</span>
      </button>
      <button
        type="button"
        onClick={() => onModeSwitch?.('shopping')}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={appMode === 'shopping'
          ? { background: 'var(--paper-surface)', color: 'var(--save)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
          : { color: 'var(--ink-soft)' }}
      >
        <ShoppingCart className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('appMode.shopping')}</span>
      </button>
    </div>
  );

  // Auth section (shared between both modes)
  const AuthSection = ({ compact = false }: { compact?: boolean }) => (
    <>
      {user ? (
        <div
          className={`flex items-center gap-1.5 ${compact ? 'px-1 py-0.5 pr-2 rtl:pl-2 rtl:pr-1' : 'px-1 py-1 pr-3 rtl:pl-3 rtl:pr-1'} border rounded-full shadow-sm`}
          style={{ background: 'var(--paper-surface)', borderColor: 'var(--line)' }}
        >
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || 'User'} className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} rounded-full`} />
          ) : (
            <div
              className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} rounded-full flex items-center justify-center`}
              style={{ background: 'var(--paper-surface-alt)', color: 'var(--accent)' }}
            >
              <UserIcon className="w-3.5 h-3.5" />
            </div>
          )}
          {!compact && (
            <span className="text-xs font-medium max-w-[80px] truncate hidden sm:block" style={{ color: 'var(--ink)' }}>
              {user.displayName}
            </span>
          )}
          <button
            onClick={onLogout}
            className="ml-0.5 rtl:mr-0.5 rtl:ml-0 p-1 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            style={{ color: 'var(--ink-soft)' }}
            title={t('header.logout')}
          >
            <LogOut className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={onLogin}
          className={`flex items-center gap-1.5 ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-1.5 text-sm'} rounded-full transition-all font-medium shadow-sm`}
          style={{ background: 'var(--ink)', color: 'var(--paper-bg)' }}
        >
          <LogIn className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('header.login')}</span>
        </button>
      )}
    </>
  );

  // ── Shopping Mode Header (supermarket style) ──
  if (isShopping) {
    return (
      <header
        className="sticky top-0 z-40 backdrop-blur-md border-b shadow-sm -mx-3 sm:-mx-4 mb-3"
        style={{ background: 'rgba(245,241,232,0.88)', borderColor: 'var(--line)' }}
      >
        {/* Main header row — slimmed down: search + profile only */}
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 max-w-7xl mx-auto">
          {/* Mobile menu button — opens the right rail drawer */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1.5 rounded-full flex-shrink-0"
            style={{ color: 'var(--ink-muted)' }}
            title={isRTL ? 'תפריט' : 'Menu'}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Smart Assistant — prominent AI CTA (positioned before search so it lands on the RTL start/right) */}
          {onOpenAI && (
            <button
              type="button"
              onClick={onOpenAI}
              disabled={disabled}
              className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap flex-shrink-0 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 disabled:opacity-60 disabled:pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, #D7352D, #E88B3C)',
                color: '#FFFFFF',
              }}
              title={isRTL ? 'עוזר חכם' : 'Smart Assistant'}
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="hidden xs:inline sm:inline">{isRTL ? 'עוזר חכם' : 'Smart AI'}</span>
            </button>
          )}

          {/* Search bar */}
          <div className="flex-1 relative min-w-0" data-search-input>
            <div
              className="flex items-center gap-2 rounded-full px-3 py-2 border transition-all"
              style={{ background: 'var(--paper-surface-alt)', borderColor: 'var(--line)' }}
            >
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ink-soft)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { onSearchChange?.(e.target.value); setSearchDropdownOpen(true); }}
                onFocus={() => setSearchDropdownOpen(true)}
                placeholder={t('productBrowse.searchProducts')}
                className="flex-1 bg-transparent text-sm focus:outline-none min-w-0"
                style={{ color: 'var(--ink)', textAlign: isRTL ? 'right' : 'left' }}
                dir={isRTL ? 'rtl' : 'ltr'}
              />
              {searchQuery && (
                <button onClick={() => { onSearchChange?.(''); setSearchDropdownOpen(false); }} style={{ color: 'var(--ink-soft)' }}>
                  <span className="sr-only">Clear</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            {searchDropdownEnabled && onAddProductFromSearch && onOpenProductFromSearch && onSeeAllSearchResults && (
              <SearchDropdown
                query={searchQuery}
                isOpen={searchDropdownOpen}
                onClose={() => setSearchDropdownOpen(false)}
                onAddProduct={(p, amount) => { onAddProductFromSearch(p, amount); /* keep dropdown open so user can add more */ }}
                onOpenProduct={(p) => { onOpenProductFromSearch(p); setSearchDropdownOpen(false); }}
                onSeeAllResults={() => { onSeeAllSearchResults(); setSearchDropdownOpen(false); }}
                storeType={searchStoreType}
                selectedBarcodes={selectedSearchBarcodes}
              />
            )}
          </div>

        </div>
      </header>
    );
  }

  // ── Organize Mode Header (original style + mode toggle) ──
  return (
    <header className="mb-8 sm:mb-12 relative">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4 text-center sm:text-start">
          <button
            onClick={() => onModeSwitch?.('shopping')}
            className="hover:opacity-80 transition-opacity"
            title={isRTL ? 'חזרה לדף הבית' : 'Back to home'}
          >
            <img
              src="/lista-05.svg"
              alt="Lista"
              className="h-12 w-auto"
            />
          </button>
          <ModeToggle />
        </div>

        <div className="flex items-center flex-wrap justify-center gap-3">
          <button
            onClick={() => setLanguage(language === 'en' ? 'he' : 'en')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-sm font-medium shadow-sm"
            style={{ background: 'var(--paper-surface)', borderColor: 'var(--line)', color: 'var(--ink-muted)' }}
          >
            <Globe className="w-4 h-4" />
            <span>{language === 'en' ? 'English' : 'עברית'}</span>
          </button>

          {!sidebarOpen && <AccessibilityMenu />}

          <AuthSection />
        </div>
      </div>

      <div className="text-center sm:text-start">
        <p className="max-w-lg mx-auto sm:mx-0 leading-relaxed text-base font-light" style={{ color: 'var(--ink-muted)' }}>
          {t('header.subtitle').split(t('header.highlight'))[0]}
          <span className="font-medium" style={{ color: 'var(--accent)' }}>{t('header.highlight')}</span>
          {t('header.subtitle').split(t('header.highlight'))[1]}
        </p>
      </div>
    </header>
  );
};

export default Header;
