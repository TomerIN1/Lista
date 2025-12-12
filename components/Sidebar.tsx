import React from 'react';
import { ListDocument, UserProfile } from '../types';
import { Plus, List, Trash2, Layout, Lock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

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
  onLogin
}) => {
  const { t, isRTL } = useLanguage();
  const handleOverlayClick = () => setIsOpen(false);

  const handleDeleteClick = (e: React.MouseEvent, listId: string) => {
    e.stopPropagation(); // Stop bubbling to list select
    e.preventDefault();  // Stop any other default actions
    
    if (window.confirm(t('sidebar.deleteConfirm'))) {
      onDelete(listId);
    }
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
    </>
  );
};

export default Sidebar;