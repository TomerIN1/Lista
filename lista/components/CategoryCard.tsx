import React, { useState } from 'react';
import { CategoryGroup, Item } from '../types';
import CategoryItem from './CategoryItem';
import { Trash2, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface CategoryCardProps {
  group: CategoryGroup;
  onDeleteCategory: () => void;
  onAddItem: (name: string) => void;
  onUpdateItem: (itemId: string, changes: Partial<Item>) => void;
  onDeleteItem: (itemId: string) => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ 
  group, 
  onDeleteCategory, 
  onAddItem,
  onUpdateItem,
  onDeleteItem 
}) => {
  const [newItemName, setNewItemName] = useState('');
  const { t } = useLanguage();

  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItemName.trim()) {
      onAddItem(newItemName.trim());
      setNewItemName('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgb(0,0,0,0.06)] hover:border-indigo-100 transition-all duration-300 overflow-hidden group/card">
      {/* Card Header */}
      <div className="p-5 flex items-center justify-between bg-gradient-to-b from-slate-50/50 to-transparent">
        <div className="flex items-center gap-4">
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
          <div>
            <h3 className="font-bold text-lg text-slate-800 leading-tight font-display">{group.category}</h3>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>
        
        <button
          onClick={onDeleteCategory}
          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors opacity-0 group-hover/card:opacity-100 focus:opacity-100"
          title="Delete Category"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Items List */}
      <div className="flex-1 px-2 pb-2">
        <div className="space-y-0.5">
          {group.items.map((item) => (
            <CategoryItem
              key={item.id}
              item={item}
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