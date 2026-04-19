import React, { useState, useEffect, useRef } from 'react';
import { LayoutGrid, ShoppingBasket, ArrowUpDown, Package, Sparkles, ChefHat, ChevronDown, ChevronLeft, ChevronRight, Plus, LogOut, LogIn, X, Eye, PenLine, Trash2, Users, Lock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ListDocument, UserProfile, SavedRecipe, ShoppingProduct } from '../types';
import { subscribeToSavedRecipes, updateListTitle, updateSavedRecipe } from '../services/firestoreService';
import ShoppingListBreakdownModal from './ShoppingListBreakdownModal';
import OrganizeListBreakdownModal from './OrganizeListBreakdownModal';
import RecipeBreakdownModal from './RecipeBreakdownModal';

export type ShoppingView = 'catalog' | 'basket' | 'comparison' | 'orders';

interface RightRailProps {
  user: UserProfile | null;
  lists: ListDocument[];
  activeListId: string | null;
  shoppingView: ShoppingView;
  onViewChange: (view: ShoppingView) => void;
  onOrganizeClick: () => void;
  onSelectList: (list: ListDocument) => void;
  onDeleteList: (id: string) => void;
  onCreateShoppingList: () => void;
  onCreateOrganizeList: () => void;
  onCreateRecipe: () => void;
  onLoadRecipe: (recipe: SavedRecipe) => void;
  onLogin: () => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  cartItemCount: number;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const RightRail: React.FC<RightRailProps> = ({
  user,
  lists,
  activeListId,
  shoppingView,
  onViewChange,
  onOrganizeClick,
  onSelectList,
  onDeleteList,
  onCreateShoppingList,
  onCreateOrganizeList,
  onCreateRecipe,
  onLoadRecipe,
  onLogin,
  onLogout,
  onOpenProfile,
  cartItemCount,
  mobileOpen,
  onMobileClose,
}) => {
  const { t, isRTL } = useLanguage();
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [onlineOpen, setOnlineOpen] = useState(true);
  const [physicalOpen, setPhysicalOpen] = useState(false);
  const [recipesOpen, setRecipesOpen] = useState(false);
  const [viewingShoppingList, setViewingShoppingList] = useState<{ products: ShoppingProduct[]; title: string } | null>(null);
  const [viewingOrganizeList, setViewingOrganizeList] = useState<ListDocument | null>(null);
  const [viewingRecipe, setViewingRecipe] = useState<SavedRecipe | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) { setSavedRecipes([]); return; }
    const unsub = subscribeToSavedRecipes(user.uid, setSavedRecipes);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (editingListId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingListId]);

  const startRename = (l: ListDocument) => {
    setEditingListId(l.id);
    setEditingTitle(l.title || '');
  };

  const commitRename = async () => {
    if (!user || !editingListId) return;
    const trimmed = editingTitle.trim();
    if (trimmed) {
      try { await updateListTitle(editingListId, trimmed); } catch (e) { console.error('[rename]', e); }
    }
    setEditingListId(null);
    setEditingTitle('');
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm(isRTL ? 'למחוק את הרשימה?' : 'Delete this list?')) {
      onDeleteList(id);
    }
  };

  const handleUpdateRecipe = async (recipeId: string, updates: Partial<SavedRecipe>) => {
    if (!user) return;
    try {
      await updateSavedRecipe(user.uid, recipeId, updates);
      if (viewingRecipe && viewingRecipe.id === recipeId) {
        setViewingRecipe({ ...viewingRecipe, ...updates, updatedAt: Date.now() });
      }
    } catch (e) { console.error(e); throw e; }
  };

  const shoppingLists = lists.filter(l => l.appMode === 'shopping');
  const organizeLists = lists.filter(l => l.appMode !== 'shopping');
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  // Primary nav items
  const navItems: Array<{ id: ShoppingView; label: string; Icon: React.ElementType; badge?: number }> = [
    { id: 'catalog',    label: isRTL ? 'קטלוג'   : 'Catalog',     Icon: LayoutGrid },
    { id: 'basket',     label: isRTL ? 'הסל'     : 'Basket',      Icon: ShoppingBasket, badge: cartItemCount || undefined },
    { id: 'comparison', label: isRTL ? 'השוואה'  : 'Comparison',  Icon: ArrowUpDown },
    { id: 'orders',     label: isRTL ? 'הזמנות'  : 'Orders',      Icon: Package },
  ];

  // Seeded color for list dot (deterministic per list id)
  const listDotColor = (id: string) => {
    const palette = ['#D7352D', '#E88B3C', '#8B6BB0', '#2F6B3C', '#5B7F9D', '#C68B6F'];
    let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  };

  const NavItem = ({ id, label, Icon, badge, active, onClick }: { id: string; label: string; Icon: React.ElementType; badge?: number; active: boolean; onClick: () => void }) => (
    <button
      key={id}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-[14px] text-sm font-semibold transition-colors"
      style={active
        ? { background: 'var(--paper-surface)', color: 'var(--ink)', boxShadow: '0 1px 2px rgba(0,0,0,0.06)', border: '1px solid var(--line)' }
        : { color: 'var(--ink-muted)' }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? 'var(--ink)' : 'var(--ink-soft)' }} />
      <span className="flex-1 text-start">{label}</span>
      {typeof badge === 'number' && (
        <span className="text-[11px] font-bold" style={{ color: 'var(--ink-soft)', fontFamily: 'var(--font-mono)' }}>{badge}</span>
      )}
    </button>
  );

  // Wrap nav actions so they auto-close the mobile drawer
  const wrapMobile = (fn: () => void) => () => { fn(); onMobileClose(); };

  return (
    <>
      {/* Mobile overlay */}
      <div
        onClick={onMobileClose}
        className={`lg:hidden fixed inset-0 z-40 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(26,26,23,0.4)' }}
        aria-hidden={!mobileOpen}
      />
      <aside
        className={`fixed top-0 bottom-0 z-50 w-[280px] max-w-[85vw] flex-col transition-transform duration-300 ease-out ${
          mobileOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'
        } lg:flex lg:translate-x-0 lg:z-30`}
        style={{
          [isRTL ? 'right' : 'left']: 0,
          background: 'var(--paper-bg)',
          borderInlineStart: '1px solid var(--line)',
          display: 'flex',
        } as React.CSSProperties}
      >
      {/* Brand — Lista logo (click → catalog) */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <button
          onClick={wrapMobile(() => onViewChange('catalog'))}
          className="flex-shrink-0 hover:opacity-80 transition-opacity"
          title={isRTL ? 'חזרה לקטלוג' : 'Back to catalog'}
        >
          <img src="/lista-05.svg" alt="Lista" className="h-9 w-auto" />
        </button>
        <div className="flex items-center gap-3">
          <div className="text-[10px] font-bold hidden sm:block" style={{ letterSpacing: '0.2em', color: 'var(--ink-soft)' }}>
            PRICEPILOT
          </div>
          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1.5 rounded-full"
            style={{ color: 'var(--ink-muted)' }}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="mx-6 h-px" style={{ background: 'var(--line)' }} />

      {/* Nav + lists (scrollable) */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-0.5">
        {navItems.map(n => (
          <NavItem
            key={n.id}
            id={n.id}
            label={n.label}
            Icon={n.Icon}
            badge={n.badge}
            active={shoppingView === n.id}
            onClick={wrapMobile(() => onViewChange(n.id))}
          />
        ))}
        <NavItem id="organize" label={isRTL ? 'ארגון קנייה פיזית' : 'Organize in-store shop'} Icon={Sparkles} active={false} onClick={wrapMobile(onOrganizeClick)} />

        {/* My Lists */}
        <div className="mt-5 mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--ink-soft)' }}>
          {isRTL ? 'הרשימות שלי' : 'My lists'}
        </div>

        {/* Online shopping lists (agent-driven) */}
        <SectionHeader
          icon={<ShoppingBasket className="w-3.5 h-3.5" />}
          label={isRTL ? 'קניה אונליין' : 'Online shopping'}
          count={shoppingLists.length}
          color={SECTION_COLORS.online}
          isOpen={onlineOpen}
          onToggle={() => setOnlineOpen(o => !o)}
          isRTL={isRTL}
        />
        {onlineOpen && (
          <>
        <AddButton onClick={wrapMobile(onCreateShoppingList)} label={isRTL ? 'רשימה חדשה' : 'New list'} color={SECTION_COLORS.online} />
        {shoppingLists.length > 0 && (
          <div className="flex flex-col gap-2 px-2 mt-2">
            {shoppingLists.map(l => (
              <ListCard
                key={l.id}
                list={l}
                kind="shopping"
                active={activeListId === l.id}
                dotColor={listDotColor(l.id)}
                isEditing={editingListId === l.id}
                editingTitle={editingTitle}
                setEditingTitle={setEditingTitle}
                editInputRef={editInputRef}
                startRename={() => startRename(l)}
                commitRename={commitRename}
                onUse={wrapMobile(() => onSelectList(l))}
                onView={() => setViewingShoppingList({
                  products: (l as any).shoppingProducts || [],
                  title: l.title || (isRTL ? 'רשימת קניות' : 'Shopping list'),
                })}
                onDelete={(e) => handleDelete(e, l.id)}
                isRTL={isRTL}
              />
            ))}
          </div>
        )}
          </>
        )}

        <SectionDivider />

        {/* Physical shopping / organize lists */}
        <SectionHeader
          icon={<LayoutGrid className="w-3.5 h-3.5" />}
          label={isRTL ? 'קנייה פיזית' : 'In-store shopping'}
          count={organizeLists.length}
          color={SECTION_COLORS.physical}
          isOpen={physicalOpen}
          onToggle={() => setPhysicalOpen(o => !o)}
          isRTL={isRTL}
        />
        {physicalOpen && (
          <>
        <AddButton onClick={wrapMobile(onCreateOrganizeList)} label={isRTL ? 'רשימה חדשה' : 'New list'} color={SECTION_COLORS.physical} />
        {organizeLists.length > 0 && (
          <div className="flex flex-col gap-2 px-2 mt-2">
            {organizeLists.map(l => (
              <ListCard
                key={l.id}
                list={l}
                kind="organize"
                active={activeListId === l.id}
                dotColor={listDotColor(l.id)}
                isEditing={editingListId === l.id}
                editingTitle={editingTitle}
                setEditingTitle={setEditingTitle}
                editInputRef={editInputRef}
                startRename={() => startRename(l)}
                commitRename={commitRename}
                onUse={wrapMobile(() => onSelectList(l))}
                onView={() => setViewingOrganizeList(l)}
                onDelete={(e) => handleDelete(e, l.id)}
                isRTL={isRTL}
              />
            ))}
          </div>
        )}
          </>
        )}

        <SectionDivider />

        {/* Recipes (collapsible) */}
        <SectionHeader
          icon={<ChefHat className="w-3.5 h-3.5" />}
          label={isRTL ? 'מתכונים' : 'Recipes'}
          count={savedRecipes.length}
          color={SECTION_COLORS.recipes}
          isOpen={recipesOpen}
          onToggle={() => setRecipesOpen(o => !o)}
          isRTL={isRTL}
        />
        {recipesOpen && (
          <>
            <AddButton onClick={wrapMobile(onCreateRecipe)} label={isRTL ? 'מתכון חדש' : 'New recipe'} color={SECTION_COLORS.recipes} />
            {savedRecipes.length > 0 && (
              <div className="flex flex-col gap-0.5 ms-4 mt-2">
                {savedRecipes.map(r => (
                  <button
                    key={r.id}
                    onClick={wrapMobile(() => onLoadRecipe(r))}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-xs transition-colors truncate"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    <span className="truncate">{r.title}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* User card */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--line)' }}>
        {user ? (
          <div
            onClick={wrapMobile(onOpenProfile)}
            className="flex items-center gap-3 p-3 rounded-[14px] cursor-pointer transition-colors hover:shadow-md"
            style={{ background: 'var(--paper-surface)', border: '1px solid var(--line)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            title={isRTL ? 'הפרופיל שלי' : 'My profile'}
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full flex-shrink-0" />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold"
                style={{ background: 'linear-gradient(135deg, #E88B3C, #D7352D)' }}
              >
                {(user.displayName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{user.displayName}</div>
              <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{isRTL ? `סל פעיל: ${cartItemCount}` : `In cart: ${cartItemCount}`}</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onLogout(); }}
              className="p-1.5 rounded-full transition-colors"
              style={{ color: 'var(--ink-soft)' }}
              title={isRTL ? 'יציאה' : 'Log out'}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-[14px] text-sm font-semibold transition-colors"
            style={{ background: 'var(--ink)', color: 'var(--paper-bg)' }}
          >
            <LogIn className="w-4 h-4" />
            <span>{isRTL ? 'התחברות' : 'Sign in'}</span>
          </button>
        )}
      </div>
      </aside>

      {/* View modals */}
      {viewingShoppingList && (
        <ShoppingListBreakdownModal
          isOpen={!!viewingShoppingList}
          onClose={() => setViewingShoppingList(null)}
          products={viewingShoppingList.products}
          listTitle={viewingShoppingList.title}
        />
      )}
      {viewingOrganizeList && (
        <OrganizeListBreakdownModal
          isOpen={!!viewingOrganizeList}
          onClose={() => setViewingOrganizeList(null)}
          list={viewingOrganizeList}
        />
      )}
      {viewingRecipe && (
        <RecipeBreakdownModal
          isOpen={!!viewingRecipe}
          onClose={() => setViewingRecipe(null)}
          recipes={[viewingRecipe]}
          canEdit={true}
          onUpdate={handleUpdateRecipe}
        />
      )}
    </>
  );
};

// ───────────────────────────────────────────────────────────
// Section colors
// ───────────────────────────────────────────────────────────
const SECTION_COLORS = {
  online:   '#D7352D', // tomato — "act" / order / agent
  physical: '#2F6B3C', // signal green — grocery / take-in-person
  recipes:  '#E88B3C', // warm amber — food
} as const;

// Horizontal divider between sections
const SectionDivider: React.FC = () => (
  <div className="mx-4 my-4 h-px" style={{ background: 'var(--line)' }} />
);

// Section header — collapsible, e.g. "ONLINE SHOPPING  3  ▾"
const SectionHeader: React.FC<{
  icon: React.ReactNode; label: string; count: number; color: string;
  isOpen: boolean; onToggle: () => void; isRTL: boolean; className?: string;
}> = ({ icon, label, count, color, isOpen, onToggle, isRTL, className = '' }) => {
  const ChevronClosed = isRTL ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-2 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${className}`}
      style={{ color }}
    >
      <span>{icon}</span>
      <span className="flex-1 text-start">{label}</span>
      {count > 0 && (
        <span className="text-[11px] font-normal normal-case tracking-normal" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)' }}>{count}</span>
      )}
      {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronClosed className="w-3.5 h-3.5" />}
    </button>
  );
};

