# Lista - AI List Organizer

## Table of Contents
- [Overview](#overview)
- [Live Demo](#live-demo)
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
- [Local Development Setup](#local-development-setup)
- [Firebase Configuration](#firebase-configuration)
- [OpenAI Configuration](#openai-configuration)
- [Deployment to Vercel](#deployment-to-vercel)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

---

## Overview

**Lista** is an intelligent AI-powered list organization application that transforms chaotic, unstructured text into beautifully organized, categorized lists. Built as a Progressive Web App (PWA), Lista uses OpenAI's GPT-4o-mini and DALL-E 3 to automatically categorize items, generate category icons, and provide a seamless user experience for managing shopping lists, to-do items, and any other list-based content.

---

## Live Demo

**Production URL**: https://lista-six-psi.vercel.app

- Deployed on Vercel
- Automatic deployments from GitHub `main` branch
- Full PWA support with offline capabilities
- Google OAuth authentication enabled

---

## Project Description

Lista solves the common problem of managing disorganized lists by leveraging AI to:
1. **Parse unstructured text** (comma-separated, space-separated, or newline-separated items)
2. **Intelligently categorize items** into logical groups using GPT-4o-mini
3. **Generate visual icons** for each category using DALL-E 3
4. **Provide collaborative features** for sharing lists with others
5. **Support offline functionality** through PWA capabilities

The application supports both authenticated users (via Google Sign-In) and guest users, with authenticated users getting cloud storage and collaboration features through Firebase Firestore.

---

## Key Features

### 🤖 AI-Powered Organization
- Automatically categorizes items using **OpenAI GPT-4o-mini**
- Generates beautiful 3D-style category icons using **DALL-E 3**
- Smart category merging when adding items to existing lists
- Support for multiple languages (English & Hebrew)
- Context-aware categorization that remembers existing categories

### 👥 User Management
- Google OAuth authentication via Firebase
- Guest mode for trying the app without login
- User profile management with photo display
- Persistent user sessions

### 📋 List Management
- Create unlimited lists
- Edit list titles and content
- Add items to existing categories
- Check off completed items
- Delete categories or individual items
- Real-time synchronization across devices
- Import/export functionality

### 🧑‍🍳 Recipe Mode (Advanced Feature)
- **Dual Input Modes**: Switch between "Items Mode" (default) and "Recipe Mode"
- **Multiple Recipe Support**: Add up to 10 recipes with names, ingredients, and instructions
- **AI Recipe Suggestions**: Get full recipe details (ingredients + instructions) from just a recipe name
- **Smart Ingredient Combining**: Automatically merges duplicate ingredients across recipes
  - Normalizes names to singular form ("eggs" → "egg")
  - Sums quantities (2 eggs + 3 eggs = 5 eggs)
  - Combines by name + unit (separate items for different units)
- **Colored Recipe Badges**: Each item shows which recipe(s) it belongs to with color-coded labels
- **Recipe Breakdown Modal**: View original recipes with ingredients and instructions
- **Saved Recipes Library**: Save favorite recipes for reuse
  - View saved recipes instantly (no AI cost)
  - Load saved recipes into input to organize
  - Real-time sync across devices
- **Unit Conversion**: AI converts measurements (>1000ml → L, >1000g → kg)
- **Copy with Recipe Context**: Copied lists include original recipe breakdown
- **Works Offline**: Recipe mode fully functional in guest mode

### 🤝 Collaboration
- **Shareable Links**: Copy and share lists with a single link that includes full list content + join URL
- **Email Invitations**: Share lists with other users via email
- **Category Assignment**: Assign specific categories to different team members to split responsibilities
- **Real-time Synchronization**: Updates appear instantly for all members
- **Auto-Join via Share Links**: New users can click a share link, register, and automatically join the list
- **Multi-language Share Messages**: Share text respects user's language (English/Hebrew)
- **Member Management**: See all list members with avatar indicators
- **Permission-based Access Control**: Owners can delete, members can edit

### ♿ Accessibility
- Font size adjustment (80%-150%)
- Display modes: Normal, Dark, High Contrast
- Reduce motion option
- RTL (Right-to-Left) support for Hebrew
- ARIA labels and semantic HTML
- Keyboard navigation support

### 📱 Progressive Web App
- Installable on mobile and desktop
- Offline support via Service Worker
- Responsive design for all screen sizes
- Native app-like experience
- Push notifications ready (future feature)

---

## Technology Stack

### Frontend
- **React 19.2.2** - UI framework with latest features
- **TypeScript 5.8.2** - Type safety and better DX
- **Vite 6.2.0** - Lightning-fast build tool and dev server
- **Tailwind CSS** (via CDN) - Utility-first styling

### AI Services
- **OpenAI API**
  - **GPT-4o-mini** - Text categorization and list organization
  - **DALL-E 3** - Category icon generation (1024x1024 images)
- **Client-side AI calls** (dangerouslyAllowBrowser enabled for development)

### Backend Services
- **Firebase 12.6.0**
  - **Firebase Authentication** - Google OAuth
  - **Firestore Database** - Real-time NoSQL database
  - **Offline persistence** - Local caching with IndexedDB

### UI Components & Icons
- **Lucide React 0.560.0** - Beautiful, consistent icon library

### Development Tools
- **@vitejs/plugin-react 5.0.0** - React plugin for Vite
- **@types/node 22.14.0** - Node type definitions

### Deployment
- **Vercel** - Serverless deployment platform
- **GitHub** - Version control and CI/CD integration

---

## Project Structure

```
Lista/
├── .env                          # Environment variables (API keys) - NOT in git
├── .env.example                  # Template for environment variables
├── .gitignore                    # Git ignore rules
├── PROJECT_DOCUMENTATION.md      # This file
├── README.md                     # Quick start guide
│
├── package.json                  # Dependencies and scripts
├── package-lock.json            # Locked dependency versions
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite build configuration
│
├── index.html                   # HTML entry point
├── index.tsx                    # React entry point
├── App.tsx                      # Main application component
├── types.ts                     # TypeScript type definitions
│
├── firebase.ts                  # Firebase initialization
├── service-worker.js            # PWA service worker
├── manifest.json                # PWA manifest
├── metadata.json                # App metadata
│
├── components/                  # React components
│   ├── AccessibilityMenu.tsx   # Accessibility controls
│   ├── CategoryCard.tsx         # Category display
│   ├── CategoryItem.tsx         # Individual item
│   ├── Footer.tsx               # App footer
│   ├── Header.tsx               # App header
│   ├── InfoModal.tsx            # Modal dialog
│   ├── InputArea.tsx            # List input
│   ├── Logo.tsx                 # App logo
│   ├── ResultCard.tsx           # Results display
│   ├── ShareModal.tsx           # Share dialog
│   └── Sidebar.tsx              # Navigation sidebar
│
├── constants/                   # Static data
│   ├── legalText.ts            # Privacy & Terms
│   └── translations.ts         # i18n strings
│
├── contexts/                    # React contexts
│   ├── AccessibilityContext.tsx # A11y settings
│   └── LanguageContext.tsx      # i18n context
│
├── services/                    # External services
│   ├── firestoreService.ts     # Firestore operations
│   └── geminiService.ts        # OpenAI API integration
│
└── node_modules/                # Dependencies (not in git)
```

---

## Architecture

### Application Flow

```
User Input → OpenAI Processing → Firestore Storage → Real-time Sync
     ↓
Guest Mode ────────────────────────→ Local State Only
     ↓
Authenticated ──→ Create/Update List ──→ Cloud Storage + Sync
```

### Data Flow

1. **Input Phase**: User enters unstructured text (e.g., "apples, milk, bread")
2. **AI Processing**: OpenAI GPT-4o-mini organizes items into categories
3. **Icon Generation**: DALL-E 3 creates unique category icons
4. **Storage**:
   - **Guest**: Local React state only (lost on refresh)
   - **Authenticated**: Firestore + Local state (persistent)
5. **Real-time Updates**: Firestore `onSnapshot` subscriptions update UI automatically

### Authentication Flow

```
App Load → Check Firebase Auth State
    ↓
    ├─→ Logged In → Subscribe to user's lists from Firestore
    └─→ Guest → Show welcome screen / Allow guest mode
```

### API Integration

```
Frontend (Browser)
    ↓
    ├─→ OpenAI API (client-side)
    │   ├─→ GPT-4o-mini (list organization)
    │   └─→ DALL-E 3 (icon generation)
    │
    └─→ Firebase
        ├─→ Authentication (Google OAuth)
        └─→ Firestore (data storage)
```

---

## Core Components

### App.tsx (Main Component)
**Location**: `App.tsx`

The root component that orchestrates the entire application.

**Responsibilities**:
- Authentication state management
- List CRUD operations
- Active list selection
- Guest vs authenticated mode handling
- Sidebar and modal state management

**Key State**:
```typescript
- user: UserProfile | null              // Current authenticated user
- lists: ListDocument[]                 // All user's lists
- activeListId: string | null           // Currently selected list
- localGroups: CategoryGroup[]          // Current list data
- status: OrganizeStatus                // Loading state
- sidebarOpen: boolean                  // Mobile sidebar state
- isShareModalOpen: boolean             // Share modal state
```

**Key Functions**:
- `handleOrganize()` - Process new list with OpenAI
- `handleAddItems()` - Add items to existing list
- `handleShare()` - Share list via email
- `handleDeleteList()` - Remove list
- `generateIconsForGroups()` - Async DALL-E icon generation

---

### InputArea.tsx
**Location**: `components/InputArea.tsx`

Main input interface for creating and modifying lists.

**Features**:
- List name input field
- Large textarea for unstructured items
- Context-aware actions:
  - **New List**: "Organize" button with AI sparkle icon
  - **Existing List**: "Add Items" button
  - "Replace" button to re-organize entire list
  - "Clear" and "New List" utilities
- Keyboard shortcuts (Cmd/Ctrl + Enter to submit)
- Loading states with animations

**UX Details**:
- Placeholder text guides users
- Auto-resize textarea
- Disabled state during processing
- Visual feedback for all actions

---

### ResultCard.tsx
**Location**: `components/ResultCard.tsx`

Displays the organized list with all categories.

**Features**:
- Grid layout of CategoryCard components
- Export functionality:
  - Plain text format
  - JSON format (with full data)
- Print view
- Share button (authenticated users only)
- Delete list option with confirmation
- Responsive grid (1-3 columns based on screen size)

---

### CategoryCard.tsx
**Location**: `components/CategoryCard.tsx`

Individual category display with items.

**Features**:
- AI-generated category icon (DALL-E 3)
- Item count badge
- List of CategoryItem components
- Add new item input at bottom
- Delete category button (visible on hover)
- Smooth hover animations
- Loading state while icon generates

**Layout**:
- Header: Icon + Name + Count + Delete
- Body: Scrollable item list
- Footer: Add item input

---

### CategoryItem.tsx
**Location**: `components/CategoryItem.tsx`

Individual list item with full editing capabilities.

**Features**:
- Checkbox for completion status
- Inline name editing (click to edit)
- Amount and unit selection
- Strike-through for completed items
- Delete button (visible on hover)
- Quantity controls (+/- buttons)

**Supported Units**:
- pcs (pieces)
- g (grams)
- kg (kilograms)
- L (liters)
- ml (milliliters)

---

### Sidebar.tsx
**Location**: `components/Sidebar.tsx`

Navigation panel for managing multiple lists.

**Features**:
- List of all user lists (sorted by update time)
- Active list highlighting
- Create new list button
- Delete list action with confirmation
- Login prompt for guests
- Responsive drawer on mobile
- Close on outside click (mobile)
- **Saved Recipes Section**: Collapsible list of saved recipes with:
  - Real-time Firestore subscription
  - View recipe button (opens modal, no AI cost)
  - Use recipe button (loads into input for organizing)
  - Delete recipe with confirmation
  - RTL support for Hebrew

**States**:
- Open/closed animation
- Loading states
- Empty state for no lists
- Recipe section expanded/collapsed

---

### RecipeInputCard.tsx
**Location**: `components/RecipeInputCard.tsx`

Advanced input interface for recipe mode with multiple recipe support.

**Features**:
- **Mode Toggle**: Switch between "Items Mode" and "Recipe Mode"
- **Multiple Recipes**: Add up to 10 recipes per list
- **Recipe Fields**:
  - Recipe name input
  - Ingredients textarea
  - Instructions textarea (optional)
- **AI Suggestions**:
  - "AI Suggest" button - generates ingredients only
  - "AI Suggest Full Recipe" button - generates ingredients + instructions
  - Loading states during AI generation
- **Recipe Management**:
  - Add/remove recipe forms dynamically
  - Save recipe button (stores to Firestore)
  - Organize recipes button
- **Validation**: Requires recipe name and ingredients at minimum
- **Keyboard Shortcuts**: Cmd/Ctrl + Enter to organize

**UX Details**:
- Auto-resize textareas
- Clear visual separation between recipes
- Numbered recipe headers (Recipe 1, Recipe 2, etc.)
- Loading states with spinner animations
- Error handling for AI suggestions

---

### RecipeBreakdownModal.tsx
**Location**: `components/RecipeBreakdownModal.tsx`

Modal component for viewing recipe details with ingredients and instructions.

**Features**:
- **Full-screen modal** with backdrop blur
- **Recipe display**:
  - Numbered recipe headers with color-coded badges
  - Ingredients section (plain text)
  - Instructions section (plain text, shown if available)
- **Close actions**:
  - Close button in header
  - Click outside to close
  - Escape key to close
- **Responsive design**: Max-width container, scrollable content
- **Internationalization**: All text translated (English/Hebrew)

**Used In**:
- ResultCard.tsx - "View Recipes" button when in recipe mode
- Sidebar.tsx - "View" button for saved recipes

**Props**:
```typescript
{
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
}
```

---

### RecipeBadge.tsx
**Location**: `components/RecipeBadge.tsx`

Small colored badge component showing recipe labels on items.

**Features**:
- **Color-coded**: Each recipe gets a unique, deterministic color
- **Compact display**: Shows recipe initials (e.g., "PS" for "Pasta Salad")
- **Tooltip**: Hover shows full recipe name
- **Multiple badges**: Items from multiple recipes show multiple badges

**Color Generation**:
- Uses deterministic hash of recipe name
- Generates HSL color (varying hue, consistent saturation/lightness)
- Same recipe always gets same color across sessions

**Example**:
```typescript
// Item from "Pasta Salad" and "Caesar Salad"
<RecipeBadge label={{ recipeName: "Pasta Salad", recipeId: "1" }} />
<RecipeBadge label={{ recipeName: "Caesar Salad", recipeId: "2" }} />
// Shows: [PS] [CS] in different colors
```

---

## Services

### services/geminiService.ts
**Location**: `services/geminiService.ts`

Handles all AI interactions with OpenAI.

#### Functions

**`organizeList(inputList: string, language: Language, existingCategories?: string[])`**

**Purpose**: Categorize unstructured text into organized groups

**AI Model**: `gpt-4o-mini`

**Parameters**:
- `inputList`: Raw text input from user
- `language`: 'en' or 'he' for output language
- `existingCategories`: Optional array of existing category names to prioritize

**Process**:
1. Builds system prompt with language instructions
2. Sends user input with context to GPT-4o-mini
3. Requests JSON response with specific schema
4. Parses response and creates Item objects
5. Returns CategoryGroup array

**Output Format**:
```json
{
  "categories": [
    {
      "category": "Fruits",
      "items": ["apple", "banana", "orange"]
    },
    {
      "category": "Dairy",
      "items": ["milk", "cheese"]
    }
  ]
}
```

**Features**:
- Language-aware categorization
- Category reuse for existing lists
- Automatic item parsing with default units
- Error handling with console logging

---

**`generateCategoryImage(category: string)`**

**Purpose**: Generate 3D icon for category

**AI Model**: `dall-e-3`

**Parameters**:
- `category`: Category name (e.g., "Fruits", "Dairy")

**Image Specifications**:
- **Size**: 1024x1024
- **Quality**: standard
- **Style**: "simple, aesthetic, 3D-style, colorful, minimalist"
- **Background**: "solid white or soft pastel"

**Process**:
1. Creates detailed prompt for DALL-E 3
2. Generates image
3. Returns OpenAI-hosted image URL

**Output**: Image URL (valid for ~1 hour from OpenAI)

**Error Handling**: Returns `null` on failure, allowing app to use fallback (first letter of category)

---

**`organizeRecipes(recipes: Recipe[], language: Language)`**

**Purpose**: Organize multiple recipes into a unified shopping list with smart ingredient combining

**AI Model**: `gpt-4o-mini`

**Parameters**:
- `recipes`: Array of Recipe objects with name, ingredients, and instructions
- `language`: 'en' or 'he' for output language

**Process**:
1. Sends all recipes to GPT-4o-mini
2. AI parses ingredients from natural text
3. AI categorizes items into logical groups
4. AI combines duplicate ingredients across recipes
5. AI normalizes units (>1000ml → L, >1000g → kg)
6. Returns CategoryGroup array with recipe labels

**Key Features**:
- **Smart Combining**: Merges duplicates by name + unit
  - "2 eggs" + "3 eggs" = "5 eggs"
  - Normalizes to singular form ("eggs" → "egg")
  - Separate items for different units (1L milk ≠ 100ml milk)
- **Recipe Tracking**: Each item tagged with source recipe(s)
- **Unit Conversion**: Automatic conversion of large quantities
- **Category Organization**: Groups ingredients logically (Produce, Dairy, etc.)

**Output Format**:
```json
{
  "categories": [
    {
      "category": "Produce",
      "items": [
        {
          "name": "tomato",
          "amount": 4,
          "unit": "pcs",
          "recipeLabels": [
            {"recipeName": "Pasta Sauce", "recipeId": "1"},
            {"recipeName": "Greek Salad", "recipeId": "2"}
          ]
        }
      ]
    }
  ]
}
```

---

**`suggestRecipeIngredients(recipeName: string, language: Language)`**

**Purpose**: Generate ingredient list from recipe name

**AI Model**: `gpt-4o-mini`

**Parameters**:
- `recipeName`: Name of recipe (e.g., "Chocolate Chip Cookies")
- `language`: Output language

**Process**:
1. Sends recipe name to GPT-4o-mini
2. AI generates typical ingredients with quantities
3. Returns formatted ingredient list

**Output**: String with ingredients (e.g., "2 eggs, 100g flour, 1 cup milk...")

**Use Case**: Quick recipe creation without manual ingredient entry

---

**`suggestFullRecipe(recipeName: string, language: Language)`**

**Purpose**: Generate complete recipe with ingredients and instructions

**AI Model**: `gpt-4o-mini`

**Parameters**:
- `recipeName`: Name of recipe
- `language`: Output language

**Process**:
1. Sends recipe name to GPT-4o-mini
2. AI generates ingredients with quantities
3. AI generates step-by-step instructions
4. Returns both as formatted text

**Output**:
```typescript
{
  ingredients: "2 eggs, 100g flour...",
  instructions: "Step 1: Mix ingredients...\nStep 2: Bake for 30 minutes..."
}
```

**Use Case**: Full recipe creation with minimal user input

---

**`generateRecipeColor(recipeName: string)`**

**Purpose**: Generate consistent color for recipe badges

**Algorithm**: Deterministic hash-based color generation

**Process**:
1. Creates simple hash from recipe name
2. Converts hash to hue value (0-360)
3. Returns HSL color with fixed saturation and lightness
4. Same recipe name always produces same color

**Output**: HSL color string (e.g., "hsl(240, 70%, 60%)")

**Features**:
- Deterministic: Same recipe = same color every time
- Visually distinct: Good color separation between recipes
- Consistent across sessions and devices

---

### services/firestoreService.ts
**Location**: `services/firestoreService.ts`

Manages all Firestore database operations.

**Collection**: `lists`

#### Functions

**`createList(title, ownerId, ownerEmail)`**
- Creates new list document in Firestore
- Initializes with empty groups array
- Sets timestamps (createdAt, updatedAt)
- Returns newly created list ID

**`createListWithRecipes(title, ownerId, ownerEmail, groups, recipes, mode)`**
- **Purpose**: Creates list with recipes atomically (fixes race condition)
- Creates new list document with recipes and groups in one operation
- Prevents empty list appearing in UI before recipes are added
- Sets `inputMode` to 'recipe'
- Sets timestamps (createdAt, updatedAt)
- Returns newly created list ID

**Use Case**: Used when organizing recipes to avoid race condition where Firestore subscription fires with empty list data before recipes are added

**`updateListGroups(listId, groups)`**
- Updates list categories and items
- Updates `updatedAt` timestamp
- Used when adding/removing items or categories

**`updateListGroupsAndRecipes(listId, groups, recipes, mode)`**
- Updates list with both groups and recipes
- Sets `inputMode` field
- Used when adding recipes to existing lists
- Updates `updatedAt` timestamp

**`updateListTitle(listId, title)`**
- Renames list
- Updates `updatedAt` timestamp

**`shareList(listId, email)`**
- Adds email to `memberEmails` array using `arrayUnion`
- Grants read/write access to shared user
- Checks if list exists before sharing

**`deleteList(listId)`**
- Permanently removes list document
- No undo functionality

**`subscribeToLists(userId, email, callback)`**
- Real-time subscription to user's lists
- Filters by `memberEmails` array-contains query
- Sorts by `updatedAt` descending (client-side)
- Calls callback with updated lists on any change
- Returns unsubscribe function for cleanup

**`joinSharedList(listId, userEmail)`**
- Adds a user to a shared list via share link
- Attempts direct update without reading first (for better security rule compatibility)
- Uses `arrayUnion` to prevent duplicates
- Throws specific errors for "not-found" and "permission-denied" cases
- Returns listId on success

#### Saved Recipes Functions

**`saveRecipe(userId, recipe)`**
- Saves recipe to user's personal recipe library
- Stores in `savedRecipes` subcollection under user document
- Generates unique recipe ID
- Sets timestamp
- Returns saved recipe ID

**`subscribeToSavedRecipes(userId, callback)`**
- Real-time subscription to user's saved recipes
- Listens to `savedRecipes` subcollection
- Calls callback with updated recipes array on any change
- Returns unsubscribe function for cleanup

**`deleteSavedRecipe(userId, recipeId)`**
- Permanently removes saved recipe from user's library
- Deletes document from `savedRecipes` subcollection
- No undo functionality

**Firestore Structure**:
```
users/
  {userId}/
    savedRecipes/
      {recipeId}:
        id: string
        name: string
        ingredients: string
        instructions: string
        createdAt: timestamp
```

**Firestore Security Rules** (Configure in Firebase Console):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /lists/{listId} {
      // Allow read if user is a member
      allow read: if request.auth != null &&
                     request.auth.token.email in resource.data.memberEmails;

      // Allow create if user is authenticated
      allow create: if request.auth != null;

      // Allow update if user is a member OR adding themselves to memberEmails
      allow update: if request.auth != null && (
        // Already a member - can update
        request.auth.token.email in resource.data.memberEmails ||
        // OR user is adding themselves (share link join)
        (request.auth.token.email in request.resource.data.memberEmails &&
         !(request.auth.token.email in resource.data.memberEmails))
      );

      // Allow delete if user is the owner
      allow delete: if request.auth != null &&
                       request.auth.uid == resource.data.ownerId;
    }
  }
}
```

**Important**: These security rules are essential for:
- ✅ Share link functionality (allows users to add themselves)
- ✅ Real-time collaboration (members can update lists)
- ✅ Owner-only delete permissions
- ✅ Privacy (only members can read lists)

---

## Context Providers

### LanguageContext
**Location**: `contexts/LanguageContext.tsx`

Manages app language and translations.

**Supported Languages**:
- English (`en`)
- Hebrew (`he`)

**State**:
```typescript
- language: Language              // Current language
- isRTL: boolean                 // Right-to-left mode
```

**Functions**:
```typescript
- t(path: string): string        // Translation function
- tUnit(unit: string): string    // Translate unit names
- setLanguage(lang: Language)    // Change app language
```

**Features**:
- Updates HTML `dir` attribute (ltr/rtl)
- Updates HTML `lang` attribute
- Supports nested translation keys (e.g., "header.login")
- Fallback to key if translation missing
- Persistent during session

**Example Usage**:
```typescript
const { t, language, setLanguage } = useLanguage();

<button>{t('input.organize')}</button>
// Renders: "Organize" (en) or "ארגן" (he)
```

---

### AccessibilityContext
**Location**: `contexts/AccessibilityContext.tsx`

Manages accessibility settings.

**State**:
```typescript
- fontSize: number (80-150)      // Font size percentage
- displayMode: DisplayMode       // 'normal' | 'dark' | 'high-contrast'
- reduceMotion: boolean         // Disable animations
```

**Functions**:
```typescript
- setFontSize(size: number)     // Update font size
- setDisplayMode(mode)          // Change display mode
- setReduceMotion(reduce)       // Toggle animations
- resetDefaults()               // Reset all to defaults
```

**Implementation**:
- Applies settings to `document.documentElement`
- CSS classes: `.dark-mode`, `.high-contrast`, `.reduce-motion`
- Font size via inline style: `fontSize: ${size}%`
- Persists during session (not saved to localStorage)

---

## Data Models

### TypeScript Types
**Location**: `types.ts`

#### Item
```typescript
interface Item {
  id: string;              // UUID v4
  name: string;            // Item name (e.g., "Apple")
  checked: boolean;        // Completion status
  amount: number;          // Quantity (default: 1)
  unit: Unit;             // 'pcs' | 'g' | 'kg' | 'L' | 'ml'
  recipeLabels?: RecipeLabel[];  // NEW: Tags showing which recipe(s) this item belongs to
}
```

#### CategoryGroup
```typescript
interface CategoryGroup {
  id: string;              // UUID v4
  category: string;        // Category name (e.g., "Fruits")
  items: Item[];          // Array of items in category
  imageUrl?: string;      // DALL-E 3 generated icon (optional)
  assignedTo?: string;    // Email of assigned member (optional)
}
```

**Note**: `assignedTo` field allows list members to assign specific categories to different team members, enabling task splitting and responsibility tracking.

#### ListDocument
```typescript
interface ListDocument {
  id: string;              // Firestore document ID
  title: string;           // List name
  ownerId: string;         // Creator's Firebase UID
  memberEmails: string[];  // Shared with users (includes owner)
  groups: CategoryGroup[]; // Organized categories
  recipes?: Recipe[];      // NEW: Original recipes (if inputMode is 'recipe')
  inputMode?: InputMode;   // NEW: 'items' or 'recipe'
  createdAt?: number;      // Unix timestamp
  updatedAt?: number;      // Unix timestamp
}
```

#### UserProfile
```typescript
interface UserProfile {
  uid: string;             // Firebase UID
  email: string | null;    // User email
  displayName: string | null;  // Full name
  photoURL: string | null;     // Profile picture URL
}
```

#### OrganizeStatus
```typescript
type OrganizeStatus = 'idle' | 'loading' | 'success' | 'error';
```

#### Language
```typescript
type Language = 'en' | 'he';
```

#### Recipe (NEW)
```typescript
interface Recipe {
  id: string;              // UUID v4
  name: string;            // Recipe name (e.g., "Pasta Carbonara")
  ingredients: string;     // Ingredient list as text
  instructions?: string;   // Optional cooking instructions
}
```

**Purpose**: Represents a recipe with ingredients and optional instructions. Used in recipe mode to store original recipes before they're combined into a shopping list.

#### RecipeLabel (NEW)
```typescript
interface RecipeLabel {
  recipeName: string;      // Full recipe name
  recipeId: string;        // Reference to recipe ID
}
```

**Purpose**: Tags on items showing which recipe(s) they belong to. Multiple labels indicate item is shared across recipes.

#### SavedRecipe (NEW)
```typescript
interface SavedRecipe {
  id: string;              // Firestore document ID
  name: string;            // Recipe name
  ingredients: string;     // Ingredient list as text
  instructions?: string;   // Optional cooking instructions
  createdAt?: number;      // Unix timestamp
}
```

**Purpose**: Represents a recipe saved to user's personal library. Stored in Firestore `users/{userId}/savedRecipes/{recipeId}` collection.

#### InputMode (NEW)
```typescript
type InputMode = 'items' | 'recipe';
```

**Purpose**: Determines the input interface and list organization behavior:
- `'items'`: Standard mode for unstructured text lists
- `'recipe'`: Recipe mode with multiple recipe support and ingredient combining

---

## User Flow

### Guest User Flow
1. **Landing Page**: Welcome screen with "Login" or "Try as Guest" buttons
2. **Guest Mode**: Click "Try as Guest" to use app without authentication
3. **Input**: Enter unstructured list (e.g., "apples, milk, bread, shampoo")
4. **AI Processing**: GPT-4o-mini categorizes items into logical groups
5. **View Results**: See categorized list with DALL-E 3 generated icons
6. **Add Items**: Can add more items to existing categories
7. **Limitations**:
   - No persistence (data lost on page refresh)
   - Cannot save or share lists
   - Alert banner prompts login for full features

### Authenticated User Flow
1. **Login**: Click "Login with Google" → Firebase OAuth popup
2. **Authorization**: Grant permissions and sign in
3. **Dashboard**: See sidebar with all saved lists
4. **Create/Edit**:
   - Click "New List" to create
   - Or select existing list from sidebar
   - Enter items and organize with AI
5. **Collaboration**:
   - Click member avatars or "Share" button to open share modal
   - **Option A - Email Invite**: Enter collaborator's email and click "Invite"
   - **Option B - Share Link**: Copy shareable link with "Copy Link" button
   - Share link includes full list content + join URL for WhatsApp/messaging
6. **Category Assignment**:
   - Hover over any category card
   - Click the UserCheck icon
   - Assign categories to specific team members
   - Visual indicator shows who's responsible for each category
7. **Sync**: Changes sync automatically across all devices
8. **Persistence**: All lists saved to Firestore permanently

### Share Link Flow (New User)
1. **Receive Link**: User receives share message via WhatsApp/messaging with:
   - Full list content (readable immediately)
   - Share link URL (e.g., `https://lista-six-psi.vercel.app/share/abc123`)
2. **Click Link**: Opens Lista app at `/share/:listId` route
3. **Authentication**:
   - If not logged in: See login page
   - Click "Sign in with Google"
   - Complete OAuth flow
4. **Auto-Join**: After authentication:
   - App automatically adds user to list's memberEmails
   - List appears in user's sidebar
   - User gets full edit access
5. **Collaboration**: User can now view, edit, and collaborate on the shared list

### List Organization Flow
1. **Input Text**: "apples, milk, bread, shampoo, cheese, bananas"
2. **AI Categorization**:
   - OpenAI analyzes and groups items
   - Returns: Fruits (apples, bananas), Dairy (milk, cheese), Bakery (bread), Personal Care (shampoo)
3. **Icon Generation**:
   - DALL-E 3 generates unique icon for each category (async)
   - Icons load progressively as they're generated
4. **Display**: Shows organized categories in responsive grid
5. **Interaction**:
   - Check off items as completed
   - Edit item names, quantities, units
   - Add new items to categories
   - Delete items or entire categories
   - Export or share list

---

## Local Development Setup

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Firebase Project** (for auth and database)
- **OpenAI API Key** (for GPT-4o-mini and DALL-E 3)

### Step 1: Clone Repository
```bash
git clone https://github.com/TomerIN1/Lista.git
cd Lista
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables

Create a `.env` file in the project root:

```env
# OpenAI API Key (for ChatGPT and DALL-E)
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY_HERE

# Firebase Configuration
FIREBASE_API_KEY=AIzaSy...YOUR_KEY_HERE
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

**Important**: Never commit `.env` to git! It's already in `.gitignore`.

### Step 4: Run Development Server
```bash
npm run dev
```

App will be available at:
- **Local**: http://localhost:3000/
- **Network**: http://192.168.x.x:3000/ (accessible on local network)

---

## Firebase Configuration

### Create Firebase Project

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Create Project**: Click "Add project" → Enter name → Create
3. **Skip Google Analytics** (optional for now)

### Enable Authentication

1. Click **"Authentication"** → **"Get started"**
2. Go to **"Sign-in method"** tab
3. Enable **"Google"** provider
4. Enter support email
5. Click **"Save"**

### Add Authorized Domains

1. In Authentication → **"Settings"** → **"Authorized domains"**
2. Add:
   - `localhost` (for local dev)
   - `your-vercel-domain.vercel.app` (for production)
3. Click **"Add"** for each domain

### Create Firestore Database

1. Click **"Firestore Database"** → **"Create database"**
2. Choose **"Start in production mode"**
3. Select location (closest to your users)
4. Click **"Enable"**

### Configure Security Rules

1. In Firestore → **"Rules"** tab
2. Replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /lists/{listId} {
      // Allow read/write if user is authenticated and is a member
      allow read, write: if request.auth != null &&
        request.auth.token.email in resource.data.memberEmails;

      // Allow create if user is authenticated
      allow create: if request.auth != null;
    }
  }
}
```

3. Click **"Publish"**

### Get Firebase Config

1. Click ⚙️ **"Project Settings"**
2. Scroll to **"Your apps"** → Click web icon `</>`
3. Register app (enter nickname, skip hosting)
4. Copy the `firebaseConfig` values:
   - apiKey
   - authDomain
   - projectId
   - storageBucket
   - messagingSenderId
   - appId
5. Add these to your `.env` file

---

## OpenAI Configuration

### Get API Key

1. **Go to**: https://platform.openai.com/api-keys
2. **Sign in** or create account
3. Click **"Create new secret key"**
4. **Name it**: "Lista App"
5. **Copy the key** (starts with `sk-proj-...`)
6. Add to `.env` as `OPENAI_API_KEY`

### Set Usage Limits (Recommended)

1. Go to **"Usage limits"** in OpenAI dashboard
2. Set monthly budget (e.g., $20)
3. Enable email notifications at 75% and 100%

### Model Costs (as of 2024)

**GPT-4o-mini**:
- Input: $0.150 per 1M tokens
- Output: $0.600 per 1M tokens
- ~100-200 tokens per list organization

**DALL-E 3**:
- Standard 1024x1024: $0.040 per image
- HD 1024x1024: $0.080 per image (not used in this app)

**Estimated cost**: ~$0.01-0.05 per list creation with icons

---

## Deployment to Vercel

### Prerequisites
- GitHub account
- Vercel account (free tier works)
- Project pushed to GitHub

### Step 1: Import Project to Vercel

1. **Go to**: https://vercel.com/new
2. **Import Git Repository**:
   - Click "Import" next to your Lista repository
   - Or paste: `https://github.com/YourUsername/Lista`
3. **Configure Project**:
   - Framework Preset: **Vite**
   - Root Directory: `.` (leave default)
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Click **"Deploy"**

### Step 2: Add Environment Variables

1. Go to **Project Settings** → **"Environment Variables"**
2. Add each variable:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `OPENAI_API_KEY` | sk-proj-... | Production, Preview, Development |
| `FIREBASE_API_KEY` | AIzaSy... | Production, Preview, Development |
| `FIREBASE_AUTH_DOMAIN` | your-project.firebaseapp.com | All |
| `FIREBASE_PROJECT_ID` | your-project-id | All |
| `FIREBASE_STORAGE_BUCKET` | your-project.firebasestorage.app | All |
| `FIREBASE_MESSAGING_SENDER_ID` | 123456789 | All |
| `FIREBASE_APP_ID` | 1:123456789:web:abc | All |

**Important**: Select all three environments (Production, Preview, Development) for each variable.

### Step 3: Configure Firebase for Vercel Domain

1. Go to **Firebase Console** → Your project
2. **Authentication** → **Settings** → **"Authorized domains"**
3. Click **"Add domain"**
4. Enter your Vercel domain: `your-app-name.vercel.app`
5. Click **"Add"**

**Note**: Vercel provides a unique domain. Find it in Vercel dashboard under "Domains".

### Step 4: Configure SPA Routing (vercel.json)

The project includes a `vercel.json` file that handles Single Page Application routing:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This configuration is **essential** for:
- ✅ Share links to work correctly (`/share/:listId` routes)
- ✅ Direct URL navigation (e.g., bookmarks, external links)
- ✅ Browser refresh on any route

Without this, routes like `/share/abc123` will return 404 errors.

### Step 5: Redeploy

1. Go to **"Deployments"** tab in Vercel
2. Click **"Redeploy"** on the latest deployment
3. Wait for build to complete (~1-2 minutes)
4. Click **"Visit"** to see your live app

### Automatic Deployments

Vercel automatically deploys when you push to GitHub:
- **Push to `main`** → Production deployment
- **Push to other branch** → Preview deployment
- **Pull Request** → Preview deployment with unique URL

### Custom Domain (Optional)

1. In Vercel → **"Settings"** → **"Domains"**
2. Click **"Add"**
3. Enter your custom domain
4. Follow DNS configuration instructions
5. Add custom domain to Firebase authorized domains

---

## Environment Variables

### Required Variables

| Variable | Purpose | Where to Get |
|----------|---------|--------------|
| `OPENAI_API_KEY` | OpenAI API access | https://platform.openai.com/api-keys |
| `FIREBASE_API_KEY` | Firebase project authentication | Firebase Console → Project Settings |
| `FIREBASE_AUTH_DOMAIN` | Firebase auth domain | Firebase Console → Project Settings |
| `FIREBASE_PROJECT_ID` | Firebase project identifier | Firebase Console → Project Settings |
| `FIREBASE_STORAGE_BUCKET` | Firebase storage | Firebase Console → Project Settings |
| `FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID | Firebase Console → Project Settings |
| `FIREBASE_APP_ID` | Firebase app identifier | Firebase Console → Project Settings |

### Local Development

**File**: `.env` (in project root)

```env
OPENAI_API_KEY=sk-proj-your-key-here
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=lista-xxxxx.firebaseapp.com
FIREBASE_PROJECT_ID=lista-xxxxx
FIREBASE_STORAGE_BUCKET=lista-xxxxx.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef
```

**Security**:
- ✅ `.env` is in `.gitignore` (never committed)
- ✅ `.env.example` provides template (safe to commit)
- ✅ Use different keys for dev and production (recommended)

### Production (Vercel)

All environment variables are set in Vercel dashboard:
- **Settings** → **Environment Variables**
- Accessible via `process.env` in build and runtime
- Can be different per environment (Production/Preview/Development)

---

## Troubleshooting

### Common Issues

#### 1. "API key not valid" Error (Firebase)

**Symptoms**:
```
Firebase: Error (auth/api-key-not-valid)
```

**Solutions**:
- Check `.env` file has correct `FIREBASE_API_KEY`
- Verify key copied from Firebase Console (no extra spaces)
- Restart dev server after changing `.env`
- On Vercel: Check environment variables are set correctly

---

#### 2. "Unauthorized domain" Error (Firebase Auth)

**Symptoms**:
```
Firebase: Error (auth/unauthorized-domain)
```

**Solution**:
1. Go to Firebase Console → Authentication → Settings
2. Scroll to "Authorized domains"
3. Add your domain:
   - `localhost` (for local dev)
   - `your-app.vercel.app` (for production)
4. Refresh your app

---

#### 3. "The OPENAI_API_KEY environment variable is missing"

**Symptoms**: Black page, console error about missing OpenAI key

**Solutions**:
- **Local**: Check `.env` file has `OPENAI_API_KEY`
- **Vercel**: Add environment variable in Vercel dashboard
- Restart server/redeploy after adding
- Check key starts with `sk-proj-` or `sk-`

---

#### 4. Vercel 404 Error

**Symptoms**: Vercel shows 404 not found

**Solutions**:
- ✅ Already fixed: Files moved to root directory
- Verify `package.json` is in root
- Check Vercel build logs for errors
- Ensure build output is `dist/`

---

#### 5. Icons Not Generating

**Symptoms**: Categories show but no icons

**Possible Causes**:
- DALL-E 3 API error (check OpenAI usage limits)
- CORS errors (check browser console)
- Network timeout

**Solutions**:
- Check OpenAI API key is valid
- Check OpenAI account has credits
- Icons load asynchronously - wait a few seconds
- Fallback: First letter of category will show

---

#### 6. Lists Not Saving (Guest Mode)

**Expected Behavior**: Guest mode data is NOT saved

**Solution**:
- Log in with Google to save lists
- Guest mode is for trying the app only
- Data persists only during session

---

#### 7. Dev Server Won't Start

**Symptoms**:
```
Error: Cannot find module...
```

**Solutions**:
```bash
# Delete and reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

---

#### 8. TypeScript Errors

**Solutions**:
```bash
# Check TypeScript version
npx tsc --version

# Reinstall type definitions
npm install --save-dev @types/node

# Ignore specific errors (not recommended)
// @ts-ignore
```

---

### Debug Mode

**Enable verbose logging**:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Check for errors (red) and warnings (yellow)
4. Expand error objects to see full stack trace

**Network tab**:
- Check API calls to OpenAI
- Check Firestore requests
- Look for 400/401/403/404 errors

---

### Getting Help

1. **Check Documentation**: Read this file thoroughly
2. **Browser Console**: Look for error messages
3. **Vercel Logs**: Check deployment and function logs
4. **Firebase Console**: Check Authentication and Firestore tabs
5. **OpenAI Dashboard**: Check usage and errors

---

## Development Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Browser Support

- **Chrome/Edge**: ✅ Full support
- **Firefox**: ✅ Full support
- **Safari**: ✅ Full support (iOS 13+)
- **Mobile**: ✅ Responsive design

---

## License & Legal

- **Privacy Policy**: Available in app footer
- **Terms of Service**: Available in app footer
- **Data Storage**: Firebase (Google Cloud)
- **AI Processing**: OpenAI API

---

## Future Enhancements

Potential features for future development:

1. **Templates**: Pre-made list templates (grocery, packing, wedding, etc.)
2. **Recurring Lists**: Auto-create weekly/monthly lists
3. **Smart Suggestions**: AI suggests items based on history
4. **Voice Input**: Speak lists instead of typing
5. **Export Formats**: CSV, PDF, Excel export
6. **Mobile Apps**: Native iOS/Android versions
7. **Integrations**: Import from notes apps, Google Keep, Todoist
8. **Analytics**: Track completion rates, popular items
9. **Reminders**: Push notifications for uncompleted lists
10. **Barcode Scanner**: Scan products to add to lists
11. **Recipe Import**: Import ingredients from recipe URLs
12. **Price Tracking**: Estimate shopping costs
13. **Store Maps**: Organize by store aisle layout

---

## Performance Optimization

Current optimizations:
- ✅ Vite for fast builds and HMR
- ✅ React 19 with concurrent features
- ✅ Code splitting (automatic via Vite)
- ✅ Lazy loading of modals
- ✅ Firestore offline persistence
- ✅ Service worker caching
- ✅ Optimized image loading (DALL-E URLs)

Future optimizations:
- [ ] Image optimization/compression
- [ ] Virtual scrolling for large lists
- [ ] Memoization of expensive computations
- [ ] Bundle size reduction

---

## Security Best Practices

✅ **Implemented**:
- Environment variables for all secrets
- `.gitignore` for sensitive files
- Firebase security rules
- Client-side input validation
- HTTPS only (enforced by Vercel)
- CORS headers configured

⚠️ **Important Notes**:
- OpenAI API calls are client-side (key visible in network tab)
- For production, consider proxying through backend
- Never expose API keys in client code (current setup is for MVP)

**Production-Ready Security Improvements**:
1. Create serverless functions for OpenAI calls
2. Implement rate limiting
3. Add request authentication
4. Use environment-specific API keys
5. Implement CAPTCHA for public endpoints

---

## Credits

- **AI Models**: OpenAI (GPT-4o-mini, DALL-E 3)
- **Backend**: Firebase (Google)
- **Hosting**: Vercel
- **Icons**: Lucide React
- **Fonts**: System fonts (optimized for performance)

---

## Contact & Support

- **GitHub**: https://github.com/TomerIN1/Lista
- **Live App**: https://lista-six-psi.vercel.app

---

---

## Two-Mode Restructuring (February 2026)

### Overview

The app was restructured into two top-level modes to separate the original free-text organizing experience from the new supermarket/price-comparison features:

- **Organize Mode** — The original Lista: free-text input, recipes, AI categorization. No barcodes, no price DB.
- **Shopping Mode** — Build a list from DB products, compare prices across stores, then choose physical shopping (AI-organized list with store recommendation) or online shopping (agent chat).

### New Types

| Type | Definition | Purpose |
|------|-----------|---------|
| `AppMode` | `'organize' \| 'shopping'` | Top-level mode selector |
| `ShoppingFlowStep` | `'build_list' \| 'comparing' \| 'mode_select' \| 'ready'` | Shopping mode flow state |
| `ListDocument.appMode` | `AppMode` (optional) | Persisted mode per list; `undefined` defaults to `'organize'` for backward compatibility |

### New Components

#### `components/AppModeToggle.tsx`
- Top-level pill toggle above all content
- Two buttons: Organize (Sparkles icon) / Shopping (ShoppingCart icon)
- Props: `appMode`, `onSwitch`, `disabled`
- Disabled during loading states to prevent mid-operation switches

#### `components/ShoppingInputArea.tsx`
- Shopping mode list builder
- Uses `ProductSearchInput` with `prominent` prop for larger, primary input styling
- Only accepts DB products (no free text) to ensure all items have barcodes and prices for reliable agent/comparison operation
- "Compare Prices" button triggers price comparison flow
- Clear button to reset product selection

#### `components/ShoppingPriceStep.tsx`
- Displays price comparison results inline as a main-flow step
- Reuses `SavingsReport`, `ModeSelector`, and `LocationInput` components
- Back button returns to build_list step
- Physical mode: "Organize for Store" button triggers AI categorization with store recommendation
- Online mode: "Build Cart" button opens PriceAgentChat directly

### Modified Components

#### `components/InputArea.tsx`
- Removed `ProductSearchInput` import and all usage
- Removed `selectedProducts` state and all related logic
- Simplified `onOrganize` signature to `(text: string, name: string) => void`
- Simplified `onAdd` signature to `(text: string) => void`
- Items/Recipe sub-toggle unchanged

#### `components/ResultCard.tsx`
- Added `appMode` and `storeRecommendation` props
- Removed "Find Best Prices" button entirely (price features live in Shopping mode now)
- Removed `PriceComparisonPanel` inline rendering
- Removed `onFindBestPrices` and `onStartOnlineAgent` props
- Added store recommendation banner (green gradient with store name and savings amount) that renders above the category grid when `storeRecommendation` is set

#### `components/ProductSearchInput.tsx`
- Added `prominent?: boolean` prop — larger input, bigger padding, emerald color scheme for use as primary input in Shopping mode
- Added `z-20` to wrapper div to ensure dropdown renders above sibling elements

### App.tsx Changes

#### New State
```typescript
appMode: AppMode                    // 'organize' | 'shopping'
shoppingStep: ShoppingFlowStep     // Current step in shopping flow
shoppingProducts: DbProduct[]      // Selected products from DB search
priceComparison: ListPriceComparison | null  // Comparison results
selectedShoppingMode: ShoppingMode | null    // 'physical' | 'online'
storeRecommendation: { storeName: string; savingsAmount: number } | null
isShoppingComparing: boolean       // Loading state for comparison
```

#### New Handlers
- `handleAppModeSwitch(mode)` — Switches mode, resets shopping state when going back to organize
- `handleShoppingCompare()` — Builds temp groups from DB products, calls `compareListPrices`, advances to mode_select
- `handleShoppingPhysical()` — Calls `handleOrganize` with product names, sets store recommendation from comparison data
- `handleShoppingOnline()` — Builds temp groups from DB products, opens PriceAgentChat

#### Simplified Handlers
- `handleOrganize` — Removed `selectedProducts` parameter (organize mode is pure free-text now)
- `handleAddItems` — Removed `selectedProducts` parameter
- Removed `enrichItemsWithProductData` helper (no longer needed)
- Removed `handleFindBestPrices` handler

#### Conditional Rendering
```
AppModeToggle (always visible)

if appMode === 'organize':
  InputArea (text + recipes, no DB search)
  ResultCard (no price features)

if appMode === 'shopping':
  if step === 'build_list':   ShoppingInputArea (DB product search only)
  if step === 'mode_select':  ShoppingPriceStep (savings + mode choice)
  if step === 'ready':        ResultCard (with store recommendation banner)
```

#### Sync Effect
- Reads `list.appMode` from loaded Firestore lists and sets `appMode` state accordingly (defaults to `'organize'` for backward compat)

### Infrastructure Changes

#### `vite.config.ts`
- Added dev proxy: `/price-api` → `https://israeli-food-prices-database-and-ap-one.vercel.app`
- Solves CORS issue where the external price API doesn't send `Access-Control-Allow-Origin` headers

#### `services/priceDbService.ts`
- `API_BASE` now uses `/price-api` in dev (Vite proxy) and the full URL in production
- Fixed `apiFetch` to handle relative URLs by using `window.location.origin` as base for `new URL()` constructor

#### `constants/translations.ts`
- Added `appMode` section with 12 keys in both English and Hebrew:
  - Mode labels: `organize`, `shopping`, `organizeDesc`, `shoppingDesc`
  - Shopping flow: `buildList`, `comparePricesStep`, `selectMode`, `proceedToCompare`
  - Actions: `backToBuildList`, `organizeForStore`, `shoppingListEmpty`

### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `types.ts` | Modified | Added `AppMode`, `ShoppingFlowStep`, extended `ListDocument` |
| `constants/translations.ts` | Modified | Added `appMode` section (en + he) |
| `components/AppModeToggle.tsx` | **New** | Top-level mode toggle |
| `components/ShoppingInputArea.tsx` | **New** | Shopping mode DB product search |
| `components/ShoppingPriceStep.tsx` | **New** | Price comparison + mode selection step |
| `components/InputArea.tsx` | Modified | Removed ProductSearchInput, simplified props |
| `components/ResultCard.tsx` | Modified | Removed price features, added store banner |
| `components/ProductSearchInput.tsx` | Modified | Added `prominent` prop, fixed z-index |
| `App.tsx` | Modified | Two-mode state, handlers, conditional rendering |
| `vite.config.ts` | Modified | Added CORS proxy for price API |
| `services/priceDbService.ts` | Modified | Dev proxy support, fixed URL construction |

### SavingsReport Per-Store Item Accuracy Fix (February 2026)

Fixed the SavingsReport to show accurate item counts relative to the full shopping list, not per-store totals.

**Problem**: When a user added 4 items, stores showed "3 of 3 matched" and "2 of 2 matched" instead of "3 of 4" and "2 of 4". The user couldn't tell which items were unavailable at each store.

**Changes**:
- **`types.ts`**: Added `totalListItems: number` to `ListPriceComparison` interface
- **`services/priceDbService.ts`**: `compareListPrices` now computes per-store `unmatchedItems` (all list items minus items this store carries) instead of copying the global unmatched list. Returns `totalListItems` in the result.
- **`components/SavingsReport.tsx`**: `StoreRow` receives `data.totalListItems` as the denominator. Expanded store view now shows unavailable items below the price breakdown with an `XCircle` icon and "unavailable" label.
- **`constants/translations.ts`**: Added `unavailable` / `לא זמין` translation key.

---

**Last Updated**: February 10, 2026
**Version**: 3.0.1
**Status**: Production Ready
