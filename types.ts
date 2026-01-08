export type Unit = 'pcs' | 'g' | 'kg' | 'L' | 'ml';
export type Language = 'en' | 'he';
export type InputMode = 'items' | 'recipe';

export interface Recipe {
  id: string;
  name: string;
  ingredients: string;
  instructions?: string; // Optional cooking instructions
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
  createdAt?: any;
  updatedAt?: any;
}