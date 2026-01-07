import React from 'react';
import Logo from './Logo';
import { useLanguage } from '../contexts/LanguageContext';
import { Globe, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import AccessibilityMenu from './AccessibilityMenu';
import { UserProfile } from '../types';

interface HeaderProps {
  user: UserProfile | null;
  onLogin: () => void;
  onLogout: () => void;
  sidebarOpen?: boolean;
}

const Header: React.FC<HeaderProps> = ({ user, onLogin, onLogout, sidebarOpen = false }) => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="mb-8 sm:mb-12 relative">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4 text-center sm:text-start">
          <Logo className="w-12 h-12 shadow-xl shadow-indigo-500/20 rounded-2xl" />
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 font-display">
            Lista
          </h1>
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

          {/* Auth Button */}
          {user ? (
            <div className="flex items-center gap-2 px-1 py-1 pr-3 rtl:pl-3 rtl:pr-1 bg-white border border-slate-200 rounded-full shadow-sm">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-7 h-7 rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <span className="text-xs font-medium text-slate-700 max-w-[80px] truncate hidden sm:block">
                {user.displayName}
              </span>
              <button 
                onClick={onLogout}
                className="ml-1 rtl:mr-1 rtl:ml-0 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                title={t('header.logout')}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-all text-sm font-medium shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>{t('header.login')}</span>
            </button>
          )}
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