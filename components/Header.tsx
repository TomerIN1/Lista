import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Globe, LogIn, LogOut, User as UserIcon, Search, MapPin, ShoppingCart, Sparkles, Menu } from 'lucide-react';
import AccessibilityMenu from './AccessibilityMenu';
import { AppMode, UserProfile } from '../types';

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
}

const Header: React.FC<HeaderProps> = ({
  user, onLogin, onLogout, sidebarOpen = false,
  appMode = 'organize', onModeSwitch, shoppingCity, cartItemCount = 0,
  onLocationClick, onCartClick, searchQuery = '', onSearchChange, disabled = false,
  onMenuClick,
}) => {
  const { language, setLanguage, t, isRTL } = useLanguage();

  const isShopping = appMode === 'shopping';

  // Compact mode toggle (used in both modes)
  const ModeToggle = () => (
    <div className="inline-flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
      <button
        type="button"
        onClick={() => onModeSwitch?.('organize')}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
          appMode === 'organize'
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'text-slate-400 hover:text-slate-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('appMode.organize')}</span>
      </button>
      <button
        type="button"
        onClick={() => onModeSwitch?.('shopping')}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
          appMode === 'shopping'
            ? 'bg-white text-emerald-700 shadow-sm'
            : 'text-slate-400 hover:text-slate-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
        <div className={`flex items-center gap-1.5 ${compact ? 'px-1 py-0.5 pr-2 rtl:pl-2 rtl:pr-1' : 'px-1 py-1 pr-3 rtl:pl-3 rtl:pr-1'} bg-white border border-slate-200 rounded-full shadow-sm`}>
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || 'User'} className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} rounded-full`} />
          ) : (
            <div className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600`}>
              <UserIcon className="w-3.5 h-3.5" />
            </div>
          )}
          {!compact && (
            <span className="text-xs font-medium text-slate-700 max-w-[80px] truncate hidden sm:block">
              {user.displayName}
            </span>
          )}
          <button
            onClick={onLogout}
            className="ml-0.5 rtl:mr-0.5 rtl:ml-0 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            title={t('header.logout')}
          >
            <LogOut className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={onLogin}
          className={`flex items-center gap-1.5 ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-1.5 text-sm'} rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-all font-medium shadow-sm`}
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
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm -mx-3 sm:-mx-4 mb-3">
        {/* Main header row */}
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 max-w-7xl mx-auto">
          {/* Sidebar / My Lists button */}
          <button
            onClick={onMenuClick}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
            title={isRTL ? 'הרשימות שלי' : 'My Lists'}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mode toggle */}
          <ModeToggle />

          {/* Logo (compact) — click to go home */}
          <button
            onClick={() => onModeSwitch?.('shopping')}
            className="hidden sm:block flex-shrink-0 hover:opacity-80 transition-opacity"
            title={isRTL ? 'חזרה לדף הבית' : 'Back to home'}
          >
            <img
              src="/lista-05.svg"
              alt="Lista"
              className="h-7 w-auto"
            />
          </button>

          {/* Search bar */}
          <div className="flex-1 flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all min-w-0">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={t('productBrowse.searchProducts')}
              className="flex-1 bg-transparent text-sm placeholder:text-slate-400 focus:outline-none min-w-0"
              dir="auto"
            />
            {searchQuery && (
              <button onClick={() => onSearchChange?.('')} className="text-slate-400 hover:text-slate-600">
                <span className="sr-only">Clear</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {/* Location badge */}
          {shoppingCity && (
            <button
              onClick={onLocationClick}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors whitespace-nowrap flex-shrink-0"
              title={isRTL ? 'שנה מיקום' : 'Change location'}
            >
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="max-w-[80px] truncate">{shoppingCity}</span>
            </button>
          )}

          {/* Cart badge */}
          <button
            onClick={onCartClick}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 ${
              cartItemCount > 0
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-100 text-slate-400'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>{cartItemCount}</span>
          </button>

          {/* Auth */}
          <AuthSection compact />
        </div>

        {/* Mobile-only location bar */}
        {shoppingCity && (
          <button
            onClick={onLocationClick}
            className="sm:hidden flex items-center gap-1.5 w-full px-4 py-1.5 bg-emerald-50/50 border-t border-emerald-100/50 text-emerald-700 text-xs"
          >
            <MapPin className="w-3 h-3" />
            <span className="truncate">{shoppingCity}</span>
            <span className="text-emerald-500 ms-auto">{isRTL ? 'שנה' : 'Change'}</span>
          </button>
        )}
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all text-sm font-medium shadow-sm"
          >
            <Globe className="w-4 h-4" />
            <span>{language === 'en' ? 'English' : 'עברית'}</span>
          </button>

          {!sidebarOpen && <AccessibilityMenu />}

          <AuthSection />
        </div>
      </div>

      <div className="text-center sm:text-start">
        <p className="text-slate-500 max-w-lg mx-auto sm:mx-0 leading-relaxed text-base font-light">
          {t('header.subtitle').split(t('header.highlight'))[0]}
          <span className="text-indigo-600 font-medium">{t('header.highlight')}</span>
          {t('header.subtitle').split(t('header.highlight'))[1]}
        </p>
      </div>
    </header>
  );
};

export default Header;
