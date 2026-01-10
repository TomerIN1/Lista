import React, { useState } from 'react';
import { CategoryGroup, Item, Recipe, InputMode, RecipeLabel } from '../types';
import CategoryCard from './CategoryCard';
import RecipeBreakdownModal from './RecipeBreakdownModal';
import { Check, Copy, Trash2, Lock, ChefHat, Pencil, Eye } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ResultCardProps {
  groups: CategoryGroup[];
  setGroups: React.Dispatch<React.SetStateAction<CategoryGroup[]>>;
  title?: string;
  listId: string;
  members: string[];
  onShareClick: () => void;
  onUpdateList: (newGroups: CategoryGroup[]) => void;
  onDeleteList: (id: string) => void;
  onTitleUpdate: (newTitle: string) => void;
  isGuest: boolean;
  onLoginRequest: () => void;
  recipes?: Recipe[];
  inputMode?: InputMode;
}

const ResultCard: React.FC<ResultCardProps> = ({
  groups,
  setGroups,
  title,
  listId,
  members,
  onShareClick,
  onUpdateList,
  onDeleteList,
  onTitleUpdate,
  isGuest,
  onLoginRequest,
  recipes = [],
  inputMode = 'items'
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title || '');
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const { t, tUnit } = useLanguage();

  const handleCopy = () => {
    if (isGuest) {
      onLoginRequest();
      return;
    }

    // Format the list content with translated units
    const header = title ? `${title}\n\n` : '';

    // Add recipe breakdown if in recipe mode
    let recipeSection = '';
    if (inputMode === 'recipe' && recipes.length > 0) {
      recipeSection = `${t('result.recipeMode')} • ${recipes.length} ${t('result.recipesUsed')}\n\n`;
      recipeSection += recipes.map(r => `${r.name}:\n${r.ingredients}`).join('\n\n');
      recipeSection += '\n\n━━━━━━━━━━━━━━━━\n\n';
    }

    const listContent = groups
      .map(g => {
        const items = g.items.map(i => {
          const badges = i.recipeLabels && i.recipeLabels.length > 0
            ? ` [${i.recipeLabels.map(l => l.recipeName.substring(0, 2).toUpperCase()).join(', ')}]`
            : '';
          return `• ${i.name}${badges} (${i.amount} ${tUnit(i.unit)})`;
        }).join('\n');
        return `${g.category}:\n${items}`;
      })
      .join('\n\n');

    // Create share link
    const shareLink = `${window.location.origin}/share/${listId}`;

    // Combine everything with messaging-friendly format
    const text = `${header}${recipeSection}${listContent}\n\n━━━━━━━━━━━━━━━━\n${t('result.createdBy')}\n\n${t('result.openSharedList')}\n${shareLink}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (isGuest) {
      onLoginRequest();
      return;
    }
    onShareClick();
  };

  const handleDeleteCategory = (groupId: string) => {
    const newGroups = groups.filter(g => g.id !== groupId);
    setGroups(newGroups);
    onUpdateList(newGroups);
  };

  const handleRenameCategory = (groupId: string, newName: string) => {
    const newGroups = groups.map(g => {
      if (g.id === groupId) {
        return { ...g, category: newName };
      }
      return g;
    });
    setGroups(newGroups);
    onUpdateList(newGroups);
  };

  const handleAssignCategory = (groupId: string, assignedTo: string | undefined) => {
    const newGroups = groups.map(g => {
      if (g.id === groupId) {
        return { ...g, assignedTo };
      }
      return g;
    });
    setGroups(newGroups);
    onUpdateList(newGroups);
  };

  const handleAddItem = (groupId: string, name: string, recipeLabels?: RecipeLabel[]) => {
    const newItem: Item = {
      id: crypto.randomUUID(),
      name,
      checked: false,
      amount: 1,
      unit: 'pcs',
      recipeLabels
    };

    const newGroups = groups.map(g => {
      if (g.id === groupId) {
        return { ...g, items: [...g.items, newItem] };
      }
      return g;
    });
    setGroups(newGroups);
    onUpdateList(newGroups);
  };

  const handleUpdateItem = (groupId: string, itemId: string, changes: Partial<Item>) => {
    const newGroups = groups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          items: g.items.map(item => item.id === itemId ? { ...item, ...changes } : item)
        };
      }
      return g;
    });
    setGroups(newGroups);
    onUpdateList(newGroups);
  };

  const handleDeleteItem = (groupId: string, itemId: string) => {
    const newGroups = groups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          items: g.items.filter(item => item.id !== itemId)
        };
      }
      return g;
    });
    setGroups(newGroups);
    onUpdateList(newGroups);
  };

  const handleDeleteListClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (window.confirm(t('sidebar.deleteConfirm'))) {
      onDeleteList(listId);
    }
  };

  const handleTitleEdit = () => {
    if (isGuest) {
      onLoginRequest();
      return;
    }
    setEditedTitle(title || '');
    setIsEditingTitle(true);
  };

  const handleTitleSave = () => {
    const newTitle = editedTitle.trim();
    if (newTitle && newTitle !== title) {
      onTitleUpdate(newTitle);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setEditedTitle(title || '');
    }
  };

  if (groups.length === 0) return null;

  return (
    <div className="mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-end justify-between border-b border-slate-200 pb-4 flex-wrap gap-4">
        <div>
           {/* Recipe Mode Indicator */}
           {inputMode === 'recipe' && recipes.length > 0 && (
             <div className="flex items-center gap-2 mb-2">
               <ChefHat className="w-4 h-4 text-emerald-600" />
               <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                 {t('result.recipeMode')} • {recipes.length} {t('result.recipesUsed')}
               </span>
             </div>
           )}
           {title && <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1 block">{t('result.listNameLabel')}</span>}
           {isEditingTitle ? (
             <input
               type="text"
               value={editedTitle}
               onChange={(e) => setEditedTitle(e.target.value)}
               onKeyDown={handleTitleKeyDown}
               onBlur={handleTitleSave}
               autoFocus
               enterKeyHint="done"
               className="text-3xl font-bold text-slate-800 font-display bg-transparent border-b-2 border-indigo-500 focus:outline-none w-full max-w-md"
             />
           ) : (
             <div className="flex items-center gap-2 group">
               <h2 className="text-3xl font-bold text-slate-800 font-display">
                 {title ? title : t('result.defaultTitle')}
               </h2>
               {!isGuest && (
                 <button
                   onClick={handleTitleEdit}
                   className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-slate-100 rounded-lg"
                   title="Rename list"
                 >
                   <Pencil className="w-4 h-4 text-slate-400 hover:text-indigo-600" />
                 </button>
               )}
             </div>
           )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Share Button (Restricted) */}
          <button 
            onClick={handleShare} 
            className={`flex -space-x-2 rtl:space-x-reverse mr-2 rtl:mr-0 rtl:ml-2 hover:scale-105 transition-transform ${isGuest ? 'opacity-70' : ''}`}
            title={isGuest ? t('result.loginToShare') : ''}
          >
             {members.length > 0 && members.slice(0, 3).map((m, i) => (
               <div key={i} className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700" title={m}>
                 {m.charAt(0).toUpperCase()}
               </div>
             ))}
             <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-slate-400 text-xs hover:bg-slate-200 transition-colors">
               {isGuest ? <Lock className="w-3 h-3 text-slate-400" /> : '+'}
             </div>
          </button>

          {/* Copy Button (Restricted) */}
          <button
            type="button"
            onClick={handleCopy}
            className="group flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors px-4 py-2 rounded-xl hover:bg-indigo-50 active:scale-95 duration-200"
            title={isGuest ? t('result.loginToCopy') : ''}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="text-emerald-600">{t('result.copied')}</span>
              </>
            ) : (
              <>
                {isGuest ? <Lock className="w-4 h-4" /> : <Copy className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />}
                <span>{t('result.copyAll')}</span>
              </>
            )}
          </button>

          {/* View Recipes Button (Only in recipe mode) */}
          {inputMode === 'recipe' && recipes.length > 0 && (
            <button
              type="button"
              onClick={() => setIsRecipeModalOpen(true)}
              className="group flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-600 transition-colors px-4 py-2 rounded-xl hover:bg-emerald-50 active:scale-95 duration-200"
            >
              <Eye className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
              <span>{t('result.viewRecipes')}</span>
            </button>
          )}

          {/* Delete Button (Allowed for guests to clear local view, or server for users) */}
          <div className="w-px h-6 bg-slate-200 mx-1" />

          <button
            type="button"
            onClick={handleDeleteListClick}
            className="group flex items-center justify-center p-2 text-slate-400 hover:text-red-600 transition-colors rounded-xl hover:bg-red-50 active:scale-95 duration-200"
            title="Delete List"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {groups.map((group) => (
          <CategoryCard
            key={group.id}
            group={group}
            members={members}
            recipes={recipes}
            onDeleteCategory={() => handleDeleteCategory(group.id)}
            onRenameCategory={(newName) => handleRenameCategory(group.id, newName)}
            onAddItem={(name, recipeLabels) => handleAddItem(group.id, name, recipeLabels)}
            onUpdateItem={(itemId, changes) => handleUpdateItem(group.id, itemId, changes)}
            onDeleteItem={(itemId) => handleDeleteItem(group.id, itemId)}
            onAssignCategory={(assignedTo) => handleAssignCategory(group.id, assignedTo)}
          />
        ))}
      </div>

      {/* Recipe Breakdown Modal */}
      <RecipeBreakdownModal
        isOpen={isRecipeModalOpen}
        onClose={() => setIsRecipeModalOpen(false)}
        recipes={recipes}
      />
    </div>
  );
};

export default ResultCard;