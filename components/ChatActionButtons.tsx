import React from 'react';
import { ChatButton, AgentStore, AgentProduct } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Check, X, ShoppingCart, SkipForward, Store } from 'lucide-react';

// ============================================
// Consent Buttons
// ============================================

interface ConsentButtonsProps {
  onConsent: (agreed: boolean) => void;
}

export const ConsentButtons: React.FC<ConsentButtonsProps> = ({ onConsent }) => {
  const { language } = useLanguage();

  return (
    <div className="flex gap-3">
      <button
        onClick={() => onConsent(true)}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-sm"
      >
        <Check className="w-4 h-4" />
        {language === 'he' ? 'כן, אני מסכים/ה' : 'Yes, I agree'}
      </button>
      <button
        onClick={() => onConsent(false)}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-all active:scale-95"
      >
        <X className="w-4 h-4" />
        {language === 'he' ? 'לא, תודה' : 'No, thanks'}
      </button>
    </div>
  );
};

// ============================================
// Store Selection Buttons
// ============================================

interface StoreSelectionButtonsProps {
  stores: AgentStore[];
  selectedStores: string[];
  onToggleStore: (storeId: string) => void;
  onComplete: () => void;
}

export const StoreSelectionButtons: React.FC<StoreSelectionButtonsProps> = ({
  stores,
  selectedStores,
  onToggleStore,
  onComplete,
}) => {
  const { language } = useLanguage();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {stores.map((store) => {
          const isSelected = selectedStores.includes(store.id);
          return (
            <button
              key={store.id}
              onClick={() => onToggleStore(store.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all active:scale-98 ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isSelected ? 'bg-indigo-100' : 'bg-slate-100'
                }`}
              >
                {isSelected ? (
                  <Check className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Store className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <div className="text-start flex-1">
                <div className="font-medium">
                  {language === 'he' ? store.nameHe : store.name}
                </div>
                <div className="text-xs text-slate-500">
                  {store.deliveryFee === 0
                    ? language === 'he'
                      ? 'משלוח חינם'
                      : 'Free delivery'
                    : `₪${store.deliveryFee} ${language === 'he' ? 'משלוח' : 'delivery'}`}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={onComplete}
        disabled={selectedStores.length === 0}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 font-medium rounded-xl transition-all active:scale-95 ${
          selectedStores.length > 0
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }`}
      >
        <ShoppingCart className="w-4 h-4" />
        {language === 'he' ? `חפש ב-${selectedStores.length} חנויות` : `Search ${selectedStores.length} store${selectedStores.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
};

// ============================================
// Product Selection Buttons
// ============================================

interface ProductSelectionButtonsProps {
  products: AgentProduct[];
  onSelect: (index: number) => void;
  onSkip: () => void;
}

export const ProductSelectionButtons: React.FC<ProductSelectionButtonsProps> = ({
  products,
  onSelect,
  onSkip,
}) => {
  const { language } = useLanguage();

  return (
    <div className="space-y-2">
      {products.map((product, index) => (
        <button
          key={product.sku}
          onClick={() => onSelect(index)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all active:scale-98"
        >
          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600">
            {index + 1}
          </div>
          <div className="flex-1 text-start">
            <div className="font-medium text-slate-800">
              {language === 'he' && product.nameHe ? product.nameHe : product.name}
            </div>
            <div className="text-xs text-slate-500">
              {product.brand} • {product.unit}
            </div>
          </div>
          <div className="text-end">
            {product.salePrice && product.salePrice < product.price ? (
              <div className="text-sm font-bold text-emerald-600">
                ₪{product.salePrice.toFixed(2)}
              </div>
            ) : (
              <div className="text-sm font-bold text-slate-800">
                ₪{product.price.toFixed(2)}
              </div>
            )}
          </div>
        </button>
      ))}

      <button
        onClick={onSkip}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
      >
        <SkipForward className="w-4 h-4" />
        {language === 'he' ? 'דלג על פריט זה' : 'Skip this item'}
      </button>
    </div>
  );
};

// ============================================
// Approval Buttons
// ============================================

interface ApprovalButtonsProps {
  onApprove: () => void;
  onDecline: () => void;
}

export const ApprovalButtons: React.FC<ApprovalButtonsProps> = ({
  onApprove,
  onDecline,
}) => {
  const { language } = useLanguage();

  return (
    <div className="flex gap-3">
      <button
        onClick={onApprove}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-all active:scale-95 shadow-sm"
      >
        <Check className="w-4 h-4" />
        {language === 'he' ? 'אישור והמשך' : 'Approve & Continue'}
      </button>
      <button
        onClick={onDecline}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition-all active:scale-95"
      >
        <X className="w-4 h-4" />
        {language === 'he' ? 'ביטול' : 'Decline'}
      </button>
    </div>
  );
};

// ============================================
// Generic Button Group
// ============================================

interface ButtonGroupProps {
  buttons: ChatButton[];
  onButtonClick: (action: string) => void;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({ buttons, onButtonClick }) => {
  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  };

  return (
    <div className="flex flex-wrap gap-2">
      {buttons.map((button) => (
        <button
          key={button.id}
          onClick={() => onButtonClick(button.action)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
            variantClasses[button.variant || 'secondary']
          }`}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
};

export default ButtonGroup;
