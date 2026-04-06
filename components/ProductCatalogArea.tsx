import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, X, Loader2, Leaf, ChevronRight, SlidersHorizontal, Check, ArrowUpDown, Tag, DollarSign } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { DbProductEnhanced, ShoppingProduct, Unit, CategoryNode, ProductSortOption } from '../types';
import { getCategories, browseProducts, searchProducts, getProductGroups, ProductGroupSummary } from '../services/priceDbService';
import { useDebounce } from '../hooks/useDebounce';
import ProductCard from './ProductCard';
import ProductDetailModal from './ProductDetailModal';
import GroupDetailModal from './GroupDetailModal';
import { defaultCartUnit } from '../utils/priceFormat';

// ─── Category icon helpers ──────────────────────────────────────────────────

/** Resolve SVG icon path for a category (file names match Hebrew category names) */
export function getCategoryIconSrc(name: string): string {
  const normalised = name.replace(/\s+/g, ' ');
  return `/category-icons/${encodeURIComponent(normalised)}.svg`;
}

// Preferred display order: classic grocery first, lifestyle/other last.
// Categories not in this list appear after the listed ones, sorted alphabetically.
const CATEGORY_ORDER: string[] = [
  'פירות וירקות',
  'מוצרי חלב וביצים',
  'בשר עוף דגים ומעדניה',
  'לחם מאפים ודגני בוקר',
  'מזווה בישול ואפייה',
  'שימורים רטבים וממרחים',
  'קפואים',
  'משקאות',
  'חטיפים מתוקים ופיצוחים',
  'בריאות טבע וללא גלוטן',
  'יין בירה ואלכוהול',
  'ניקיון כביסה וחד פעמי',
  'בית מטבח ואירוח',
  'פארם טיפוח אישי ובריאות',
  'תינוקות',
  'חיות מחמד',
  'פנאי נסיעות ועונתי',
  'פרחים גינה וחוץ',
  'חשמל אלקטרוניקה וסוללות',
  'טבק ועישון',
  'טקסטיל והלבשה בסיסית',
  'מבצעים',
  'אחר ולא מסווג',
];

// Custom sub-subcategory ordering within specific subcategories
const SUBCATEGORY_ORDER: Record<string, string[]> = {
  'ירקות טריים': [
    'עגבניות',
    'מלפפונים',
    'פלפלים',
    'בצלים ושום',
    'פטריות',
    'ירקות עלים',
    'ירקות שורש',
  ],
};

export function sortSubItems<T extends { name: string }>(items: T[], parentName: string): T[] {
  const order = SUBCATEGORY_ORDER[parentName.replace(/\s+/g, ' ')];
  if (!order) return items;
  const orderMap = new Map(order.map((name, i) => [name.replace(/\s+/g, ' '), i]));
  return [...items].sort((a, b) => {
    const aIdx = orderMap.get(a.name.replace(/\s+/g, ' ')) ?? 999;
    const bIdx = orderMap.get(b.name.replace(/\s+/g, ' ')) ?? 999;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.name.localeCompare(b.name, 'he');
  });
}

export function sortCategories(cats: CategoryNode[]): CategoryNode[] {
  const orderMap = new Map(CATEGORY_ORDER.map((name, i) => [name.replace(/\s+/g, ' '), i]));
  return [...cats].sort((a, b) => {
    const aN = a.name.replace(/\s+/g, ' ');
    const bN = b.name.replace(/\s+/g, ' ');
    const aIdx = orderMap.get(aN) ?? 999;
    const bIdx = orderMap.get(bN) ?? 999;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return aN.localeCompare(bN, 'he');
  });
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
  selectedChains?: string[];
  externalSearchQuery?: string;
  externalCategory?: string | null;
  externalSubcategory?: string | null;
  externalSubSubcategory?: string | null;
  onCategoryChange?: (cat: string | null) => void;
}

type View = 'categories' | 'browse' | 'search';

const PAGE_SIZE = 24;