// Inline "+ New list" button — tinted to match the section color
const AddButton: React.FC<{ onClick: () => void; label: string; color: string }> = ({ onClick, label, color }) => (
  <button
    onClick={onClick}
    className="mx-2 mt-1.5 flex items-center gap-2 px-3 py-2 rounded-[12px] border border-dashed text-xs font-medium transition-colors hover:bg-[var(--paper-surface-alt)]"
    style={{ borderColor: `${color}55`, color }}
  >
    <Plus className="w-3.5 h-3.5 flex-shrink-0" />
    <span>{label}</span>
  </button>
);

// ───────────────────────────────────────────────────────────
// ListCard — full list tile with rename, view, use, delete
// ───────────────────────────────────────────────────────────
interface ListCardProps {
  list: ListDocument;
  kind: 'shopping' | 'organize';
  active: boolean;
  dotColor: string;
  isEditing: boolean;
  editingTitle: string;
  setEditingTitle: (s: string) => void;
  editInputRef: React.RefObject<HTMLInputElement>;
  startRename: () => void;
  commitRename: () => void;
  onUse: () => void;
  onView: () => void;
  onDelete: (e: React.MouseEvent) => void;
  isRTL: boolean;
}

const ListCard: React.FC<ListCardProps> = ({
  list, kind, active, dotColor, isEditing, editingTitle, setEditingTitle, editInputRef,
  startRename, commitRename, onUse, onView, onDelete, isRTL,
}) => {
  const productCount = kind === 'shopping'
    ? ((list as any).shoppingProducts?.length ?? 0)
    : (list.groups?.reduce((s, g) => s + (g.items?.length || 0), 0) ?? 0);
  const isShared = (list.memberEmails?.length ?? 0) > 1;

  const KindIcon = kind === 'shopping' ? ShoppingBasket : LayoutGrid;
  const defaultTitle = kind === 'shopping'
    ? (isRTL ? 'רשימת קניות' : 'Shopping list')
    : (isRTL ? 'רשימה' : 'List');

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-[14px] transition-colors"
      style={active
        ? { background: 'var(--paper-surface)', border: '1px solid var(--line)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
        : { background: 'transparent', border: '1px solid transparent' }}
    >
      {/* Header: delete · title · icon */}
      <div className="flex items-center gap-2">
        <button
          onClick={onDelete}
          className="p-1 rounded-md transition-colors flex-shrink-0"
          style={{ color: 'var(--ink-soft)' }}
          aria-label={isRTL ? 'מחק רשימה' : 'Delete list'}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={editInputRef}
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') { setEditingTitle(''); commitRename(); }
              }}
              className="w-full bg-transparent text-sm font-semibold focus:outline-none border-b"
              style={{ color: 'var(--ink)', borderColor: 'var(--accent)', textAlign: isRTL ? 'right' : 'left' }}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          ) : (
            <button
              onClick={startRename}
              className="w-full text-start text-sm font-semibold truncate"
              style={{ color: 'var(--ink)' }}
              title={isRTL ? 'לחץ לשינוי שם' : 'Click to rename'}
            >
              {list.title || defaultTitle}
            </button>
          )}
        </div>

        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: active ? 'var(--paper-surface-alt)' : 'transparent', color: dotColor }}
        >
          <KindIcon className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Meta row: count + privacy */}
      <div className="flex items-center gap-2 ps-7 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{productCount}</span>
        <span>{isRTL ? 'מוצרים' : productCount === 1 ? 'item' : 'items'}</span>
        <span style={{ color: 'var(--ink-soft)' }}>·</span>
        <span className="flex items-center gap-1">
          {isShared ? <Users className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
          {isShared ? (isRTL ? 'משותף' : 'shared') : (isRTL ? 'פרטי' : 'private')}
        </span>
      </div>

      {/* Action buttons: View + Use */}
      <div className="flex gap-1.5">
        <button
          onClick={onView}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[10px] text-[11px] font-semibold transition-colors"
          style={{ background: 'var(--save-bg)', color: 'var(--save)' }}
        >
          <Eye className="w-3 h-3" />
          <span>{isRTL ? 'צפה' : 'View'}</span>
        </button>
        <button
          onClick={onUse}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[10px] text-[11px] font-semibold transition-colors"
          style={{ background: 'var(--paper-surface-alt)', color: 'var(--ink)' }}
        >
          <PenLine className="w-3 h-3" />
          <span>{isRTL ? 'השתמש' : 'Use'}</span>
        </button>
      </div>
    </div>
  );
};

export default RightRail;
