import React, { useState, useEffect } from 'react';
import { OrganizeStatus, CategoryGroup, UserProfile, ListDocument, Recipe, InputMode } from './types';
import { organizeList, organizeRecipes, generateCategoryImage } from './services/geminiService';
import { createList, subscribeToLists, updateListGroups, updateListGroupsAndRecipes, updateListTitle, shareList, deleteList, joinSharedList } from './services/firestoreService';
import { auth, signInWithGoogle, logout } from './firebase';

import Header from './components/Header';
import InputArea from './components/InputArea';
import ResultCard from './components/ResultCard';
import Sidebar from './components/Sidebar';
import ShareModal from './components/ShareModal';
import Footer from './components/Footer';
import InfoModal from './components/InfoModal';
import { LEGAL_TEXT, LegalDocType } from './constants/legalText';
import { useLanguage } from './contexts/LanguageContext';

import { AlertCircle, Sparkles, Menu, ShieldAlert } from 'lucide-react';

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pendingShareListId, setPendingShareListId] = useState<string | null>(null);

  // App State
  const [status, setStatus] = useState<OrganizeStatus>('idle');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // List Management
  const [lists, setLists] = useState<ListDocument[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Active List Data (Derived or Local state for immediate edits)
  const activeList = lists.find(l => l.id === activeListId);
  const [localGroups, setLocalGroups] = useState<CategoryGroup[]>([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Recipe Mode State
  const [inputMode, setInputMode] = useState<InputMode>('items');
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  // Legal Modal State
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType | null>(null);

  // Language Context
  const { language, t } = useLanguage();

  // Check for share link on mount
  useEffect(() => {
    const path = window.location.pathname;
    const shareMatch = path.match(/^\/share\/(.+)$/);
    if (shareMatch) {
      const listId = shareMatch[1];
      setPendingShareListId(listId);
    }
  }, []);

  // Auth Subscription
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL
        });
      } else {
        setUser(null);
        setLists([]);
        setActiveListId(null);
        setLocalGroups([]);
        setStatus('idle');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore List Subscription
  useEffect(() => {
    if (!user || !user.email) return;
    const unsubscribe = subscribeToLists(user.uid, user.email, (updatedLists) => {
      setLists(updatedLists);
    });
    return () => unsubscribe();
  }, [user]);

  // Handle pending share list after user logs in
  useEffect(() => {
    const handlePendingShare = async () => {
      if (user && user.email && pendingShareListId) {
        try {
          console.log('Attempting to join list:', pendingShareListId, 'with email:', user.email);

          // Small delay to ensure user is fully authenticated
          await new Promise(resolve => setTimeout(resolve, 500));

          await joinSharedList(pendingShareListId, user.email);
          console.log('Successfully joined list:', pendingShareListId);

          setActiveListId(pendingShareListId);
          setPendingShareListId(null);
          // Clear the URL path
          window.history.replaceState({}, '', '/');
        } catch (err: any) {
          console.error('Failed to join shared list:', err);
          console.error('Error details:', err.message, err.code);
          setError(`Failed to access shared list: ${err.message || 'Unknown error'}`);
          setPendingShareListId(null);
          window.history.replaceState({}, '', '/');
        }
      }
    };

    handlePendingShare();
  }, [user, pendingShareListId]);

  // Sync active list change when selection changes or lists update
  useEffect(() => {
    if (activeListId && user) {
      const current = lists.find(l => l.id === activeListId);
      if (current) {
        setLocalGroups(current.groups);
        setInputMode(current.inputMode || 'items');
        setRecipes(current.recipes || []);
        setStatus(current.groups.length > 0 ? 'success' : 'idle');
      }
    } else if (!user) {
      // Guest mode: Don't reset localGroups immediately if organizing
      if (status === 'idle') {
        setLocalGroups([]);
        setRecipes([]);
        setInputMode('items');
      }
    }
  }, [activeListId, lists, user]);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
      setError("Login failed");
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleCreateList = async () => {
    if (!user) {
      handleLogin();
      return;
    }
    try {
      const newId = await createList("New List", user.uid, user.email || '');
      setActiveListId(newId);
      setStatus('idle');
    } catch (e) {
      console.error(e);
      setError(t('errors.createFailed'));
    }
  };

  const generateIconsForGroups = (groupsToProcess: CategoryGroup[], listId: string | null) => {
    groupsToProcess.forEach(async (group) => {
      if (!group.imageUrl) {
        const imageUrl = await generateCategoryImage(group.category);
        if (imageUrl) {
          setLocalGroups(prev => {
             const newGroups = prev.map(g => g.id === group.id ? { ...g, imageUrl } : g);
             // Only save to DB if logged in and we have a list ID
             if (listId && user) {
               updateListGroups(listId, newGroups).catch(console.error);
             }
             return newGroups;
          });
        }
      }
    });
  };

  const handleOrganize = async (text: string, name: string) => {
    setStatus('loading');
    setError(null);
    
    try {
      let targetListId = activeListId;

      // Logic: 
      // If User: Create list in DB immediately if not exists.
      // If Guest: Just organize in memory.

      if (user) {
        if (!targetListId) {
          targetListId = await createList(name || "New List", user.uid, user.email || '');
          setActiveListId(targetListId);
        } else if (name && activeList?.title !== name) {
          await updateListTitle(targetListId, name);
        }
      }

      const result = await organizeList(text, language);
      
      // Update State
      setLocalGroups(result);
      
      if (user && targetListId) {
        await updateListGroups(targetListId, result);
        generateIconsForGroups(result, targetListId);
      } else {
        // Guest: generate icons but don't save to DB
        generateIconsForGroups(result, null);
      }
      
      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setError(t('errors.organizeFailed'));
      setStatus('error');
    }
  };

  const handleAddItems = async (text: string) => {
    setIsAdding(true);
    setError(null);

    try {
      const existingCategories = localGroups.map(g => g.category);
      const newGroups = await organizeList(text, language, existingCategories);
      
      const updatedGroups = [...localGroups];
      const groupsForIcon: CategoryGroup[] = [];

      newGroups.forEach(newGroup => {
        const existingIndex = updatedGroups.findIndex(g => 
          g.category.toLowerCase() === newGroup.category.toLowerCase()
        );

        if (existingIndex >= 0) {
          updatedGroups[existingIndex] = {
            ...updatedGroups[existingIndex],
            items: [...updatedGroups[existingIndex].items, ...newGroup.items]
          };
        } else {
          updatedGroups.push(newGroup);
          groupsForIcon.push(newGroup);
        }
      });

      setLocalGroups(updatedGroups);

      if (user && activeListId) {
        await updateListGroups(activeListId, updatedGroups);
        if (groupsForIcon.length > 0) {
          generateIconsForGroups(groupsForIcon, activeListId);
        }
      } else {
         if (groupsForIcon.length > 0) {
          generateIconsForGroups(groupsForIcon, null);
        }
      }

    } catch (err) {
      console.error(err);
      setError(t('errors.addFailed'));
    } finally {
      setIsAdding(false);
    }
  };

  const handleOrganizeRecipes = async (recipesToOrganize: Recipe[], name: string) => {
    setStatus('loading');
    setError(null);

    try {
      let targetListId = activeListId;

      if (user) {
        if (!targetListId) {
          targetListId = await createList(name || "New Recipe List", user.uid, user.email || '');
          setActiveListId(targetListId);
        } else if (name && activeList?.title !== name) {
          await updateListTitle(targetListId, name);
        }
      }

      const result = await organizeRecipes(recipesToOrganize, language);

      setLocalGroups(result);
      setRecipes(recipesToOrganize);
      setInputMode('recipe');

      if (user && targetListId) {
        await updateListGroupsAndRecipes(targetListId, result, recipesToOrganize, 'recipe');
        generateIconsForGroups(result, targetListId);
      } else {
        generateIconsForGroups(result, null);
      }

      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setError(t('errors.organizeFailed'));
      setStatus('error');
    }
  };

  const handleAddRecipes = async (newRecipes: Recipe[]) => {
    setIsAdding(true);
    setError(null);

    try {
      const allRecipes = [...recipes, ...newRecipes];
      const existingCategories = localGroups.map(g => g.category);
      const result = await organizeRecipes(allRecipes, language, existingCategories);

      setLocalGroups(result);
      setRecipes(allRecipes);

      if (user && activeListId) {
        await updateListGroupsAndRecipes(activeListId, result, allRecipes, 'recipe');
        generateIconsForGroups(result, activeListId);
      } else {
        generateIconsForGroups(result, null);
      }
    } catch (err) {
      console.error(err);
      setError(t('errors.addFailed'));
    } finally {
      setIsAdding(false);
    }
  };

  const handleListUpdate = async (newGroups: CategoryGroup[]) => {
    setLocalGroups(newGroups);
    if (user && activeListId) {
      await updateListGroups(activeListId, newGroups);
    }
  };

  const handleDeleteList = async (id: string) => {
    // If guest, they are just clearing their temporary view
    if (!user) {
      setLocalGroups([]);
      setStatus('idle');
      return;
    }

    if (!id) return;
    
    // 1. Optimistic Update
    setLists(prevLists => prevLists.filter(l => l.id !== id));

    if (activeListId === id) {
      setActiveListId(null);
      setLocalGroups([]);
      setStatus('idle');
    }

    try {
      await deleteList(id);
    } catch (err) {
      console.error("Failed to delete list:", err);
    }
  };

  const handleShare = async (email: string) => {
    if (!activeListId || !user) return;
    await shareList(activeListId, email);
  };

  const LegalModal = () => (
    <InfoModal 
      isOpen={!!activeLegalDoc}
      onClose={() => setActiveLegalDoc(null)}
      title={activeLegalDoc ? LEGAL_TEXT[language][activeLegalDoc].title : ''}
      content={activeLegalDoc ? LEGAL_TEXT[language][activeLegalDoc].content : ''}
    />
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      <Sidebar 
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        lists={lists}
        activeListId={activeListId}
        onSelect={(l) => setActiveListId(l.id)}
        onCreate={handleCreateList}
        onDelete={handleDeleteList}
        user={user}
        onLogin={handleLogin}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative scroll-smooth">
        <div className="lg:hidden absolute top-6 start-4 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 text-slate-600">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <div className="max-w-5xl w-full mx-auto px-4 py-8 sm:px-6 sm:py-16 flex flex-col min-h-full">
          <Header 
            user={user} 
            onLogin={handleLogin} 
            onLogout={handleLogout} 
          />

          <div className="flex-1">
            {/* Show Welcome screen if Guest AND no results yet */}
            {(!user && status === 'idle') ? (
               <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                 <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-200 mb-6">
                    <Sparkles className="w-10 h-10" />
                 </div>
                 <h2 className="text-2xl font-display font-bold text-slate-800 mb-2">{t('auth.welcome')}</h2>
                 <p className="text-slate-500 max-w-sm mb-8">{t('auth.intro')}</p>
                 <div className="flex gap-4">
                   <button 
                     onClick={handleLogin}
                     className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-full shadow-lg shadow-indigo-200 transition-all"
                   >
                     {t('header.login')}
                   </button>
                   <button
                    onClick={() => setStatus('success')} // Hack to show input area for guests
                    className="px-6 py-3 bg-white text-slate-600 hover:text-indigo-600 font-medium rounded-full border border-slate-200 hover:border-indigo-200 transition-all"
                   >
                     {t('auth.guest')}
                   </button>
                 </div>
               </div>
            ) : (
              <div className="space-y-8 sm:space-y-10">
                {!user && (
                   <div className="p-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-100 flex items-center justify-center gap-2 text-sm">
                      <ShieldAlert className="w-4 h-4" />
                      {t('auth.guestAlert')}
                      <button onClick={handleLogin} className="underline font-semibold hover:text-amber-900">{t('header.login')}</button>
                   </div>
                )}

                <InputArea
                  onOrganize={handleOrganize}
                  onOrganizeRecipes={handleOrganizeRecipes}
                  onAdd={handleAddItems}
                  onAddRecipes={handleAddRecipes}
                  onReset={() => {
                    setLocalGroups([]);
                    setRecipes([]);
                    setInputMode('items');
                    setStatus('idle');
                    setActiveListId(null);
                  }}
                  isLoading={status === 'loading' || isAdding}
                  hasResults={localGroups.length > 0}
                  currentMode={inputMode}
                  currentRecipes={recipes}
                />

                {error && (
                  <div className="p-4 rounded-2xl bg-red-50/80 backdrop-blur-sm text-red-800 border border-red-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="font-medium">{error}</p>
                  </div>
                )}

                {(localGroups.length > 0) && (
                  <ResultCard
                    groups={localGroups}
                    members={activeList?.memberEmails || []}
                    setGroups={setLocalGroups}
                    title={activeList?.title}
                    listId={activeListId || 'guest-list'}
                    onShareClick={() => setIsShareModalOpen(true)}
                    onUpdateList={handleListUpdate}
                    onDeleteList={handleDeleteList}
                    isGuest={!user}
                    onLoginRequest={handleLogin}
                    recipes={recipes}
                    inputMode={inputMode}
                  />
                )}
              </div>
            )}
          </div>
          
          <div className="mt-12">
            <Footer onOpenDoc={setActiveLegalDoc} />
          </div>
        </div>
      </div>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onShare={handleShare}
        members={activeList?.memberEmails || []}
        listId={activeListId || 'guest-list'}
      />
      
      <LegalModal />
    </div>
  );
};

export default App;