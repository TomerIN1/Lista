import React from 'react';
import { LegalDocType } from '../constants/legalText';
import { useLanguage } from '../contexts/LanguageContext';

interface FooterProps {
  onOpenDoc: (doc: LegalDocType) => void;
}

const Footer: React.FC<FooterProps> = ({ onOpenDoc }) => {
  const currentYear = new Date().getFullYear();
  const { t } = useLanguage();

  return (
    <footer className="mt-auto py-8 border-t border-slate-100/50">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-medium">
        
        <div className="order-2 md:order-1">
          &copy; {currentYear} {t('footer.rights')}
        </div>

        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 order-1 md:order-2">
          <button 
            onClick={() => onOpenDoc('privacy')} 
            className="hover:text-indigo-600 transition-colors"
          >
            {t('footer.privacy')}
          </button>
          <button 
            onClick={() => onOpenDoc('terms')} 
            className="hover:text-indigo-600 transition-colors"
          >
            {t('footer.terms')}
          </button>
          <button 
            onClick={() => onOpenDoc('accessibility')} 
            className="hover:text-indigo-600 transition-colors"
          >
            {t('footer.accessibility')}
          </button>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;