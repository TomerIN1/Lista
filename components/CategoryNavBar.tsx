import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CategoryNode } from '../types';
import { getCategories } from '../services/priceDbService';
import { getCategoryIconSrc, sortCategories } from './ProductCatalogArea';

interface CategoryNavBarProps {
  activeCategory: string | null;
  onSelect: (category: string | null, subcategory?: string | null, subSubcategory?: string | null) => void;
}

const CategoryNavBar: React.FC<CategoryNavBarProps> = ({ activeCategory, onSelect }) => {
  const { isRTL } = useLanguage();
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCategories()
      .then((cats) => setCategories(sortCategories(cats.filter((c) => !/^\d+$/.test(c.name)))))
      .catch(() => setCategories([]));
  }, []);

  const handleMouseEnter = (catName: string) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHoveredCategory(catName);
  };

  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => setHoveredCategory(null), 200);
  };

  const handleDropdownEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  };

  const handleDropdownLeave = () => {
    hoverTimeout.current = setTimeout(() => setHoveredCategory(null), 200);
  };

  const hoveredCatNode = hoveredCategory
    ? categories.find((c) => c.name === hoveredCategory)
    : null;

  if (categories.length === 0) return null;

  return (
    <nav className="bg-white border-b border-slate-100 overflow-visible -mx-3 sm:-mx-4 px-2 sm:px-4 relative z-30">
      <div className="flex items-center gap-1.5 sm:gap-2 py-2 sm:py-3 max-w-7xl mx-auto overflow-x-auto no-scrollbar">
        {/* "All" pill */}
        <button
          type="button"
          onClick={() => { onSelect(null); setHoveredCategory(null); }}
          onMouseEnter={() => setHoveredCategory(null)}
          className={`flex flex-col items-center justify-center gap-1.5 px-5 sm:px-6 py-3 sm:py-4 rounded-2xl text-sm sm:text-base font-semibold whitespace-nowrap transition-all flex-shrink-0 min-w-[90px] sm:min-w-[105px] ${
            activeCategory === null
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:shadow-sm'
          }`}
        >
          <span className="text-3xl sm:text-4xl">🏪</span>
          <span>{isRTL ? 'הכל' : 'All'}</span>
        </button>

        {categories.map((cat) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => { onSelect(cat.name); setHoveredCategory(null); }}
            onMouseEnter={() => handleMouseEnter(cat.name)}
            onMouseLeave={handleMouseLeave}
            className={`flex flex-col items-center justify-center gap-1.5 px-4 sm:px-5 py-3 sm:py-4 rounded-2xl text-sm sm:text-base font-medium whitespace-nowrap transition-all flex-shrink-0 min-w-[90px] sm:min-w-[105px] ${
              activeCategory === cat.name
                ? 'bg-emerald-600 text-white shadow-sm'
                : hoveredCategory === cat.name
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:shadow-sm'
            }`}
          >
            <img
              src={getCategoryIconSrc(cat.name)}
              alt=""
              className={`w-14 h-14 sm:w-16 sm:h-16 object-contain ${activeCategory === cat.name ? 'brightness-0 invert' : ''}`}
              loading="lazy"
            />
            <span className="max-w-[90px] sm:max-w-[105px] truncate leading-tight">{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Subcategory dropdown on hover */}
      {hoveredCatNode && hoveredCatNode.subcategories.length > 0 && (
        <div
          ref={dropdownRef}
          onMouseEnter={handleDropdownEnter}
          onMouseLeave={handleDropdownLeave}
          className="absolute start-0 end-0 top-full bg-white border-b border-slate-200 shadow-lg z-40 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <img
                src={getCategoryIconSrc(hoveredCatNode.name)}
                alt=""
                className="w-8 h-8 object-contain"
              />
              <h3 className="text-base font-bold text-slate-800">{hoveredCatNode.name}</h3>
              <button
                onClick={() => { onSelect(hoveredCatNode.name); setHoveredCategory(null); }}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium ms-auto"
              >
                {isRTL ? 'לכל הקטגוריה ←' : '→ View all'}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-3">
              {hoveredCatNode.subcategories.map((sub) => (
                <div key={sub.name}>
                  <button
                    type="button"
                    onClick={() => { onSelect(hoveredCatNode.name, sub.name); setHoveredCategory(null); }}
                    className="text-start text-sm font-semibold text-emerald-700 hover:text-emerald-800 px-2 py-1 rounded-lg transition-colors w-full"
                  >
                    {sub.name}
                    <span className="text-slate-400 text-xs font-normal ms-1">({sub.count})</span>
                  </button>
                  {sub.sub_subcategories.length > 0 && (
                    <div className="ps-3 mt-0.5 space-y-0.5">
                      {sub.sub_subcategories.map((subsub) => (
                        <button
                          key={subsub.name}
                          type="button"
                          onClick={() => { onSelect(hoveredCatNode.name, sub.name, subsub.name); setHoveredCategory(null); }}
                          className="block text-start text-xs text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded transition-colors w-full truncate"
                        >
                          {subsub.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default CategoryNavBar;
