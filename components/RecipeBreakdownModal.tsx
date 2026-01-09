import React, { useState } from 'react';
import { Recipe, SavedRecipe } from '../types';
import { X, ChefHat, Edit, Save, XCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface RecipeBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  canEdit?: boolean;
  onUpdate?: (recipeId: string, updates: Partial<SavedRecipe>) => Promise<void>;
}

const RecipeBreakdownModal: React.FC<RecipeBreakdownModalProps> = ({
  isOpen,
  onClose,
  recipes,
  canEdit = false,
  onUpdate
}) => {
  const { t, isRTL, language } = useLanguage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedRecipe, setEditedRecipe] = useState<Partial<Recipe>>({});
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleEdit = (recipe: Recipe) => {
    setEditingId(recipe.id);
    setEditedRecipe({
      name: recipe.name,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedRecipe({});
  };

  const handleSave = async (recipeId: string) => {
    if (!onUpdate) return;

    setIsSaving(true);
    try {
      await onUpdate(recipeId, editedRecipe as SavedRecipe);
      setEditingId(null);
      setEditedRecipe({});
    } catch (error) {
      alert(language === 'he' ? 'שגיאה בעדכון המתכון' : 'Error updating recipe');
    } finally {
      setIsSaving(false);
    }
  };

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
          {recipes.map((recipe, index) => {
            const isEditing = editingId === recipe.id;

            return (
              <div
                key={recipe.id}
                className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-xl p-5 hover:shadow-md transition-shadow"
              >
                {/* Recipe Number & Name */}
                <div className={`flex items-center justify-between gap-3 mb-4`}>
                  <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white text-sm font-bold shrink-0">
                      {index + 1}
                    </div>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedRecipe.name || ''}
                        onChange={(e) => setEditedRecipe(prev => ({ ...prev, name: e.target.value }))}
                        className="flex-1 text-xl font-display font-bold text-slate-800 bg-white border border-emerald-200 rounded-lg px-3 py-1"
                      />
                    ) : (
                      <h3 className="text-xl font-display font-bold text-slate-800">
                        {recipe.name}
                      </h3>
                    )}
                  </div>

                  {canEdit && !isEditing && (
                    <button
                      onClick={() => handleEdit(recipe)}
                      className="p-2 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-600"
                      title={language === 'he' ? 'ערוך מתכון' : 'Edit recipe'}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Ingredients */}
                <div className="mb-4">
                  <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wider mb-2">
                    {t('input.ingredientsLabel')}
                  </h4>
                  {isEditing ? (
                    <textarea
                      value={editedRecipe.ingredients || ''}
                      onChange={(e) => setEditedRecipe(prev => ({ ...prev, ingredients: e.target.value }))}
                      rows={4}
                      className="w-full bg-white rounded-lg p-4 border border-emerald-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  ) : (
                    <div className="bg-white rounded-lg p-4 border border-emerald-100">
                      <p className={`text-sm text-slate-700 whitespace-pre-wrap leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
                        {recipe.ingredients}
                      </p>
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div>
                  <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wider mb-2">
                    {t('input.instructionsLabel')}
                  </h4>
                  {isEditing ? (
                    <textarea
                      value={editedRecipe.instructions || ''}
                      onChange={(e) => setEditedRecipe(prev => ({ ...prev, instructions: e.target.value }))}
                      rows={4}
                      className="w-full bg-white rounded-lg p-4 border border-emerald-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  ) : (
                    recipe.instructions && recipe.instructions.trim() && (
                      <div className="bg-white rounded-lg p-4 border border-emerald-100">
                        <p className={`text-sm text-slate-700 whitespace-pre-wrap leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
                          {recipe.instructions}
                        </p>
                      </div>
                    )
                  )}
                </div>

                {/* Edit Actions */}
                {isEditing && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleSave(recipe.id)}
                      disabled={isSaving}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? (language === 'he' ? 'שומר...' : 'Saving...') : (language === 'he' ? 'שמור' : 'Save')}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      {language === 'he' ? 'ביטול' : 'Cancel'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
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
