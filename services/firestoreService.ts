import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  arrayUnion
} from 'firebase/firestore';
import { ListDocument, CategoryGroup, Recipe, InputMode, SavedRecipe } from '../types';

const COLLECTION_NAME = 'lists';

export const createList = async (title: string, ownerId: string, ownerEmail: string) => {
  console.log('[createList] Creating list:', title, 'for user:', ownerEmail);
  const newListRef = doc(collection(db, COLLECTION_NAME));
  const newList: ListDocument = {
    id: newListRef.id,
    title,
    ownerId,
    memberEmails: [ownerEmail],
    groups: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await setDoc(newListRef, newList);
  console.log('[createList] List created with ID:', newList.id);
  return newList.id;
};

export const createListWithRecipes = async (
  title: string,
  ownerId: string,
  ownerEmail: string,
  groups: CategoryGroup[],
  recipes: Recipe[],
  mode: InputMode
) => {
  console.log('[createListWithRecipes] Creating list:', title, 'with groups:', groups.length, 'recipes:', recipes.length);
  const newListRef = doc(collection(db, COLLECTION_NAME));
  const newList: ListDocument = {
    id: newListRef.id,
    title,
    ownerId,
    memberEmails: [ownerEmail],
    groups,
    recipes,
    inputMode: mode,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await setDoc(newListRef, newList);
  console.log('[createListWithRecipes] List created with ID:', newList.id);
  return newList.id;
};

export const updateListGroups = async (listId: string, groups: CategoryGroup[], title?: string) => {
  const listRef = doc(db, COLLECTION_NAME, listId);
  const updateData: any = {
    groups,
    updatedAt: Date.now()
  };

  if (title !== undefined) {
    updateData.title = title;
  }

  await updateDoc(listRef, updateData);
};

export const updateListGroupsAndRecipes = async (
  listId: string,
  groups: CategoryGroup[],
  recipes: Recipe[],
  mode: InputMode,
  title?: string
) => {
  console.log('[updateListGroupsAndRecipes] Updating list:', listId, 'with groups:', groups.length, 'recipes:', recipes.length, 'mode:', mode, 'title:', title);
  const listRef = doc(db, COLLECTION_NAME, listId);
  const updateData: any = {
    groups,
    recipes,
    inputMode: mode,
    updatedAt: Date.now()
  };

  if (title !== undefined) {
    updateData.title = title;
  }

  await updateDoc(listRef, updateData);
  console.log('[updateListGroupsAndRecipes] Update complete');
};

export const updateListTitle = async (listId: string, title: string) => {
  const listRef = doc(db, COLLECTION_NAME, listId);
  await updateDoc(listRef, {
    title,
    updatedAt: Date.now()
  });
};

export const shareList = async (listId: string, email: string) => {
  const listRef = doc(db, COLLECTION_NAME, listId);
  // Check if list exists first to avoid errors
  const listSnap = await getDoc(listRef);
  if (listSnap.exists()) {
    await updateDoc(listRef, {
      memberEmails: arrayUnion(email)
    });
  }
};

export const joinSharedList = async (listId: string, userEmail: string) => {
  const listRef = doc(db, COLLECTION_NAME, listId);

  try {
    // Try to add user directly without reading first
    // This works if the list exists and Firestore rules allow arrayUnion
    await updateDoc(listRef, {
      memberEmails: arrayUnion(userEmail)
    });

    return listId;
  } catch (error: any) {
    // If update fails, the list might not exist or user doesn't have permission
    console.error('Failed to join list:', error);

    if (error.code === 'not-found') {
      throw new Error('List not found. The share link may be invalid.');
    } else if (error.code === 'permission-denied') {
      throw new Error('Permission denied. Please check Firestore security rules.');
    } else {
      throw new Error('Failed to join list: ' + error.message);
    }
  }
};

export const deleteList = async (listId: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, listId));
};

export const subscribeToLists = (userId: string, email: string | null, callback: (lists: ListDocument[]) => void) => {
  console.log('[subscribeToLists] Setting up subscription for email:', email);
  if (!email) {
    console.log('[subscribeToLists] No email provided, returning empty callback');
    callback([]);
    return () => {};
  }

  // Query lists where the user is a member (by email)
  const q = query(
    collection(db, COLLECTION_NAME),
    where('memberEmails', 'array-contains', email)
  );

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    console.log('[subscribeToLists] Snapshot received with', querySnapshot.size, 'documents');
    const lists: ListDocument[] = [];
    querySnapshot.forEach((doc) => {
      const listData = doc.data() as ListDocument;
      console.log('[subscribeToLists] List:', doc.id, 'title:', listData.title, 'groups:', listData.groups.length, 'recipes:', listData.recipes?.length);
      lists.push(listData);
    });
    // Sort client-side to avoid complex Firestore composite indexes for now
    lists.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    console.log('[subscribeToLists] Calling callback with', lists.length, 'lists');
    callback(lists);
  }, (error) => {
    console.error("[subscribeToLists] Error fetching lists from Firestore:", error);
  });

  return unsubscribe;
};

// ==================== SAVED RECIPES FUNCTIONS ====================

/**
 * Save a recipe to the user's personal recipe library
 * @param userId - The user's UID
 * @param recipe - The recipe to save
 * @returns The recipe ID
 */
export const saveRecipeToLibrary = async (
  userId: string,
  recipe: Recipe
): Promise<string> => {
  const recipeId = recipe.id || crypto.randomUUID();
  const recipeRef = doc(db, 'users', userId, 'saved_recipes', recipeId);

  // Check if recipe already exists to preserve createdAt
  const existingDoc = await getDoc(recipeRef);
  const existingData = existingDoc.exists() ? existingDoc.data() as SavedRecipe : null;

  const savedRecipe: SavedRecipe = {
    ...recipe,
    id: recipeId,
    userId,
    createdAt: existingData?.createdAt || Date.now(), // Preserve original createdAt on updates
    updatedAt: Date.now()
  };

  await setDoc(recipeRef, savedRecipe);
  return recipeId;
};

/**
 * Subscribe to a user's saved recipes (real-time updates)
 * @param userId - The user's UID
 * @param callback - Function to call when recipes update
 * @returns Unsubscribe function
 */
export const subscribeToSavedRecipes = (
  userId: string,
  callback: (recipes: SavedRecipe[]) => void
): (() => void) => {
  const recipesRef = collection(db, 'users', userId, 'saved_recipes');

  const unsubscribe = onSnapshot(recipesRef, (snapshot) => {
    const recipes: SavedRecipe[] = [];
    snapshot.forEach((doc) => {
      recipes.push(doc.data() as SavedRecipe);
    });
    // Sort by most recently updated
    recipes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    callback(recipes);
  }, (error) => {
    console.error("Error fetching saved recipes from Firestore:", error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Delete a saved recipe from the user's library
 * @param userId - The user's UID
 * @param recipeId - The recipe ID to delete
 */
export const deleteSavedRecipe = async (
  userId: string,
  recipeId: string
): Promise<void> => {
  const recipeRef = doc(db, 'users', userId, 'saved_recipes', recipeId);
  await deleteDoc(recipeRef);
};

/**
 * Update a saved recipe in the user's library
 * @param userId - The user's UID
 * @param recipeId - The recipe ID to update
 * @param updates - Partial recipe updates
 */
export const updateSavedRecipe = async (
  userId: string,
  recipeId: string,
  updates: Partial<Recipe>
): Promise<void> => {
  const recipeRef = doc(db, 'users', userId, 'saved_recipes', recipeId);
  await updateDoc(recipeRef, {
    ...updates,
    updatedAt: Date.now()
  });
};