// ─── Filter dropdown ─────────────────────────────────────────────────────────
interface FilterPanelProps {
  filterVegan: boolean;
  onToggleVegan: () => void;
  filterAllergenFree: string[];
  onToggleAllergen: (a: string) => void;
  filterOnSale: boolean;
  onToggleOnSale: () => void;
  priceMin: string;
  priceMax: string;
  onPriceMinChange: (v: string) => void;
  onPriceMaxChange: (v: string) => void;
  onClearFilters: () => void;
  activeCount: number;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filterVegan, onToggleVegan, filterAllergenFree, onToggleAllergen,
  filterOnSale, onToggleOnSale, priceMin, priceMax, onPriceMinChange, onPriceMaxChange,
  onClearFilters, activeCount
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

              {/* On Sale toggle */}
              <button
                type="button"
                onClick={onToggleOnSale}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                  <Tag className="w-4 h-4 text-red-500" />
                  {t('productBrowse.onSale')}
                </span>
                <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                  filterOnSale ? 'bg-red-500 border-red-500' : 'border-slate-300'
                }`}>
                  {filterOnSale && <Check className="w-3 h-3 text-white" />}
                </span>
              </button>

              {/* Price range */}
              <div className="h-px bg-slate-100 my-2" />
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
                {t('productBrowse.priceRange')}
              </p>
              <div className="flex items-center gap-2 px-3 pb-1">
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder={t('productBrowse.minPrice')}
                  value={priceMin}
                  onChange={(e) => onPriceMinChange(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 text-center"
                />
                <span className="text-slate-400 text-xs">–</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder={t('productBrowse.maxPrice')}
                  value={priceMax}
                  onChange={(e) => onPriceMaxChange(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 text-center"
                />
              </div>

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

// ─── Sort dropdown ──────────────────────────────────────────────────────────
interface SortDropdownProps {
  sortBy: ProductSortOption;
  onSortChange: (sort: ProductSortOption) => void;
}

const SORT_OPTIONS: ProductSortOption[] = ['default', 'price_asc', 'price_desc', 'name_asc', 'name_desc'];

const SORT_LABEL_KEYS: Record<ProductSortOption, string> = {
  default: 'productBrowse.sortDefault',
  price_asc: 'productBrowse.sortPriceAsc',
  price_desc: 'productBrowse.sortPriceDesc',
  name_asc: 'productBrowse.sortNameAsc',
  name_desc: 'productBrowse.sortNameDesc',
};

const SortDropdown: React.FC<SortDropdownProps> = ({ sortBy, onSortChange }) => {
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
          sortBy !== 'default'
            ? 'bg-blue-100 text-blue-700 border-blue-300'
            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
        }`}
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
        {t('productBrowse.sortBy')}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setOpen(false)} />
          <div className="absolute top-full end-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl w-56 overflow-hidden">
            <div className="p-2">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => { onSortChange(option); setOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    sortBy === option
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t(SORT_LABEL_KEYS[option])}
                  {sortBy === option && <Check className="w-4 h-4" />}
                </button>
              ))}
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
  selectedChains,
  externalSearchQuery,
  externalCategory,
  externalSubcategory,
  externalSubSubcategory,
  onCategoryChange,
}) => {
  const { t } = useLanguage();

  // Navigation state
  const [view, setView] = useState<View>('categories');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [productGroups, setProductGroups] = useState<Map<number, ProductGroupSummary>>(new Map());
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
  const [sortBy, setSortBy] = useState<ProductSortOption>('price_asc');
  const [filterOnSale, setFilterOnSale] = useState(false);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  // Detail modal
  const [detailBarcode, setDetailBarcode] = useState<string | null>(null);
  const [detailImageUrl, setDetailImageUrl] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<DbProductEnhanced | null>(null);
  const [detailGroupId, setDetailGroupId] = useState<number | null>(null);

  // Landing page product sections
  const [featuredProducts, setFeaturedProducts] = useState<DbProductEnhanced[]>([]); // worth comparing
  const [commonProducts, setCommonProducts] = useState<DbProductEnhanced[]>([]); // common staples

  const fetchId = useRef(0);

  const activeFilterCount = (filterVegan ? 1 : 0) + filterAllergenFree.length + (filterOnSale ? 1 : 0) + (priceMin ? 1 : 0) + (priceMax ? 1 : 0);

  // ── Load categories + featured products on mount ─────────────────────────
  useEffect(() => {
    setIsLoadingCategories(true);
    getCategories()
      .then((cats) => {
        setCategories(sortCategories(cats.filter((c) => !/^\d+$/.test(c.name))));
      })
      .catch(() => setCategories([]))
      .finally(() => setIsLoadingCategories(false));

    // Load product groups for image dedup (47 groups, lightweight)
    getProductGroups()
      .then((groups) => {
        const map = new Map<number, ProductGroupSummary>();
        groups.forEach(g => map.set(g.id, g));
        setProductGroups(map);
      })
      .catch(() => {});

    // Load "worth comparing" products — popular items with biggest price gaps
    // Search for well-known Israeli grocery staples, pick those with highest savings
    const popularQueries = ['חלב', 'ביצים', 'לחם', 'גבינה צהובה', 'שמן זית', 'קוטג', 'חמאה', 'קורנפלקס', 'אורז', 'שוקולד', 'קפה', 'סוכר', 'מים מינרליים', 'טונה', 'קטשופ', 'חלב סויה'];
    Promise.allSettled(
      popularQueries.map(q => searchProducts(q, 5, 0, city, storeType).catch(() => null))
    ).then((results) => {
      const candidates: DbProductEnhanced[] = [];
      for (const r of results) {
        if (r.status !== 'fulfilled' || !r.value) continue;
        const products = (r.value as any).products as DbProductEnhanced[];
        if (!products?.length) continue;
        // Pick the product with the biggest savings from each search
        const withSavings = products
          .filter(p => p.max_price && p.min_price && p.max_price > p.min_price && p.image_url)
          .sort((a, b) => ((b.max_price || 0) - b.min_price) - ((a.max_price || 0) - a.min_price));
        if (withSavings.length > 0) candidates.push(withSavings[0]);
      }
      // Sort all candidates by savings descending, take top 8
      const sorted = candidates
        .sort((a, b) => ((b.max_price || 0) - b.min_price) - ((a.max_price || 0) - a.min_price))
        .slice(0, 8);
      setFeaturedProducts(sorted);
    }).catch(() => {});

    // Load common staple products
    const stapleQueries = ['לחם אחיד', 'חלב תנובה', 'ביצים', 'גבינה לבנה', 'שמנת חמוצה', 'במבה', 'קולה', 'מלפפונים'];
    Promise.allSettled(
      stapleQueries.map(q => searchProducts(q, 3, 0, city, storeType).catch(() => null))
    ).then((results) => {
      const items: DbProductEnhanced[] = [];
      const seen = new Set<string>();
      for (const r of results) {
        if (r.status !== 'fulfilled' || !r.value) continue;
        const products = (r.value as any).products as DbProductEnhanced[];
        if (!products?.length) continue;
        // Pick the first product with an image that we haven't seen
        const pick = products.find(p => p.image_url && !seen.has(p.barcode));
        if (pick) { items.push(pick); seen.add(pick.barcode); }
      }
      setCommonProducts(items.slice(0, 8));
    }).catch(() => {});
  }, []);

  // ── Sync external search query from header ─────────────────────────────
  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      setSearchQuery(externalSearchQuery);
      if (externalSearchQuery.trim().length >= 2) {
        setView('search');
      } else if (externalSearchQuery === '' && view === 'search') {
        setView(selectedCategory ? 'browse' : 'categories');
      }
    }
  }, [externalSearchQuery]);

  // ── Sync external category + subcategory + sub_subcategory from CategoryNavBar
  useEffect(() => {
    if (externalCategory !== undefined && externalCategory !== null) {
      setSelectedCategory(externalCategory);
      setSelectedSubcategory(externalSubcategory || null);
      setSelectedSubSubcategory(externalSubSubcategory || null);
      setView('browse');
    } else if (externalCategory === null) {
      setView('categories');
      setSelectedCategory(null);
      setSelectedSubcategory(null);
      setSelectedSubSubcategory(null);
    }
  }, [externalCategory, externalSubcategory, externalSubSubcategory]);

  // ── Fetch products ────────────────────────────────────────────────────────
  const fetchProducts = useCallback(
    async (page: number, replace: boolean) => {
      const id = ++fetchId.current;
      setIsLoadingProducts(true);

      try {
        let result: { products: DbProductEnhanced[]; total: number };

        if (debouncedQuery.trim().length >= 2) {
          // Map sort option to API params (search API supports sort_by=min_price)
          let apiSortBy: string | undefined;
          let apiSortOrder: string | undefined;
          if (sortBy === 'price_asc') { apiSortBy = 'min_price'; apiSortOrder = 'asc'; }
          else if (sortBy === 'price_desc') { apiSortBy = 'min_price'; apiSortOrder = 'desc'; }

          const sr = await searchProducts(
            debouncedQuery.trim(),
            PAGE_SIZE,
            (page - 1) * PAGE_SIZE,
            city,
            storeType,
            filterVegan || undefined,
            filterAllergenFree.length > 0 ? filterAllergenFree : undefined,
            apiSortBy,
            apiSortOrder,
            selectedChains && selectedChains.length > 0 ? selectedChains : undefined
          );
          result = { products: sr.products as DbProductEnhanced[], total: sr.total };
        } else {
          // Use API-level sub-subcategory sorting when viewing a subcategory with defined order
          const useSubcatSort = selectedSubcategory && !selectedSubSubcategory && SUBCATEGORY_ORDER[selectedSubcategory];
          const br = await browseProducts({
            category: selectedCategory || undefined,
            subcategory: selectedSubcategory || undefined,
            sub_subcategory: selectedSubSubcategory || undefined,
            is_vegan: filterVegan || undefined,
            allergen_free: filterAllergenFree.length > 0 ? filterAllergenFree : undefined,
            city,
            store_type: storeType,
            chains: selectedChains && selectedChains.length > 0 ? selectedChains : undefined,
            limit: PAGE_SIZE,
            page,
            sort_by: useSubcatSort ? 'sub_subcategory_order' : undefined,
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
    [debouncedQuery, selectedCategory, selectedSubcategory, selectedSubSubcategory, filterVegan, filterAllergenFree, city, storeType, sortBy, selectedChains]
  );

  // Re-fetch when browse params change
  useEffect(() => {
    if (view === 'browse') {
      fetchProducts(1, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedCategory, selectedSubcategory, selectedSubSubcategory, filterVegan, filterAllergenFree, selectedChains]);

  // Re-fetch search results when sort or chain filter changes
  useEffect(() => {
    if (view === 'search' && debouncedQuery.trim().length >= 2) {
      fetchProducts(1, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, selectedChains]);

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
    onCategoryChange?.(catName);
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
    setSortBy('default');
    setFilterOnSale(false);
    setPriceMin('');
    setPriceMax('');
  };

  const handleAddProduct = (product: DbProductEnhanced, amount?: number) => {
    if (selectedProducts.some((p) => p.barcode === product.barcode)) return;
    const unit = defaultCartUnit(product.unit_of_measure, product.is_weighted);
    onSelectProduct({ ...product, amount: amount ?? 1, unit });
  };

  const handleLoadMore = () => {
    fetchProducts(currentPage + 1, false);
  };

  // ── displayProducts: client-side filter + sort ─────────────────────────────
  const displayProducts = useMemo(() => {
    // Deduplicate products sharing the same product_group_id (fresh produce).
    // Keep the one with the lowest min_price as the representative card.
    // Override image_url with the group's curated image when available.
    const seen = new Map<number, DbProductEnhanced>();
    const deduped: DbProductEnhanced[] = [];
    for (const p of products) {
      const gid = (p as any).product_group_id as number | null | undefined;
      if (gid != null) {
        const existing = seen.get(gid);
        if (!existing) {
          // Use group's curated image if available
          const groupInfo = productGroups.get(gid);
          const rep = groupInfo?.image_url
            ? { ...p, image_url: groupInfo.image_url }
            : p;
          seen.set(gid, rep);
          deduped.push(rep);
        } else if (p.min_price < existing.min_price) {
          // Replace: cheaper representative, keep the group image
          const rep = { ...p, image_url: existing.image_url };
          const idx = deduped.indexOf(existing);
          deduped[idx] = rep;
          seen.set(gid, rep);
        }
      } else {
        deduped.push(p);
      }
    }
    let list = deduped;

    // On-sale filter: keep products whose labels contain promo-related text
    if (filterOnSale) {
      list = list.filter((p) => p.labels && p.labels.length > 0);
    }

    // Price range filter
    const minP = priceMin ? parseFloat(priceMin) : null;
    const maxP = priceMax ? parseFloat(priceMax) : null;
    if (minP !== null) list = list.filter((p) => p.min_price >= minP);
    if (maxP !== null) list = list.filter((p) => p.min_price <= maxP);

    // Client-side sort (always applied — serves as primary sort for browse and fallback for search)
    if (sortBy !== 'default') {
      list.sort((a, b) => {
        switch (sortBy) {
          case 'price_asc': return a.min_price - b.min_price;
          case 'price_desc': return b.min_price - a.min_price;
          case 'name_asc': return a.name.localeCompare(b.name, 'he');
          case 'name_desc': return b.name.localeCompare(a.name, 'he');
          default: return 0;
        }
      });
    } else if (selectedSubcategory && !selectedSubSubcategory && SUBCATEGORY_ORDER[selectedSubcategory]) {
      // Custom sort: group by sub-subcategory order, weighted products first within each group
      const subOrder = SUBCATEGORY_ORDER[selectedSubcategory];
      const orderMap = new Map(subOrder.map((name, i) => [name, i]));
      list.sort((a, b) => {
        const aIdx = orderMap.get(a.sub_subcategory || '') ?? 999;
        const bIdx = orderMap.get(b.sub_subcategory || '') ?? 999;
        if (aIdx !== bIdx) return aIdx - bIdx;
        // Within same sub-subcategory: weighted first
        const aW = a.is_weighted ? 0 : 1;
        const bW = b.is_weighted ? 0 : 1;
        return aW - bW;
      });
    }

    return list;
  }, [products, filterOnSale, priceMin, priceMax, sortBy, view, productGroups, selectedSubcategory, selectedSubSubcategory]);

  const hasClientSideFilters = filterOnSale || priceMin !== '' || priceMax !== '';

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

        {/* Sort dropdown */}
        <SortDropdown sortBy={sortBy} onSortChange={setSortBy} />

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
          filterOnSale={filterOnSale}
          onToggleOnSale={() => setFilterOnSale((v) => !v)}
          priceMin={priceMin}
          priceMax={priceMax}
          onPriceMinChange={setPriceMin}
          onPriceMaxChange={setPriceMax}
          onClearFilters={() => { setFilterVegan(false); setFilterAllergenFree([]); setFilterOnSale(false); setPriceMin(''); setPriceMax(''); }}
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
          {filterOnSale && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold border border-red-200">
              <Tag className="w-3 h-3" />
              {t('productBrowse.onSale')}
              <button onClick={() => setFilterOnSale(false)} className="ms-0.5 hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {(priceMin || priceMax) && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 whitespace-nowrap flex-shrink-0">
              <DollarSign className="w-3 h-3" />
              {priceMin && `₪${priceMin}`}{priceMin && priceMax && '–'}{priceMax && `₪${priceMax}`}
              <button onClick={() => { setPriceMin(''); setPriceMax(''); }} className="ms-0.5 hover:opacity-70">
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
              {sortSubItems(activeSubcategoryNode.sub_subcategories, activeSubcategoryNode.name).map((subsub) => (
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
            <>
              {/* Promo banner */}
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 sm:p-5 text-white mb-4">
                <p className="text-sm sm:text-base font-semibold">
                  {t('productBrowse.promoBanner')}
                </p>
              </div>

              {/* "Worth Comparing" — popular products with biggest price gaps */}
              {featuredProducts.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2 px-0.5">
                    {t('productBrowse.worthComparing')}
                  </h3>
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    {featuredProducts.map((fp) => {
                      const savings = (fp.max_price || 0) - fp.min_price;
                      const pct = fp.max_price ? Math.round((savings / fp.max_price) * 100) : 0;
                      return (
                        <div key={fp.barcode} className="w-[180px] flex-shrink-0 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-all relative">
                          {/* Savings badge */}
                          {savings > 0 && (
                            <div className="flex items-center justify-center gap-2 bg-rose-50 border-b border-rose-100 px-2 py-1.5">
                              <span className="text-rose-600 text-[11px] font-bold">{t('productBrowse.saveUpTo')} ₪{savings.toFixed(2)}</span>
                              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">-{pct}%</span>
                            </div>
                          )}
                          {/* Card body — fixed height */}
                          <div className="flex-1 flex flex-col p-2.5">
                            <div className="h-24 flex items-center justify-center mb-2">
                              {fp.image_url ? (
                                <img src={fp.image_url} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                              ) : (
                                <div className="w-12 h-12 text-slate-200 flex items-center justify-center">
                                  <Search className="w-8 h-8" />
                                </div>
                              )}
                            </div>
                            <div className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2 text-center min-h-[2.5rem]">{fp.name}</div>
                            {fp.manufacturer && (
                              <div className="text-[10px] text-slate-400 text-center truncate mt-0.5">{fp.manufacturer}</div>
                            )}
                            <div className="flex items-center justify-center gap-1.5 mt-1.5">
                              <span className="text-sm font-bold text-emerald-600">₪{fp.min_price.toFixed(2)}</span>
                              {fp.max_price && fp.max_price > fp.min_price && (
                                <span className="text-[11px] text-slate-400 line-through">₪{fp.max_price.toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                          {/* Add button */}
                          <div className="px-2.5 pb-2.5">
                            {selectedProducts.some((p) => p.barcode === fp.barcode) ? (
                              <button
                                onClick={() => onRemoveProduct(fp.barcode)}
                                className="w-full py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500"
                              >
                                ✓ {t('productBrowse.added')}
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  onSelectProduct({
                                    ...fp,
                                    amount: 1,
                                    unit: defaultCartUnit(fp.unit_of_measure, fp.is_weighted),
                                  });
                                }}
                                className="w-full py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                              >
                                + {t('productBrowse.addToList')}
                              </button>
                            )}
                          </div>
                          {/* Click overlay for detail */}
                          <div
                            className="absolute inset-0 cursor-pointer"
                            style={{ bottom: '40px' }}
                            onClick={() => {
                              setDetailBarcode(fp.barcode);
                              setDetailImageUrl(fp.image_url);
                              setDetailProduct(fp);
                              setDetailGroupId((fp as any).product_group_id ?? null);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Common Products — everyday staples */}
              {commonProducts.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2 px-0.5">
                    {t('productBrowse.commonProducts')}
                  </h3>
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    {commonProducts.map((cp) => (
                      <div key={cp.barcode} className="w-[180px] flex-shrink-0 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-all relative">
                        <div className="flex-1 flex flex-col p-2.5">
                          <div className="h-24 flex items-center justify-center mb-2">
                            {cp.image_url ? (
                              <img src={cp.image_url} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                            ) : (
                              <div className="w-12 h-12 text-slate-200 flex items-center justify-center">
                                <Search className="w-8 h-8" />
                              </div>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2 text-center min-h-[2.5rem]">{cp.name}</div>
                          {cp.manufacturer && (
                            <div className="text-[10px] text-slate-400 text-center truncate mt-0.5">{cp.manufacturer}</div>
                          )}
                          <div className="flex items-center justify-center gap-1.5 mt-1.5">
                            <span className="text-sm font-bold text-emerald-600">₪{cp.min_price.toFixed(2)}</span>
                            {cp.max_price && cp.max_price > cp.min_price && (
                              <span className="text-[11px] text-slate-400 line-through">₪{cp.max_price.toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                        <div className="px-2.5 pb-2.5">
                          {selectedProducts.some((p) => p.barcode === cp.barcode) ? (
                            <button
                              onClick={() => onRemoveProduct(cp.barcode)}
                              className="w-full py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500"
                            >
                              ✓ {t('productBrowse.added')}
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                onSelectProduct({ ...cp, amount: 1, unit: defaultCartUnit(cp.unit_of_measure, cp.is_weighted) });
                              }}
                              className="w-full py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                            >
                              + {t('productBrowse.addToList')}
                            </button>
                          )}
                        </div>
                        <div
                          className="absolute inset-0 cursor-pointer"
                          style={{ bottom: '40px' }}
                          onClick={() => { setDetailBarcode(cp.barcode); setDetailImageUrl(cp.image_url); setDetailProduct(cp); setDetailGroupId((cp as any).product_group_id ?? null); }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )
        )}

        {/* Product grid */}
        {(view === 'browse' || view === 'search') && (
          isLoadingProducts && products.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-7 h-7 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : displayProducts.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              {t('productBrowse.noProducts')}
            </div>
          ) : (
            <>
              {totalProducts > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs text-slate-400">
                    {hasClientSideFilters
                      ? `${displayProducts.length} / ${totalProducts} ${t('productBrowse.results')}`
                      : `${totalProducts} ${t('productBrowse.results')}`}
                  </p>
                  {sortBy !== 'default' && view === 'browse' && products.length < totalProducts && (
                    <p className="text-[10px] text-blue-500 font-medium">
                      ({t('productBrowse.sortingLoaded')})
                    </p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 xl:gap-4">
                {displayProducts.map((product) => (
                  <ProductCard
                    key={product.barcode}
                    product={product}
                    isSelected={selectedProducts.some((p) => p.barcode === product.barcode)}
                    onAdd={(amount) => handleAddProduct(product, amount)}
                    onClick={() => { setDetailBarcode(product.barcode); setDetailImageUrl(product.image_url ?? null); setDetailProduct(product); setDetailGroupId((product as any).product_group_id ?? null); }}
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

      {/* Detail modal — use GroupDetailModal for grouped products, ProductDetailModal otherwise */}
      {detailBarcode && detailGroupId != null && (
        <GroupDetailModal
          groupId={detailGroupId}
          fallbackProduct={detailProduct}
          onClose={() => { setDetailBarcode(null); setDetailGroupId(null); }}
          onAdd={(product, amount) => {
            handleAddProduct(product, amount);
            setDetailBarcode(null);
            setDetailGroupId(null);
          }}
          isAdded={selectedProducts.some((p) => p.barcode === detailBarcode)}
          city={city}
          storeType={storeType}
        />
      )}
      {detailBarcode && detailGroupId == null && (
        <ProductDetailModal
          barcode={detailBarcode}
          fallbackImageUrl={detailImageUrl}
          fallbackProduct={detailProduct}
          onClose={() => { setDetailBarcode(null); setDetailGroupId(null); }}
          onAdd={(product, amount) => {
            handleAddProduct(product, amount);
            setDetailBarcode(null);
            setDetailGroupId(null);
          }}
          isAdded={selectedProducts.some((p) => p.barcode === detailBarcode)}
        />
      )}
    </div>
  );
};

export default ProductCatalogArea;
