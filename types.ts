export type Unit = 'pcs' | 'g' | 'kg' | 'L' | 'ml';
export type Language = 'en' | 'he';
export type InputMode = 'items' | 'recipe';
export type AppMode = 'organize' | 'shopping';
export type ShoppingFlowStep = 'setup' | 'build_list' | 'comparing' | 'results' | 'ready';

export interface Recipe {
  id: string;
  name: string;
  ingredients: string;
  instructions?: string; // Optional cooking instructions
  originalSavedRecipeId?: string; // Tracks which saved recipe this came from (for update vs save as new)
}

export interface SavedRecipe extends Recipe {
  userId: string;
  createdAt: number;
  updatedAt: number;
}

export interface RecipeLabel {
  recipeId: string;
  recipeName: string;
  color: string; // Hex color for badge
}

export interface Item {
  id: string;
  name: string;
  checked: boolean;
  amount: number;
  unit: Unit;
  recipeLabels?: RecipeLabel[]; // Array of recipes this item belongs to
  barcode?: string;
  dbProductId?: number;
  manufacturer?: string;
  dbPrice?: number; // effective price from DB
}

export interface CategoryGroup {
  id: string;
  category: string;
  items: Item[];
  imageUrl?: string;
  assignedTo?: string; // email of the assigned member
}

export type OrganizeStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface ListDocument {
  id: string;
  title: string;
  ownerId: string;
  memberEmails: string[];
  groups: CategoryGroup[];
  recipes?: Recipe[]; // Array of recipes used in this list
  inputMode?: InputMode; // Current mode ('items' or 'recipe')
  appMode?: AppMode; // Top-level mode ('organize' or 'shopping') — undefined defaults to 'organize'
  shoppingProducts?: ShoppingProduct[]; // Products for shopping mode lists
  shoppingCity?: string;
  shoppingLocation?: UserLocation;
  shoppingMode?: ShoppingMode;
  createdAt?: any;
  updatedAt?: any;
}

// ============================================
// DB API Response Types (Israeli Food Prices)
// ============================================

export interface DbProduct {
  id: number;
  barcode: string;
  name: string;
  manufacturer: string;
  category: string;
  image_url: string | null;
  min_price: number;
  max_price?: number;   // absent from browse endpoint
  savings?: number;     // absent from browse endpoint
  // Optional enhanced fields (present when using browse/detail endpoints)
  subcategory?: string | null;
  sub_subcategory?: string | null;
  allergens?: string | null;
  is_vegan?: boolean | null;
  labels?: string | null;
}

export interface DbProductEnhanced extends DbProduct {
  subcategory: string | null;
  sub_subcategory: string | null;
  allergens: string | null;
  is_vegan: boolean | null;
  labels: string | null;
}

export interface SubSubCategoryNode { name: string; count: number; }
export interface SubCategoryNode { name: string; count: number; sub_subcategories: SubSubCategoryNode[]; }
export interface CategoryNode { name: string; count: number; subcategories: SubCategoryNode[]; }

export interface ProductBrowseResult {
  total: number;
  page: number;
  limit: number;
  products: DbProductEnhanced[];
}

export interface ProductStorePrice {
  supermarket: string;
  price: number;
  effective_price: number;
  promotion: { description: string; type: string; ends_at: string | null } | null;
  store: { store_id: string; store_name: string; city: string | null; address: string | null; is_online: boolean };
}

export interface DbProductDetail extends DbProductEnhanced {
  prices: ProductStorePrice[];
}

export interface ShoppingProduct extends DbProduct {
  amount: number;
  unit: Unit;
}

export interface DbProductSearchResult {
  query: string;
  total: number;
  count: number;
  products: DbProduct[];
}

export interface DbStoreDetail {
  store_id: string;
  store_name: string;
  city: string;
  address: string | null;
  is_online: boolean;
  delivery_fee?: number;
  minimum_order?: number | null;
}

export interface DbStorePrice {
  supermarket: string;
  price: number;
  store?: DbStoreDetail;
}

export interface DbPriceComparison {
  product: { id: number; barcode: string; name: string; manufacturer: string; category: string };
  prices: DbStorePrice[];
}

export interface DbPromotion {
  product: { barcode: string; name: string };
  supermarket: string;
  regular_price: number;
  discount_rate: number;
  description: string;
}

export interface DbSupermarket {
  id: number;
  name: string;
  chain_id: number;
  stats: { products: number; promotions: number };
}

// ============================================
// Price Comparison Results
// ============================================

export interface ItemPromotion {
  description: string;
  type: string;
  endsAt: string | null;
}

export interface ItemPriceDetail {
  itemName: string;
  price: number;
  originalPrice?: number;  // regular price before promo (if discounted)
  amount: number;
  total: number;
  promotion?: ItemPromotion;
}

export interface StoreBranch {
  storeId: string;
  address: string | null;
  totalCost: number;
  itemPrices: ItemPriceDetail[];
}

export interface StorePriceSummary {
  supermarketName: string;
  totalCost: number;
  matchedItems: number;
  unmatchedItems: string[];
  itemPrices: ItemPriceDetail[];
  storeAddress?: string;
  selectedStoreId?: string;
  availableBranches?: StoreBranch[];
  deliveryFee?: number;
  minimumOrder?: number | null;
  totalWithDelivery?: number;
}

