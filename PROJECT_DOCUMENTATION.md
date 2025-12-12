# Lista - AI List Organizer

## Table of Contents
- [Overview](#overview)
- [Project Description](#project-description)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Core Components](#core-components)
- [Services](#services)
- [Context Providers](#context-providers)
- [Data Models](#data-models)
- [User Flow](#user-flow)
- [Setup and Installation](#setup-and-installation)
- [Configuration](#configuration)
- [Development](#development)
- [Deployment](#deployment)

---

## Overview

**Lista** is an intelligent AI-powered list organization application that transforms chaotic, unstructured text into beautifully organized, categorized lists. Built as a Progressive Web App (PWA), Lista uses Google's Gemini AI to automatically categorize items, generate category icons, and provide a seamless user experience for managing shopping lists, to-do items, and any other list-based content.

---

## Project Description

Lista solves the common problem of managing disorganized lists by leveraging AI to:
1. **Parse unstructured text** (comma-separated, space-separated, or newline-separated items)
2. **Intelligently categorize items** into logical groups
3. **Generate visual icons** for each category using AI image generation
4. **Provide collaborative features** for sharing lists with others
5. **Support offline functionality** through PWA capabilities

The application supports both authenticated users (via Google Sign-In) and guest users, with authenticated users getting cloud storage and collaboration features through Firebase Firestore.

---

## Key Features

### 🤖 AI-Powered Organization
- Automatically categorizes items using Gemini 2.5 Flash
- Generates beautiful 3D-style category icons using Gemini Image
- Smart category merging when adding items to existing lists
- Support for multiple languages (English & Hebrew)

### 👥 User Management
- Google OAuth authentication via Firebase
- Guest mode for trying the app without login
- User profile management with photo display

### 📋 List Management
- Create multiple lists
- Edit list titles and content
- Add items to existing categories
- Check off completed items
- Delete categories or individual items
- Real-time synchronization across devices

### 🤝 Collaboration
- Share lists with other users via email
- Real-time updates for shared lists
- Member management

### ♿ Accessibility
- Font size adjustment (80%-150%)
- Display modes: Normal, Dark, High Contrast
- Reduce motion option
- RTL (Right-to-Left) support for Hebrew
- ARIA labels and semantic HTML

### 📱 Progressive Web App
- Installable on mobile and desktop
- Offline support via Service Worker
- Responsive design for all screen sizes
- Native app-like experience

---

## Technology Stack

### Frontend
- **React 19.2.2** - UI framework
- **TypeScript 5.8.2** - Type safety
- **Vite 6.2.0** - Build tool and dev server
- **Tailwind CSS** (via inline styles) - Styling

### AI & Backend Services
- **Google Gemini AI (genai 1.33.0)**
  - Gemini 2.5 Flash - Text categorization
  - Gemini 2.5 Flash Image - Icon generation
- **Firebase 12.6.0**
  - Firebase Authentication - Google OAuth
  - Firestore - Database for lists
  - Offline persistence

### UI Components & Icons
- **Lucide React 0.560.0** - Icon library

### Development Tools
- **@vitejs/plugin-react 5.0.0** - React plugin for Vite
- **@types/node 22.14.0** - Node type definitions

---

## Project Structure

```
Lista/
├── lista/
│   ├── components/           # React components
│   │   ├── AccessibilityMenu.tsx    # Accessibility controls
│   │   ├── CategoryCard.tsx         # Category display with items
│   │   ├── CategoryItem.tsx         # Individual item component
│   │   ├── Footer.tsx              # App footer with legal links
│   │   ├── Header.tsx              # App header with user controls
│   │   ├── InfoModal.tsx           # Generic modal for info display
│   │   ├── InputArea.tsx           # Main input for lists
│   │   ├── Logo.tsx                # App logo component
│   │   ├── ResultCard.tsx          # Display organized results
│   │   ├── ShareModal.tsx          # Share list with others
│   │   └── Sidebar.tsx             # List navigation sidebar
│   │
│   ├── constants/           # Static data and translations
│   │   ├── legalText.ts    # Privacy policy, terms, etc.
│   │   └── translations.ts # i18n strings (English & Hebrew)
│   │
│   ├── contexts/           # React context providers
│   │   ├── AccessibilityContext.tsx  # Accessibility settings
│   │   └── LanguageContext.tsx       # Language & i18n
│   │
│   ├── services/           # External service integrations
│   │   ├── firestoreService.ts      # Firestore CRUD operations
│   │   └── geminiService.ts         # Gemini AI integration
│   │
│   ├── App.tsx             # Main application component
│   ├── firebase.ts         # Firebase initialization
│   ├── index.html          # HTML entry point
│   ├── index.tsx           # React entry point
│   ├── manifest.json       # PWA manifest
│   ├── metadata.json       # App metadata
│   ├── package.json        # Dependencies
│   ├── service-worker.js   # PWA service worker
│   ├── tsconfig.json       # TypeScript configuration
│   ├── types.ts            # TypeScript type definitions
│   └── vite.config.ts      # Vite configuration
│
├── .git/                   # Git repository
└── README.md              # Setup instructions
```

---

## Architecture

### Application Flow

```
User Input → AI Processing → Firestore Storage → Real-time Sync
     ↓
Guest Mode ────────────────────────→ Local State Only
     ↓
Authenticated ──→ Create/Update List ──→ Cloud Storage
```

### Data Flow

1. **Input Phase**: User enters unstructured text
2. **AI Processing**: Gemini AI organizes items into categories
3. **Icon Generation**: Gemini Image creates category icons
4. **Storage**:
   - Guest: Local React state only
   - Authenticated: Firestore + Local state
5. **Real-time Updates**: Firestore subscriptions update UI

### Authentication Flow

```
App Load → Check Auth State
    ↓
    ├─→ Logged In → Subscribe to user's lists
    └─→ Guest → Show welcome / Allow guest mode
```

---

## Core Components

### App.tsx (Main Component)
**Location**: `lista/App.tsx`

The root component that orchestrates the entire application.

**Responsibilities**:
- Authentication state management
- List CRUD operations
- Active list selection
- Guest vs authenticated mode handling
- Sidebar and modal state

**Key State**:
```typescript
- user: UserProfile | null          // Current user
- lists: ListDocument[]             // All user lists
- activeListId: string | null       // Currently selected list
- localGroups: CategoryGroup[]      // Current list data
- status: OrganizeStatus           // Loading state
```

**Key Functions**:
- `handleOrganize()` - Process new list with AI
- `handleAddItems()` - Add items to existing list
- `handleShare()` - Share list with email
- `handleDeleteList()` - Remove list
- `generateIconsForGroups()` - Async icon generation

---

### Header.tsx
**Location**: `lista/components/Header.tsx`

Displays app branding, user profile, and authentication controls.

**Features**:
- Logo and app title
- User profile photo and name
- Login/Logout buttons
- Language switcher (EN/HE)
- Accessibility menu toggle

---

### InputArea.tsx
**Location**: `lista/components/InputArea.tsx`

Main input interface for creating and modifying lists.

**Features**:
- List name input field
- Large textarea for items
- Context-aware actions:
  - **New List**: "Organize" button with AI sparkle
  - **Existing List**: "Add Items" button
  - "Replace" button to re-organize
  - "Clear" and "New List" utilities
- Keyboard shortcuts (Cmd/Ctrl + Enter)
- Loading states with animations

---

### ResultCard.tsx
**Location**: `lista/components/ResultCard.tsx`

Displays the organized list with all categories.

**Features**:
- Grid layout of CategoryCard components
- Export functionality (text, JSON)
- Print view
- Share button (authenticated users)
- Delete list option

---

### CategoryCard.tsx
**Location**: `lista/components/CategoryCard.tsx`

Individual category display with items.

**Features**:
- AI-generated category icon
- Item count badge
- List of CategoryItem components
- Add new item input
- Delete category button (on hover)
- Smooth hover animations

---

### CategoryItem.tsx
**Location**: `lista/components/CategoryItem.tsx`

Individual list item with editing capabilities.

**Features**:
- Checkbox for completion
- Inline name editing
- Amount and unit selection
- Strike-through for completed items
- Delete button
- Quantity controls

---

### Sidebar.tsx
**Location**: `lista/components/Sidebar.tsx`

Navigation panel for managing multiple lists.

**Features**:
- List of all user lists
- Active list highlighting
- Create new list button
- Delete list action
- Login prompt for guests
- Responsive drawer on mobile

---

### ShareModal.tsx
**Location**: `lista/components/ShareModal.tsx`

Modal for sharing lists with other users.

**Features**:
- Email input for sharing
- List of current members
- Validation
- Close/submit actions

---

### AccessibilityMenu.tsx
**Location**: `lista/components/AccessibilityMenu.tsx`

Floating accessibility controls.

**Features**:
- Font size slider (80%-150%)
- Display mode selector (Normal/Dark/High Contrast)
- Reduce motion toggle
- Reset to defaults
- Persistent settings (via context)

---

## Services

### geminiService.ts
**Location**: `lista/services/geminiService.ts`

Handles all AI interactions with Google Gemini.

#### Functions

**`organizeList(inputList: string, language: Language, existingCategories?: string[])`**
- **Purpose**: Categorize unstructured text into organized groups
- **AI Model**: `gemini-2.5-flash`
- **Input**: Raw text, language preference, optional existing categories
- **Output**: Array of `CategoryGroup` objects
- **Features**:
  - Structured JSON output via schema
  - Language-aware categorization
  - Category reuse for existing lists
  - Automatic item parsing with units

**`generateCategoryImage(category: string)`**
- **Purpose**: Generate 3D icon for category
- **AI Model**: `gemini-2.5-flash-image`
- **Input**: Category name
- **Output**: Base64 data URI of generated image
- **Features**:
  - Minimalist, colorful, 3D style
  - Pastel backgrounds
  - High quality vector art style

---

### firestoreService.ts
**Location**: `lista/services/firestoreService.ts`

Manages all Firestore database operations.

#### Functions

**`createList(title, ownerId, ownerEmail)`**
- Creates new list document
- Returns list ID

**`updateListGroups(listId, groups)`**
- Updates list categories and items
- Updates timestamp

**`updateListTitle(listId, title)`**
- Renames list

**`shareList(listId, email)`**
- Adds email to `memberEmails` array
- Enables access for shared user

**`deleteList(listId)`**
- Removes list document

**`subscribeToLists(userId, email, callback)`**
- Real-time subscription to user's lists
- Filters by `memberEmails` array-contains
- Sorts by `updatedAt` descending
- Returns unsubscribe function

---

## Context Providers

### LanguageContext
**Location**: `lista/contexts/LanguageContext.tsx`

Manages app language and translations.

**State**:
- `language`: 'en' | 'he'
- `isRTL`: boolean (right-to-left mode)

**Functions**:
- `t(path)`: Translation function for nested keys
- `tUnit(unit)`: Translate unit names
- `setLanguage(lang)`: Change app language

**Features**:
- Updates HTML `dir` and `lang` attributes
- Supports nested translation keys
- Fallback to key if translation missing

---

### AccessibilityContext
**Location**: `lista/contexts/AccessibilityContext.tsx`

Manages accessibility settings.

**State**:
- `fontSize`: 80-150 (percentage)
- `displayMode`: 'normal' | 'dark' | 'high-contrast'
- `reduceMotion`: boolean

**Functions**:
- `setFontSize(size)`: Update font size
- `setDisplayMode(mode)`: Change display mode
- `setReduceMotion(reduce)`: Toggle animations
- `resetDefaults()`: Reset all settings

**Features**:
- Applies settings to `document.documentElement`
- CSS classes for modes
- Persists during session

---

## Data Models

### TypeScript Types
**Location**: `lista/types.ts`

#### Item
```typescript
interface Item {
  id: string;           // UUID
  name: string;         // Item name
  checked: boolean;     // Completion status
  amount: number;       // Quantity
  unit: Unit;          // 'pcs' | 'g' | 'kg' | 'L' | 'ml'
}
```

#### CategoryGroup
```typescript
interface CategoryGroup {
  id: string;              // UUID
  category: string;        // Category name
  items: Item[];          // Array of items
  imageUrl?: string;      // AI-generated icon (base64)
}
```

#### ListDocument
```typescript
interface ListDocument {
  id: string;              // Firestore document ID
  title: string;           // List name
  ownerId: string;         // Creator's UID
  memberEmails: string[];  // Shared with users
  groups: CategoryGroup[]; // Organized categories
  createdAt?: number;      // Timestamp
  updatedAt?: number;      // Timestamp
}
```

#### UserProfile
```typescript
interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
```

---

## User Flow

### Guest User Flow
1. **Landing Page**: Welcome screen with "Login" or "Try as Guest"
2. **Guest Mode**: Click "Try as Guest"
3. **Input**: Enter unstructured list
4. **AI Processing**: Gemini organizes items
5. **View Results**: See categorized list with icons
6. **Add Items**: Can add more items to existing categories
7. **Limitations**:
   - No persistence (lost on refresh)
   - Cannot save or share
   - Prompted to login for full features

### Authenticated User Flow
1. **Login**: Click "Login with Google"
2. **Authorization**: Firebase Google OAuth popup
3. **Sidebar**: See all lists or create new one
4. **Create/Edit**:
   - Create new list
   - Edit existing list
   - Add items to categories
5. **Collaboration**: Share list via email
6. **Sync**: Changes sync in real-time across devices
7. **Persistence**: Lists saved to Firestore

### List Organization Flow
1. **Input Text**: Enter items (e.g., "apples, milk, shampoo, bread")
2. **AI Categorization**:
   - Gemini parses and categorizes
   - Returns JSON with categories and items
3. **Icon Generation**:
   - Async generation for each category
   - Updates UI as icons load
4. **Display**: Shows organized categories in grid
5. **Interaction**:
   - Check off items
   - Edit quantities/units
   - Add/delete items
   - Delete categories

---

## Setup and Installation

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**
- **Firebase Project** (for authentication and database)
- **Google Gemini API Key**

### Step 1: Clone Repository
```bash
git clone <repository-url>
cd Lista/lista
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables

Create a `.env.local` file in the `lista/` directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
FIREBASE_API_KEY=your_firebase_api_key
```

### Step 4: Configure Firebase

Edit `lista/firebase.ts` with your Firebase project credentials:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

**Get these values from**:
- Firebase Console → Project Settings → General → Your Apps

### Step 5: Run Development Server
```bash
npm run dev
```

App will be available at `http://localhost:3000`

---

## Configuration

### Firebase Setup

1. **Create Firebase Project**: https://console.firebase.google.com
2. **Enable Authentication**:
   - Go to Authentication → Sign-in method
   - Enable Google provider
3. **Create Firestore Database**:
   - Go to Firestore Database → Create database
   - Start in production mode
   - Choose region
4. **Configure Security Rules** (in Firestore Rules tab):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /lists/{listId} {
      allow read, write: if request.auth != null &&
        request.auth.token.email in resource.data.memberEmails;
      allow create: if request.auth != null;
    }
  }
}
```

### Gemini API Setup

1. **Get API Key**: https://ai.google.dev/
2. **Enable Models**:
   - Gemini 2.5 Flash (text)
   - Gemini 2.5 Flash Image (image generation)
3. **Add to `.env.local`**: `GEMINI_API_KEY=your_key`

---

## Development

### Available Scripts

```bash
npm run dev      # Start development server (port 3000)
npm run build    # Build for production
npm run preview  # Preview production build
```

### Development Server
- **Host**: `0.0.0.0` (accessible on local network)
- **Port**: `3000`
- **Hot Reload**: Enabled via Vite

### Environment Variables in Code

Accessed via `process.env`:
- `process.env.API_KEY` - Gemini API key
- `process.env.GEMINI_API_KEY` - Alternative reference
- `process.env.FIREBASE_API_KEY` - Firebase config (if used)

Configured in `vite.config.ts`:
```typescript
define: {
  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
}
```

---

## Deployment

### Build for Production

```bash
npm run build
```

Outputs to `dist/` directory.

### Deployment Options

#### Option 1: Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

#### Option 2: Vercel
```bash
npm install -g vercel
vercel
```

#### Option 3: Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Environment Variables in Production

Set these in your hosting platform:
- `GEMINI_API_KEY`
- `FIREBASE_API_KEY` (if different from code)

### Service Worker

The PWA service worker (`service-worker.js`) is automatically registered in production. It handles:
- **Caching strategy**: Network-first for HTML, stale-while-revalidate for assets
- **Offline support**: Falls back to cached index.html
- **Cache management**: Cleans up old caches on activation

---

## PWA Features

### Manifest (manifest.json)

```json
{
  "name": "Lista - AI List Organizer",
  "short_name": "Lista",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FAFAFA",
  "theme_color": "#6366F1"
}
```

### Installation
- **Desktop**: Browser will show install prompt
- **Mobile**: "Add to Home Screen" option
- **Standalone Mode**: Runs like native app

### Offline Support
- Service worker caches core files
- Firestore has offline persistence enabled
- User can view cached lists offline
- Changes sync when back online

---

## Key Features Deep Dive

### AI Categorization Algorithm

The Gemini AI uses structured output to ensure consistent JSON:

```typescript
responseSchema: {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING },
      items: { type: Type.ARRAY, items: { type: Type.STRING } }
    }
  }
}
```

**Language Support**:
- Detects language context
- Provides language-specific category names
- Handles RTL languages (Hebrew)

**Smart Merging**:
- When adding items to existing list
- AI receives `existingCategories` array
- Prioritizes reusing categories
- Merges items into existing groups in client code

### Real-time Collaboration

Firestore query for shared lists:
```typescript
where('memberEmails', 'array-contains', userEmail)
```

**How it works**:
1. List owner shares via email
2. Email added to `memberEmails` array
3. Recipient's query automatically includes shared list
4. Real-time updates via `onSnapshot` listener
5. Both users see changes instantly

### Accessibility Implementation

**Font Scaling**:
```typescript
document.documentElement.style.fontSize = `${fontSize}%`;
```

**Display Modes**:
- Normal: Default styling
- Dark: `.dark-mode` class on `<html>`
- High Contrast: `.high-contrast` class

**Reduce Motion**:
- Adds `.reduce-motion` class
- CSS can disable animations:
```css
.reduce-motion * {
  animation: none !important;
  transition: none !important;
}
```

---

## Troubleshooting

### Common Issues

**1. Firebase Permission Denied**
- Check Firestore security rules
- Ensure user is authenticated
- Verify `memberEmails` includes user

**2. Gemini API Errors**
- Verify API key is correct in `.env.local`
- Check quota limits
- Ensure models are enabled

**3. Service Worker Not Updating**
- Clear browser cache
- Unregister old service worker
- Hard refresh (Cmd/Ctrl + Shift + R)

**4. Icons Not Generating**
- Check browser console for errors
- Verify Gemini Image model access
- Check network requests

---

## Future Enhancements

Potential features for future development:

1. **Templates**: Pre-made list templates (grocery, packing, etc.)
2. **Recurring Lists**: Auto-create weekly/monthly lists
3. **Smart Suggestions**: AI suggests items based on history
4. **Voice Input**: Speak lists instead of typing
5. **Export Formats**: CSV, PDF export
6. **Mobile Apps**: Native iOS/Android versions
7. **Integrations**: Import from notes apps, calendar
8. **Analytics**: Track completion rates, popular items

---

## License & Legal

- **Privacy Policy**: Available in app footer
- **Terms of Service**: Available in app footer
- **Data Storage**: Firebase (Google Cloud)
- **AI Processing**: Google Gemini API

---

## Contact & Support

For issues or questions about this project:
- Check the README.md in the repository
- Review Firebase and Gemini API documentation
- Consult the AI Studio link: https://ai.studio/apps/temp/2

---

**Generated**: 2025-12-12
**Version**: 1.0
**Project**: Lista - AI List Organizer
