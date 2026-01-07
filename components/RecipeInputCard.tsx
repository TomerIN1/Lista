import React from 'react';
import { Recipe } from '../types';
import { X, ChefHat } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface RecipeInputCardProps {
  recipe: Recipe;
  index: number;
  onUpdate: (id: string, changes: Partial<Recipe>) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
  canDelete: boolean;
}

const RecipeInputCard: React.FC<RecipeInputCardProps> = ({
  recipe,
  index,
  onUpdate,
  onDelete,
  isLoading,
  canDelete
}) => {
  const { t, isRTL } = useLanguage();

  return (
    <div
      className="relative bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 space-y-3"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Recipe number badge and delete button */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-700">
            {t('input.recipe')} {index + 1}
          </span>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(recipe.id)}
            disabled={isLoading}
            className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('input.removeRecipe')}
          >
            <X className="w-4 h-4 text-emerald-600" />
          </button>
        )}
      </div>

      {/* Recipe name input */}
      <div>
        <input
          type="text"
          value={recipe.name}
          onChange={(e) => onUpdate(recipe.id, { name: e.target.value })}
          placeholder={t('input.recipeName')}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-white border border-emerald-200 rounded-xl
            focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
            placeholder-slate-400 text-slate-900 font-medium
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200"
        />
      </div>

      {/* Ingredients textarea */}
      <div>
        <textarea
          value={recipe.ingredients}
          onChange={(e) => onUpdate(recipe.id, { ingredients: e.target.value })}
          placeholder={t('input.recipeIngredients')}
          disabled={isLoading}
          rows={4}
          className="w-full px-4 py-3 bg-white border border-emerald-200 rounded-xl
            focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
            placeholder-slate-400 text-slate-900
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 resize-none"
        />
      </div>
    </div>
  );
};

export default RecipeInputCard;
