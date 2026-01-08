import React, { useState } from 'react';
import { Recipe } from '../types';
import { X, ChefHat, Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { suggestRecipeIngredients } from '../services/geminiService';

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
  const { t, isRTL, language } = useLanguage();
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const handleAISuggest = async () => {
    if (!recipe.name.trim()) {
      setSuggestionError(language === 'he' ? 'אנא הזן שם מתכון תחילה' : 'Please enter a recipe name first');
      setTimeout(() => setSuggestionError(null), 3000);
      return;
    }

    setIsSuggesting(true);
    setSuggestionError(null);

    try {
      const result = await suggestRecipeIngredients(recipe.name, language);

      if (result.error) {
        setSuggestionError(result.error);
        setTimeout(() => setSuggestionError(null), 5000);
      } else if (result.ingredients) {
        // Append to existing ingredients (don't replace)
        const currentIngredients = recipe.ingredients.trim();
        const newIngredients = currentIngredients
          ? `${currentIngredients}\n${result.ingredients}`
          : result.ingredients;

        onUpdate(recipe.id, { ingredients: newIngredients });
      }
    } catch (error) {
      setSuggestionError(t('input.aiSuggestError'));
      setTimeout(() => setSuggestionError(null), 3000);
    } finally {
      setIsSuggesting(false);
    }
  };

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

      {/* Ingredients textarea with AI suggest button */}
      <div className="relative">
        <div className="flex items-start gap-2">
          <textarea
            value={recipe.ingredients}
            onChange={(e) => onUpdate(recipe.id, { ingredients: e.target.value })}
            placeholder={t('input.recipeIngredients')}
            disabled={isLoading || isSuggesting}
            rows={4}
            className="flex-1 px-4 py-3 bg-white border border-emerald-200 rounded-xl
              focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
              placeholder-slate-400 text-slate-900
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200 resize-none"
          />

          {/* AI Suggest Button */}
          <button
            type="button"
            onClick={handleAISuggest}
            disabled={isLoading || isSuggesting || !recipe.name.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600
              text-white rounded-lg shadow-sm hover:shadow-md hover:from-emerald-600 hover:to-emerald-700
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm
              transition-all duration-200 text-xs font-medium whitespace-nowrap h-fit"
            title={t('input.aiSuggest')}
          >
            <Sparkles className={`w-3.5 h-3.5 ${isSuggesting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSuggesting ? t('input.suggestingIngredients') : t('input.aiSuggest')}</span>
          </button>
        </div>

        {/* Error message */}
        {suggestionError && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
            {suggestionError}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeInputCard;
