import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Trash2, PlusCircle, PenLine, ListPlus, RefreshCw, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { InputMode, Recipe } from '../types';
import RecipeInputCard from './RecipeInputCard';

interface InputAreaProps {
  onOrganize: (text: string, name: string) => void;
  onOrganizeRecipes: (recipes: Recipe[], name: string) => void;
  onAdd: (text: string) => void;
  onAddRecipes: (recipes: Recipe[]) => void;
  onReset: () => void;
  isLoading: boolean;
  hasResults: boolean;
  currentMode?: InputMode;
  currentRecipes?: Recipe[];
  currentTitle?: string;
}

const InputArea: React.FC<InputAreaProps> = ({
  onOrganize,
  onOrganizeRecipes,
  onAdd,
  onAddRecipes,
  onReset,
  isLoading,
  hasResults,
  currentMode = 'items',
  currentRecipes = [],
  currentTitle = ''
}) => {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<InputMode>(currentMode);
  const [recipes, setRecipes] = useState<Recipe[]>([
    { id: crypto.randomUUID(), name: '', ingredients: '' }
  ]);
  const { t, isRTL } = useLanguage();

  // Sync recipes from props when currentRecipes change (e.g., when reopening a list)
  useEffect(() => {
    if (currentRecipes.length > 0) {
      setRecipes(currentRecipes);
    } else {
      // Reset to empty recipe if no current recipes
      setRecipes([{ id: crypto.randomUUID(), name: '', ingredients: '' }]);
    }
  }, [currentRecipes]);

  // Sync mode from props
  useEffect(() => {
    setMode(currentMode);
  }, [currentMode]);

  // Sync name from props when list title changes
  useEffect(() => {
    setName(currentTitle);
  }, [currentTitle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'items') {
      if (!text.trim()) return;
      if (hasResults) {
        onAdd(text);
        setText('');
      } else {
        onOrganize(text, name);
      }
    } else {
      // Recipe mode
      const validRecipes = recipes.filter(r => r.ingredients.trim());
      if (validRecipes.length === 0) return;

      // Auto-name empty recipe names
      const namedRecipes = validRecipes.map((r, i) => ({
        ...r,
        name: r.name.trim() || `${t('input.recipe')} ${i + 1}`
      }));

      if (hasResults) {
        onAddRecipes(namedRecipes);
      } else {
        onOrganizeRecipes(namedRecipes, name);
      }
    }
  };

  const handleReplace = () => {
    if (mode === 'items') {
      if (text.trim()) {
        onOrganize(text, name);
      }
    } else {
      const validRecipes = recipes.filter(r => r.ingredients.trim());
      if (validRecipes.length > 0) {
        const namedRecipes = validRecipes.map((r, i) => ({
          ...r,
          name: r.name.trim() || `${t('input.recipe')} ${i + 1}`
        }));
        onOrganizeRecipes(namedRecipes, name);
      }
    }
  };

  const handleClear = () => {
    setText('');
    setName('');
    setRecipes([{ id: crypto.randomUUID(), name: '', ingredients: '' }]);
  };

  const handleNewList = () => {
    setText('');
    setName('');
    setRecipes([{ id: crypto.randomUUID(), name: '', ingredients: '' }]);
    onReset();
  };

  const handleAddRecipe = () => {
    if (recipes.length < 10) {
      setRecipes([...recipes, { id: crypto.randomUUID(), name: '', ingredients: '' }]);
    }
  };

  const handleUpdateRecipe = (id: string, changes: Partial<Recipe>) => {
    setRecipes(recipes.map(r => r.id === id ? { ...r, ...changes } : r));
  };

  const handleDeleteRecipe = (id: string) => {
    if (recipes.length > 1) {
      setRecipes(recipes.filter(r => r.id !== id));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      if (mode === 'items' && text.trim()) {
        if (hasResults) {
          onAdd(text);
          setText('');
        } else {
          onOrganize(text, name);
        }
      }
    }
  };

  const hasContent = mode === 'items'
    ? !!text.trim()
    : recipes.some(r => r.ingredients.trim());

  const showClear = hasContent;
  const showNewList = hasResults || hasContent;
  const showReplace = hasResults;
  const canSubmit = mode === 'items' ? !!text.trim() : recipes.some(r => r.ingredients.trim());
  
  // Icon based on direction
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden transition-shadow focus-within:shadow-[0_8px_40px_rgb(99,102,241,0.12)] focus-within:border-indigo-100">
      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Mode Toggle */}
        <div className="flex items-center justify-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setMode('items')}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              mode === 'items'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-transparent text-slate-500 hover:bg-slate-100'
            }`}
          >
            {t('input.modeItems')}
          </button>
          <button
            type="button"
            onClick={() => setMode('recipe')}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              mode === 'recipe'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-transparent text-slate-500 hover:bg-slate-100'
            }`}
          >
            {t('input.modeRecipe')}
          </button>
        </div>

        {/* List Name Input */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-50 bg-slate-50/30">
          <PenLine className="w-5 h-5 text-indigo-400 flex-shrink-0" strokeWidth={2} />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('input.listNamePlaceholder')}
            className="w-full bg-transparent font-display font-semibold text-lg text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none"
            disabled={isLoading}
            enterKeyHint="done"
          />
        </div>

        {/* Conditional Content: Items Mode or Recipe Mode */}
        {mode === 'items' ? (
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('input.textPlaceholder')}
              className="w-full h-48 px-6 py-5 bg-transparent text-slate-700 placeholder:text-slate-300 focus:outline-none resize-none text-lg leading-relaxed font-light"
              disabled={isLoading}
            />
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4 max-h-[500px] overflow-y-auto">
            {recipes.map((recipe, index) => (
              <RecipeInputCard
                key={recipe.id}
                recipe={recipe}
                index={index}
                onUpdate={handleUpdateRecipe}
                onDelete={handleDeleteRecipe}
                isLoading={isLoading}
                canDelete={recipes.length > 1}
              />
            ))}

            {/* Add Recipe Button */}
            {recipes.length < 10 && (
              <button
                type="button"
                onClick={handleAddRecipe}
                disabled={isLoading}
                className="w-full py-3 border-2 border-dashed border-emerald-200 rounded-2xl text-emerald-600 font-medium hover:bg-emerald-50 hover:border-emerald-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + {t('input.addRecipe')}
              </button>
            )}

            {recipes.length >= 8 && recipes.length < 10 && (
              <p className="text-xs text-amber-600 text-center">
                {t('input.recipeWarning') || `Consider splitting into multiple lists (max 10 recipes)`}
              </p>
            )}
          </div>
        )}
        
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 pb-6 pt-2 gap-4">
          <div className="hidden sm:flex items-center gap-2">
             <span className="text-[10px] uppercase tracking-wider font-bold text-slate-300 bg-slate-50 px-2 py-1 rounded-md">
               {t('input.cmdEnter')}
             </span>
          </div>
          
          <div className="flex flex-col w-full sm:w-auto sm:flex-row gap-3 sm:items-center">
            
            {/* Secondary Actions */}
            {(showClear || showNewList || showReplace) && (
              <div className="flex items-center justify-end flex-wrap gap-2">
                {showClear && (
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={isLoading}
                    className="group flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span className="hidden xs:inline">{t('input.clear')}</span>
                  </button>
                )}

                {showNewList && (
                  <button
                    type="button"
                    onClick={handleNewList}
                    disabled={isLoading}
                    className="group flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                  >
                    <PlusCircle className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span>{t('input.new')}</span>
                  </button>
                )}
                
                {showReplace && (
                  <button
                    type="button"
                    onClick={handleReplace}
                    disabled={!text.trim() || isLoading}
                    className="group flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    <RefreshCw className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span>{t('input.replace')}</span>
                  </button>
                )}
              </div>
            )}
            
            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={!canSubmit || isLoading}
              className={`
                group relative flex items-center justify-center gap-2 px-8 py-3 sm:ms-2 rounded-2xl sm:rounded-full font-semibold text-white shadow-lg transition-all duration-300 w-full sm:w-auto overflow-hidden
                ${!canSubmit || isLoading
                  ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                  : hasResults
                    ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5 active:translate-y-0'
                    : mode === 'recipe'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5 active:translate-y-0'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 active:translate-y-0'
                }
              `}
            >
              <div className="relative z-10 flex items-center gap-2">
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{t('input.processing')}</span>
                  </>
                ) : hasResults ? (
                  <>
                    <ListPlus className="w-5 h-5 transition-transform group-hover:scale-110" />
                    <span>{mode === 'recipe' ? t('input.addRecipes') : t('input.addItems')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 transition-transform group-hover:scale-110" />
                    <span>{mode === 'recipe' ? t('input.organizeRecipes') : t('input.organize')}</span>
                    <ArrowIcon className="w-4 h-4 opacity-70 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default InputArea;