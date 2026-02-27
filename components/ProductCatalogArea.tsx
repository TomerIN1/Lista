import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Loader2, Leaf, ChevronRight, SlidersHorizontal, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { DbProductEnhanced, ShoppingProduct, Unit, CategoryNode } from '../types';
import { getCategories, browseProducts, searchProducts } from '../services/priceDbService';
import { useDebounce } from '../hooks/useDebounce';
import ProductCard from './ProductCard';
import ProductDetailModal from './ProductDetailModal';

// ─── Category icon / colour map ─────────────────────────────────────────────
// normalise spaces so "בשר  ודגים" (double-space) still matches
const CATEGORY_ICONS_RAW: Record<string, { emoji: string; bg: string }> = {
  'שימורים בישול ואפיה':              { emoji: '🥫', bg: 'bg-orange-50' },
  'חלב ביצים וסלטים':                 { emoji: '🥛', bg: 'bg-blue-50' },
  'בשר ודגים':                         { emoji: '🥩', bg: 'bg-red-50' },
  'לחם ומאפים טריים':                  { emoji: '🍞', bg: 'bg-amber-50' },
  'חטיפים ומתוקים':                   { emoji: '🍫', bg: 'bg-pink-50' },
  'משקאות':                            { emoji: '🥤', bg: 'bg-cyan-50' },
  'קפואים':                            { emoji: '❄️', bg: 'bg-indigo-50' },
  'אחזקת הבית ובע"ח':                  { emoji: '🏠', bg: 'bg-slate-50' },
  'מוצרי ניקיון':                      { emoji: '🧹', bg: 'bg-teal-50' },
  'פארם ותינוקות':                     { emoji: '💊', bg: 'bg-emerald-50' },
  'חד-פעמי ומתכלה':                   { emoji: '🍽️', bg: 'bg-yellow-50' },
  'אורגני ובריאות':                    { emoji: '🌿', bg: 'bg-green-50' },
  'קטניות ודגנים':                    { emoji: '🌾', bg: 'bg-amber-50' },
  'פירות וירקות':                     { emoji: '🍎', bg: 'bg-rose-50' },
  'מבצעים וקופוני פירות וירקות':       { emoji: '🎁', bg: 'bg-rose-50' },
};

// Build a normalised lookup (collapse multiple spaces → single space)
const CATEGORY_ICONS: Record<string, { emoji: string; bg: string }> = {};
for (const [k, v] of Object.entries(CATEGORY_ICONS_RAW)) {
  CATEGORY_ICONS[k.replace(/\s+/g, ' ')] = v;
}

function getCategoryIcon(name: string) {
  return CATEGORY_ICONS[name.replace(/\s+/g, ' ')] ?? { emoji: '🛒', bg: 'bg-slate-50' };
}

const ALLERGEN_LIST = ['גלוטן', 'חלב', 'ביצים', 'אגוזים', 'בוטנים', 'סויה', 'דגים', 'שומשום'];

// ─── Props ───────────────────────────────────────────────────────────────────
interface ProductCatalogAreaProps {
  selectedProducts: ShoppingProduct[];
  onSelectProduct: (product: ShoppingProduct) => void;
  onRemoveProduct: (barcode: string) => void;
  onUpdateProduct?: (barcode: string, updates: { amount?: number; unit?: Unit }) => void;
  disabled?: boolean;
  city?: string;
  storeType?: string;
}

type View = 'categories' | 'browse' | 'search';

const PAGE_SIZE = 24;

