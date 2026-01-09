import React, { useState, useEffect } from 'react';
import { ListDocument, UserProfile, SavedRecipe } from '../types';
import { Plus, List, Trash2, Layout, Lock, ChefHat, ChevronDown, ChevronRight, ChevronLeft, Eye, PenLine } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { subscribeToSavedRecipes, deleteSavedRecipe } from '../services/firestoreService';
import RecipeBreakdownModal from './RecipeBreakdownModal';

interface SidebarProps {
  lists: ListDocument[];
  activeListId: string | null;
  onSelect: (list: ListDocument) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  user: UserProfile | null;
  onLogin: () => void;
  onLoadRecipe: (recipe: SavedRecipe) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  lists,
  activeListId,
  onSelect,
  onCreate,
  onDelete,
  isOpen,
  setIsOpen,
  user,
  onLogin,
  onLoadRecipe
}) => {
  const { t, isRTL } = useLanguage();
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [recipesExpanded, setRecipesExpanded] = useState(true);
  const [viewingRecipe, setViewingRecipe] = useState<SavedRecipe | null>(null);

  const handleOverlayClick = () => setIsOpen(false);

  // Subscribe to saved recipes
  useEffect(() => {
    if (!user) {
      setSavedRecipes([]);
      return;
    }

    const unsubscribe = subscribeToSavedRecipes(user.uid, (recipes) => {
      setSavedRecipes(recipes);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDeleteClick = (e: React.MouseEvent, listId: string) => {
    e.stopPropagation(); // Stop bubbling to list select
    e.preventDefault();  // Stop any other default actions

    if (window.confirm(t('sidebar.deleteConfirm'))) {
      onDelete(listId);
    }
  };

  const handleDeleteRecipe = async (e: React.MouseEvent, recipeId: string) => {
    e.stopPropagation();
    e.preventDefault();

    if (!user) return;

    if (window.confirm(t('sidebar.deleteRecipeConfirm'))) {
      try {
        await deleteSavedRecipe(user.uid, recipeId);
      } catch (error) {
        console.error('Error deleting recipe:', error);
      }
    }
  };

  const handleUseRecipe = (recipe: SavedRecipe) => {
    onLoadRecipe(recipe);
    setIsOpen(false);
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={handleOverlayClick}
      />

      <aside 
        className={`
          fixed lg:static inset-y-0 start-0 z-50 w-72 bg-white border-e border-slate-200 transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0')}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center px-6 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layout className="w-5 h-5 text-indigo-600" />
              <span className="font-display font-bold text-lg text-slate-800">{t('sidebar.myLists')}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {!user ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-2 space-y-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">{t('sidebar.loginTitle')}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{t('sidebar.loginDesc')}</p>
                </div>
                <button
                  onClick={onLogin}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors w-full"
                >
                  {t('header.login')}
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    onCreate();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-white transition-colors">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">{t('sidebar.createNew')}</span>
                </button>

                {lists.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-400">
                    {t('sidebar.noLists')}
                  </div>
                )}

                {lists.map(list => (
                  <div
                    key={list.id}
                    className={`
                      group relative flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer
                      ${activeListId === list.id
                        ? 'bg-indigo-50 text-indigo-900'
                        : 'text-slate-600 hover:bg-slate-50'
                      }
                    `}
                    onClick={() => {
                      onSelect(list);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${activeListId === list.id ? 'bg-white text-indigo-600 shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                        <List className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold truncate">{list.title || 'Untitled List'}</span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {list.groups.length} {t('sidebar.categories')} • {list.memberEmails.length > 1 ? t('sidebar.shared') : t('sidebar.private')}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(e, list.id)}
                      className="lg:opacity-0 lg:group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all focus:opacity-100 relative z-20"
                      aria-label="Delete List"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Saved Recipes Section */}
                {savedRecipes.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => setRecipesExpanded(!recipesExpanded)}
                      className="w-full flex items-center justify-between px-2 py-2 text-slate-700 hover:text-slate-900 transition-colors"
                    >
                      {isRTL ? (
                        <>
                          <div className="flex items-center gap-2">
                            <ChefHat className="w-4 h-4 text-emerald-600" />
                            <span className="font-display font-bold text-sm">{t('sidebar.savedRecipes')}</span>
                            <span className="text-xs text-slate-400">({savedRecipes.length})</span>
                          </div>
                          {recipesExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronLeft className="w-4 h-4 text-slate-400" />
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <ChefHat className="w-4 h-4 text-emerald-600" />
                            <span className="font-display font-bold text-sm">{t('sidebar.savedRecipes')}</span>
                            <span className="text-xs text-slate-400">({savedRecipes.length})</span>
                          </div>
                          {recipesExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </>
                      )}
                    </button>

                    {recipesExpanded && (
                      <div className="mt-2 space-y-1">
                        {savedRecipes.map(recipe => (
                          <div
                            key={recipe.id}
                            className="group relative flex flex-col px-3 py-2 rounded-xl text-slate-600 hover:bg-emerald-50 transition-all"
                          >
                            {/* Recipe Name */}
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-600">
                                <ChefHat className="w-3 h-3" />
                              </div>
                              <span className="text-sm font-semibold truncate flex-1">{recipe.name}</span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteRecipe(e, recipe.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-white rounded transition-all"
                                aria-label="Delete Recipe"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => setViewingRecipe(recipe)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                {t('sidebar.viewRecipe')}
                              </button>
                              <button
                                onClick={() => handleUseRecipe(recipe)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg transition-colors"
                              >
                                <PenLine className="w-3 h-3" />
                                {t('sidebar.useRecipe')}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
             <div className="text-xs text-slate-400 text-center font-medium">
               Lista v2.0
             </div>
          </div>
        </div>
      </aside>

      {/* Recipe View Modal */}
      {viewingRecipe && (
        <RecipeBreakdownModal
          isOpen={!!viewingRecipe}
          onClose={() => setViewingRecipe(null)}
          recipes={[viewingRecipe]}
        />
      )}
    </>
  );
};

export default Sidebar;