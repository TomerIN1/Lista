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

### 🤝 Collaboration
- Share lists with other users via email
- Real-time updates for shared lists
- Member management
- Permission-based access control

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

**States**:
- Open/closed animation
- Loading states
- Empty state for no lists

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

**`updateListGroups(listId, groups)`**
- Updates list categories and items
- Updates `updatedAt` timestamp
- Used when adding/removing items or categories

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

**Firestore Security Rules**:
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
}
```

#### CategoryGroup
```typescript
interface CategoryGroup {
  id: string;              // UUID v4
  category: string;        // Category name (e.g., "Fruits")
  items: Item[];          // Array of items in category
  imageUrl?: string;      // DALL-E 3 generated icon (optional)
}
```

#### ListDocument
```typescript
interface ListDocument {
  id: string;              // Firestore document ID
  title: string;           // List name
  ownerId: string;         // Creator's Firebase UID
  memberEmails: string[];  // Shared with users (includes owner)
  groups: CategoryGroup[]; // Organized categories
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
   - Click "Share" button
   - Enter collaborator's email
   - They get real-time access
6. **Sync**: Changes sync automatically across all devices
7. **Persistence**: All lists saved to Firestore permanently

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

### Step 4: Redeploy

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

**Last Updated**: December 12, 2024
**Version**: 2.0.0
**Status**: Production Ready ✅