// ─── Filter dropdown ─────────────────────────────────────────────────────────
interface FilterPanelProps {
  filterVegan: boolean;
  onToggleVegan: () => void;
  filterAllergenFree: string[];
  onToggleAllergen: (a: string) => void;
  onClearFilters: () => void;
  activeCount: number;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filterVegan, onToggleVegan, filterAllergenFree, onToggleAllergen, onClearFilters, activeCount
}) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
          activeCount > 0
            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        {t('productBrowse.filters')}
        {activeCount > 0 && (
          <span className="bg-emerald-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile backdrop */}
          <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setOpen(false)} />

          {/* Dropdown panel — anchored to end-0 so it grows inward in both LTR & RTL */}
          <div className="absolute top-full end-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl w-64 max-h-[70vh] overflow-y-auto">
            <div className="p-3">
              {/* Vegan toggle */}
              <button
                type="button"
                onClick={onToggleVegan}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                  <Leaf className="w-4 h-4 text-green-500" />
                  {t('productBrowse.veganOnly')}
                </span>
                <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                  filterVegan ? 'bg-green-500 border-green-500' : 'border-slate-300'
                }`}>
                  {filterVegan && <Check className="w-3 h-3 text-white" />}
                </span>
              </button>

              {/* Allergen list */}
              <div className="h-px bg-slate-100 my-2" />
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
                {t('productBrowse.allergenFree')}
              </p>
              <div className="space-y-0.5">
                {ALLERGEN_LIST.map((allergen) => (
                  <button
                    key={allergen}
                    type="button"
                    onClick={() => onToggleAllergen(allergen)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm text-slate-700">ללא {allergen}</span>
                    <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                      filterAllergenFree.includes(allergen) ? 'bg-amber-500 border-amber-500' : 'border-slate-300'
                    }`}>
                      {filterAllergenFree.includes(allergen) && <Check className="w-3 h-3 text-white" />}
                    </span>
                  </button>
                ))}
              </div>

              {/* Clear */}
              {activeCount > 0 && (
                <>
                  <div className="h-px bg-slate-100 mt-2 mb-1" />
                  <button
                    type="button"
                    onClick={() => { onClearFilters(); setOpen(false); }}
                    className="w-full py-2 text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    {t('input.clear')}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const ProductCatalogArea: React.FC<ProductCatalogAreaProps> = ({
  selectedProducts,
  onSelectProduct,
  onRemoveProduct,
  disabled = false,
  city,
  storeType,
}) => {
  const { t } = useLanguage();

  // Navigation state
  const [view, setView] = useState<View>('categories');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedSubSubcategory, setSelectedSubSubcategory] = useState<string | null>(null);

  // Products state
  const [products, setProducts] = useState<DbProductEnhanced[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Filters
  const [filterVegan, setFilterVegan] = useState(false);
  const [filterAllergenFree, setFilterAllergenFree] = useState<string[]>([]);

  // Detail modal
  const [detailBarcode, setDetailBarcode] = useState<string | null>(null);
  const [detailImageUrl, setDetailImageUrl] = useState<string | null>(null);

  const fetchId = useRef(0);

  const activeFilterCount = (filterVegan ? 1 : 0) + filterAllergenFree.length;

  // ── Load categories on mount ─────────────────────────────────────────────
  useEffect(() => {
    setIsLoadingCategories(true);
    getCategories()
      .then((cats) => {
        setCategories(cats.filter((c) => !/^\d+$/.test(c.name)));
      })
      .catch(() => setCategories([]))
      .finally(() => setIsLoadingCategories(false));
  }, []);

  // ── Fetch products ────────────────────────────────────────────────────────
  const fetchProducts = useCallback(
    async (page: number, replace: boolean) => {
      const id = ++fetchId.current;
      setIsLoadingProducts(true);

      try {
        let result: { products: DbProductEnhanced[]; total: number };

        if (debouncedQuery.trim().length >= 2) {
          const sr = await searchProducts(
            debouncedQuery.trim(),
            PAGE_SIZE,
            (page - 1) * PAGE_SIZE,
            city,
            storeType,
            filterVegan || undefined,
            filterAllergenFree.length > 0 ? filterAllergenFree : undefined
          );
          result = { products: sr.products as DbProductEnhanced[], total: sr.total };
        } else {
          const br = await browseProducts({
            category: selectedCategory || undefined,
            subcategory: selectedSubcategory || undefined,
            sub_subcategory: selectedSubSubcategory || undefined,
            is_vegan: filterVegan || undefined,
            allergen_free: filterAllergenFree.length > 0 ? filterAllergenFree : undefined,
            city,
            store_type: storeType,
            limit: PAGE_SIZE,
            page,
          });
          result = { products: br.products, total: br.total };
        }

        if (id !== fetchId.current) return;

        setProducts((prev) => (replace ? result.products : [...prev, ...result.products]));
        setTotalProducts(result.total);
        setCurrentPage(page);
      } catch {
        if (id === fetchId.current) {
          if (replace) setProducts([]);
          setTotalProducts(0);
        }
      } finally {
        if (id === fetchId.current) setIsLoadingProducts(false);
      }
    },
    [debouncedQuery, selectedCategory, selectedSubcategory, selectedSubSubcategory, filterVegan, filterAllergenFree, city, storeType]
  );

  // Re-fetch when browse params change
  useEffect(() => {
    if (view === 'browse') {
      fetchProducts(1, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedCategory, selectedSubcategory, selectedSubSubcategory, filterVegan, filterAllergenFree]);

  // React to debounced search query
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      setView('search');
      fetchProducts(1, true);
    } else if (debouncedQuery.trim().length === 0 && view === 'search') {
      if (selectedCategory) {
        setView('browse');
      } else {
        setView('categories');
        setProducts([]);
        setTotalProducts(0);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCategoryClick = (catName: string) => {
    setSelectedCategory(catName);
    setSelectedSubcategory(null);
    setSelectedSubSubcategory(null);
    setView('browse');
  };

  const handleSubcategoryClick = (sub: string) => {
    setSelectedSubcategory(sub);
    setSelectedSubSubcategory(null);
  };

  const handleSubSubcategoryClick = (subsub: string) => {
    setSelectedSubSubcategory(subsub);
  };

  const handleResetToCategories = () => {
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setSelectedSubSubcategory(null);
    setSearchQuery('');
    setView('categories');
    setProducts([]);
    setTotalProducts(0);
  };

  const handleAddProduct = (product: DbProductEnhanced) => {
    if (selectedProducts.some((p) => p.barcode === product.barcode)) return;
    onSelectProduct({ ...product, amount: 1, unit: 'pcs' });
  };

  const handleLoadMore = () => {
    fetchProducts(currentPage + 1, false);
  };

  // Derived
  const activeCategoryNode = selectedCategory
    ? categories.find((c) => c.name === selectedCategory)
    : null;
  const activeSubcategoryNode = activeCategoryNode && selectedSubcategory
    ? activeCategoryNode.subcategories.find((s) => s.name === selectedSubcategory)
    : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">
      {/* ── Search bar + filter button ────────────────────── */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-100 bg-emerald-50/40">
        {isLoadingProducts && view === 'search' ? (
          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 animate-spin flex-shrink-0" />
        ) : (
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 flex-shrink-0" />
        )}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('productBrowse.searchPlaceholder')}
          disabled={disabled}
          className="flex-1 min-w-0 bg-transparent text-slate-700 placeholder:text-slate-400 focus:outline-none text-sm sm:text-base font-medium"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="p-0.5 text-slate-400 hover:text-slate-600 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Filter dropdown — lives at the end of the search bar */}
        <FilterPanel
          filterVegan={filterVegan}
          onToggleVegan={() => setFilterVegan((v) => !v)}
          filterAllergenFree={filterAllergenFree}
          onToggleAllergen={(a) =>
            setFilterAllergenFree((prev) =>
              prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
            )
          }
          onClearFilters={() => { setFilterVegan(false); setFilterAllergenFree([]); }}
          activeCount={activeFilterCount}
        />
      </div>

      {/* Active filter chips (summary row, only when filters active) */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-slate-100 overflow-x-auto scrollbar-none">
          {filterVegan && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold border border-green-200">
              <Leaf className="w-3 h-3" />
              {t('productBrowse.veganOnly')}
              <button onClick={() => setFilterVegan(false)} className="ms-0.5 hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filterAllergenFree.map((a) => (
            <span key={a} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200 whitespace-nowrap flex-shrink-0">
              ללא {a}
              <button
                onClick={() => setFilterAllergenFree((prev) => prev.filter((x) => x !== a))}
                className="ms-0.5 hover:opacity-70"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {filterAllergenFree.length > 0 && (
            <p className="text-[10px] text-amber-600 whitespace-nowrap flex-shrink-0">
              * {t('productBrowse.allergenDisclaimer')}
            </p>
          )}
        </div>
      )}

      {/* ── Breadcrumb + subcategory chips ────────────────── */}
      {selectedCategory && (
        <div className="px-4 pt-2 pb-1 space-y-2">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-xs text-slate-500 flex-wrap">
            <button
              type="button"
              onClick={handleResetToCategories}
              className="hover:text-emerald-600 transition-colors font-medium"
            >
              {t('productBrowse.backToCategories')}
            </button>
            <ChevronRight className="w-3 h-3 flex-shrink-0 rtl:rotate-180" />
            <button
              type="button"
              onClick={() => { setSelectedSubcategory(null); setSelectedSubSubcategory(null); }}
              className={`hover:text-emerald-600 transition-colors ${!selectedSubcategory ? 'font-semibold text-slate-800' : ''}`}
            >
              {selectedCategory}
            </button>
            {selectedSubcategory && (
              <>
                <ChevronRight className="w-3 h-3 flex-shrink-0 rtl:rotate-180" />
                <button
                  type="button"
                  onClick={() => setSelectedSubSubcategory(null)}
                  className={`hover:text-emerald-600 transition-colors ${!selectedSubSubcategory ? 'font-semibold text-slate-800' : ''}`}
                >
                  {selectedSubcategory}
                </button>
              </>
            )}
            {selectedSubSubcategory && (
              <>
                <ChevronRight className="w-3 h-3 flex-shrink-0 rtl:rotate-180" />
                <span className="font-semibold text-slate-800">{selectedSubSubcategory}</span>
              </>
            )}
          </div>

          {/* Subcategory chips */}
          {activeCategoryNode && !selectedSubcategory && activeCategoryNode.subcategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {activeCategoryNode.subcategories.map((sub) => (
                <button
                  key={sub.name}
                  type="button"
                  onClick={() => handleSubcategoryClick(sub.name)}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700 transition-all whitespace-nowrap flex-shrink-0"
                >
                  {sub.name}
                  <span className="ms-1 text-slate-400">({sub.count})</span>
                </button>
              ))}
            </div>
          )}

          {/* Sub-subcategory chips */}
          {activeSubcategoryNode && !selectedSubSubcategory && activeSubcategoryNode.sub_subcategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {activeSubcategoryNode.sub_subcategories.map((subsub) => (
                <button
                  key={subsub.name}
                  type="button"
                  onClick={() => handleSubSubcategoryClick(subsub.name)}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-all whitespace-nowrap flex-shrink-0"
                >
                  {subsub.name}
                  <span className="ms-1 text-emerald-400">({subsub.count})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Main content ──────────────────────────────────── */}
      <div className="min-h-[300px] px-3 sm:px-4 py-3">
        {/* Category grid */}
        {view === 'categories' && (
          isLoadingCategories ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-7 h-7 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : categories.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              {t('productBrowse.noProducts')}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {categories.map((cat) => {
                const icon = getCategoryIcon(cat.name);
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => handleCategoryClick(cat.name)}
                    className={`${icon.bg} rounded-xl p-3 flex flex-col items-center gap-1.5 border border-white hover:shadow-md hover:-translate-y-0.5 transition-all text-center`}
                  >
                    <span className="text-2xl leading-none">{icon.emoji}</span>
                    <span className="text-[11px] font-semibold text-slate-700 leading-tight line-clamp-2">{cat.name}</span>
                    <span className="text-[10px] text-slate-400">{cat.count}</span>
                  </button>
                );
              })}
            </div>
          )
        )}

        {/* Product grid */}
        {(view === 'browse' || view === 'search') && (
          isLoadingProducts && products.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-7 h-7 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              {t('productBrowse.noProducts')}
            </div>
          ) : (
            <>
              {view === 'search' && totalProducts > 0 && (
                <p className="text-xs text-slate-400 mb-2">{totalProducts} {t('productBrowse.results')}</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {products.map((product) => (
                  <ProductCard
                    key={product.barcode}
                    product={product}
                    isSelected={selectedProducts.some((p) => p.barcode === product.barcode)}
                    onAdd={() => handleAddProduct(product)}
                    onClick={() => { setDetailBarcode(product.barcode); setDetailImageUrl(product.image_url ?? null); }}
                  />
                ))}
              </div>

              {products.length < totalProducts && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isLoadingProducts}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700 transition-all disabled:opacity-50"
                  >
                    {isLoadingProducts && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t('productBrowse.loadMore')}
                  </button>
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* Detail modal */}
      {detailBarcode && (
        <ProductDetailModal
          barcode={detailBarcode}
          fallbackImageUrl={detailImageUrl}
          onClose={() => setDetailBarcode(null)}
          onAdd={(product) => {
            handleAddProduct(product);
            setDetailBarcode(null);
          }}
          isAdded={selectedProducts.some((p) => p.barcode === detailBarcode)}
        />
      )}
    </div>
  );
};

export default ProductCatalogArea;
