import React from 'react';
import { ListDocument } from '../types';
import { X, List, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface OrganizeListBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  list: ListDocument;
}

const OrganizeListBreakdownModal: React.FC<OrganizeListBreakdownModalProps> = ({
  isOpen,
  onClose,
  list,
}) => {
  const { t, tUnit } = useLanguage();

  if (!isOpen) return null;

  const totalItems = list.groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-indigo-50">
          <div className="flex items-center gap-2">
            <List className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-display font-bold text-slate-800 truncate">
              {list.title || 'Untitled List'}
            </h2>
            <span className="text-sm text-slate-500 flex-shrink-0">
              ({list.groups.length} {t('sidebar.categories')} &middot; {totalItems} {t('priceComparison.items')})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-lg transition-colors text-slate-600 hover:text-slate-900 flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Groups */}
        <div className="overflow-y-auto max-h-[calc(85vh-140px)] p-4 space-y-4">
          {list.groups.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">
              {t('result.emptyCategory')}
            </div>
          ) : (
            list.groups.map((group) => (
              <div key={group.id}>
                {/* Category header */}
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-bold text-indigo-700">{group.category}</h3>
                  <span className="text-xs text-slate-400">({group.items.length})</span>
                </div>

                {/* Items */}
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-100"
                    >
                      {/* Checked status */}
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.checked ? 'bg-indigo-500 text-white' : 'border-2 border-slate-300'}`}>
                        {item.checked && <Check className="w-3 h-3" />}
                      </div>

                      {/* Item name */}
                      <span className={`text-sm flex-1 min-w-0 truncate ${item.checked ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}`}>
                        {item.name}
                      </span>

                      {/* Amount + unit badge */}
                      <div className="flex items-center gap-1 flex-shrink-0 px-2 py-0.5 bg-indigo-50 rounded-lg border border-indigo-100">
                        <span className="text-xs font-bold text-indigo-700">{item.amount}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">{tUnit(item.unit)}</span>
                      </div>

                      {/* Recipe labels */}
                      {item.recipeLabels && item.recipeLabels.length > 0 && (
                        <div className="flex gap-1 flex-shrink-0">
                          {item.recipeLabels.map((label) => (
                            <span
                              key={label.recipeId}
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
                              style={{ backgroundColor: label.color }}
                            >
                              {label.recipeName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            {t('result.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrganizeListBreakdownModal;
