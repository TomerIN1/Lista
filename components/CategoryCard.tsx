import React, { useState } from 'react';
import { CategoryGroup, Item, Recipe } from '../types';
import CategoryItem from './CategoryItem';
import { Trash2, Plus, UserCheck, Pencil } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface CategoryCardProps {
  group: CategoryGroup;
  members: string[];
  recipes?: Recipe[];
  onDeleteCategory: () => void;
  onAddItem: (name: string) => void;
  onUpdateItem: (itemId: string, changes: Partial<Item>) => void;
  onDeleteItem: (itemId: string) => void;
  onAssignCategory: (assignedTo: string | undefined) => void;
  onRenameCategory: (newName: string) => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  group,
  members,
  recipes = [],
  onDeleteCategory,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onAssignCategory,
  onRenameCategory
}) => {
  const [newItemName, setNewItemName] = useState('');
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(group.category);
  const { t } = useLanguage();

  // Build a map of existing recipe colors from all items in this group
  const getRecipeColors = (): Map<string, string> => {
    const colorMap = new Map<string, string>();
    group.items.forEach(item => {
      if (item.recipeLabels) {
        item.recipeLabels.forEach(label => {
          if (!colorMap.has(label.recipeId)) {
            colorMap.set(label.recipeId, label.color);
          }
        });
      }
    });
    return colorMap;
  };

  const recipeColorMap = getRecipeColors();

  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItemName.trim()) {
      onAddItem(newItemName.trim());
      setNewItemName('');
    }
  };

  const handleNameEdit = () => {
    setEditedName(group.category);
    setIsEditingName(true);
  };

  const handleNameSave = () => {
    const newName = editedName.trim();
    if (newName && newName !== group.category) {
      onRenameCategory(newName);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
      setEditedName(group.category);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgb(0,0,0,0.06)] hover:border-indigo-100 transition-all duration-300 overflow-hidden group/card">
      {/* Card Header */}
      <div className="p-5 flex items-center justify-between bg-gradient-to-b from-slate-50/50 to-transparent">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="relative w-14 h-14 flex-shrink-0 bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex items-center justify-center group-hover/card:scale-105 transition-transform duration-500">
             {group.imageUrl ? (
               <img
                 src={group.imageUrl}
                 alt={group.category}
                 className="w-full h-full object-cover animate-in fade-in duration-700"
               />
             ) : (
               <span className="text-indigo-600 font-display font-bold text-2xl leading-none opacity-80">
                {group.category.charAt(0).toUpperCase()}
               </span>
             )}
          </div>
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={handleNameSave}
                autoFocus
                enterKeyHint="done"
                className="font-bold text-lg text-slate-800 leading-tight font-display bg-transparent border-b-2 border-indigo-500 focus:outline-none w-full"
              />
            ) : (
              <div className="flex items-center gap-2 group/name">
                <h3 className="font-bold text-lg text-slate-800 leading-tight font-display truncate">
                  {group.category}
                </h3>
                <button
                  onClick={handleNameEdit}
                  className="opacity-0 group-hover/name:opacity-100 transition-opacity p-1 hover:bg-slate-100 rounded-lg"
                  title="Rename category"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-600" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
              </span>
              {group.assignedTo && (
                <>
                  <span className="text-slate-300">•</span>
                  <div className="flex items-center gap-1 text-xs text-indigo-600">
                    <UserCheck className="w-3 h-3" />
                    <span className="font-medium truncate max-w-[120px]">{group.assignedTo}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Assignment Button */}
          {members.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowAssignMenu(!showAssignMenu)}
                className={`p-2 rounded-xl transition-colors ${
                  group.assignedTo
                    ? 'text-indigo-600 bg-indigo-50'
                    : 'text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover/card:opacity-100 focus:opacity-100'
                }`}
                title="Assign to member"
              >
                <UserCheck className="w-4 h-4" />
              </button>

              {showAssignMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowAssignMenu(false)}
                  />
                  <div className="absolute right-0 rtl:right-auto rtl:left-0 top-full mt-2 z-20 bg-white rounded-xl shadow-lg border border-slate-100 py-1 min-w-[200px]">
                    <button
                      onClick={() => {
                        onAssignCategory(undefined);
                        setShowAssignMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Unassign
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    {members.map((member) => (
                      <button
                        key={member}
                        onClick={() => {
                          onAssignCategory(member);
                          setShowAssignMenu(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                          group.assignedTo === member
                            ? 'bg-indigo-50 text-indigo-700 font-medium'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                          {member.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{member}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={onDeleteCategory}
            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors opacity-0 group-hover/card:opacity-100 focus:opacity-100"
            title="Delete Category"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 px-2 pb-2">
        <div className="space-y-0.5">
          {group.items.map((item) => (
            <CategoryItem
              key={item.id}
              item={item}
              recipes={recipes}
              recipeColorMap={recipeColorMap}
              onToggle={() => onUpdateItem(item.id, { checked: !item.checked })}
              onUpdate={(changes) => onUpdateItem(item.id, changes)}
              onDelete={() => onDeleteItem(item.id)}
            />
          ))}
          {group.items.length === 0 && (
            <div className="py-8 text-center text-slate-400 text-sm font-light">
              {t('result.emptyCategory')}
            </div>
          )}
        </div>
      </div>

      {/* Add Item Footer */}
      <div className="p-3 mt-auto">
        <form onSubmit={handleAddItemSubmit} className="relative flex items-center group/input">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder={t('result.addItemPlaceholder')}
            className="w-full h-10 ps-4 pe-10 text-sm rounded-xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!newItemName.trim()}
            className="absolute right-1 rtl:right-auto rtl:left-1 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-0 transition-all"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default CategoryCard;