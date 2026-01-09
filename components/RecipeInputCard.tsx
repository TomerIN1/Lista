import React, { useState } from 'react';
import { Recipe } from '../types';
import { X, ChefHat, Sparkles, Star } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { suggestFullRecipe } from '../services/geminiService';

interface RecipeInputCardProps {
  recipe: Recipe;
  index: number;
  onUpdate: (id: string, changes: Partial<Recipe>) => void;
  onDelete: (id: string) => void;
  onSave: (recipe: Recipe) => void;
  isLoading: boolean;
  canDelete: boolean;
  isLoggedIn: boolean;
}

const RecipeInputCard: React.FC<RecipeInputCardProps> = ({
  recipe,
  index,
  onUpdate,
  onDelete,
  onSave,
  isLoading,
  canDelete,
  isLoggedIn
}) => {
  const { t, isRTL, language } = useLanguage();
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
      const result = await suggestFullRecipe(recipe.name, language);

      if (result.error) {
        setSuggestionError(result.error);
        setTimeout(() => setSuggestionError(null), 5000);
      } else {
        // Append to existing ingredients and instructions (don't replace)
        const currentIngredients = recipe.ingredients.trim();
        const currentInstructions = recipe.instructions?.trim() || '';

        onUpdate(recipe.id, {
          ingredients: currentIngredients
            ? `${currentIngredients}\n${result.ingredients}`
            : result.ingredients,
          instructions: currentInstructions
            ? `${currentInstructions}\n${result.instructions}`
            : result.instructions
        });
      }
    } catch (error) {
      setSuggestionError(t('input.aiSuggestError'));
      setTimeout(() => setSuggestionError(null), 3000);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!recipe.name.trim() || !recipe.ingredients.trim()) {
      setSuggestionError(language === 'he' ? 'אנא הזן שם ומרכיבים' : 'Please enter name and ingredients');
      setTimeout(() => setSuggestionError(null), 3000);
      return;
    }

    // If this recipe came from a saved recipe, ask user if they want to update or save as new
    if (recipe.originalSavedRecipeId) {
      const updateMessage = language === 'he'
        ? 'האם לעדכן את המתכון השמור או לשמור כמתכון חדש?'
        : 'Update the existing saved recipe or save as a new recipe?';

      const updateButton = language === 'he' ? 'עדכן את המתכון הקיים' : 'Update existing recipe';
      const saveNewButton = language === 'he' ? 'שמור כמתכון חדש' : 'Save as new recipe';

      const shouldUpdate = window.confirm(`${updateMessage}\n\nOK = ${updateButton}\nCancel = ${saveNewButton}`);

      setIsSaving(true);
      try {
        if (shouldUpdate) {
          // Update the existing saved recipe with the current ID
          await onSave({ ...recipe, id: recipe.originalSavedRecipeId });
          setSuggestionError(language === 'he' ? 'המתכון עודכן בהצלחה!' : 'Recipe updated successfully!');
        } else {
          // Save as a new recipe (remove originalSavedRecipeId to ensure it's saved as new)
          const { originalSavedRecipeId, ...recipeWithoutOriginal } = recipe;
          await onSave({ ...recipeWithoutOriginal, id: crypto.randomUUID() });
          setSuggestionError(language === 'he' ? 'נשמר כמתכון חדש!' : 'Saved as new recipe!');
        }
        setTimeout(() => setSuggestionError(null), 2000);
      } catch (error) {
        setSuggestionError(language === 'he' ? 'שגיאה בשמירה' : 'Error saving recipe');
        setTimeout(() => setSuggestionError(null), 3000);
      } finally {
        setIsSaving(false);
      }
    } else {
      // Normal save for new recipes
      setIsSaving(true);
      try {
        await onSave(recipe);
        setSuggestionError(language === 'he' ? 'נשמר בהצלחה!' : 'Saved successfully!');
        setTimeout(() => setSuggestionError(null), 2000);
      } catch (error) {
        setSuggestionError(language === 'he' ? 'שגיאה בשמירה' : 'Error saving recipe');
        setTimeout(() => setSuggestionError(null), 3000);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div
      className="relative bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 space-y-3"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Recipe number badge, save button, and delete button */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-700">
            {t('input.recipe')} {index + 1}
          </span>
          {/* Indicator for loaded saved recipe */}
          {recipe.originalSavedRecipeId && (
            <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
              {language === 'he' ? 'מתכון שמור' : 'Saved'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Save Recipe Button (only if logged in) */}
          {isLoggedIn && (
            <button
              type="button"
              onClick={handleSaveRecipe}
              disabled={isLoading || isSaving}
              className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                recipe.originalSavedRecipeId
                  ? 'hover:bg-amber-100'
                  : 'hover:bg-emerald-100'
              }`}
              aria-label={recipe.originalSavedRecipeId
                ? (language === 'he' ? 'עדכן או שמור כחדש' : 'Update or save as new')
                : t('input.saveRecipe')}
              title={recipe.originalSavedRecipeId
                ? (language === 'he' ? 'עדכן מתכון קיים או שמור כמתכון חדש' : 'Update existing recipe or save as new')
                : t('input.saveRecipe')}
            >
              <Star className={`w-4 h-4 ${
                recipe.originalSavedRecipeId
                  ? 'text-amber-500 fill-amber-500'
                  : 'text-emerald-600'
              } ${isSaving ? 'animate-pulse' : ''}`} />
            </button>
          )}
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

      {/* AI Suggest Button */}
      <button
        type="button"
        onClick={handleAISuggest}
        disabled={isLoading || isSuggesting || !recipe.name.trim()}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600
          text-white rounded-lg shadow-sm hover:shadow-md hover:from-emerald-600 hover:to-emerald-700
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm
          transition-all duration-200 text-sm font-medium"
        title={t('input.aiSuggestFull')}
      >
        <Sparkles className={`w-4 h-4 ${isSuggesting ? 'animate-spin' : ''}`} />
        <span>{isSuggesting ? t('input.suggestingRecipe') : t('input.aiSuggestFull')}</span>
      </button>

      {/* Ingredients textarea */}
      <div className="relative space-y-2">
        <label className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
          {t('input.ingredientsLabel')}
        </label>
        <textarea
          value={recipe.ingredients}
          onChange={(e) => onUpdate(recipe.id, { ingredients: e.target.value })}
          placeholder={t('input.recipeIngredients')}
          disabled={isLoading || isSuggesting}
          rows={4}
          className="w-full px-4 py-3 bg-white border border-emerald-200 rounded-xl
            focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
            placeholder-slate-400 text-slate-900
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 resize-none"
        />
      </div>

      {/* Instructions textarea */}
      <div className="relative space-y-2">
        <label className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
          {t('input.instructionsLabel')}
        </label>
        <textarea
          value={recipe.instructions || ''}
          onChange={(e) => onUpdate(recipe.id, { instructions: e.target.value })}
          placeholder={t('input.recipeInstructions')}
          disabled={isLoading || isSuggesting}
          rows={4}
          className="w-full px-4 py-3 bg-white border border-emerald-200 rounded-xl
            focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
            placeholder-slate-400 text-slate-900
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 resize-none"
        />
      </div>

      {/* Error/Success message */}
      {suggestionError && (
        <div className={`mt-2 text-xs px-3 py-2 rounded-lg border ${
          suggestionError.includes('success') || suggestionError.includes('הצלחה')
            ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
            : 'text-red-600 bg-red-50 border-red-100'
        }`}>
          {suggestionError}
        </div>
      )}
    </div>
  );
};

export default RecipeInputCard;
