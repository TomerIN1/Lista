import React, { useState } from 'react';
import { ArrowRight, Sparkles, Trash2, PlusCircle, PenLine, ListPlus, RefreshCw, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface InputAreaProps {
  onOrganize: (text: string, name: string) => void;
  onAdd: (text: string) => void;
  onReset: () => void;
  isLoading: boolean;
  hasResults: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({ onOrganize, onAdd, onReset, isLoading, hasResults }) => {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const { t, isRTL } = useLanguage();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    if (hasResults) {
      onAdd(text);
      setText('');
    } else {
      onOrganize(text, name);
    }
  };

  const handleReplace = () => {
    if (text.trim()) {
      onOrganize(text, name);
    }
  };

  const handleClear = () => {
    setText('');
    setName('');
  };

  const handleNewList = () => {
    setText('');
    setName('');
    onReset();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      if (text.trim()) {
        if (hasResults) {
          onAdd(text);
          setText('');
        } else {
          onOrganize(text, name);
        }
      }
    }
  };

  const showClear = !!text;
  const showNewList = hasResults || !!text;
  const showReplace = hasResults;
  
  // Icon based on direction
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden transition-shadow focus-within:shadow-[0_8px_40px_rgb(99,102,241,0.12)] focus-within:border-indigo-100">
      <form onSubmit={handleSubmit} className="flex flex-col">
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
          />
        </div>

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
              disabled={!text.trim() || isLoading}
              className={`
                group relative flex items-center justify-center gap-2 px-8 py-3 sm:ms-2 rounded-2xl sm:rounded-full font-semibold text-white shadow-lg transition-all duration-300 w-full sm:w-auto overflow-hidden
                ${!text.trim() || isLoading 
                  ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed' 
                  : hasResults 
                    ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5 active:translate-y-0'
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
                    <span>{t('input.addItems')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 transition-transform group-hover:scale-110" />
                    <span>{t('input.organize')}</span>
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