export interface ListPriceComparison {
  stores: StorePriceSummary[];
  cheapestStoreId: string;
  cheapestTotal: number;
  mostExpensiveTotal: number;
  savingsAmount: number;
  savingsPercent: number;
  unmatchedItems: string[];
  totalListItems: number;
}

// ============================================
// Shopping Modes
// ============================================

export type ShoppingMode = 'physical' | 'online';

export interface UserLocation {
  city: string;
  address?: string;
  cityCode?: number;   // סמל_ישוב from gov data (e.g., 3000 = Jerusalem)
  streetName?: string;  // שם_רחוב
}

// ============================================
// Delivery Check (POST /api/delivery/check)
// ============================================

export interface ChainDeliveryResult {
  chain: string;
  store_ref_id: number;
  delivers: boolean;
  click_and_collect: boolean;
  delivery_fee: number | null;
  error: string | null;
}

export interface DeliveryCheckResult {
  city: string;
  street: string | null;
  chains: ChainDeliveryResult[];
  eligible_store_ref_ids: number[];
}

// ============================================
// Price Agent Types
// ============================================

// Workflow states for the price comparison agent
export type AgentWorkflowState =
  | 'IDLE'
  | 'ONBOARDING'
  | 'COLLECTING_LIST'
  | 'CONFIRMING_CONTEXT'
  | 'SELECTING_STORES'
  | 'SCANNING_PRICES'
  | 'DISAMBIGUATING_ITEMS'
  | 'BUILDING_CART'
  | 'AWAITING_APPROVAL'
  | 'GENERATING_CHECKOUT'
  | 'COMPLETED'
  | 'ERROR';

// Shopping item for the agent (different from Lista's Item)
export interface AgentShoppingItem {
  id: string;
  rawText: string;
  name: string;
  quantity: number;
  unit?: string;
  brand?: string;
  category?: 'grocery' | 'electronics' | 'fashion' | 'home' | 'beauty' | 'sports' | 'other';
  attributes?: string[];
}

// Product from store catalog
export interface AgentProduct {
  sku: string;
  storeId: string;
  name: string;
  nameHe?: string;
  brand: string;
  price: number;
  salePrice?: number;
  currency?: string;
  unit: string;
  unitSize?: number;
  imageUrl?: string;
  inStock: boolean;
  url?: string;
}

// Store information
export interface AgentStore {
  id: string;
  name: string;
  nameHe: string;
  logoUrl?: string;
  deliveryFee: number;
  deliveryFeeThreshold?: number;
}

// Cart item
export interface AgentCartItem {
  product: AgentProduct;
  quantity: number;
}

// Pricing plan for a store combination
export interface AgentPricingPlan {
  stores: string[];
  items: AgentCartItem[];
  subtotal: number;
  deliveryFees: number;
  total: number;
  storeBreakdown: AgentStoreBreakdown[];
}

export interface AgentStoreBreakdown {
  storeId: string;
  storeName: string;
  items: AgentCartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}

// Savings report
export interface AgentSavingsReport {
  baseline: AgentPricingPlan;
  bestPlan: AgentPricingPlan;
  savingsAmount: number;
  savingsPercent: number;
  fee: number; // 5% of savings
  netBenefit: number;
}

// Disambiguation context for product selection
export interface AgentDisambiguationItem {
  groceryItem: AgentShoppingItem;
  options: AgentProduct[];
  selectedProduct?: AgentProduct;
  status: 'pending' | 'resolved' | 'skipped';
}

// Chat message types
export type ChatMessageType = 'bot' | 'user' | 'system';

export interface ChatButton {
  id: string;
  label: string;
  action: string; // e.g., 'consent:yes', 'select_store:rami-levy', 'product:0'
  variant?: 'primary' | 'secondary' | 'danger';
}

// Store category for organized store selection
export interface StoreCategory {
  id: string;
  name: string;
  nameHe: string;
  stores: AgentStore[];
}

export interface ChatMessage {
  id: string;
  type: ChatMessageType;
  text: string;
  timestamp: number;
  buttons?: ChatButton[];
  // Optional rich content
  products?: AgentProduct[];
  savingsReport?: AgentSavingsReport;
  groceryList?: AgentShoppingItem[];
  // Store selection
  storeCategories?: StoreCategory[];
  selectedStoreIds?: string[];
  allowCustomStore?: boolean;
}

// Agent session stored in Firestore
export interface AgentSession {
  id: string;
  userId: string;
  listId: string;
  state: AgentWorkflowState;
  groceryList: AgentShoppingItem[];
  selectedStores: string[];
  messages: ChatMessage[];
  savingsReport?: AgentSavingsReport;
  disambiguation?: {
    currentItemIndex: number;
    items: AgentDisambiguationItem[];
  };
  checkoutUrls?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

// Type adapter: Convert Lista Item to AgentShoppingItem
export function itemToShoppingItem(item: Item): AgentShoppingItem {
  return {
    id: item.id,
    rawText: `${item.amount} ${item.unit} ${item.name}`,
    name: item.name,
    quantity: item.amount,
    unit: item.unit,
    category: 'grocery',
  };
}

// Type adapter: Convert CategoryGroup[] to AgentShoppingItem[]
export function groupsToShoppingItems(groups: CategoryGroup[]): AgentShoppingItem[] {
  const items: AgentShoppingItem[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (!item.checked) { // Only include unchecked items
        items.push(itemToShoppingItem(item));
      }
    }
  }
  return items;
}