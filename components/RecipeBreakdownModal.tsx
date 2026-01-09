import React from 'react';
import { Recipe } from '../types';
import { X, ChefHat } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface RecipeBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
}

const RecipeBreakdownModal: React.FC<RecipeBreakdownModalProps> = ({
  isOpen,
  onClose,
  recipes
}) => {
  const { t, isRTL } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-emerald-50">
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-display font-bold text-slate-800">
              {t('result.viewRecipesTitle')}
            </h2>
            <span className="text-sm text-slate-500">
              ({recipes.length} {t('result.recipes')})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-lg transition-colors text-slate-600 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-6 space-y-6">
          {recipes.map((recipe, index) => (
            <div
              key={recipe.id}
              className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              {/* Recipe Number & Name */}
              <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white text-sm font-bold shrink-0">
                  {index + 1}
                </div>
                <h3 className="text-xl font-display font-bold text-slate-800">
                  {recipe.name}
                </h3>
              </div>

              {/* Ingredients */}
              <div className="mb-4">
                <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wider mb-2">
                  {t('input.ingredientsLabel')}
                </h4>
                <div className="bg-white rounded-lg p-4 border border-emerald-100">
                  <p className={`text-sm text-slate-700 whitespace-pre-wrap leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
                    {recipe.ingredients}
                  </p>
                </div>
              </div>

              {/* Instructions (if available) */}
              {recipe.instructions && recipe.instructions.trim() && (
                <div>
                  <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wider mb-2">
                    {t('input.instructionsLabel')}
                  </h4>
                  <div className="bg-white rounded-lg p-4 border border-emerald-100">
                    <p className={`text-sm text-slate-700 whitespace-pre-wrap leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
                      {recipe.instructions}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
          >
            {t('result.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeBreakdownModal;
