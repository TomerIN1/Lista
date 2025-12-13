import { db } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  arrayUnion, 
  getDoc
} from 'firebase/firestore';
import { ListDocument, CategoryGroup } from '../types';

const COLLECTION_NAME = 'lists';

export const createList = async (title: string, ownerId: string, ownerEmail: string) => {
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
  return newList.id;
};

export const updateListGroups = async (listId: string, groups: CategoryGroup[]) => {
  const listRef = doc(db, COLLECTION_NAME, listId);
  await updateDoc(listRef, {
    groups,
    updatedAt: Date.now()
  });
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
  const listSnap = await getDoc(listRef);

  if (!listSnap.exists()) {
    throw new Error('List not found');
  }

  const listData = listSnap.data() as ListDocument;

  // Check if user is already a member
  if (listData.memberEmails.includes(userEmail)) {
    return listId; // Already a member
  }

  // Add user to the list
  await updateDoc(listRef, {
    memberEmails: arrayUnion(userEmail)
  });

  return listId;
};

export const deleteList = async (listId: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, listId));
};

export const subscribeToLists = (userId: string, email: string | null, callback: (lists: ListDocument[]) => void) => {
  if (!email) {
    callback([]);
    return () => {};
  }

  // Query lists where the user is a member (by email)
  const q = query(
    collection(db, COLLECTION_NAME), 
    where('memberEmails', 'array-contains', email)
  );

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const lists: ListDocument[] = [];
    querySnapshot.forEach((doc) => {
      lists.push(doc.data() as ListDocument);
    });
    // Sort client-side to avoid complex Firestore composite indexes for now
    lists.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    callback(lists);
  }, (error) => {
    console.error("Error fetching lists from Firestore:", error);
  });

  return unsubscribe;
};