import React, { useState } from 'react';
import { ChatMessage as ChatMessageType, ChatButton, AgentProduct, AgentSavingsReport, StoreCategory, AgentStore } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Bot, User, Package, TrendingDown, ChevronDown, ChevronRight, Store, Plus, Search } from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessageType;
  onButtonClick?: (action: string) => void;
  onStoreSelectionChange?: (selectedStoreIds: string[]) => void;
  onCustomStoreAdd?: (storeName: string) => void;
  onStoreSelectionComplete?: () => void;
  selectedStoreIds?: string[];
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onButtonClick,
  onStoreSelectionChange,
  onCustomStoreAdd,
  onStoreSelectionComplete,
  selectedStoreIds = [],
}) => {
  const { isRTL, language } = useLanguage();
  const isBot = message.type === 'bot';
  const isUser = message.type === 'user';

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isBot
            ? 'bg-indigo-100 text-indigo-600'
            : 'bg-slate-100 text-slate-600'
        }`}
      >
        {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'flex flex-col items-end' : ''}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isBot
              ? 'bg-white border border-slate-200 text-slate-700'
              : 'bg-indigo-600 text-white'
          }`}
        >
          {/* Text content with preserved line breaks */}
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.text}
          </div>

          {/* Store selection UI */}
          {message.storeCategories && (
            <StoreSelectionUI
              categories={message.storeCategories}
              selectedStoreIds={selectedStoreIds}
              onToggleStore={(storeId) => {
                const newSelection = selectedStoreIds.includes(storeId)
                  ? selectedStoreIds.filter(id => id !== storeId)
                  : [...selectedStoreIds, storeId];
                onStoreSelectionChange?.(newSelection);
              }}
              onCustomStoreAdd={onCustomStoreAdd}
              onComplete={onStoreSelectionComplete}
              allowCustomStore={message.allowCustomStore}
            />
          )}

          {/* Products display */}
          {message.products && message.products.length > 0 && (
            <ProductsDisplay products={message.products} />
          )}

          {/* Savings report display */}
          {message.savingsReport && (
            <SavingsReportDisplay report={message.savingsReport} />
          )}
        </div>

        {/* Action buttons */}
        {message.buttons && message.buttons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.buttons.map((button) => (
              <ChatActionButton
                key={button.id}
                button={button}
                onClick={() => onButtonClick?.(button.action)}
              />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div
          className={`text-[10px] text-slate-400 mt-1 ${
            isUser ? 'text-end' : 'text-start'
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================
// Sub-components
// ============================================

interface ChatActionButtonProps {
  button: ChatButton;
  onClick: () => void;
}

const ChatActionButton: React.FC<ChatActionButtonProps> = ({ button, onClick }) => {
  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  };

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
        variantClasses[button.variant || 'secondary']
      }`}
    >
      {button.label}
    </button>
  );
};

interface ProductsDisplayProps {
  products: AgentProduct[];
}

const ProductsDisplay: React.FC<ProductsDisplayProps> = ({ products }) => {
  const { language } = useLanguage();

  return (
    <div className="mt-3 space-y-2">
      {products.map((product, index) => (
        <div
          key={product.sku}
          className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center overflow-hidden">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800 truncate">
              {index + 1}. {language === 'he' && product.nameHe ? product.nameHe : product.name}
            </div>
            <div className="text-xs text-slate-500">
              {product.brand} • {product.unit}
            </div>
          </div>
          <div className="text-end">
            {product.salePrice && product.salePrice < product.price ? (
              <>
                <div className="text-sm font-bold text-emerald-600">
                  ₪{product.salePrice.toFixed(2)}
                </div>
                <div className="text-xs text-slate-400 line-through">
                  ₪{product.price.toFixed(2)}
                </div>
              </>
            ) : (
              <div className="text-sm font-bold text-slate-800">
                ₪{product.price.toFixed(2)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

interface SavingsReportDisplayProps {
  report: AgentSavingsReport;
}

const SavingsReportDisplay: React.FC<SavingsReportDisplayProps> = ({ report }) => {
  const { language } = useLanguage();

  return (
    <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
          <TrendingDown className="w-4 h-4 text-emerald-600" />
        </div>
        <span className="font-bold text-emerald-800">
          {language === 'he' ? 'דו"ח חיסכון' : 'Savings Report'}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-slate-600">
            {language === 'he' ? 'מחיר בסיס:' : 'Baseline:'}
          </span>
          <span className="font-medium text-slate-800">
            ₪{report.baseline.total.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">
            {language === 'he' ? 'המחיר הטוב ביותר:' : 'Best price:'}
          </span>
          <span className="font-bold text-emerald-600">
            ₪{report.bestPlan.total.toFixed(2)}
          </span>
        </div>
        <div className="border-t border-emerald-200 pt-2 mt-2">
          <div className="flex justify-between items-center">
            <span className="text-emerald-700 font-medium">
              {language === 'he' ? 'חיסכון:' : 'Savings:'}
            </span>
            <span className="font-bold text-emerald-600">
              ₪{report.savingsAmount.toFixed(2)} ({report.savingsPercent.toFixed(1)}%)
            </span>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-500 mt-1">
            <span>{language === 'he' ? 'עמלה (5%):' : 'Fee (5%):'}</span>
            <span>₪{report.fee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-emerald-200">
            <span className="font-bold text-emerald-800">
              {language === 'he' ? 'רווח נקי:' : 'Net benefit:'}
            </span>
            <span className="font-bold text-lg text-emerald-600">
              ₪{report.netBenefit.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Store Selection UI
// ============================================

interface StoreSelectionUIProps {
  categories: StoreCategory[];
  selectedStoreIds: string[];
  onToggleStore: (storeId: string) => void;
  onCustomStoreAdd?: (storeName: string) => void;
  onComplete?: () => void;
  allowCustomStore?: boolean;
}

const StoreSelectionUI: React.FC<StoreSelectionUIProps> = ({
  categories,
  selectedStoreIds,
  onToggleStore,
  onCustomStoreAdd,
  onComplete,
  allowCustomStore,
}) => {
  const { language } = useLanguage();
  const [expandedCategories, setExpandedCategories] = useState<string[]>([categories[0]?.id || '']);
  const [customStoreName, setCustomStoreName] = useState('');

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleAddCustomStore = () => {
    if (customStoreName.trim()) {
      onCustomStoreAdd?.(customStoreName.trim());
      setCustomStoreName('');
    }
  };

  const selectedCount = selectedStoreIds.length;

  return (
    <div className="mt-4 space-y-3">
      {/* Categories */}
      {categories.map((category) => {
        const isExpanded = expandedCategories.includes(category.id);
        const categorySelectedCount = category.stores.filter(s => selectedStoreIds.includes(s.id)).length;

        return (
          <div key={category.id} className="border border-slate-200 rounded-xl overflow-hidden">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category.id)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
                <span className="font-medium text-sm text-slate-700">
                  {language === 'he' ? category.nameHe : category.name}
                </span>
              </div>
              {categorySelectedCount > 0 && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  {categorySelectedCount}
                </span>
              )}
            </button>

            {/* Store Buttons */}
            {isExpanded && (
              <div className="p-2 flex flex-wrap gap-2">
                {category.stores.map((store) => {
                  const isSelected = selectedStoreIds.includes(store.id);
                  return (
                    <button
                      key={store.id}
                      onClick={() => onToggleStore(store.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <Store className="w-3 h-3" />
                      {language === 'he' ? store.nameHe : store.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Custom Store Input */}
      {allowCustomStore && (
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={customStoreName}
              onChange={(e) => setCustomStoreName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomStore()}
              placeholder={language === 'he' ? 'הוסף חנות אחרת...' : 'Add another store...'}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleAddCustomStore}
            disabled={!customStoreName.trim()}
            className={`px-3 py-2 rounded-lg transition-all ${
              customStoreName.trim()
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-slate-50 text-slate-300 cursor-not-allowed'
            }`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Done Button */}
      <button
        onClick={onComplete}
        disabled={selectedCount === 0}
        className={`w-full py-3 rounded-xl font-medium transition-all ${
          selectedCount > 0
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-98'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }`}
      >
        {language === 'he'
          ? `חפש ב-${selectedCount} חנויות`
          : `Search ${selectedCount} store${selectedCount !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
};

export default ChatMessage;
