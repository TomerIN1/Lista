import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CategoryNode } from '../types';
import { getCategories } from '../services/priceDbService';
import { getCategoryIconSrc, sortCategories, sortSubItems } from './ProductCatalogArea';

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

  // Colored SVG icon via CSS mask — lets us tint single-color line icons to any Paper token color
  const iconStyle = (src: string, color: string, size = 56): React.CSSProperties => ({
    width: size,
    height: size,
    backgroundColor: color,
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    transition: 'background-color 150ms',
  });

  return (
    <nav
      className="overflow-visible -mx-3 sm:-mx-4 px-2 sm:px-4 relative z-30 border-b"
      style={{ background: 'var(--paper-bg)', borderColor: 'var(--line)' }}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 pt-2 sm:pt-3 pb-1 sm:pb-1.5 max-w-7xl mx-auto overflow-x-auto slim-scrollbar">
        {/* "All" pill */}
        <button
          type="button"
          onClick={() => { onSelect(null); setHoveredCategory(null); }}
          onMouseEnter={() => setHoveredCategory(null)}
          className="flex flex-col items-center justify-start gap-1.5 px-4 sm:px-5 py-3 sm:py-4 rounded-[18px] text-sm sm:text-[15px] font-semibold transition-all flex-shrink-0 w-[100px] sm:w-[120px] min-h-[90px] sm:min-h-[104px]"
          style={activeCategory === null
            ? { background: 'var(--paper-surface)', color: 'var(--ink)', border: '2px solid var(--ink-muted)', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }
            : { background: 'var(--paper-surface)', color: 'var(--ink-muted)', border: '1px solid var(--line)' }}
        >
          <div
            className="w-10 h-10 sm:w-11 sm:h-11"
            style={iconStyle(
              getCategoryIconSrc('הכל'),
              activeCategory === null ? 'var(--ink)' : 'var(--ink-muted)',
            )}
            aria-hidden
          />
          <span className="w-full text-center leading-[1.15]">{isRTL ? 'הכל' : 'All'}</span>
        </button>

        {categories.map((cat) => {
          const isActive = activeCategory === cat.name;
          const isHovered = hoveredCategory === cat.name;
          const pillStyle = isActive
            ? { background: 'var(--paper-surface)', color: 'var(--ink)', border: '2px solid var(--ink-muted)', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }
            : isHovered
              ? { background: 'var(--paper-surface-alt)', color: 'var(--ink)', border: '1px solid var(--line)' }
              : { background: 'var(--paper-surface)', color: 'var(--ink-muted)', border: '1px solid var(--line)' };
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => { onSelect(cat.name); setHoveredCategory(null); }}
              onMouseEnter={() => handleMouseEnter(cat.name)}
              onMouseLeave={handleMouseLeave}
              className="flex flex-col items-center justify-center gap-1.5 px-4 sm:px-5 py-3 sm:py-4 rounded-[18px] text-sm sm:text-base font-medium whitespace-nowrap transition-all flex-shrink-0 min-w-[90px] sm:min-w-[105px]"
              style={pillStyle}
            >
              <div
                className="w-10 h-10 sm:w-11 sm:h-11"
                style={iconStyle(
                  getCategoryIconSrc(cat.name),
                  isActive ? 'var(--ink)' : isHovered ? 'var(--accent)' : 'var(--ink-muted)',
                )}
                aria-hidden
              />
              <span className="w-full text-center leading-[1.15] line-clamp-2 break-words" style={{ wordBreak: 'break-word' }}>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Subcategory dropdown on hover */}
      {hoveredCatNode && hoveredCatNode.subcategories.length > 0 && (
        <div
          ref={dropdownRef}
          onMouseEnter={handleDropdownEnter}
          onMouseLeave={handleDropdownLeave}
          className="absolute start-0 end-0 top-full shadow-lg z-40 animate-in fade-in slide-in-from-top-1 duration-150 border-b"
          style={{ background: 'var(--paper-surface)', borderColor: 'var(--line)' }}
        >
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-8 h-8"
                style={iconStyle(getCategoryIconSrc(hoveredCatNode.name), 'var(--ink)', 32)}
                aria-hidden
              />
              <h3 className="text-base font-bold" style={{ color: 'var(--ink)' }}>{hoveredCatNode.name}</h3>
              <button
                onClick={() => { onSelect(hoveredCatNode.name); setHoveredCategory(null); }}
                className="text-xs font-medium ms-auto"
                style={{ color: 'var(--accent)' }}
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
                    className="text-start text-sm font-semibold px-2 py-1 rounded-lg transition-colors w-full"
                    style={{ color: 'var(--ink)' }}
                  >
                    {sub.name}
                    <span className="text-xs font-normal ms-1" style={{ color: 'var(--ink-soft)' }}>({sub.count})</span>
                  </button>
                  {sub.sub_subcategories.length > 0 && (
                    <div className="ps-3 mt-0.5 space-y-0.5">
                      {sortSubItems(sub.sub_subcategories, sub.name).map((subsub) => (
                        <button
                          key={subsub.name}
                          type="button"
                          onClick={() => { onSelect(hoveredCatNode.name, sub.name, subsub.name); setHoveredCategory(null); }}
                          className="block text-start text-xs px-2 py-1 rounded transition-colors w-full truncate hover:bg-[var(--paper-surface-alt)]"
                          style={{ color: 'var(--ink-muted)' }}
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
