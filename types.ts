export type Unit = 'pcs' | 'g' | 'kg' | 'L' | 'ml';
export type Language = 'en' | 'he';

export interface Item {
  id: string;
  name: string;
  checked: boolean;
  amount: number;
  unit: Unit;
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
  createdAt?: any;
  updatedAt?: any;
}