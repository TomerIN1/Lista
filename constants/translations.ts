import { Language } from '../types';

export const TRANSLATIONS = {
  en: {
    header: {
      subtitle: "Transform your chaotic thoughts into beautifully organized lists instantly using AI.",
      highlight: "beautifully organized lists",
      login: "Sign in with Google",
      logout: "Sign Out"
    },
    input: {
      listNamePlaceholder: "List Name (e.g. Weekly Groceries)",
      textPlaceholder: "e.g. Apples, Milk, Bread, Laundry detergent, Eggs, Cheese, Batteries...",
      cmdEnter: "CMD + Enter",
      clear: "Clear",
      new: "New",
      replace: "Replace",
      processing: "Processing...",
      addItems: "Add Items",
      organize: "Organize"
    },
    result: {
      listNameLabel: "List Name",
      defaultTitle: "Organized List",
      copyAll: "Copy All",
      copied: "Copied",
      emptyCategory: "Empty category",
      addItemPlaceholder: "Add an item...",
      loginToCopy: "Sign in to Copy",
      loginToShare: "Sign in to Share",
      createdBy: "This list created by Lista",
      openSharedList: "Open shared list:"
    },
    sidebar: {
      myLists: "My Lists",
      createNew: "Create New List",
      noLists: "No lists yet. Create one!",
      categories: "categories",
      shared: "Shared",
      private: "Private",
      deleteConfirm: "Are you sure you want to delete this list?",
      loginTitle: "Sign in",
      loginDesc: "Sign in to save and manage your lists across devices."
    },
    share: {
      title: "Share List",
      inviteLabel: "Invite by Email",
      placeholder: "friend@example.com",
      inviteBtn: "Invite",
      sent: "Invitation sent",
      failed: "Failed to share",
      currentMembers: "Current Members"
    },
    accessibilityMenu: {
      title: "Accessibility",
      reset: "Reset",
      textSize: "Text Size",
      displayMode: "Display Mode",
      modes: {
        normal: "Normal",
        contrast: "Contrast",
        dark: "Dark"
      },
      reduceMotion: "Reduce Motion"
    },
    footer: {
      rights: "Lista App. All rights reserved.",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      accessibility: "Accessibility"
    },
    auth: {
      welcome: "Welcome",
      intro: "Select a list from the sidebar or create a new one to get started.",
      createBtn: "Create New List",
      guest: "Guest Mode",
      guestAlert: "You are in Guest Mode. Lists will not be saved."
    },
    errors: {
      organizeFailed: "Failed to organize list.",
      createFailed: "Failed to create list.",
      addFailed: "Failed to add items."
    }
  },
  he: {
    header: {
      subtitle: "הפוך את המחשבות המפוזרות שלך לרשימות מסודרות באמצעות AI.",
      highlight: "רשימות מסודרות",
      login: "התחבר עם Google",
      logout: "התנתק"
    },
    input: {
      listNamePlaceholder: "שם הרשימה (לדוגמה: קניות לשבת)",
      textPlaceholder: "למשל: תפוחים, חלב, לחם, אבקת כביסה, ביצים, גבינה...",
      cmdEnter: "CMD + Enter",
      clear: "נקה",
      new: "חדש",
      replace: "החלף",
      processing: "מעבד...",
      addItems: "הוסף פריטים",
      organize: "סדר לי"
    },
    result: {
      listNameLabel: "שם הרשימה",
      defaultTitle: "רשימה מסודרת",
      copyAll: "העתק הכל",
      copied: "הועתק",
      emptyCategory: "קטגוריה ריקה",
      addItemPlaceholder: "הוסף פריט...",
      loginToCopy: "התחבר כדי להעתיק",
      loginToShare: "התחבר כדי לשתף",
      createdBy: "רשימה זו נוצרה ע״י Lista",
      openSharedList: "פתח רשימה משותפת:"
    },
    sidebar: {
      myLists: "הרשימות שלי",
      createNew: "צור רשימה חדשה",
      noLists: "אין עדיין רשימות. צור אחת!",
      categories: "קטגוריות",
      shared: "משותף",
      private: "פרטי",
      deleteConfirm: "האם אתה בטוח שברצונך למחוק רשימה זו?",
      loginTitle: "התחבר",
      loginDesc: "התחבר כדי לשמור ולנהל את הרשימות שלך מכל מכשיר."
    },
    share: {
      title: "שתף רשימה",
      inviteLabel: "הזמן במייל",
      placeholder: "friend@example.com",
      inviteBtn: "הזמן",
      sent: "ההזמנה נשלחה",
      failed: "השיתוף נכשל",
      currentMembers: "חברים ברשימה"
    },
    accessibilityMenu: {
      title: "נגישות",
      reset: "איפוס",
      textSize: "גודל טקסט",
      displayMode: "מצבי תצוגה",
      modes: {
        normal: "רגיל",
        contrast: "ניגודיות",
        dark: "כהה"
      },
      reduceMotion: "הפחתת תנועה"
    },
    footer: {
      rights: "Lista App. כל הזכויות שמורות.",
      privacy: "מדיניות פרטיות",
      terms: "תנאי שימוש",
      accessibility: "הצהרת נגישות"
    },
    auth: {
      welcome: "ברוכים הבאים",
      intro: "בחר רשימה מהתפריט או צור רשימה חדשה כדי להתחיל.",
      createBtn: "צור רשימה חדשה",
      guest: "מצב אורח",
      guestAlert: "אתה במצב אורח. הרשימות לא יישמרו."
    },
    errors: {
      organizeFailed: "נכשל בסידור הרשימה.",
      createFailed: "נכשל ביצירת הרשימה.",
      addFailed: "נכשל בהוספת הפריטים."
    }
  }
};

export const UNITS_TRANSLATIONS = {
  en: {
    'pcs': 'pcs',
    'g': 'g',
    'kg': 'kg',
    'L': 'L',
    'ml': 'ml'
  },
  he: {
    'pcs': 'יח׳',
    'g': 'גרם',
    'kg': 'ק״ג',
    'L': 'ליטר',
    'ml': 'מ״ל'
  }
};