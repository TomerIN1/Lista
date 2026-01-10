import React, { useState } from 'react';
import { Item, Unit, Recipe, RecipeLabel } from '../types';
import { X, Check, Tag } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import RecipeBadge from './RecipeBadge';

interface CategoryItemProps {
  item: Item;
  recipes?: Recipe[];
  onToggle: () => void;
  onUpdate: (changes: Partial<Item>) => void;
  onDelete: () => void;
}

const UNITS: Unit[] = ['pcs', 'g', 'kg', 'L', 'ml'];

const CategoryItem: React.FC<CategoryItemProps> = ({ item, recipes = [], onToggle, onUpdate, onDelete }) => {
  const { tUnit } = useLanguage();
  const [showRecipeMenu, setShowRecipeMenu] = useState(false);

  // Helper function to generate color for recipe (same as in geminiService)
  const getRecipeColor = (recipeId: string) => {
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];
    const index = parseInt(recipeId.slice(-8), 16) % colors.length;
    return colors[index];
  };

  const toggleRecipeLabel = (recipe: Recipe) => {
    const currentLabels = item.recipeLabels || [];
    const existingIndex = currentLabels.findIndex(label => label.recipeId === recipe.id);

    let newLabels: RecipeLabel[];
    if (existingIndex >= 0) {
      // Remove the label
      newLabels = currentLabels.filter((_, i) => i !== existingIndex);
    } else {
      // Add the label
      const newLabel: RecipeLabel = {
        recipeId: recipe.id,
        recipeName: recipe.name,
        color: getRecipeColor(recipe.id)
      };
      newLabels = [...currentLabels, newLabel];
    }

    onUpdate({ recipeLabels: newLabels.length > 0 ? newLabels : undefined });
  };

  const hasRecipeLabel = (recipeId: string) => {
    return item.recipeLabels?.some(label => label.recipeId === recipeId) || false;
  };

  return (
    <div 
      className={`
        group flex flex-wrap sm:flex-nowrap items-center gap-3 py-2 px-3 rounded-xl hover:bg-slate-50 transition-all duration-200
        ${item.checked ? 'opacity-50 grayscale-[0.5]' : 'opacity-100'}
      `}
    >
      {/* Custom Checkbox */}
      <button
        onClick={onToggle}
        className={`
          flex-shrink-0 w-5 h-5 rounded-md border transition-all duration-200 flex items-center justify-center shadow-sm
          ${item.checked 
            ? 'bg-indigo-500 border-indigo-500 text-white scale-100' 
            : 'bg-white border-slate-300 text-transparent hover:border-indigo-400 hover:shadow-indigo-100'
          }
        `}
      >
        <Check className="w-3.5 h-3.5" strokeWidth={3} />
      </button>

      {/* Item Name with Recipe Badges */}
      <div className="flex-grow flex items-center gap-2 flex-wrap me-2">
        <span
          className={`
            text-[15px] transition-all font-medium
            ${item.checked ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700'}
          `}
        >
          {item.name}
        </span>

        {/* Recipe Badges */}
        {item.recipeLabels && item.recipeLabels.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {item.recipeLabels.slice(0, 3).map(label => (
              <RecipeBadge key={label.recipeId} label={label} size="sm" />
            ))}
            {item.recipeLabels.length > 3 && (
              <span className="text-[10px] text-slate-400 font-medium">
                +{item.recipeLabels.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Controls Container */}
      <div className="flex items-center gap-1.5 ms-auto sm:ms-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {/* Amount Input */}
        <input
          type="number"
          min="0.1"
          max="100"
          step="0.1"
          value={item.amount}
          onChange={(e) => onUpdate({ amount: parseFloat(e.target.value) || 0 })}
          className="w-14 h-7 text-xs font-semibold text-center border border-transparent hover:border-slate-200 focus:border-indigo-400 rounded-md outline-none bg-transparent focus:bg-white text-slate-600 focus:text-indigo-600 transition-all"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Unit Selector */}
        <div className="relative">
          <select
            value={item.unit}
            onChange={(e) => onUpdate({ unit: e.target.value as Unit })}
            className="h-7 ps-1.5 pe-5 text-[11px] font-bold uppercase tracking-wider bg-transparent hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 rounded-md border-none focus:ring-0 outline-none appearance-none cursor-pointer text-end w-12"
          >
            {UNITS.map(u => (
              <option key={u} value={u}>{tUnit(u)}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        {/* Recipe Labels Button (only show if recipes exist) */}
        {recipes.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowRecipeMenu(!showRecipeMenu)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                item.recipeLabels && item.recipeLabels.length > 0
                  ? 'text-emerald-600 bg-emerald-50'
                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
              }`}
              title="Add recipe labels"
            >
              <Tag className="w-3.5 h-3.5" />
            </button>

            {showRecipeMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowRecipeMenu(false)}
                />
                <div className="absolute right-0 rtl:right-auto rtl:left-0 top-full mt-2 z-20 bg-white rounded-xl shadow-lg border border-slate-100 py-2 min-w-[200px] max-h-[300px] overflow-y-auto">
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Select Recipes
                  </div>
                  {recipes.map((recipe) => {
                    const isSelected = hasRecipeLabel(recipe.id);
                    const recipeLabel: RecipeLabel = {
                      recipeId: recipe.id,
                      recipeName: recipe.name,
                      color: getRecipeColor(recipe.id)
                    };

                    return (
                      <button
                        key={recipe.id}
                        onClick={() => toggleRecipeLabel(recipe)}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                          isSelected
                            ? 'bg-emerald-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-slate-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </div>
                        <RecipeBadge label={recipeLabel} size="sm" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Delete Item */}
        <button
          onClick={onDelete}
          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Remove item"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default CategoryItem;