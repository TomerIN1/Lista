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

### 🛒 Shopping Mode — Supermarket-Style Store Experience
The shopping mode is designed to look and feel like a real online supermarket (inspired by Rami Levy, Shufersal, Instacart). When the user enters shopping mode, they immediately see products, categories, and deals — no setup wall.

#### Store-Style Layout
- **Supermarket Header** (sticky): Search bar, location badge (📍 city name), cart counter (🛒 N), mode toggle (ארגון/קניות), sidebar menu button (☰). Replaces the standard header when in shopping mode.
- **Horizontal Category Navigation Bar with Mega-Menu**: Scrollable strip of category buttons with SVG icons below the header. Click a category to browse products; "All" button resets to the landing view. Categories sorted in grocery-first order. **Hover** over a category to see a dropdown mega-menu showing all subcategories as bold headers, each with their sub-subcategories listed underneath. Click any level (category, subcategory, or sub-subcategory) to jump directly to those products.
- **Persistent Address**: City, location, and shopping mode are persisted to localStorage (`lista_shopping_city`, `lista_shopping_location`, `lista_shopping_mode`). Returning users skip the setup form and land directly on the store. First-time users see a full-page setup form; returning users can change their address via a compact modal (triggered from the location badge).
- **Sidebar as Overlay**: In shopping mode, the sidebar (My Lists, Shopping Lists, Saved Recipes) is always an overlay panel, not a permanent column — maximizing store space. Accessed via the ☰ button in the header.

#### Product Catalog
- **Landing Page** (no category selected): Three content sections replace the old category grid:
  1. **Promo Banner** — "Compare prices across all supermarkets" gradient banner
  2. **"Worth Comparing"** (שווה להשוות) — 8 popular grocery products with the biggest price gaps between supermarkets. Each card shows product image, name, price range, savings amount (₪) and percentage (%). Products sourced by searching common Israeli staples (חלב, ביצים, לחם, גבינה, etc.) and picking those with the highest `max_price - min_price`.
  3. **"Everyday Essentials"** (מוצרים יומיומיים) — 8 common staple products (לחם אחיד, חלב תנובה, ביצים, גבינה לבנה, etc.) with consistent card sizing.
- **Category Selection**: Clicking a category (from nav bar or mega-menu) hides the landing banners and shows products. Clicking "All" returns to the landing page.
- **3-Level Category Navigation**: Browse products by category › subcategory › sub_subcategory with horizontal chip navigation. Categories display custom SVG illustration icons (served from `/public/category-icons/`). All three levels are navigable from the mega-menu dropdown.
- **Product Grid**: 2-col (mobile) / 3-col (tablet) / 4-col (desktop) card grid with product image, name, manufacturer + package size, price, and unit price
- **Promo Badges**: `-X%` rose pill on cards and in the detail modal when `min_price < max_price`; shows savings amount ("חיסכון ₪X")
- **Filter Panel**: Vegan-only toggle + allergen-free multi-select (גלוטן, חלב, ביצים, etc.) + on-sale toggle + price range (min/max ₪) inputs, with active chip summary row
- **Sort Dropdown**: 5 sort options (default: price low→high, price high→low, name א→ת, name ת→א). Browse view sorts client-side on loaded products; search view passes `sort_by=min_price` to the API for price sorts, name sorts are client-side.
- **Chain Filter**: Toggleable supermarket pills in the Available Stores banner. Selecting one or more chains passes `chain=` to the browse/search API, filtering to products with prices at those chains with recalculated min/max prices. "All Stores" reset pill clears the filter.
- **Search**: Available in both the header search bar and the catalog's inline search. Debounced (300ms) full-text product search with result count; clears back to category view.
- **Product Detail Modal** (opens on card click):
  - Fixed-height image with product name/manufacturer overlaid on gradient
  - Labeled info table: Barcode, Manufacturer, Package Size (`unit_qty`), Category, Subcategory, Sub-subcategory (merged from browse + detail API responses)
  - Price hero: best price + unit price line for packaged products (e.g., "₪9.23 ל-100 גרם") + "חסוך ₪X" savings badge vs most expensive store
  - For weighted products: "מחיר ל-ק״ג" indicator with Weight icon
  - Store price table sorted cheapest-first; cheapest row highlighted green + "הכי זול" badge + `-X%` discount badge
  - Per-store `unit_qty` display (e.g., "400 גרם") and computed unit price per store
  - Per-store promo detection via `effective_price < price`; shows "במבצע: [description]" with Tag icon
  - `+₪X.XX` price difference vs cheapest shown on every non-cheapest row
  - Sticky "הוסף" / "נוסף" button pinned to modal bottom

#### Cart
- **Desktop — Left Sidebar Cart**: Fixed sidebar (w-72 / xl:w-80 / 2xl:w-96) pinned to the **left side** of the screen (uses `direction: ltr` on the flex container to force left positioning regardless of RTL). Shows cart items with product thumbnail (40x40), name, manufacturer, price, qty control, remove button. Footer shows estimated total (₪XX.XX) and "Compare Prices" button.
- **Mobile — Bottom Bar**: Fixed bottom bar with item count, estimated total, and Compare Prices button (`lg:hidden`).
- **Product Thumbnails**: Each cart item shows a small product image with ShoppingCart icon fallback.
- **Estimated Total**: Sum of `min_price * amount` for all products (with weighted product estimation via `computeWeightedTotal()`).
- **Weighted Items Disclaimer**: Amber banner shown when any weighted product is in cart.

#### Available Stores Banner
- Interactive chip row above the catalog showing which supermarket chains serve the user's selected city
- Chips are toggleable — click to filter products to selected chains (API-side via `chain=` param)
- Online mode shows delivery fee (₪XX) or "איסוף" (collect) badge per chain; physical mode shows all chain names
- Uses `checkDelivery()` API data
- **Load More**: Paginated product loading (24 per page) with Load More button

### 🤖 Product Discovery Assistant (AI Chat)
- **Conversational Product Search**: Chat-based AI assistant inside Shopping Mode that helps users find products via natural language — paste a list, ask questions, or search by criteria
- **Smart Intent Detection**: AI interprets user input as shopping list, product search, price query, or general question
- **Two-Pass AI Architecture**: First AI call generates search queries → products searched → second AI call sees actual product names/prices → generates honest, context-aware response
- **Multi-Query Search**: For tricky queries (e.g., "milk in a bag"), AI generates multiple search variations to maximize match chances
- **Price & Filter Support**: "cheapest milk" → sorts by price; "vegan snacks" → applies vegan filter
- **Inline Product Cards**: Results shown as cards in the chat feed with product image, name, manufacturer, price
- **Click for Detail**: Tap a product card to open the full `ProductDetailModal` with store-by-store price comparison
- **Add to Cart**: Individual "Add" buttons per product + bulk "Add All" for multi-result responses
- **Conversation Memory**: Follow-up questions work — AI maintains context within the session
- **Bilingual**: Full Hebrew + English support with proper RTL layout
- **Category Grouping (v5.0.0)**: Results are grouped into the 23 fixed Lista categories (פירות וירקות, מוצרי חלב וביצים, ניקיון כביסה וחד פעמי, …), each with an icon header and visual divider. DB-category alignment filter drops cross-category keyword leaks (e.g., cleaning brand "וניש" no longer appears under חטיפים).
- **Fresh-First Search (v5.0.0)**: For fresh-oriented categories (produce, meat, bread, dairy) the AI generates both plural + singular Hebrew queries and the orchestrator prioritizes `is_weighted === true` products (real fresh produce). Processed variants (חמוץ, כבוש, קפוא, משומר, במלח) are filtered out. Fresh produce also collapses by `product_group_id` to match the catalog's unified-barcode view.
- **Price Range on Cards**: Cards now display `₪min–₪max` when available, matching the detail modal.
- **Location**: `agents_and_ai/product-discovery-assistant/` — self-contained module with own README

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
│   ├── AccessibilityMenu.tsx        # Accessibility controls
│   ├── CategoryCard.tsx             # Category display
│   ├── CategoryItem.tsx             # Individual item
│   ├── Footer.tsx                   # App footer
│   ├── Header.tsx                   # App header
│   ├── InfoModal.tsx                # Modal dialog
│   ├── InputArea.tsx                # List input
│   ├── Logo.tsx                     # App logo
│   ├── ResultCard.tsx               # Results display
│   ├── ShareModal.tsx               # Share dialog
│   ├── OrganizeListBreakdownModal.tsx  # Modal for viewing organize list categories & items
│   ├── Sidebar.tsx                  # Navigation sidebar
│   ├── ShoppingInputArea.tsx        # Shopping mode: catalog + left-side cart sidebar (desktop) / bottom bar (mobile)
│   ├── ProductCatalogArea.tsx       # Supermarket-style browse/search with category nav & filters
│   ├── CategoryNavBar.tsx           # Horizontal scrollable category bar with SVG icons (sticky below header)
│   ├── ProductCard.tsx              # Product grid card with promo badge, unit_qty, unit pricing display
│   ├── ProductDetailModal.tsx       # Rich product detail: info table, package size, unit pricing, sorted price table, per-store promos
│   ├── BasketStrategyPicker.tsx    # Two-card strategy picker: single-store vs multi-store split
│   └── BasketBreakdownView.tsx     # Per-store item breakdown for selected basket strategy
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
│   ├── geminiService.ts        # OpenAI API (organize, recipes — shared AI functions)
│   ├── govDataService.ts       # data.gov.il address autocomplete
│   └── priceDbService.ts       # Israeli food prices API (browse, search, compare, delivery)
│
├── utils/                       # Shared utilities
│   ├── priceFormat.ts           # Price formatting: unit suffixes, unit_qty parsing, unit price computation
│   └── basketStrategies.ts     # Basket optimization: single-store vs multi-store split computation
│
├── agents_and_ai/               # AI-powered features (self-contained modules)
│   └── product-discovery-assistant/
│       ├── README.md            # Full feature documentation
│       ├── SmartListPanel.tsx   # Chat UI component (messages feed, product cards, input)
│       ├── aiService.ts         # AI functions (parseShoppingList, smartAssistant, summarizeResults)
│       └── smartListService.ts  # Orchestration (buildSmartList, processSmartChat)
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
- appMode: AppMode                      // 'organize' | 'shopping'
- shoppingStep: ShoppingFlowStep        // 'setup' | 'build_list' | 'comparing' | 'results' | 'ready'
- showLocationModal: boolean            // Location change modal visibility
- headerSearchQuery: string             // Search query from the supermarket header
- selectedNavCategory: string | null    // Active category in the horizontal nav bar
```

**Key Functions**:
- `handleOrganize()` - Process new list with OpenAI
- `handleAddItems()` - Add items to existing list
- `handleShare()` - Share list via email
- `handleDeleteList()` - Remove list
- `generateIconsForGroups()` - Async DALL-E icon generation
- `handleAppModeSwitch()` - Switch between organize/shopping; preserves shopping state (city/location/mode) across switches
- `handleSetupProceed()` - Fires delivery check and transitions to build_list step

---

### Header.tsx
**Location**: `components/Header.tsx`

Dual-mode header that changes layout based on `appMode`.

**Organize Mode** (standard layout):
- Logo + compact mode toggle (ארגון/קניות)
- Language toggle, accessibility menu, auth button
- Subtitle text with highlighted keyword

**Shopping Mode** (supermarket-style sticky bar):
- Sticky header (`sticky top-0 z-20 bg-white/95 backdrop-blur-sm`)
- Layout: `[☰ Menu] [Mode Toggle] [Logo] [Search Bar] [📍 Location] [🛒 Cart] [Auth]`
- **Search bar**: Controlled input synced to `headerSearchQuery` in App.tsx, forwarded to `ProductCatalogArea`
- **Location badge**: Shows current city name, clickable to open location change modal
- **Cart badge**: Shows item count, clickable (emerald when items present, slate when empty)
- **Menu button**: Always visible, opens sidebar overlay (for My Lists access)
- **Mobile location bar**: Full-width strip below main row showing city + "Change" link (visible on small screens only)

---

### CategoryNavBar.tsx
**Location**: `components/CategoryNavBar.tsx`

Horizontal scrollable category navigation strip with hover mega-menu, rendered below the header in shopping mode.

- Fetches categories via `getCategories()` from `priceDbService.ts`
- Sorts using `sortCategories()` from `ProductCatalogArea.tsx`
- Each button: SVG icon (w-14/w-16) + category name, vertical layout
- Active category: emerald-600 bg with white text and inverted icon (strokes flip to white via `brightness-0 invert` — clean because icons are stroke-only)
- Hovered category: emerald-50 bg with emerald text
- "All" button uses `הכל.svg` illustration icon (matches the rest of the rail)
- Row uses `.slim-scrollbar` (thin slate-colored scrollbar in `index.html`) so users see at a glance that the rail is horizontally scrollable
- **Mega-Menu Dropdown**: On hover, shows a full-width dropdown with:
  - Category icon + name header + "View all" link
  - Grid of subcategories (bold headers) with their sub-subcategories listed underneath
  - Click any subcategory or sub-subcategory to navigate directly to those products
  - 200ms hover timeout prevents flicker when moving between items
- Synced with `ProductCatalogArea` via `externalCategory`, `externalSubcategory`, and `externalSubSubcategory` props through App.tsx
- `onSelect(category, subcategory?, subSubcategory?)` callback supports all three navigation levels

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

Navigation panel for managing multiple lists. Acts as the user's "personal area" for lists, recipes, and shopping lists.

**Features**:
- List of all user lists (sorted by update time)
- Active list highlighting
- Create new list button
- Delete list action with confirmation
- Login prompt for guests
- Responsive drawer on mobile
- Close on outside click (mobile)
- **`alwaysOverlay` prop**: When `true` (shopping mode), the sidebar is always a slide-out overlay — even on desktop — to maximize store space. Accessed via the ☰ button in the header.
- **Consistent View + Use buttons** across all three sections:
  - **My Lists (Organize)**: View opens `OrganizeListBreakdownModal` (categories & items), Use navigates to the list
  - **Shopping Lists**: View opens `ShoppingListBreakdownModal` (products), Use navigates to the list
  - **Saved Recipes**: View opens `RecipeBreakdownModal` (ingredients & instructions), Use loads recipe into input
  - All use the same card layout: icon + name + delete row, then View (emerald, Eye icon) + Use (indigo, PenLine icon) button row

**States**:
- Open/closed animation
- Loading states
- Empty state for no lists
- Recipe/organize/shopping sections expanded/collapsed

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

### ProductCatalogArea.tsx
**Location**: `components/ProductCatalogArea.tsx`

The supermarket-style browse/search experience embedded inside `ShoppingInputArea`.

**Views**:
- `categories` — Landing page with promo banner + "Worth Comparing" (biggest price gaps) + "Everyday Essentials" (common staples). No category grid — categories are in the nav bar mega-menu.
- `browse` — product grid for a selected category/subcategory/sub_subcategory
- `search` — product grid for a free-text query (debounced 300ms, min 2 chars)

**Navigation**:
- External navigation via `externalCategory`, `externalSubcategory`, `externalSubSubcategory`, and `externalSearchQuery` props (from header search bar and CategoryNavBar mega-menu)
- Subcategory/sub_subcategory chips refine results within browse view
- Breadcrumb buttons navigate back up the hierarchy
- Clearing search or clicking "All" returns to `categories` (landing page)

**Landing Page Sections** (categories view):
- **"Worth Comparing"** (שווה להשוות): Searches 16 popular Israeli grocery terms (חלב, ביצים, לחם, etc.), picks products with images and highest `max_price - min_price`, displays top 8 in uniform 180px cards with savings badge (₪ amount + -X% pill)
- **"Everyday Essentials"** (מוצרים יומיומיים): Searches 8 staple terms (לחם אחיד, חלב תנובה, ביצים, etc.), displays first result with image from each in matching 180px cards

**Filters** (via `FilterPanel` dropdown):
- 🌿 Vegan-only toggle (`is_vegan=true`)
- Allergen-free multi-select (8 allergens: גלוטן, חלב, ביצים, אגוזים, בוטנים, סויה, דגים, שומשום)
- Active filters shown as dismissible chips with allergen disclaimer

**Sort**: Default sort is price low→high (`price_asc`). 5 options: price low→high, price high→low, default, name א→ת, name ת→א.

**Pagination**: 24 products/page; Load More appends next page.

**Exported Utilities** (used by `CategoryNavBar`):
- `getCategoryIconSrc(name)` — resolves SVG icon path for a category
- `sortCategories(cats)` — sorts categories in grocery-first order

**Props**:
```typescript
{
  selectedProducts: ShoppingProduct[];
  onSelectProduct: (product: ShoppingProduct) => void;
  onRemoveProduct: (barcode: string) => void;
  onUpdateProduct?: (barcode: string, updates: { amount?: number; unit?: Unit }) => void;
  disabled?: boolean;
  city?: string;
  storeType?: string;
  selectedChains?: string[];
  externalSearchQuery?: string;       // from header search bar
  externalCategory?: string | null;    // from CategoryNavBar
  externalSubcategory?: string | null; // from CategoryNavBar mega-menu
  externalSubSubcategory?: string | null; // from CategoryNavBar mega-menu
  onCategoryChange?: (cat: string | null) => void; // notify parent of internal category changes
}
```

---

### ProductCard.tsx
**Location**: `components/ProductCard.tsx`

Individual product card for the browse/search grid.

**Features**:
- Product image with `Package` fallback on 404
- Name (2-line clamp), manufacturer + package size (e.g., "טירת צבי | 400 גרם" via `unit_qty`)
- Promo badge: `-X%` rose pill (top-start) when `min_price < max_price`
- Price section: sale price in rose + original struck through + "חיסכון ₪X / Save ₪X" line
- **Weighted products**: per-100g subprice line (e.g., "≈ ₪1.09 / 100 ג׳") via `formatWeightedSubprice()`, prominent "⚖️ נמכר במשקל" text label (amber, Weight icon) below price
- Unit price line for packaged products (e.g., "₪9.23 ל-100 גרם") computed from `unit_qty`
- **Quantity selector**: +/− buttons with amount and unit label. Weighted products step by 0.5 kg (starting at 0.5, label "ק״ג"), per-unit products step by 1 (starting at 1, label "יח׳"). Hidden once product is added.
- Add / Added button (green CTA → disabled state once in cart). `onAdd(amount)` passes selected quantity to cart.
- Card body click opens `ProductDetailModal`

---

### ProductDetailModal.tsx
**Location**: `components/ProductDetailModal.tsx`

Full product details rendered as a portal modal.

**Layout**:
1. **Fixed-height image** (200-240px) with gradient + product name/manufacturer overlay
2. **Scrollable body**:
   - Labeled info table: Barcode · Manufacturer · Package Size (`unit_qty`) · Sale Type (נמכר במשקל / יחידה) · Unit of Measure (ק״ג / ליטר) · Category · Subcategory · Sub-subcategory
   - Price hero card: best price (₪X) with unit suffix for weighted (/ ק״ג) + unit price line for packaged products (e.g., "₪9.23 ל-100 גרם") + "חסוך ₪Y" badge vs most expensive store
   - For weighted products: "מחיר ל-ק״ג" indicator with Weight icon + per-100g subprice (≈ ₪X.XX / 100 ג׳)
   - Vegan / labels badges + allergen chips (with AlertCircle icon)
   - Store price table (sorted cheapest first):
     - Cheapest row: green highlight + "הכי זול" badge + `-X%` badge (vs most expensive)
     - Per-store `unit_qty` display and computed unit price
     - Per-store promo detection via `effective_price < price` → shows `-X% מבצע` badge + "במבצע: [description]"
     - Other rows: `+₪X.XX` diff vs cheapest in slate text
3. **Sticky footer** pinned to modal bottom: quantity selector (+/− with same weighted/per-unit logic as ProductCard) + Add button. `onAdd(product, amount)` passes selected quantity.

**Data merging**: Detail API omits several fields; modal accepts `fallbackProduct: DbProductEnhanced` prop from the browse card to fill gaps.

**Props**:
```typescript
{
  barcode: string;
  onClose: () => void;
  onAdd: (product: DbProductEnhanced, amount: number) => void;
  isAdded: boolean;
  fallbackImageUrl?: string | null;
  fallbackProduct?: DbProductEnhanced | null;
}
```

---

### ShoppingInputArea.tsx
**Location**: `components/ShoppingInputArea.tsx`

Shopping mode main content area with a **two-column layout on desktop**: left-side cart sidebar + main catalog area. Hosts `ProductCatalogArea` (browse/search), an **AI Assistant** toggle, and the available stores banner.

**Layout**:
- **Desktop** (`lg+`): `flex` row — `[Cart Sidebar (w-72/xl:w-80/2xl:w-96)] [Main Content (flex-1)]`
- **Mobile** (`<lg`): Single column with fixed bottom cart bar

**Available Stores Banner** (above catalog in main content):
- Renders when `deliveryCheck` prop is non-null (i.e., delivery API has responded)
- Online mode: shows chains where `delivers || click_and_collect`; chips include delivery fee or "איסוף" badge
- Physical mode: shows all chains (all represent stores in the city area)
- Empty state: "לא נמצאו חנויות באזור שלך" message
- Uses `SUPERMARKET_NAME_MAP` from `priceDbService` for Hebrew chain names

**Desktop Cart Sidebar** (left side, sticky):
- Fixed sidebar with full viewport height, sticky below header
- Header: item count + clear all button
- Scrollable item list with product thumbnail (40x40), name, manufacturer, price, qty control, remove button
- Footer: estimated total (₪XX.XX) + "Compare Prices" button
- Empty state: cart icon + "Start shopping!" message
- Weighted items disclaimer when applicable

**Mobile Cart Bar** (fixed bottom):
- Compact bar with item count, estimated total (~₪XX), and Compare Prices button
- `lg:hidden` — only shown on small screens

**Estimated Total**: `sum(product.min_price * product.amount)` for all products, using `computeWeightedTotal()` for weighted items.

**External Props** (from header/nav bar via App.tsx):
- `externalSearchQuery` — synced from the header search bar
- `externalCategory` — synced from the CategoryNavBar
- `onCategoryChange` — callback to sync category selection back to nav bar

---

## Services

### services/priceDbService.ts
**Location**: `services/priceDbService.ts`

Client-side service for the Israeli food prices API, proxied through `/price-api`.

**LRU Cache**: In-memory, 200 entries max with per-function TTLs.

#### Key Functions

**`getCategories()`** — TTL 30min
- `GET /api/products/categories`
- Returns `CategoryNode[]` (3-level tree: category → subcategory → sub_subcategory)

**`browseProducts(params)`** — TTL 5min
- `GET /api/products/browse`
- Params: `category`, `subcategory`, `sub_subcategory`, `is_vegan`, `allergen_free`, `delivery_city_name`, `store_type`, `limit`, `page`
- Returns `ProductBrowseResult` (`{ total, page, limit, products: DbProductEnhanced[] }`)

**`getProductDetail(barcode)`** — TTL 10min
- `GET /api/products/{barcode}`
- Returns `DbProductDetail` (product + `prices: ProductStorePrice[]`)
- `ProductStorePrice` includes `supermarket`, `price`, `effective_price`, `unit_qty`, `promotion`, `store`

**`searchProducts(query, limit, offset, city?, storeType?, is_vegan?, allergen_free?)`** — TTL 5min
- `GET /api/products/search`
- Returns `DbProductSearchResult`

**`compareListPrices(request)`**
- `POST /api/shopping-list/compare`
- Bulk price comparison for a full shopping list
- Groups branches by chain, picks best branch, computes savings

**`checkDelivery(city, street?)`**
- `POST /api/delivery/check`
- Returns per-chain delivery availability + eligible store ref IDs

#### Known Issues
- ~39.5% of products (~15,800 / 40,147) have images stored in S3 on Railway. Products without images show a `Package` placeholder icon.

#### Resolved Issues
- **Browse by category returned no products when city selected** — The `browseProducts()` call passed the city as `city` query param, but the API expects `delivery_city_name`. This caused the browse endpoint to return 0–1 results when a city was selected (same class of bug as the search/city fix in `cd5a124`). **Fixed in frontend**: `priceDbService.ts` now maps `city` → `delivery_city_name` for the browse endpoint.
- **`min_price` reflected only regular prices** — The browse/search endpoints computed `min_price` as `MIN(price)`, ignoring active promotions. This caused a visible inconsistency: a product card showed ₪14.90 as the best price while the detail modal showed ₪12.90 (Rami Levy promo). **Fixed in backend**: browse and search queries now compute `min_price` as `MIN(effective_price)` so the cheapest promotion price is always reflected in card display. `max_price` remains `MAX(price)` (the most expensive regular price, used as the "before discount" anchor).

---

### utils/priceFormat.ts
**Location**: `utils/priceFormat.ts`

Shared price formatting utilities used across all product-facing components. Central source of truth for how prices and units are displayed.

**Core concept**: `is_weighted` (from supermarket XML `bIsWeighted` field) gates all unit display:
- `true` → sold by weight — price IS per-unit, show unit suffix (/ ק״ג, / 100 ג׳, / ליטר). Defaults to per-kg when `unit_of_measure` is null.
- `false` → packaged product — ignore `unit_of_measure` (it's regulatory), use `unit_qty` for package size and unit price
- `null` → unknown — fall back to `unit_of_measure` heuristic

#### Exported Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `formatPriceLabel` | `(price, unitOfMeasure?, isWeighted?) → string` | Single price with unit suffix: `"₪8.90 / ק״ג"` or `"₪7.20"` |
| `formatPriceRange` | `(min, max?, unitOfMeasure?, isWeighted?) → string` | Price range: `"₪8.90 – ₪12.00 / ק״ג"` |
| `isWeightedProduct` | `(unitOfMeasure?, isWeighted?) → boolean` | Check if product is sold by weight |
| `unitBadgeLabel` | `(unitOfMeasure?, isWeighted?) → string \| null` | Badge text: `"ק״ג"`, `"100ג׳"`, `"ליטר"`, or null |
| `defaultCartUnit` | `(unitOfMeasure?, isWeighted?, name?) → 'kg' \| 'pcs'` | Default cart unit (kg for weighted, pcs otherwise). When `name` matches a unit-override pattern (see `utils/unitOverrides.ts`), forces `'pcs'` — used for whole produce sold by weight but purchased per unit (cabbage, cauliflower, watermelon, pineapple). |
| `formatWeightedSubprice` | `(price, unitOfMeasure?, isWeighted?) → string \| null` | Per-100g/100ml subprice for weighted products: `"≈ ₪9.99 / 100 ג׳"` (per-kg), `"≈ ₪1.50 / 100 מ״ל"` (per-liter). Returns null for packaged or per-100g products. |
| `computeWeightedTotal` | `(price, amount, cartUnit, unitOfMeasure?, isWeighted?, name?) → number \| null` | Estimated total for weighted cart items based on amount/unit. Supports kg↔g, 100g↔g, liter↔ml conversions. When a unit-override matches `name` and cart unit is `'pcs'`, computes `price × typicalKgPerUnit × amount`. |
| `normalizeUnitQty` | `(raw?) → string \| null` | Normalize whitespace and validate `unit_qty`. Allows: strings with leading number (`"400 גרם"` → `"400 גרם"`), per-unit labels (`"יחידה"`). Filters: bare regulatory units (`"קילוגרמים"` → `null`). |
| `parseUnitQty` | `(raw?) → ParsedUnitQty \| null` | Parse `unit_qty` into `{ value, unit, unitLabel }` (supports גרם, ק"ג, ליטר, מ"ל) |
| `formatUnitPriceLine` | `(price, unitQty?, isWeighted?) → string \| null` | Computed unit price: `"₪9.23 ל-100 גרם"` (400g @ ₪29.90), `"₪8.60 לליטר"` (500ml @ ₪4.30). Returns null for weighted products or missing data. |

**Used by**: `ProductCard`, `ProductDetailModal`, `SmartListPanel`, `ShoppingInputArea`, `ProductSearchInput`, `ShoppingListBreakdownModal`, `ProductCatalogArea`

---

### utils/unitOverrides.ts
**Location**: `utils/unitOverrides.ts`

Per-product unit overrides for items sold by weight at the supermarket but purchased as whole units by shoppers (cabbage, cauliflower, watermelon, pineapple). Inspired by Rami Levy's UX: "1 יחידה ≈ 1.2 ק״ג".

**How it works**: `getUnitOverride(name)` matches the product name against a regex list and returns `{ estimatedKgPerUnit }` when there's a match. `utils/priceFormat.ts` consults this in `defaultCartUnit()` (forces `'pcs'`) and `computeWeightedTotal()` (multiplies `price × estimatedKgPerUnit × amount`).

**Current overrides** (Hebrew pattern → kg):
- `כרוב לבן` / `כרוב אדום` → 1.2
- `כרובית` → 0.8
- `אבטיח` → 5.0
- `אננס` → 1.3

**Adding more items**: append a `{ pattern, kg }` entry. Regex matches anywhere in the name, so compound SKUs (e.g. `קוביות אבטיח`) will also match — tighten the pattern if that's undesired.

---

### services/geminiService.ts
**Location**: `services/geminiService.ts`

Handles shared AI interactions with OpenAI (list organization, recipes, ingredient suggestions). Product discovery AI functions (`parseShoppingList`, `smartAssistant`, `summarizeResults`) have been extracted to `agents_and_ai/product-discovery-assistant/aiService.ts`.

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
- Displays price comparison results with **basket strategy picker** on top
- Computes `BasketComparison` via `computeBasketComparison()` from `utils/basketStrategies.ts`
- **Layout**: City chip → `BasketStrategyPicker` → `BasketBreakdownView` (when strategy selected) → Action button → Collapsible "View all stores" (`SavingsReport`)
- Physical mode: "Organize for Store" button (single-store selection)
- Multi-store and online PricePilot actions deferred (PricePilot not ready)

#### `components/BasketStrategyPicker.tsx`
- Two side-by-side cards: **Single Store** (emerald) vs **Multi-Store** (indigo)
- Each card shows: store name(s), total cost, delivery fees (online), matched item count
- "מומלץ" badge on the recommended strategy (multi if savings ≥ ₪2, else single)
- Savings callout: "חסכו ₪X עם קנייה מ-Y חנויות" or "חנות אחת זולה יותר אחרי משלוח"
- Multi-store card disabled when only one store has items (identical to single)
- Minimum order warning badge when any store is below threshold

#### `components/BasketBreakdownView.tsx`
- Renders item-level breakdown for the selected strategy
- **Single store**: Item list with promo badges, subtotal, delivery fee, total, missing items
- **Multi store**: Per-store sections (store header + items + subtotal + delivery), grand total row, minimum order warnings (yellow), missing items

#### `utils/basketStrategies.ts`
- Pure computation utility, no side effects
- **`computeBasketComparison(comparison, isOnline)`**: Takes `ListPriceComparison` and returns `BasketComparison` with both strategies
- **Single store**: Best-ranked store from comparison (already sorted by match count + price)
- **Multi store**: Uses `cheapestPerItem` from API to group items by cheapest store, sums per-store subtotals + delivery fees, checks minimum orders
- **Recommendation**: Multi if savings ≥ ₪2 vs single, otherwise single
- Physical mode: delivery fees set to 0

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

### Product Images in Shopping Mode (February 2026)

Added product image support to the shopping mode search and selection flow. The API returns an `image_url` field for products that have images stored in S3 (Railway).

**Changes**:
- **`types.ts`**: Added `image_url: string | null` to `DbProduct` interface
- **`components/ProductSearchInput.tsx`**:
  - Added `ProductThumb` helper component with graceful fallback (shows `Package` icon when no image or on load error)
  - Search dropdown results now show a 40x40 product thumbnail alongside name, manufacturer, and price
  - Selected product chips now show a 24x24 round thumbnail before the product name
- Products without images in the database display a neutral placeholder icon — no broken image states

### Shopping Mode UX Improvements (February 2026)

#### Product Search Dropdown — Manufacturer & Barcode
- Search results now show manufacturer (when available) and barcode alongside name, image, and price

#### Selected Products — List View
- Replaced small chips with a proper list layout: 56x56 product images, product name, manufacturer, barcode, and price range per row
- Clean dividers between items with a remove button on each row

#### Price Comparison — Coverage-Based Ranking
Fixed a logic issue where stores with fewer items appeared "cheapest" simply because their partial total was lower.

**New logic**:
- **`services/priceDbService.ts`**: Stores now sorted by most matched items first, then cheapest within the same coverage tier. Savings are calculated only among stores in the top coverage tier.
- **`components/SavingsReport.tsx`**: Recommended badge goes to the store with best coverage + lowest price. Stores with full item coverage show match count in green; partial coverage stores appear dimmed with amber match count.

**Example**: If only Rami Levy has all 3 items at ₪32.30, it's recommended even though H. Cohen has 1 item at ₪9.00.

### Shopping List Persistence & Sidebar Grouping (February 2026)

#### Overview

Shopping mode products (`shoppingProducts: DbProduct[]`) previously existed only as local React state — lost on page refresh. This update adds full Firestore persistence for shopping lists and reorganizes the sidebar to separate organize/recipe lists from shopping lists.

Price comparison results are **not** saved — they're recalculated on demand.

#### Types Changes

- **`types.ts`**: Added `shoppingProducts?: DbProduct[]` to `ListDocument` (backward-compatible optional field)

#### Firestore Service

- **`services/firestoreService.ts`**: Two new functions:
  - `createShoppingList(title, ownerId, ownerEmail, shoppingProducts)` — creates a list with `appMode: 'shopping'` and `shoppingProducts`
  - `updateShoppingListProducts(listId, shoppingProducts, title?)` — updates products and timestamp on an existing shopping list

#### Sidebar Grouping

- **`components/Sidebar.tsx`**: Restructured into three collapsible sections:
  - **"My Lists"** (Sparkles icon, indigo) — organize/recipe lists + "Create New List" button
  - **"Shopping Lists"** (ShoppingCart icon, emerald) — shopping lists + "New Shopping List" button; items show product count instead of category count
  - **"Saved Recipes"** (ChefHat icon) — unchanged behavior
  - Added `onCreateShoppingList` prop
  - Lists split using `list.appMode` field: `appMode === 'shopping'` vs everything else

#### Shopping List Rename

- **`components/ShoppingInputArea.tsx`**: Header now displays the list title (falls back to "Build Your List"). When the list is saved:
  - Hover reveals a pencil icon
  - Click opens inline text input for renaming
  - Enter/blur commits, Escape cancels
  - Added `title` and `onTitleChange` optional props

#### App.tsx Wiring

- **Save logic**: `handleShoppingProductsChange(products)` — sets local state; on first product add (no active list), creates a Firestore shopping list via `createShoppingList()` and sets `activeListId`
- **Auto-save effect**: watches `shoppingProducts` changes and persists to Firestore with a ref-based guard to prevent circular saves from the sync effect
- **Load logic**: sync effect now detects shopping lists — restores `shoppingProducts`, resets `shoppingStep` to `'build_list'`, clears stale comparison state
- **Mode switching**: `handleAppModeSwitch` deselects the active list if it belongs to the other mode; sidebar `onSelect` auto-switches `appMode` based on the selected list's mode
- **`handleCreateShoppingList`**: switches to shopping mode with empty state (lazy Firestore creation — no doc until first product added)
- **Title**: passes `title` and `onTitleChange` (reuses existing `handleTitleUpdate`) to `ShoppingInputArea`

#### Translations

- **`constants/translations.ts`**: Added 4 sidebar keys (en + he):
  - `organizeLists` / `הרשימות שלי`
  - `shoppingLists` / `רשימות קניות`
  - `products` / `מוצרים`
  - `createNewShoppingList` / `רשימת קניות חדשה`

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `types.ts` | Modified | Added `shoppingProducts?: DbProduct[]` to `ListDocument` |
| `services/firestoreService.ts` | Modified | Added `createShoppingList`, `updateShoppingListProducts` |
| `constants/translations.ts` | Modified | Added sidebar section labels (en + he) |
| `components/Sidebar.tsx` | Modified | Split lists into two grouped sections, added `onCreateShoppingList` |
| `components/ShoppingInputArea.tsx` | Modified | Added editable title with `title`/`onTitleChange` props |
| `App.tsx` | Modified | Save/load/auto-save shopping lists, mode switching, new handlers, title prop wiring |

### Product Search Relevance Ranking (February 2026)

Improved product search results ordering so that exact/closest matches appear first.

**Problem**: Searching "חלב" (milk) returned protein powders ("אבקת חלבון") and chocolate bars before actual milk products. The API returned results alphabetically, so real milk products (starting with "חלב ") didn't appear until offset ~100-150 out of 529 matches.

**Fix**: API-side relevance sorting was added to `GET /api/products/search`. Results are now ranked:
1. Name **starts with** the query (highest priority)
2. Query appears as a **whole word** in the name
3. Query appears as a **substring** only (lowest priority)

**Client-side changes**:
- **`hooks/useProductSearch.ts`**: Removed client-side ranking workaround (no longer needed). Simplified back to a clean fetch of 10 results from the API, which now returns them in relevance order.

### Product Search Dropdown UX Improvement (February 2026)

Enlarged the product search dropdown for easier scanning and selection.

**Changes** (`components/ProductSearchInput.tsx`):
- Product thumbnails enlarged from 40x40 to 56x56
- Text bumped from `text-sm` to `text-base` for product names, `text-xs` to `text-sm` for metadata
- Row padding increased (`py-2.5` → `py-3.5`, `gap-3` → `gap-4`)
- Dropdown max height increased from `max-h-64` (16rem) to `max-h-[28rem]` (28rem)
- Added subtle row dividers (`border-b border-slate-50`)
- Price styled in emerald bold to match shopping mode theme

### PricePilot: Google ADK Agent Conversion (February 2026)

#### Overview

Converted PricePilot from a TypeScript multi-module system (`packages_for_online_buying_agent/`) to a **Google ADK (Agent Development Kit) Python agent** designed for deployment on **Vertex AI Agent Engine**, using **Anthropic Claude** as the LLM.

The agent's mission: take a user's shopping list from Lista, navigate supermarket websites autonomously via Playwright, handle the entire shopping flow, and return checkout links to the user in the Lista app's PricePilot sidebar.

Telegram bot integration was removed — all communication happens through the Lista app chat UI.

#### Architecture: Multi-Agent Orchestrator

The system uses an orchestrator agent with four specialized sub-agents, leveraging ADK's native agent transfer:

```
                    ┌─────────────────────┐
                    │   OrchestratorAgent  │  (LlmAgent - Claude)
                    │   Routes workflow    │
                    └──────────┬──────────┘
                               │ agent transfer
          ┌────────────────────┼────────────────────┐
          │                    │                     │
    ┌─────▼─────┐      ┌──────▼──────┐      ┌──────▼──────┐
    │   List     │      │   Store     │      │  Checkout   │
    │ Interpreter│      │  Navigator  │      │  Builder    │
    │ (LlmAgent) │      │ (LlmAgent)  │      │ (LlmAgent)  │
    └───────────┘      └──────┬──────┘      └─────────────┘
                               │
                        ┌──────▼──────┐
                        │   Browser   │
                        │   Agent     │
                        │ (LlmAgent)  │
                        │ + Playwright│
                        └─────────────┘
```

#### New Directory: `pricepilot-agent/`

Complete Python project with ADK agents, Playwright browser tools, FastAPI server, and Vertex AI deployment config. See `pricepilot-agent/PRICEPILOT.md` for full details.

Key directories:
- `pricepilot/agents/` — 5 ADK agent definitions (orchestrator, list_interpreter, store_navigator, browser_agent, checkout_builder)
- `pricepilot/tools/` — 14 tool functions (browser automation, store search, cart management, checkout)
- `pricepilot/api/` — FastAPI REST server for Lista integration
- `tests/` — Unit tests for tools and agents
- `deploy/` — Dockerfile, Cloud Build, Vertex AI config

#### Lista App Changes

##### `services/agentService.ts` — Async API Integration

All three main functions converted from synchronous to async, now calling the PricePilot Agent API:

| Function | Before | After |
|----------|--------|-------|
| `startAgentSession()` | Synchronous, in-memory | Async, calls `POST /sessions` |
| `handleButtonAction()` | Synchronous, in-memory | Async, calls `POST /sessions/{id}/message` |
| `processUserMessage()` | Synchronous, in-memory | Async, calls `POST /sessions/{id}/message` |

Each function includes automatic fallback to local logic when the API is unavailable.

New internal functions:
- `apiCreateSession()` — HTTP call to create agent session
- `apiSendMessage()` — HTTP call to send message to agent

##### `components/PriceAgentChat.tsx` — Async Handlers

Updated all event handlers to be async to work with the new async service:
- `initializeSession()` — now `async`, awaits `startAgentSession()`
- `handleSendMessage()` — now `async`, awaits `processUserMessage()`
- `handleButtonClick()` — now `async`, awaits `handleButtonAction()`
- `handleStoreSelectionComplete()` — now `async`, awaits `handleButtonAction()`

UI and layout unchanged.

##### `.env` — New Variable

Added `NEXT_PUBLIC_AGENT_API_URL=http://localhost:8000` — configurable per environment (local dev vs Vertex AI production).

#### Migration Reference

| TypeScript Module | Python Equivalent | Notes |
|---|---|---|
| `orchestrator.ts` (15-state FSM) | `agents/orchestrator.py` | FSM replaced by LLM-driven routing with `session.state` |
| `ListInterpreterAgent` | `agents/list_interpreter.py` | Same logic, Pydantic output |
| `AutonomousBrowserAgent` + `SmartBrowserAgent` | `agents/browser_agent.py` | Unified into single ADK agent with Playwright tools |
| `VisionModule` + `DOMParser` + `ActionPlanner` | Built into browser_agent prompt + tools | Claude vision handles screenshots natively |
| `CatalogSearchAgent` | Absorbed into browser_agent | Browser agent searches directly on store websites |
| `CartBuilderAgent` | `agents/checkout_builder.py` | Cart state in `session.state` |
| `SavingsCalculatorAgent` | `tools/cart_tools.py` | Pure function tool |
| `CheckoutLinkAgent` | `tools/checkout_tools.py` | Pure function tool |
| `StoreAdapter` interface | Not needed | Browser agent navigates any store directly |
| Telegram agents | Removed | Lista chat UI handles conversation |

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `pricepilot-agent/` (25 files) | **New** | Complete Python ADK agent project |
| `services/agentService.ts` | Modified | Async API calls with local fallback |
| `components/PriceAgentChat.tsx` | Modified | Async event handlers |
| `.env` | Modified | Added `NEXT_PUBLIC_AGENT_API_URL` |

### Store Branch Selection in Price Comparison (February 2026)

#### Overview

Added branch-level price comparison for physical shopping mode. The price comparison API returns per-store prices with branch details (`store_id`, `address`, `city`). The same supermarket chain can have multiple branches in one city with different prices. Lista now:

1. **Auto-selects the cheapest branch** per chain as the default display
2. **Shows the branch address** under the store name with a MapPin icon
3. **Lists other branches** of the same chain with their pre-computed totals
4. **Lets users switch branches** — clicking a different branch recalculates the displayed prices locally (no new API calls)

Online mode (no `store` objects in API response) is unaffected — chains dedup as before.

#### New Types

| Type | Definition | Purpose |
|------|-----------|---------|
| `DbStoreDetail` | `{ store_id, store_name, city, address, is_online }` | Branch metadata from API |
| `StoreBranch` | `{ storeId, address, totalCost, itemPrices }` | Pre-computed totals for one branch |

#### Extended Types

| Type | New Fields | Purpose |
|------|-----------|---------|
| `DbStorePrice` | `store?: DbStoreDetail` | Optional branch info on each price entry |
| `StorePriceSummary` | `storeAddress?`, `selectedStoreId?`, `availableBranches?: StoreBranch[]` | Branch selection state per chain |

#### Price Service Changes (`services/priceDbService.ts`)

The `compareListPrices()` function now detects whether the API returned branch-level data (physical mode) or flat chain data (online mode):

- **Physical mode** (prices have `store` objects with `is_online: false`):
  - Groups all prices by `chainName::storeId` (branch key)
  - Computes per-branch totals across all items
  - Sorts branches cheapest-first per chain
  - Stores all branches in `availableBranches[]` on the `StorePriceSummary`
  - Sets default display to cheapest branch (`selectedStoreId`, `storeAddress`)

- **Online mode** (no `store` objects): Unchanged — keeps the original cheapest-per-chain dedup

#### UI Changes

##### `components/SavingsReport.tsx` — StoreRow

- **Address display**: Shows `MapPin` icon + branch address under the store name when available
- **Branch selector**: When `availableBranches` has >1 entry, an expandable "N more branches" toggle appears in the expanded item breakdown
  - Each branch row shows address + total cost
  - Clicking a branch updates the displayed total, item prices, and address using pre-computed data
  - Local state only (`selectedBranchIndex`) — no API calls on branch switch

##### `components/ShoppingPriceStep.tsx` — Cheapest Store Banner

- The "Shop at X and save" recommendation banner now shows the branch address below the savings message when available

#### Translations

| Key | English | Hebrew |
|-----|---------|--------|
| `priceComparison.otherBranches` | More branches | סניפים נוספים |
| `priceComparison.branch` | Branch | סניף |

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `types.ts` | Modified | Added `DbStoreDetail`, `StoreBranch`; extended `DbStorePrice`, `StorePriceSummary` |
| `services/priceDbService.ts` | Modified | Branch-aware grouping in `compareListPrices()`, pre-compute per-branch totals |
| `components/SavingsReport.tsx` | Modified | Address display, branch selector dropdown in StoreRow |
| `constants/translations.ts` | Modified | 2 new keys (`otherBranches`, `branch`) |
| `components/ShoppingPriceStep.tsx` | Modified | Show address in cheapest store banner |

### Online Shopping Mode: Delivery Coverage Filtering (February 2026)

#### Overview

When a user compares prices in **online mode**, the system now only shows online supermarkets that actually deliver to their selected city. The DB API was updated with a `store_delivery_coverage` table (306 records across 3 online stores) and exposes delivery fee and minimum order data per store.

#### API Changes Consumed

| Endpoint | New Behavior |
|----------|-------------|
| `GET /api/cities?store_type=online` | Returns only cities where at least one online store delivers (306 proper city names) |
| `GET /api/cities?store_type=physical` | Returns physical store cities, filtered to remove garbage entries |
| `GET /api/products/{barcode}?city=...&store_type=online` | Store object now includes `delivery_fee` and `minimum_order` for online stores |

#### New & Extended Types (`types.ts`)

| Type | New Fields | Purpose |
|------|-----------|---------|
| `DbStoreDetail` | `delivery_fee?: number`, `minimum_order?: number \| null` | Delivery info from API per online store |
| `StorePriceSummary` | `deliveryFee?: number`, `minimumOrder?: number \| null`, `totalWithDelivery?: number` | Delivery-inclusive comparison data |

#### Price Service Changes (`services/priceDbService.ts`)

- **`getCities(storeType?)`**: Now accepts optional `storeType` param, passes `?store_type=online` to the API so the city dropdown shows only delivery-covered cities in online mode
- **`compareListPrices()`**:
  - Captures `delivery_fee` and `minimum_order` from the API response per store in online/no-branch mode
  - Computes `totalWithDelivery = totalCost + deliveryFee` for online stores
  - Sorts stores by delivery-inclusive totals (`totalWithDelivery` when available)
  - Savings calculation uses delivery-inclusive totals for accurate comparison

#### UI Changes

##### `components/SavingsReport.tsx` — StoreRow

- **Headline total**: Shows `totalWithDelivery` (products + delivery) as the main price when delivery info is available
- **Delivery line item**: Expanded view shows a delivery fee row with Truck icon below product prices, plus a "Total incl. delivery" summary line
- **Minimum order warning**: Amber banner with AlertTriangle icon when the cart total is below the store's minimum order threshold

##### `components/ShoppingPriceStep.tsx` — Online Mode

- Online mode now shows a **recommendation box** (similar to physical mode) with:
  - Products subtotal breakdown
  - Delivery fee breakdown
  - Total with delivery as the headline number
  - Minimum order warning if applicable
- "Build Cart" button preserved below the recommendation

#### City Dropdown Filtering (`App.tsx`)

- City list refetches when `selectedShoppingMode` changes (e.g. physical → online)
- Online mode shows only the ~306 delivery-covered cities
- Physical mode shows physical store cities (now cleaned of garbage entries by the API)
- Uses a ref (`lastCityFetchMode`) to avoid redundant fetches

#### Translations (`constants/translations.ts`)

| Key | English | Hebrew |
|-----|---------|--------|
| `priceComparison.deliveryFee` | Delivery | משלוח |
| `priceComparison.subtotal` | Products | מוצרים |
| `priceComparison.totalWithDelivery` | Total incl. delivery | סה״כ כולל משלוח |
| `priceComparison.minimumOrder` | Minimum order | הזמנה מינימלית |
| `priceComparison.belowMinimum` | Below minimum order | מתחת להזמנה מינימלית |

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `types.ts` | Modified | Added `delivery_fee`, `minimum_order` to `DbStoreDetail`; added `deliveryFee`, `minimumOrder`, `totalWithDelivery` to `StorePriceSummary` |
| `services/priceDbService.ts` | Modified | `getCities()` accepts `storeType`; `compareListPrices()` captures delivery data, computes delivery-inclusive totals and sorting |
| `components/SavingsReport.tsx` | Modified | Delivery fee line, total-with-delivery headline, minimum order warning |
| `components/ShoppingPriceStep.tsx` | Modified | Online mode recommendation box with delivery breakdown |
| `constants/translations.ts` | Modified | 5 new delivery-related keys (en + he) |
| `App.tsx` | Modified | City list refetches per shopping mode type |

### Shopping Mode: Amount & Unit Editing (February 2026)

#### Overview

Shopping mode products were previously read-only after selection — users could only remove items, not adjust quantities or units. The price comparison hardcoded `amount: 1` and `unit: 'pcs'` for every product. This update adds full amount/unit editing to the shopping list, matching the UX from Organize mode's `CategoryItem`.

#### New Type: `ShoppingProduct` (`types.ts`)

```typescript
interface ShoppingProduct extends DbProduct {
  amount: number;  // default 1
  unit: Unit;      // default 'pcs'
}
```

- `ListDocument.shoppingProducts` type changed from `DbProduct[]` to `ShoppingProduct[]`
- Backward compatible: existing Firestore docs without `amount`/`unit` get defaults on load via `p.amount ?? 1, p.unit ?? 'pcs'`

#### Amount/Unit Controls (`components/ProductSearchInput.tsx`)

- Added `onUpdateProduct(barcode, { amount?, unit? })` callback prop
- Each selected product row now shows:
  - **Amount input**: number field with unit-aware stepping
  - **Unit selector**: native `<select>` with options [pcs, g, kg, L, ml], localized via `tUnit()`
- When a product is selected from search, it's wrapped with `{ ...product, amount: 1, unit: 'pcs' }`

#### Unit-Type-Specific Stepping

- **pcs**: step `1`, min `1`, values snap to whole numbers (1, 2, 3...)
- **g, kg, L, ml**: step `0.5`, min `0.5`, values snap to 0.5 increments (0.5, 1, 1.5, 2...)
- Switching unit to pcs auto-snaps the amount (e.g. 1.5 → 2)

#### Price Comparison Uses Actual Amounts (`App.tsx`)

- `handleShoppingCompare()` and `handleShoppingOnline()` now use `p.amount` and `p.unit` instead of hardcoded `1` / `'pcs'`
- Products with `amount: 3` correctly show 3x multiplied prices in the comparison report

#### Per-Unit Price Breakdown in Report (`components/SavingsReport.tsx`)

Updated the item breakdown rows in the expanded store view:
- **Single item** (amount = 1): Shows unit price only — `item name    ₪7.90    ₪7.90`
- **Multiple items** (amount > 1): Shows unit price × quantity — `item name    ₪7.90 × 6    ₪47.40`
- Three-column layout: item name (truncates), per-unit price (with multiplier), total price (bold)

#### Firestore Sync Fix (`App.tsx`)

Fixed a bug where editing amount/unit kicked the user back to the setup step:
- **Root cause**: Every product edit triggered Firestore save → snapshot → sync effect → `setShoppingStep('setup')`
- **Fix**: Added `prevActiveListIdRef` to distinguish list switches from Firestore echoes. Shopping UI navigation state (`shoppingStep`, `priceComparison`, city/mode) only resets when the user actually switches lists.

#### Shopping List View in Sidebar

Added the ability to view shopping list products directly from the sidebar, matching the recipe view pattern.

##### New Component: `components/ShoppingListBreakdownModal.tsx`
- Modal showing all products in a shopping list
- Each product displays: image thumbnail, name, manufacturer, barcode, price range, and an emerald badge with amount + localized unit
- Responsive layout with scrollable product list

##### Sidebar Changes (`components/Sidebar.tsx`)
- Each shopping list with products now shows a "View" button (Eye icon) below the list name
- Clicking opens `ShoppingListBreakdownModal` with the list's products
- The list row itself remains clickable to select/load (unchanged behavior)
- Backward compat: defaults `amount: 1, unit: 'pcs'` for older products

#### Mobile Header Layout Fix (`components/ShoppingInputArea.tsx`)

Fixed the "Back to Setup" button overlapping the title on mobile:
- Replaced `absolute` positioning with a proper 3-column flex layout: `[back button] [centered title] [spacer]`
- On mobile, back button text is hidden (`hidden sm:inline`) — only the chevron arrow shows
- Matching spacer keeps the title centered

#### Translations (`constants/translations.ts`)

| Key | English | Hebrew |
|-----|---------|--------|
| `sidebar.viewProducts` | View | צפה |

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `types.ts` | Modified | Added `ShoppingProduct` interface; updated `ListDocument.shoppingProducts` type |
| `components/ProductSearchInput.tsx` | Modified | Added `onUpdateProduct` prop; amount input + unit select per product row; unit-aware stepping |
| `components/ShoppingInputArea.tsx` | Modified | Updated prop types to `ShoppingProduct[]`; added `handleUpdateProduct`; fixed mobile header layout |
| `components/SavingsReport.tsx` | Modified | Per-unit price + total columns in item breakdown |
| `components/ShoppingListBreakdownModal.tsx` | **New** | Modal for viewing shopping list products with full details |
| `components/Sidebar.tsx` | Modified | Added "View" button for shopping lists; wired up `ShoppingListBreakdownModal` |
| `services/firestoreService.ts` | Modified | Updated param types from `DbProduct[]` to `ShoppingProduct[]` |
| `constants/translations.ts` | Modified | Added `sidebar.viewProducts` (en + he) |
| `App.tsx` | Modified | `ShoppingProduct` state type; backward-compat defaults on load; actual amounts in comparison; sync effect fix with `prevActiveListIdRef` |

### Consistent Sidebar Actions: View & Use for All List Types (February 2026)

#### Overview

Made the sidebar card layout consistent across all three list sections (My Lists, Shopping Lists, Saved Recipes). Previously, only recipes had both View and Use buttons — organize lists had click-to-select only, and shopping lists had View only. Now all three sections use the same card pattern with View + Use action buttons.

#### New Component: `components/OrganizeListBreakdownModal.tsx`

Modal for viewing organize list contents, following the same pattern as `ShoppingListBreakdownModal`:

- **Header**: List icon + title + category/item count + close button (indigo color scheme)
- **Body**: Scrollable. For each `CategoryGroup`:
  - Category name as section header (indigo, with item count)
  - Items shown as rows: checked status (indigo circle), name (with strikethrough if checked), amount + unit badge (indigo), recipe labels (colored pills)
- **Footer**: Close button (indigo)

Props: `{ isOpen, onClose, list: ListDocument }`

#### Sidebar Changes (`components/Sidebar.tsx`)

All three sections now use the same card layout:

```
┌─────────────────────────────────────┐
│  [icon] Item Name            🗑 (hover)
│         subtitle info
│  ┌──────────┐ ┌──────────────┐
│  │ 👁 צפה  │ │ ✏️ השתמש   │
│  └──────────┘ └──────────────┘
└─────────────────────────────────────┘
```

- **View button**: emerald-100/200 bg, emerald-700 text, Eye icon
- **Use button**: indigo-100/200 bg, indigo-700 text, PenLine icon

Changes per section:
- **My Lists (Organize)**: Removed click-to-select on entire row. Added View (opens `OrganizeListBreakdownModal`) and Use (selects list + closes sidebar) buttons
- **Shopping Lists**: Added Use button next to existing View. Both buttons now always shown (previously View was conditional on `hasProducts`)
- **Saved Recipes**: Switched from `sidebar.viewRecipe`/`sidebar.useRecipe` to generic `sidebar.view`/`sidebar.use` translation keys (same display text, unified keys)

Added `viewingOrganizeList` state for the new modal.

#### Translations (`constants/translations.ts`)

| Key | English | Hebrew |
|-----|---------|--------|
| `sidebar.view` | View | צפה |
| `sidebar.use` | Use | השתמש |

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `constants/translations.ts` | Modified | Added generic `sidebar.view` and `sidebar.use` keys (en + he) |
| `components/OrganizeListBreakdownModal.tsx` | **New** | Modal for viewing organize list categories & items |
| `components/Sidebar.tsx` | Modified | Consistent View+Use buttons across all sections; imported new modal; added `viewingOrganizeList` state |

### Product Search: City Filter Fix (February 2026)

#### Problem

After the delivery coverage filtering feature was added, product search in shopping mode returned 0 results whenever a city was selected in the setup step. Typing in the search box (e.g. "חלב") showed nothing — no spinner, no results, no error.

#### Root Cause

The `searchProducts()` function in `priceDbService.ts` was passing the `city` parameter to the `/api/products/search` endpoint, but that endpoint does not support city filtering — it returns 0 results for any `city` value. The `city` parameter is only supported by the price comparison endpoints (`/api/prices/compare/{barcode}` and `/api/products/{barcode}`).

The `store_type` parameter works correctly on the search endpoint (filters by online/physical stores).

#### Fix

Stopped passing `city` to the search API call in `searchProducts()`. The `city` parameter is kept in the function signature and cache key (for future API support), and continues flowing through the component hierarchy for use by price comparison.

#### Known API-Side Issue: Physical Store City Codes

During investigation, a separate API/DB issue was identified: some physical stores have **city codes** (e.g. `"3000"`) in their `city` field instead of proper names (e.g. `"ירושלים"`). This causes the `city` filter on price comparison endpoints to miss physical stores. Example: Rami Levy Talpiot (Jerusalem) has `city="3000"` in the DB, so `?city=ירושלים` doesn't match it. This needs a DB-side fix to normalize city codes to names.

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `services/priceDbService.ts` | Modified | Removed `city` param from search API call; `store_type` still passed |

### Street-Level Address Autocomplete via data.gov.il (February 2026)

#### Overview

Replaced the city-only dropdown in the Shopping Mode setup step with a **street-level address autocomplete** powered by the free Israeli government **data.gov.il** API. This provides finer-grained location selection (street + city) and returns city codes (`סמל_ישוב`) which can help resolve city code mismatches in the food prices database.

**Architecture**: User types address → data.gov.il autocomplete → picks suggestion → city extracted automatically → passed to food prices API.

#### API Details

- **Endpoint**: `GET https://data.gov.il/api/3/action/datastore_search`
- **Resource**: `9ad3862c-8391-4b2f-84a4-2d4c68625f4b` (Israeli streets dataset, 63,257 records)
- **Auth**: None required (free, public API)
- **Proxied via**: `/gov-data-api` (Vite dev proxy + Vercel rewrite for CORS)

#### New Files

| File | Purpose |
|------|---------|
| `services/govDataService.ts` | data.gov.il API client. `searchAddresses(query, limit)` returns `AddressSuggestion[]` with `streetName`, `cityName`, `cityCode`, `streetCode`, `displayText`. Deduplicates by street+city pair. |
| `hooks/useAddressAutocomplete.ts` | React hook following the `useProductSearch` pattern. Uses `useDebounce(300ms)`, manages query/suggestions/selectedAddress state. Provides `selectAddress()` and `clearSelection()`. |

#### Type Changes (`types.ts`)

| Type | Change |
|------|--------|
| `UserLocation` | Added `cityCode?: number` (סמל_ישוב) and `streetName?: string` (שם_רחוב) |
| `ListDocument` | Added `shoppingLocation?: UserLocation` for full location persistence |

#### Component Changes

**`ShoppingSetupStep.tsx`** — Fully rewritten:
- Replaced city dropdown with address autocomplete input (Search icon, emerald accents)
- Suggestions dropdown shows: **street name** (bold) + city name (secondary text)
- After selection: shows address badge with city subtitle and a clear/change button
- Fallback mode: if data.gov.il returns no results, user can switch to the old city list from the prices API
- New props: `onLocationChange`, `selectedLocation`

#### App.tsx Changes

- New state: `shoppingLocation: UserLocation | null`
- localStorage persistence for `shoppingLocation` (alongside existing `shoppingCity`)
- Firestore restore: reads `shoppingLocation` from `ListDocument` on list switch
- Passes `onLocationChange` and `selectedLocation` to `ShoppingSetupStep`
- Resets `shoppingLocation` on mode switch and new list creation

#### Infrastructure Changes

- **`vite.config.ts`**: Added `/gov-data-api` dev proxy → `https://data.gov.il`
- **`vercel.json`**: Added `/gov-data-api` production rewrite → `https://data.gov.il`

#### Firestore Changes

- **`firestoreService.ts`**: `createShoppingList()` now accepts and persists `shoppingLocation`

#### Translation Changes (`constants/translations.ts`)

New keys in `appMode` section (EN/HE):
- `searchAddress` — "Search for street or city..." / "...חפש רחוב או עיר"
- `selectedLocation` — "Selected location" / "מיקום נבחר"
- `changeLocation` — "Change" / "שנה"
- `noAddressResults` — "No addresses found" / "לא נמצאו כתובות"
- `searchingAddresses` — "Searching..." / "...מחפש"

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `services/govDataService.ts` | **New** | data.gov.il address autocomplete service |
| `hooks/useAddressAutocomplete.ts` | **New** | React hook with debounce for address search |
| `types.ts` | Modified | `UserLocation` expanded with `cityCode`/`streetName`; `ListDocument` gets `shoppingLocation` |
| `components/ShoppingSetupStep.tsx` | Modified | Replaced city dropdown with address autocomplete UI |
| `App.tsx` | Modified | Added `shoppingLocation` state, persistence, props wiring |
| `services/firestoreService.ts` | Modified | `createShoppingList()` accepts `shoppingLocation` |
| `constants/translations.ts` | Modified | Added 5 address-related keys (EN + HE) |
| `vite.config.ts` | Modified | Added `/gov-data-api` dev proxy |
| `vercel.json` | Modified | Added `/gov-data-api` production rewrite |

### Single-Endpoint Price Comparison with Promotions (February 2026)

#### Overview

Replaced the N+1 per-product price comparison calls with a **single `POST /api/shopping-list/compare`** endpoint. The API now handles all comparison logic server-side — store matching, branch grouping, promotion application, delivery fees — and returns a fully computed result. Lista just renders it.

Also surfaces **promotion data** in the price breakdown UI: strikethrough original prices, promotion descriptions, and expiration warnings.

#### API Contract

**Request**: `POST /api/shopping-list/compare`
```json
{
  "items": [{ "barcode": "7290000066318", "quantity": 2 }],
  "city": "ירושלים",
  "city_code": 3000,
  "store_type": "online"
}
```

**Response** (per store): `store_ref_id`, `store_name`, `city`, `address`, `is_online`, `matched_items`, `total_items`, `subtotal`, `delivery_fee`, `minimum_order`, `below_minimum_order`, `total`, `items[]` (with `unit_price`, `effective_unit_price`, `promotion`), `missing_items[]`

**Top-level**: `cheapest_store`, `cheapest_per_item`, `savings_vs_most_expensive`

#### Type Changes (`types.ts`)

| Type | Change |
|------|--------|
| `ItemPromotion` | **New** — `{ description, type, endsAt }` |
| `ItemPriceDetail` | Added `originalPrice?: number` and `promotion?: ItemPromotion` |

#### Price Service Changes (`services/priceDbService.ts`)

- **Removed**: `withConcurrencyLimit` helper, `ItemForComparison` interface, entire N+1 comparison logic (~150 lines)
- **Added**: `ShoppingListCompareRequest` interface, `ApiStore`/`ApiStoreItem`/`ApiCompareResponse` types for the new endpoint
- **`compareListPrices()`**: Now accepts `ShoppingListCompareRequest` (items, city, city_code, store_type) instead of `CategoryGroup[]`. Makes a single POST call, maps response to `ListPriceComparison`. Includes promotion data in `ItemPriceDetail` mapping.
- Passes `city_code` from address autocomplete for better store matching

#### App.tsx Changes

- `handleShoppingCompare()`: Simplified — builds `{ items, city, city_code, store_type }` directly from `shoppingProducts` instead of constructing temporary `CategoryGroup[]`

#### UI Changes (`components/SavingsReport.tsx`)

Per-item price breakdown now shows:
- **Strikethrough original price** when a promotion applies (e.g., ~~₪6.90~~ ₪5.90)
- **Promotion badge** with Tag icon and description text (rose color)
- **Expiration warning** for promos ending within 48h: "Ends today" / "Ends tomorrow" / "Ends soon"

#### Translation Changes (`constants/translations.ts`)

New keys in `priceComparison` section (EN/HE):
- `endsToday` — "Ends today" / "מסתיים היום"
- `endsTomorrow` — "Ends tomorrow" / "מסתיים מחר"
- `endsSoon` — "Ends soon" / "מסתיים בקרוב"

#### Known Limitation

Only Rami Levy has delivery coverage data in the DB. Shufersal, Victory, H. Cohen, and Market Warehouses online stores have no delivery rows yet — so `store_type: "online"` only returns Rami Levy results.

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `services/priceDbService.ts` | Modified | Replaced N+1 calls with single POST; added promotion mapping |
| `types.ts` | Modified | Added `ItemPromotion`, extended `ItemPriceDetail` |
| `App.tsx` | Modified | Simplified `handleShoppingCompare` |
| `components/SavingsReport.tsx` | Modified | Promotion badges, strikethrough prices, expiration warnings |
| `constants/translations.ts` | Modified | Added 3 promotion-related keys (EN + HE) |

---

### Service Worker POST Fix & City Name Normalization (February 2026)

#### Service Worker Fix

The service worker was intercepting `POST` requests to `/price-api/api/shopping-list/compare` and attempting to cache them via `Cache.put()`, which only supports `GET`. This caused the request to silently fail — the comparison returned no results.

**Fix**: Added `method !== 'GET'` early-return in the service worker's fetch handler. Bumped cache version to `v4` to force update.

#### City Name Normalization (קרית vs קריית)

data.gov.il uses the spelling `קרית` (single yod) for cities like קרית אונו, while the food prices DB delivery coverage table uses `קריית` (double yod). This mismatch caused online stores to not appear for affected cities.

**Fix**: Added a normalization map in `govDataService.ts` that converts data.gov.il's spelling to match the DB convention for all `קרית/קריית` city variants (13 cities covered).

**Affected cities**: קרית אונו, קרית גת, קרית טבעון, קרית יערים, קרית ספר, קרית אתא, קרית ביאליק, קרית חיים, קרית ים, קרית מוצקין, קרית מלאכי, קרית שמונה, קרית עקרון

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `service-worker.js` | Modified | Skip non-GET requests; bump cache to v4 |
| `services/govDataService.ts` | Modified | Added `CITY_NAME_NORMALIZATIONS` map for קרית→קריית |

---

### PricePilot Agent Redesign: Single Cart-Building Browser Agent (February 2026)

#### Overview

Redesigned the PricePilot agent from a 5-agent orchestrator architecture to a **single `LlmAgent`** with 10 Playwright browser tools. The previous multi-agent system (orchestrator → list_interpreter → store_navigator → browser_agent → checkout_builder) re-did work that Lista already handles via its DB API, and blew up to 208K tokens per session from redundant agent hops and context accumulation.

**New paradigm**: Lista does price comparison via DB API. The agent's ONLY job is:
1. Receive the user's chosen store + item list (from Lista's comparison results)
2. Browse that ONE store's website with Playwright
3. Search each item, add to cart
4. Handle user interaction mid-flow (product disambiguation, registration, OTP)
5. Return the checkout URL

Estimated ~36K tokens per 15-item session vs the old 208K.

#### New Architecture

```
Lista App
    │
    ▼
┌─────────────────────────────────────┐
│  FastAPI Server  (api/server.py)    │
│  POST /sessions (BuildCartRequest)  │
│  POST /sessions/{id}/message        │
│  GET  /sessions/{id}                │
│  DELETE /sessions/{id}              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  cart_builder  (agent.py)           │
│  Single LlmAgent — Claude Sonnet   │
│  10 Playwright browser tools        │
│                                     │
│  Phase 1: Navigate to store         │
│  Phase 2: Search & add each item    │
│  Phase 3: Go to cart → checkout     │
└─────────────────────────────────────┘
```

#### Deleted Files (10 files)

| File | Reason |
|------|--------|
| `pricepilot/agents/orchestrator.py` | No more multi-agent orchestration |
| `pricepilot/agents/list_interpreter.py` | Lista provides parsed items with barcodes |
| `pricepilot/agents/store_navigator.py` | Store selected in Lista before agent launches |
| `pricepilot/agents/checkout_builder.py` | Savings done by DB API; checkout URL from browser |
| `pricepilot/agents/__init__.py` | Entire `agents/` directory removed |
| `pricepilot/tools/search_tools.py` | Store discovery not needed |
| `pricepilot/tools/cart_tools.py` | Multi-store comparison not needed |
| `pricepilot/tools/checkout_tools.py` | Checkout URL captured live from browser |
| `tests/test_list_interpreter.py` | Tests deleted code |
| `tests/test_checkout.py` | Tests deleted code |

#### Rewritten Files

##### `pricepilot/agent.py` — Single Root Agent

Replaced the orchestrator import with a single `LlmAgent` named `cart_builder` that has all 10 browser tools. The agent instruction prompt covers:
- Receives a JSON payload: `{store_name, store_url, city, items[]}`
- Phase 1: Navigate to store, dismiss popups, handle delivery address
- Phase 2: For each item — search, evaluate results, add to cart (or ask user if ambiguous)
- Phase 3: Go to cart, proceed to checkout, return URL
- Hebrew supermarket tips (button text, selectors)
- Rules: strategic screenshot usage, skip items after 2 failed attempts, progress updates

##### `pricepilot/config.py` — Store URL Mapping

- Removed `SAVINGS_FEE_PERCENT` and `ISRAELI_SUPERMARKETS` list
- Added `STORE_URLS: dict[str, str]` mapping Hebrew store names to online shopping URLs (7 stores + English aliases)
- Increased `MAX_BROWSER_ACTIONS` from 50 to 100

##### `pricepilot/types.py` — Simplified Models

Removed all old models (ShoppingItem, Product, Store, PricingPlan, SavingsReport, etc.). New models:
- `CartItem` — `{name, quantity, barcode?, manufacturer?}`
- `BuildCartRequest` — `{user_id, store_name, store_url?, city?, items: CartItem[]}`
- `MessageRequest` — `{user_id, text}`
- `ChatMessageOut` — `{id, type, text, timestamp}`
- `SessionCreatedResponse` — `{session_id, messages[]}`
- `MessageResponse` — `{messages[], status?}` (status: in_progress/checkout_ready/error)
- `SessionStatusResponse` — `{session_id, status, messages[], checkout_url?, items_added, items_failed[]}`

##### `pricepilot/api/server.py` — New API Contract

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sessions` | Start cart-building session (BuildCartRequest) — resolves store URL from `STORE_URLS`, returns 400 for unknown stores |
| `POST` | `/sessions/{id}/message` | User reply (disambiguation, OTP) |
| `GET` | `/sessions/{id}?user_id=` | Session status with progress |
| `DELETE` | `/sessions/{id}?user_id=` | End session + close browser |
| `GET` | `/health` | `{status: "ok", version: "0.2.0"}` |

Key changes: store URL resolution with case-insensitive lookup, browser cleanup on delete and shutdown, proper error handling with try/catch around `runner.run_async()`.

#### New Test Files

- **`tests/test_agent.py`** — Verifies root_agent exists, has 10 tools, no sub-agents, instruction covers all 3 phases
- **`tests/test_api.py`** — Health check, store URL resolution (Hebrew/English/override), unknown store returns 400

#### Updated Files

- **`test_agent.py`** (integration script) — Uses new `BuildCartRequest` format with `store_name` and `city` instead of `list_id` and `grocery_list`
- **`.env.example`** — Removed `SAVINGS_FEE_PERCENT`, updated `MAX_BROWSER_ACTIONS=100`
- **`PRICEPILOT.md`** — Complete rewrite for single-agent architecture

#### Final File Tree

```
pricepilot-agent/
├── pricepilot/
│   ├── __init__.py
│   ├── agent.py               ← Single LlmAgent root_agent
│   ├── config.py              ← STORE_URLS mapping
│   ├── types.py               ← BuildCartRequest + simplified models
│   ├── tools/
│   │   ├── __init__.py
│   │   └── browser_tools.py   ← UNCHANGED (10 Playwright tools)
│   └── api/
│       ├── __init__.py
│       └── server.py          ← New endpoints
├── tests/
│   ├── __init__.py
│   ├── test_browser_tools.py  ← UNCHANGED
│   ├── test_agent.py          ← NEW
│   └── test_api.py            ← NEW
├── test_agent.py              ← UPDATED integration script
├── .env.example               ← UPDATED
└── PRICEPILOT.md              ← REWRITTEN
```

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `pricepilot/agents/` (5 files) | **Deleted** | Entire agents directory removed |
| `pricepilot/tools/search_tools.py` | **Deleted** | Store discovery tools removed |
| `pricepilot/tools/cart_tools.py` | **Deleted** | Cart/savings tools removed |
| `pricepilot/tools/checkout_tools.py` | **Deleted** | Checkout tools removed |
| `tests/test_list_interpreter.py` | **Deleted** | Tests for deleted code |
| `tests/test_checkout.py` | **Deleted** | Tests for deleted code |
| `pricepilot/agent.py` | **Rewritten** | Single LlmAgent with 10 browser tools |
| `pricepilot/config.py` | **Rewritten** | STORE_URLS mapping, MAX_BROWSER_ACTIONS=100 |
| `pricepilot/types.py` | **Rewritten** | BuildCartRequest + simplified response models |
| `pricepilot/api/server.py` | **Rewritten** | New endpoints, store URL resolution, browser cleanup |
| `tests/test_agent.py` | **New** | Agent definition tests (10 tools, no sub-agents) |
| `tests/test_api.py` | **New** | API routing tests (health, store resolution, 400) |
| `test_agent.py` | **Updated** | Uses BuildCartRequest format |
| `.env.example` | **Updated** | Removed SAVINGS_FEE_PERCENT |
| `PRICEPILOT.md` | **Rewritten** | Single-agent architecture docs |

---

### Delivery Check: DB-Based Fix & נהרייה Normalization (February 2026)

#### Backend Fix (DB API)

`POST /api/delivery/check` was crashing with Vercel 500 because it made sequential real-time HTTP calls to 4 supermarket websites (5–20 seconds total), exceeding Vercel's 10-second serverless timeout.

**Fix**: Endpoint now executes a single DB query against the `store_delivery_coverage` table (~50 ms). Coverage data populated by daily ETL:
- Rami Levy: 102 cities
- Shufersal: 122 cities (nationwide, ₪29.90 fee)
- Victory: 117 delivery areas
- Market Warehouses: 74 delivery areas

Request/response schema unchanged — `eligible_store_ref_ids` and per-chain `delivery_fee` still returned. `error` field is now always `null` (no live calls).

#### Frontend Fix (govDataService.ts)

data.gov.il returns `נהריה` (single yod) for Nahariya, but the delivery coverage table stores `נהרייה` (double yod). Added this mapping to `CITY_NAME_NORMALIZATIONS`.

**Affected city**: `נהריה` → `נהרייה`

This was the only `יה/ייה` variant mismatch in the entire online cities list (confirmed by checking all cities with `ייה` in the coverage table).

#### Service Worker Fix (service-worker.js → v5)

The v4 service worker was intercepting all same-origin GET requests — including `/price-api/` and `/gov-data-api/` proxy paths — and attempting `cache.put()` on the proxied responses. This failed silently and caused the entire fetch to reject, breaking delivery check and product search calls.

**Fixes in v5:**
- Bumped `CACHE_NAME` to `lista-cache-v5` (forces old SW eviction)
- Added explicit skip for proxy paths (`/price-api/`, `/gov-data-api/`)
- Wrapped `cache.put()` in `.catch(() => {})` so cache failures never kill network responses

#### End-to-End Flow (Confirmed Working)

1. User selects city + online mode in setup step → delivery check fires in background
2. govData returns `נהריה` → normalized to `נהרייה` → `checkDelivery("נהרייה")` returns `eligible:[26, 22]` (Rami Levy, Shufersal)
3. On compare: `eligible_store_ref_ids` filters the compare to only those 2 eligible chains; `delivery_fees: {22: 29.9, 26: 29.9}` passed through
4. SavingsReport shows only eligible stores with correct delivery fee breakdown

#### Rami Levy Delivery Fee (Backend Data Fix)

After the initial deployment, `/api/delivery/check` returned `delivery_fee: null` for Rami Levy (despite `delivers: true`) because the `store_delivery_coverage` table had no fee populated for Rami Levy rows. The frontend correctly excluded it from the `deliveryFees` map (filter: `c.delivers && c.delivery_fee != null`), so Rami Levy appeared cheaper than Shufersal by ₪29.90.

**Fix**: DB API agent populated `delivery_fee = 29.90` for all Rami Levy rows in `store_delivery_coverage`. No frontend changes were needed.

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `services/govDataService.ts` | Modified | Added `נהריה → נהרייה` to `CITY_NAME_NORMALIZATIONS` |
| `service-worker.js` | Modified | v5: skip proxy paths, safe `cache.put()`, force SW update |

---

### Promotion Display in Price Comparison (February 2026)

The `POST /api/shopping-list/compare` response already included per-item promotion data (`unit_price`, `effective_unit_price`, `promotion.description`, `promotion.ends_at`), and `priceDbService.ts` was already mapping it into `ItemPriceDetail.originalPrice` and `ItemPriceDetail.promotion`. However the UI was not surfacing it clearly.

#### Changes in `SavingsReport.tsx`

**Collapsed store row** — added a promo savings line below the matched-items count:
- Computes `promoSavings = Σ (originalPrice − promoPrice) × amount` for items with promos
- If `promoSavings > 0`, shows a `Tag` icon + `"חיסכון ₪X.XX במבצע"` (he) / `"₪X.XX promo savings"` (en)

**Expanded item breakdown** — improved promo price visibility:
- Original (full) price strikethrough: `text-slate-300` → `text-slate-400` (more visible)
- Promo (effective) price: now `text-rose-600 font-semibold` (was `text-slate-400`) when a promo is active, making the discount unmistakable
- Non-promo items remain `text-slate-400` (no visual change)

#### Data Source

Only Rami Levy has populated promo data in the current DB. Example product:
- Barcode `5711953106583` — ארלה גבינת שמנת 200ג — regular ₪14.90 → promo ₪12.90 (fixed_amount, expires 2026-03-07)

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `components/SavingsReport.tsx` | Modified | Promo savings badge in collapsed row; visible strikethrough + rose promo price in expanded row |

---

### Supermarket-Style Product Catalog (February 2026)

#### Overview

Replaced the simple text-search-to-dropdown product input in Shopping Mode with a full supermarket-style browsing experience. Users can now navigate a 3-level category tree, browse a product grid with images, filter by vegan/allergen preferences, and view full product details including per-store prices — all from within the list-building step.

The selected products (cart) moved from an inline list inside the search component to a **collapsible footer bar** at the bottom of `ShoppingInputArea`.

#### New API Endpoints Consumed

| Endpoint | Purpose | Cache TTL |
|----------|---------|-----------|
| `GET /api/products/categories` | Returns `{total, categories[]}` with 3-level hierarchy | 30 min |
| `GET /api/products/browse` | Paginated product grid with category/filter params | 5 min |
| `GET /api/products/{barcode}` | Full product detail including per-store prices and promotions | 10 min |

All products from the browse and detail endpoints include new fields: `subcategory`, `sub_subcategory`, `allergens`, `is_vegan`, `labels`.

#### New Types (`types.ts`)

| Type | Definition | Purpose |
|------|-----------|---------|
| `DbProductEnhanced` | Extends `DbProduct` with 5 new fields | Products from browse/detail endpoints |
| `SubSubCategoryNode` | `{name, count}` | Leaf category level |
| `SubCategoryNode` | `{name, count, sub_subcategories[]}` | Mid category level |
| `CategoryNode` | `{name, count, subcategories[]}` | Top category level |
| `ProductBrowseResult` | `{total, page, limit, products[]}` | Browse API response |
| `ProductStorePrice` | `{supermarket, price, effective_price, unit_qty, promotion, store}` | Per-store price in detail |
| `DbProductDetail` | Extends `DbProductEnhanced` with `prices[]` | Full product detail |

Also made `max_price` and `savings` optional on `DbProduct` (browse endpoint omits them) and added 5 optional enhanced fields to `DbProduct` for backward compatibility.

#### New Components

##### `components/ProductCard.tsx`

Individual product tile for the catalog grid.

- **Layout**: Square image (with `Package` fallback), name (2-line clamp), manufacturer + package size (e.g., "טירת צבי | 400 גרם"), `₪min_price`, unit price line (e.g., "₪9.23 ל-100 גרם"), promo `Tag` badge when `min_price < max_price`, weighted product badge (amber, ק״ג/100ג׳/ליטר)
- **Add button**: `+ הוסף` → `✓ נוסף` (green, disabled) when already in cart
- Clicking the card body (not button) opens `ProductDetailModal`

##### `components/ProductDetailModal.tsx`

Full-screen bottom-sheet modal (portalled via `createPortal`).

- Fetches product detail via `getProductDetail(barcode)` on open
- Shows: large image, category breadcrumb, name/manufacturer/barcode, package size (`unit_qty`), vegan badge (only when `is_vegan === true`), labels, allergen chips, per-store prices table with `unit_qty` and unit price per store, promotion descriptions
- Price hero includes unit price line for packaged products (e.g., "₪9.23 ל-100 גרם") and "מחיר ל-ק״ג" for weighted products
- Escape key and backdrop click close the modal
- Add to List button mirrors the card's `+ הוסף / ✓ נוסף` state

##### `components/ProductCatalogArea.tsx`

The main new component — replaces `ProductSearchInput` inside `ShoppingInputArea`.

**Internal state**: `view` (`categories` / `browse` / `search`), `searchQuery` (debounced 300 ms), `categories`, 3-level selection state, `products`, pagination state, loading states, `filterVegan`, `filterAllergenFree[]`, `detailBarcode`.

**Layout (top → bottom)**:
1. **Search bar** — always visible; `Loader2` spinner while searching; `X` clear button; **Filter dropdown button** (`SlidersHorizontal` icon) at the `end` of the bar
2. **Active filter chips** — visible only when filters are on; each chip has an `×` to remove it; allergen disclaimer appears when allergen filters are active
3. **Breadcrumb + subcategory chips** — visible when a category is selected; horizontal scroll chip rows for sub and sub-sub levels
4. **Main content**: category emoji grid (`view=categories`) or 2/3-col product grid (`view=browse/search`) with Load More button

**Filter dropdown** (`FilterPanel` sub-component):
- Opens as a `w-64` panel anchored `end-0` (RTL-safe — grows rightward in Hebrew, leftward in English)
- Mobile backdrop closes it on outside tap
- Vegan toggle and 8 allergen checkboxes with `rounded-md` check marks
- `max-h-[70vh] overflow-y-auto` prevents viewport overflow on small screens

**Category icon/colour map**: 15 entries with emoji + Tailwind bg colour per category; spaces normalised before lookup so "בשר  ודגים" (double-space from API) matches correctly.

**Filter semantics**:
- **Vegan**: only `is_vegan === true` products shown; `null` items hidden
- **Allergen-free**: products with matching allergens hidden; `allergens = null` products kept (unknown ≠ contains); disclaimer shown

#### Modified Components

##### `components/ShoppingInputArea.tsx`

- Replaced `<ProductSearchInput>` with `<ProductCatalogArea>` (same prop surface)
- Replaced the bottom actions row with a **collapsible cart bar**:
  - **Collapsed** (default): `🛒 N מוצרים` toggle + `השווה מחירים →` button
  - **Expanded**: scrollable product list (max-h-64) with qty/unit controls and remove buttons per row, plus "Clear all" at the bottom
  - Chevron direction flips on expand/collapse
- Mobile-responsive padding: `px-3 sm:px-4`, compare button `px-4 sm:px-6`
- `formatPrice()` updated to accept optional `max_price`

#### Modified Services

##### `services/priceDbService.ts`

Three new functions:

| Function | Notes |
|----------|-------|
| `getCategories()` | Unwraps `{total, categories}` API response (was incorrectly treated as bare array, causing blank category grid) |
| `browseProducts(params)` | Full param set: category, subcategory, sub_subcategory, is_vegan, allergen_free, delivery_city_name (mapped from `city` param), store_type, limit, page. Cache key includes all params. |
| `getProductDetail(barcode)` | Returns `DbProductDetail` with `prices[]`; `null` on error |

`searchProducts()` updated to accept `is_vegan?: boolean` and `allergen_free?: string[]` and forward them as query params.

#### Modified Translations (`constants/translations.ts`)

Added `productBrowse` namespace with 20 keys in both `en` and `he`:

| Key | English | Hebrew |
|-----|---------|--------|
| `categories` | Categories | קטגוריות |
| `allCategories` | All Categories | כל הקטגוריות |
| `searchPlaceholder` | Search products by name... | חפש מוצרים לפי שם... |
| `filters` | Filters | סינון |
| `veganOnly` | Vegan Only | טבעוני בלבד |
| `allergenFree` | Allergen-Free | ללא אלרגנים |
| `addToList` | + Add | + הוסף |
| `added` | ✓ Added | ✓ נוסף |
| `backToCategories` | Categories | קטגוריות |
| `noProducts` | No products found | לא נמצאו מוצרים |
| `loadMore` | Load More | טען עוד |
| `results` | results | תוצאות |
| `allergens` | Allergens | אלרגנים |
| `vegan` | Vegan | טבעוני |
| `detailTitle` | Product Details | פרטי מוצר |
| `pricesAt` | Prices at stores | מחירים בחנויות |
| `allergenDisclaimer` | Products with no allergen info are included | מוצרים ללא מידע על אלרגנים כלולים |
| `cartItems` | items | מוצרים |
| `cartEmpty` | Add products to start | הוסף מוצרים להתחיל |
| `clearAll` | Clear all | נקה הכל |

#### Notable Bug Fixes Included

1. **Categories blank screen** — `getCategories()` was treating the API's `{total, categories[]}` wrapper as a bare array, so `cats.filter(...)` ran on a plain object and discarded everything. Fixed by extracting `result.categories`.
2. **Filter dropdown off-screen (RTL)** — `start-0` in RTL = `right: 0`, causing the panel to grow leftward off-screen. Changed to `end-0` (`left: 0` in RTL) so the panel grows rightward into visible space.
3. **Missing `max_price` from browse endpoint** — browse API only returns `min_price`. Made `max_price` and `savings` optional in `DbProduct`; added null guards in `ProductCard` and `ShoppingInputArea`.
4. **Double-space in "בשר  ודגים"** — API category name has two spaces; icon map had one. Added `replace(/\s+/g, ' ')` normalisation before lookup.
5. **`min_price` / modal price inconsistency** — Card showed ₪14.90 (cheapest regular price) while the detail modal showed ₪12.90 (Rami Levy effective promo price). Root cause: browse API computed `min_price` from `price` column, not `effective_price`. Fixed in backend — `min_price` is now `MIN(effective_price)`. No frontend changes required; the in-memory cache (5 min TTL) flushes naturally.

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `types.ts` | Modified | `DbProductEnhanced`, category hierarchy types, `ProductBrowseResult`, `ProductStorePrice`, `DbProductDetail`; optional `max_price`/`savings` on `DbProduct` |
| `services/priceDbService.ts` | Modified | `getCategories()` (response unwrap), `browseProducts()`, `getProductDetail()`; `searchProducts()` filter params |
| `constants/translations.ts` | Modified | Added `productBrowse` namespace — 20 keys EN + HE |
| `components/ProductCard.tsx` | **New** | Product grid tile with image, price, promo badge, add button |
| `components/ProductDetailModal.tsx` | **New** | Portalled bottom-sheet detail view with per-store prices |
| `components/ProductCatalogArea.tsx` | **New** | Full catalog: category grid, browse/search, filter dropdown, detail modal |
| `components/ShoppingInputArea.tsx` | Modified | Replaced `ProductSearchInput` with `ProductCatalogArea`; collapsible cart footer bar |

### Supermarket Availability Banner in Shopping Mode (March 2026)

Added a compact banner inside `ShoppingInputArea` that shows which supermarket chains are available in the user's selected city, giving immediate visibility before browsing products.

**Changes**:
- **`services/priceDbService.ts`**: Exported `SUPERMARKET_NAME_MAP` so other components can map English chain names → Hebrew display names.
- **`App.tsx`**: Removed the `selectedShoppingMode === 'online'` guard on `checkDelivery()` so it fires for both physical and online modes. Passed `deliveryCheck` and `shoppingMode` props to `<ShoppingInputArea>`.
- **`components/ShoppingInputArea.tsx`**: Added a horizontally-scrollable chip banner between the header and `ProductCatalogArea`. Online mode chips show delivery fee (₪XX) or "איסוף" badge for click-and-collect-only chains. Physical mode shows all chain names. Banner doesn't render until delivery check completes (no flash).
- **`constants/translations.ts`**: Added `productBrowse.availableStores`, `productBrowse.collectAvailable`, `productBrowse.noStoresAvailable` in EN + HE.

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `services/priceDbService.ts` | Modified | Exported `SUPERMARKET_NAME_MAP` |
| `App.tsx` | Modified | `checkDelivery()` fires for both modes; passed `deliveryCheck`/`shoppingMode` props |
| `components/ShoppingInputArea.tsx` | Modified | Added available-stores chip banner with delivery fee / collect badges |
| `constants/translations.ts` | Modified | Added 3 translation keys (EN + HE) |

### Category SVG Icons & Sort Order (March 2026)

Replaced emoji-based category icons with high-quality SVG illustrations and added a fixed display order for categories.

**Changes**:
- **`public/category-icons/`**: Added 23 SVG illustration files (one per category, Hebrew filenames matching API names). Renamed `נקיון` → `ניקיון` to match API spelling.
- **`components/ProductCatalogArea.tsx`**: Replaced `CATEGORY_ICONS_RAW` emoji map with `getCategoryIconSrc()` that resolves SVG paths by category name. Added `CATEGORY_ORDER` array and `sortCategories()` to display grocery-first order. Removed product count from category tiles. Icons render at full tile width (`w-full h-24`).

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `public/category-icons/*.svg` | **New** | 23 category illustration SVGs |
| `components/ProductCatalogArea.tsx` | Modified | SVG icons, category sort order, removed product count |

### Product Image Proxy Fix & UX Updates (March 2026)

Fixed product images not displaying. The API returns `image_url` as a relative path (e.g. `/api/images/7290113704794.jpg`) but the frontend wasn't routing it through the `/price-api` proxy.

**Changes**:
- **`services/priceDbService.ts`**: Added `proxyImageUrl()` helper that prefixes relative `image_url` paths with `/price-api`. Applied in `searchProducts()`, `browseProducts()`, and `getProductDetail()` so all consumers receive correctly-proxied URLs.
- **`App.tsx`**: Default `appMode` changed from `'organize'` to `'shopping'`.
- **`constants/translations.ts`**: Updated app subtitle/slogan to reflect shopping focus.

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `services/priceDbService.ts` | Modified | Added `proxyImageUrl()`, applied to search/browse/detail responses |
| `App.tsx` | Modified | Default mode → shopping |
| `constants/translations.ts` | Modified | Updated subtitle EN + HE |

### Product Discovery: Sort, Filter & Chain Filter Enhancements (March 2026)

Added sorting, additional filters (on-sale, price range), and supermarket chain filtering to the product catalog. Users can now sort by price or name, filter to on-sale products or a price range, and toggle specific supermarket chains to see only products available at those stores.

**Changes**:
- **`types.ts`**: Added `ProductSortOption` type (`'default' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc'`).
- **`constants/translations.ts`**: Added 13 keys in EN + HE under `productBrowse`: `sortBy`, `sortDefault`, `sortPriceAsc`, `sortPriceDesc`, `sortNameAsc`, `sortNameDesc`, `onSale`, `priceRange`, `minPrice`, `maxPrice`, `sortingLoaded`, `allStores`.
- **`services/priceDbService.ts`**: Added `sort_by`, `sort_order`, and `chains` params to `searchProducts()`. Added `chains` param to `browseProducts()`. Both pass `chain=` to the API for server-side chain filtering. Cache keys updated to include all new params.
- **`components/ProductCatalogArea.tsx`**:
  - New `SortDropdown` sub-component: 5 radio-style options with `ArrowUpDown` icon, outside-click-to-close, blue active indicator.
  - Extended `FilterPanel`: added on-sale toggle (Tag icon, red theme), price range inputs (min/max ₪ number fields).
  - New state: `sortBy`, `filterOnSale`, `priceMin`, `priceMax`.
  - `displayProducts` useMemo: applies client-side on-sale filter, price range filter, and sort. Browse view always sorts client-side; search view uses API-side sort for price, client-side for name.
  - Filter chips for on-sale and price range in the active filters row.
  - Results count shows `displayProducts.length / totalProducts` when client-side filters reduce results.
  - "Sorting loaded products" note when sorting browse view with more data on server.
  - Accepts `selectedChains` prop and passes to browse/search API calls.
  - All state resets when navigating back to categories.
- **`components/ShoppingInputArea.tsx`**: Made available stores banner interactive — chain pills are toggleable with `selectedChains` state. Selected chains highlighted green (`bg-emerald-600 text-white`), unselected dimmed. "All Stores" reset pill appears when any chain is selected. Passes `selectedChains` to `ProductCatalogArea`.

**API dependency**: Requires `chain` query parameter support on `GET /api/products/browse` and `GET /api/products/search` (added to backend separately). When `chain` is provided, the API returns only products with current prices at the specified chains, with `min_price`/`max_price`/`savings` recalculated from only those chains.

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `types.ts` | Modified | Added `ProductSortOption` type |
| `constants/translations.ts` | Modified | Added 13 keys EN + HE (sort, on-sale, price range, allStores) |
| `services/priceDbService.ts` | Modified | `searchProducts()`: added `sort_by`, `sort_order`, `chains` params; `browseProducts()`: added `chains` param |
| `components/ProductCatalogArea.tsx` | Modified | `SortDropdown`, extended `FilterPanel`, `displayProducts` memo, `selectedChains` prop |
| `components/ShoppingInputArea.tsx` | Modified | Toggleable chain pills, `selectedChains` state, passed to `ProductCatalogArea` |

---

### Product Discovery Assistant: AI Chat for Finding Products (March 2026)

Added a conversational AI assistant inside Shopping Mode that helps users find products faster via natural language. Users can paste a shopping list, ask for the cheapest product, filter by criteria (vegan, brand), and add results to cart — all through a chat interface.

**Architecture — Two-Pass AI**:
1. **Intent pass** (`smartAssistant`): AI interprets user message → generates optimized search queries (with sort/filter params, multiple query variations)
2. **Product search**: Parallel `searchProducts()` calls (max 5 concurrent) against the price DB API
3. **Summary pass** (`summarizeResults`): AI sees actual product names/prices → generates honest, context-aware response (never says "here it is" with no results)

**New directory**: `agents_and_ai/product-discovery-assistant/` — self-contained module with own README.

**Changes**:
- **`agents_and_ai/product-discovery-assistant/SmartListPanel.tsx`** (new): Chat UI — messages feed (user bubbles + AI responses with inline product cards), text input with Enter-to-send, conversation state, product detail modal integration. RTL-aware with `dir` attribute.
- **`agents_and_ai/product-discovery-assistant/aiService.ts`** (new): Three AI functions extracted from `geminiService.ts`:
  - `parseShoppingList()`: Extracts structured items from raw list text (batch mode)
  - `smartAssistant()`: Interprets user intent, generates search queries with sort/filter/vegan params, multiple query variations for tricky searches
  - `summarizeResults()`: Post-search contextual response — references actual product names/prices, honest "not found" when empty
- **`agents_and_ai/product-discovery-assistant/smartListService.ts`** (new): Orchestration — `buildSmartList()` for batch mode, `processSmartChat()` for conversational mode. Both use concurrency-limited parallel search.
- **`types.ts`**: Added `ParsedShoppingItem`, `SmartListMatch`, `SearchIntent`, `SmartChatMessage` interfaces.
- **`constants/translations.ts`**: Added `smartList` namespace (19 keys EN + HE): `pasteList`, `title`, `textPlaceholder`, `findProducts`, `processing`, `matchedOf`, `noMatch`, `skip`, `addAll`, `addSelected`, `addToCart`, `added`, `backToCatalog`, `alternatives`, `alreadyInCart`, `noItems`, `send`, `welcome`, `addAllResults`.
- **`components/ShoppingInputArea.tsx`**: Added "AI Assistant" pill button (Sparkles icon, indigo theme) above catalog. Toggles `showSmartList` state — when active, renders `SmartListPanel` instead of `ProductCatalogArea`. Added `existingBarcodes` memo and `handleSmartListConfirm` handler.
- **`services/geminiService.ts`**: Removed `parseShoppingList`, `smartAssistant`, `summarizeResults` (extracted to `aiService.ts`). Cleaned up unused `ParsedShoppingItem`/`SearchIntent` imports.

#### File Change Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `agents_and_ai/product-discovery-assistant/SmartListPanel.tsx` | **New** | Chat UI with product cards, detail modal, Add to Cart |
| `agents_and_ai/product-discovery-assistant/aiService.ts` | **New** | 3 AI functions: intent, parsing, result summarization |
| `agents_and_ai/product-discovery-assistant/smartListService.ts` | **New** | Orchestration: AI → parallel search → contextual response |
| `agents_and_ai/product-discovery-assistant/README.md` | **New** | Full feature documentation |
| `types.ts` | Modified | Added 4 interfaces for smart list & chat |
| `constants/translations.ts` | Modified | Added `smartList` namespace (19 keys × 2 languages) |
| `components/ShoppingInputArea.tsx` | Modified | AI Assistant toggle button, SmartListPanel mount |
| `services/geminiService.ts` | Modified | Extracted 3 functions to aiService.ts |

---

### Product Discovery Assistant: Robustness Fixes (v4.8.1, March 2026)

Five improvements based on automated user simulation testing:

1. **Nonsense input handling**: AI prompt explicitly returns empty searches for gibberish/random text — prevents re-searching items from conversation history when current message is unintelligible
2. **Fresh produce awareness**: AI prompt notes DB limitation with fresh produce (may return processed versions like pickled cucumbers); `summarizeResults` can mention this to users
3. **Broad "cheapest X" search**: AI now searches broadly for product category when user asks "cheapest X" — does NOT carry over specific variants from conversation history (e.g., "cheapest cottage" searches "קוטג'" broadly, not "קוטג' 5%"). Uses higher limits (8-10)
4. **Brand post-filtering**: `smartListService.ts` extracts brand names from user messages (common Israeli brands: תנובה, שטראוס, טרה, אסם, עלית, יטבתה, מהדרין) and filters search results by manufacturer after API response
5. **Informative large-list summaries**: `summarizeResults` now highlights mismatches, missing items, and fresh produce notes for large result sets. Max tokens increased to 250
6. **Conversation history limit**: Chat history passed to AI is limited to last 6 messages to prevent context pollution from long sessions

**Changes**:
- **`aiService.ts`**: Enhanced `smartAssistant` system prompt with 4 critical rules (nonsense, broad cheapest, fresh produce, brand queries). Enhanced `summarizeResults` prompt for mismatch detection and fresh produce notes.
- **`smartListService.ts`**: Added `extractBrandFromMessage()` helper with known Israeli brand list. Post-filters search results by manufacturer when brand detected.
- **`SmartListPanel.tsx`**: Limited conversation history to last 6 messages via `.slice(-6)`.
- **`product_discovery-ai-assistant-doc.md`**: Added robustness improvements section.

---

### Basket Strategy Picker: Single-Store vs Multi-Store Split (v5.0.0, March 2026)

#### Overview

Added a basket optimization feature that computes and presents two shopping strategies to users after price comparison:

1. **Single Store**: Cheapest single supermarket for the full list (existing behavior, formalized)
2. **Multi-Store Split**: Buy each item at whichever store has the cheapest price, splitting across 2-3 stores

The API already returned `cheapest_per_item` data (cheapest store per product barcode) but it was silently discarded in `compareListPrices()`. This change surfaces that data and uses it for multi-store computation.

#### Data Layer Changes

- **`types.ts`**: Added `BasketStrategyType`, `StoreBasketBreakdown`, `SingleStoreBasket`, `MultiStoreBasket`, `BasketComparison` types. Extended `ListPriceComparison` with `cheapestPerItem` field.
- **`services/priceDbService.ts`**: `compareListPrices()` now maps `data.cheapest_per_item` (barcode → cheapest store + price) and includes it in `ListPriceComparison`. Store names mapped to Hebrew via `SUPERMARKET_NAME_MAP`.
- **`utils/basketStrategies.ts`** (new): Pure computation utility. `computeBasketComparison(comparison, isOnline)` returns `BasketComparison` with both strategies + recommendation (multi if savings ≥ ₪2).

#### UI Changes

- **`components/BasketStrategyPicker.tsx`** (new): Two side-by-side cards (single=emerald, multi=indigo) with store name(s), totals, delivery fees, matched items, "מומלץ" badge, savings callout, minimum order warnings.
- **`components/BasketBreakdownView.tsx`** (new): Item-level breakdown for selected strategy. Single: one store section. Multi: per-store sections with headers + grand total.
- **`components/ShoppingPriceStep.tsx`** (rewritten): Strategy picker on top → breakdown below → action button → collapsible "View all stores" (SavingsReport). Uses `computeBasketComparison` via `useMemo`.

#### Files Changed

| File | Action | Key Changes |
|------|--------|-------------|
| `types.ts` | Modified | Basket strategy types, `cheapestPerItem` on `ListPriceComparison` |
| `services/priceDbService.ts` | Modified | Forward `cheapest_per_item` API data |
| `utils/basketStrategies.ts` | New | `computeBasketComparison()` utility |
| `components/BasketStrategyPicker.tsx` | New | Two-card strategy picker |
| `components/BasketBreakdownView.tsx` | New | Per-store item breakdown |
| `components/ShoppingPriceStep.tsx` | Rewritten | Integrated strategy picker + breakdown + collapsible SavingsReport |

#### PricePilot Integration (Implemented in v5.2.0)

PricePilot v2 is now integrated. The `StoreBasketBreakdown` type feeds into PricePilot's cart-building flow. "Build Cart" buttons appear in online mode for supported stores (currently Rami Levy). See [PricePilot v2 Frontend Integration](#pricepilot-v2-frontend-integration-v520-march-2026) for details.

---

### Google ADK Builder Agent: Skills System (v5.1.0, March 2026)

#### Overview

Added a custom Claude Code agent (`google-adk-builder`) with 5 preloaded skills for designing, building, debugging, and deploying agent systems with Google Agent Development Kit (ADK). All skills are grounded in the official ADK documentation (https://google.github.io/adk-docs/).

#### Skills Created

| Skill | Directory | Purpose |
|-------|-----------|---------|
| `adk-architecture` | `.claude/skills/adk-architecture/` | Agent types (LlmAgent, Sequential, Parallel, Loop, Custom), multi-agent patterns, decision tree for architecture selection |
| `adk-tool-development` | `.claude/skills/adk-tool-development/` | FunctionTool, ToolContext API, LongRunningFunctionTool, parameter design, return shapes, built-in tools |
| `adk-state-memory-artifacts` | `.claude/skills/adk-state-memory-artifacts/` | Sessions, state prefixes (session/user/app/temp), MemoryService, ArtifactService, when to use each |
| `adk-debugging` | `.claude/skills/adk-debugging/` | Diagnosis table for common symptoms, tool/routing/state/memory/callback issues and fixes |
| `adk-deployment` | `.claude/skills/adk-deployment/` | Local dev setup, Cloud Run, Agent Engine (Vertex AI), GKE, FastAPI server, production checklist |

#### Files Changed

| File | Action | Key Changes |
|------|--------|-------------|
| `.claude/agents/google-adk-builder.md` | Modified | Added `skills` frontmatter field referencing all 5 skills |
| `.claude/skills/adk-architecture/SKILL.md` | New | Architecture patterns and decision criteria |
| `.claude/skills/adk-tool-development/SKILL.md` | New | Tool development guide with code examples |
| `.claude/skills/adk-state-memory-artifacts/SKILL.md` | New | State/memory/artifact persistence guide |
| `.claude/skills/adk-debugging/SKILL.md` | New | Debugging guide with symptom → cause → fix tables |
| `.claude/skills/adk-deployment/SKILL.md` | New | Deployment options and production checklist |

---

### PricePilot v2 Frontend Integration (v5.2.0, March 2026)

#### Overview

Integrated the PricePilot v2 ADK agent (FastAPI backend) into the Lista frontend shopping flow. Users can now tap "Build Cart at [Store]" from the price comparison results to have PricePilot automatically build an online grocery cart via the store's REST API. Currently only Rami Levy is fully supported; other stores show "Coming soon".

#### Architecture

```
Lista Frontend (PWA)
  → "Build Cart at רמי לוי" button
  → PriceAgentChat slide-over panel
  → agentService.ts (PricePilot v2 API client)
  → Vite proxy (/pricepilot-api)
  → PricePilot v2 FastAPI server
  → ADK Agent (gemini-2.5-flash)
  → Rami Levy REST API
```

#### Key Changes

1. **API contract rewrite** (`services/agentService.ts`): Replaced old `/sessions` endpoints with PricePilot v2's `/api/build-cart` and `/api/message`. Added session metadata tracking (`pricepilotUserId`, `checkoutUrl`, `cartPersisted`, `phase`). Maps v2 response format (`{role, text, author}`) to Lista's `ChatMessage` format. Added `storeName`, `storeId`, `userCity` parameters.

2. **"Build Cart" button for online mode** (`components/ShoppingPriceStep.tsx`): Added online-mode button that appears when user selects single-store strategy. Button shows store name (e.g., "בנה עגלה ב-רמי לוי"). Disabled with "בקרוב" badge for unsupported stores.

3. **Per-store build buttons in multi-store view** (`components/BasketBreakdownView.tsx`): Added `onBuildCart` prop. Each `StoreSection` in multi-store breakdown gets a "Build Cart" button. Supported stores (Rami Levy) are enabled; others disabled with "Coming soon".

4. **Store-aware PriceAgentChat** (`components/PriceAgentChat.tsx`): Added `storeName`, `storeId`, `userCity` props. Header subtitle shows "Building cart at [Store]". Handles `checkout:` actions (opens checkout URL in new tab) and `login:` actions (opens store login popup).

5. **Store auth service** (`services/storeAuthService.ts`): New service for PWA-based store authentication. `openStoreLoginPopup()` opens the store's website in a popup for manual login. Token extraction instructions provided for developer-mode fallback.

6. **Barcode passthrough** (`types.ts`): Added `barcode?: string` to `AgentShoppingItem`. Updated `itemToShoppingItem()` to include barcode from `Item` → enables barcode-based product resolution in PricePilot.

7. **Vite proxy** (`vite.config.ts`): Added `/pricepilot-api` proxy pointing to PricePilot v2 dev server (`localhost:8080`, configurable via `PRICEPILOT_API_TARGET`). Added `PRICEPILOT_API_URL` env var define.

#### Supported Stores

| Chain | Status | Notes |
|-------|--------|-------|
| Rami Levy (רמי לוי) | Fully supported | Build cart button enabled, end-to-end tested |
| Shufersal (שופרסל) | Coming soon | Button disabled, adapter stub on backend |
| Victory (ויקטורי) | Coming soon | Button disabled, adapter stub on backend |
| Market Warehouses (מחסני השוק) | Coming soon | Button disabled, adapter stub on backend |
| H. Cohen (ח. כהן) | Coming soon | Button disabled, adapter stub on backend |

#### Files Changed

| File | Action | Key Changes |
|------|--------|-------------|
| `types.ts` | Modified | Added `barcode?: string` to `AgentShoppingItem`, updated `itemToShoppingItem()` |
| `vite.config.ts` | Modified | Added `/pricepilot-api` proxy, `PRICEPILOT_API_URL` env define |
| `services/agentService.ts` | Rewritten | PricePilot v2 API contract (`/api/build-cart`, `/api/message`), session metadata |
| `services/storeAuthService.ts` | New | Store login popup, token extraction helpers |
| `components/PriceAgentChat.tsx` | Modified | Store-aware props, checkout/login action handlers |
| `components/ShoppingPriceStep.tsx` | Modified | Online-mode "Build Cart at [Store]" button |
| `components/BasketBreakdownView.tsx` | Modified | Per-store "Build Cart" buttons with coming-soon logic |
| `App.tsx` | Modified | `onlineStoreName` state, store context wiring to PriceAgentChat |

#### Auth Flow (PWA)

Since Lista is a PWA (not native), WebView JS injection isn't available. Current auth flow:
1. Agent asks for authentication → chat shows login instructions
2. User opens store website in popup (via "Open [Store] Login" button)
3. User logs in, extracts JWT via browser console
4. User pastes token in chat → sent to PricePilot via `/api/message` with `auth_token` field
5. Future: auth-proxy service or browser extension for seamless token extraction

---

### PricePilot Auth & UX Improvements (v5.2.1, March 2026)

#### Overview

Improved PricePilot's auth and checkout UX. The agent now **offers optional cart saving** to the user's store account instead of silently skipping it. The frontend auto-detects JWT tokens pasted in chat and dynamically adds login/checkout buttons based on agent response content.

#### Key Changes

1. **Agent instruction update** (`pricepilot-agent_v2/pricepilot/agent.py`): Phase 3 rewritten — agent now asks "רוצה שאשמור את העגלה ישירות בחשבון רמי לוי שלך?" after cart preview. If yes → triggers login flow via `get_checkout_info`. If no → shows prices + checkout URL. Agent never mentions console/F12/JWT/tokens to users.

2. **Auto-detect JWT tokens** (`services/agentService.ts`): `processUserMessage` now detects JWT-like strings (starts with "ey", 3+ dot segments, 50+ chars) pasted by users and automatically sends them as `auth_token` to the PricePilot API. User sees "🔑 טוקן התחברות התקבל" instead of raw token text.

3. **Dynamic login/checkout buttons** (`services/agentService.ts`): `mapApiMessages` now scans agent response text for login-related keywords (התחבר, חשבון, שאשמור, etc.) and auto-adds a "התחבר ל-[store]" button. Also detects checkout URLs in text and adds clickable "עבור לקופה" buttons. Prevents duplicate buttons when API response also includes checkout URL.

4. **Session metadata tracking** (`services/agentService.ts`): `PricePilotSessionMeta` now tracks `storeName` for button generation across the session lifecycle.

5. **Store auth service cleanup** (`services/storeAuthService.ts`): Removed `getTokenExtractionInstructions()` (no more F12/console instructions for users). Added `looksLikeJwt()` utility for JWT detection. Kept `openStoreLoginPopup()` for the popup login flow.

#### Auth UX Flow

```
Cart Preview shown
  → Agent asks: "רוצה שאשמור את העגלה בחשבון שלך?"
  ├─ User says "לא" → Checkout URL provided → Done
  └─ User says "כן"
      → "התחבר ל-רמי לוי" button appears in chat
      → User clicks → Rami Levy opens in popup
      → User logs in → pastes JWT in chat
      → Frontend auto-detects JWT → sends as auth_token
      → Agent persists cart → "העגלה נשמרה ✅" + checkout URL
```

#### Files Changed

| File | Action | Key Changes |
|------|--------|-------------|
| `pricepilot-agent_v2/pricepilot/agent.py` | Modified | Phase 3 offers optional cart saving, no technical jargon |
| `services/agentService.ts` | Modified | JWT auto-detection, dynamic login/checkout buttons, storeName in meta |
| `services/storeAuthService.ts` | Modified | Removed F12 instructions, added `looksLikeJwt()` |

---

### PricePilot Auth Error Sanitization & Graceful Fallback (v5.3.0, March 2026)

#### Overview

Fixed two critical UX issues: (1) the agent was leaking technical terms (reCAPTCHA, OTP, auth_token, API) to users, and (2) reCAPTCHA domain binding blocked in-chat OTP login since the sitekey belongs to rami-levy.co.il.

**Solution**: Sanitized all tool error messages to user-friendly Hebrew, strengthened agent instructions to never mention technical terms, and made the "no auth" checkout URL flow the graceful fallback. Removed broken frontend reCAPTCHA code.

#### Key Changes

1. **Error sanitization** (`pricepilot-agent_v2/pricepilot/tools/auth_tools.py`): Added `_sanitize_error()` that maps technical error codes (recaptcha_required, network_error, auth_token_expired) to natural Hebrew messages. All tool returns now use `message` field with Hebrew text instead of raw `error` field.

2. **Agent instruction hardened** (`pricepilot-agent_v2/pricepilot/agent.py`): Added explicit blocklist of 25+ technical terms the agent must NEVER say. Agent now uses the Hebrew `message` field from tools, never the `error` field. Login failure immediately falls back to checkout URL with no technical explanation.

3. **Rami Levy adapter robustness** (`pricepilot-agent_v2/pricepilot/stores/rami_levy.py`): Added client_id/client_secret to login payload (OAuth client credentials attempt). Improved reCAPTCHA detection for 422 status. Added JSON parse error handling (302 redirect returns HTML). Error codes sanitized to generic keys (login_unavailable, network_error).

4. **Cart tools sanitized** (`pricepilot-agent_v2/pricepilot/tools/cart_tools.py`): persist_cart error messages now in Hebrew. Removed raw error codes from tool responses.

5. **Frontend cleanup** (`services/agentService.ts`): Removed all reCAPTCHA code (loadRecaptchaScript, solveRecaptcha, RECAPTCHA_SITEKEY) — cross-domain reCAPTCHA tokens are rejected. Removed email detection for reCAPTCHA trigger. Simplified apiSendMessage signature.

#### Auth Flow (Current)

```
Cart Preview shown
  → Agent asks: "רוצה שאשמור את העגלה בחשבון שלך?"
  ├─ User says "לא" → Checkout URL provided → Done
  └─ User says "כן"
      → Agent asks for email
      → Agent tries OTP login
      → reCAPTCHA blocks it (domain binding)
      → Agent says: "לא הצלחתי להתחבר כרגע. הנה לינק ישיר לקופה:"
      → Checkout URL provided → User completes on rami-levy.co.il
```

#### Known Limitation

reCAPTCHA sitekey `6LcbrMcqAAAAAG3zZqwyELvzuJlNHdW9Leq71AHy` is bound to rami-levy.co.il. Tokens generated from Lista's domain are rejected by Google's verification. In-chat OTP login requires a future solution (auth proxy, browser extension, or Rami Levy API change).

#### Files Changed

| File | Action | Key Changes |
|------|--------|-------------|
| `pricepilot-agent_v2/pricepilot/tools/auth_tools.py` | Modified | `_sanitize_error()`, all errors return Hebrew `message` field |
| `pricepilot-agent_v2/pricepilot/agent.py` | Modified | 25+ term blocklist, use `message` not `error` field |
| `pricepilot-agent_v2/pricepilot/stores/rami_levy.py` | Modified | client credentials, JSON error handling, sanitized error codes |
| `pricepilot-agent_v2/pricepilot/tools/cart_tools.py` | Modified | Hebrew error messages |
| `services/agentService.ts` | Modified | Removed reCAPTCHA code, simplified message flow |

---

**Last Updated**: March 26, 2026
**Version**: 5.3.0
**Status**: Production Ready

---

## PricePilot v3: Deterministic Rami Levy Agent (March 2026)

Built from scratch based on `supermarket_agent_architecture.md`, replacing the v2 approach with a deterministic agent that controls a real headless browser session.

**Stack**: Google ADK with `gemini-2.5-flash`, Playwright headless browser, httpx for cart API calls.

**Key tools**: OTP authentication flow (login modal via `$nuxt` Vue events, SMS code entry, JWT extraction), product search (POST /api/catalog), read_cart (Vuex state), add_items_to_cart, clear_cart. Remove item is work-in-progress (API returns 200 but doesn't persist).

**Breakthrough**: Cart operations done via `page.evaluate` in the headless browser only affect the browser's session — not the user's real account. The solution: extract the JWT token and all cookies from the headless browser, then make cart API calls via httpx outside the browser. Add and clear operations are proven to persist to the user's real Rami Levy account.

**Observer module**: Every tool call is logged with inputs, outputs, timing, and screenshots saved to `logs_and_pictures/sessions/{timestamp}/`.

**Status**: Authentication, search, read cart, add items, and clear cart all working. Remove item not persisting yet. Local testing only via `adk web`. Cloud Run deployment and Lista frontend integration pending.

**Location**: `pricepilot_agent_v3/`
**Full details**: `pricepilot_agent_v3/rami_levi_agent_log.md`

## PricePilot v4: Browser-Bridge Architecture (April 2026)

Rebuilt PricePilot to solve the fundamental cross-device session ownership problem from v3. In v3, the agent's headless browser was a separate device — Rami Levy's server rejected remove/update/clear operations because the HttpOnly `cf_clearance` cookie tied the session to the originating device.

### The Solution: Chrome Extension as Execution Layer

Instead of running a headless browser on the server, all browser tools now execute in the **user's real browser** via a Chrome extension. The cloud only handles LLM orchestration.

**Stack**: Google ADK with `gemini-2.5-flash` (cloud), Chrome Extension Manifest V3 (browser), FastAPI SSE server (bridge).

### Architecture

```
Lista frontend (Vercel / localhost:3000)
    ↕ SSE stream (text, tool_call, browser_action_request)
PricePilot API (Cloud Run / localhost:8080)
    ↕ POST /api/tool-response/{session_id}
Lista frontend
    ↕ window.postMessage (ping/pong detection + tool requests)
Chrome Extension (background.js)
    ↕ chrome.scripting.executeScript({world: 'MAIN'})
rami-levy.co.il — tools execute in page context
```

### Key Technical Decisions

1. **CSP bypass**: Rami Levy's Content Security Policy blocks inline `<script>` injection. Solution: `chrome.scripting.executeScript` with `world: 'MAIN'` from the background service worker, which is exempt from page CSP.

2. **Extension detection**: Content scripts run in Chrome's isolated world and cannot set `window` properties visible to the page. Solution: postMessage ping/pong protocol between Lista and the `lista_bridge.js` content script.

3. **Merged SSE generator**: The server runs the ADK agent in a background task and merges two async queues (ADK events + browser bridge events) into a single SSE stream. This allows `browser_action_request` events to be emitted while a tool function is awaiting the extension's response.

4. **Same-origin fetch**: The extension's `fetch()` calls on rami-levy.co.il automatically include all cookies (including HttpOnly `cf_clearance`). This gives full session ownership — add, remove, update, and clear all persist to the user's real account.

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| PricePilot Agent | `pricepilot_agent_v4/` | ADK agent, system instruction, tool definitions, server |
| Browser Bridge | `pricepilot_agent_v4/tools/browser_bridge.py` | Server-side coordination (request/resolve with asyncio.Event) |
| Chrome Extension | `pricepilot_extension/` | Background service worker + content scripts |
| Extension Bridge | `services/extensionBridge.ts` | Frontend ↔ extension communication |

### Chrome Extension Structure

```
pricepilot_extension/
├── manifest.json                    # MV3, permissions: tabs, scripting, host_permissions
├── background.js                    # All tool execution via chrome.scripting.executeScript
├── content_scripts/
│   ├── lista_bridge.js              # Lista domain: postMessage ↔ chrome.runtime bridge
│   └── rami_levy_keepalive.js       # Rami Levy domain: minimal keepalive
└── icons/
```

### Tool Execution Flow

1. Agent calls `read_cart` → ADK emits `function_call` event
2. Tool function calls `request_browser_action()` → pushes `browser_action_request` to SSE queue
3. SSE stream sends `browser_action_request` to frontend
4. Frontend detects extension (ping/pong) → forwards via `window.postMessage`
5. `lista_bridge.js` → `chrome.runtime.sendMessage` → `background.js`
6. Background uses `chrome.scripting.executeScript({world: 'MAIN'})` on Rami Levy tab
7. Result flows back: background → lista_bridge → postMessage → frontend → `POST /api/tool-response` → server → tool resumes → agent continues

### Files Changed (from v4 Playwright to v4 Browser-Bridge)

| File | Change | Purpose |
|------|--------|---------|
| `pricepilot_agent_v4/tools/browser_bridge.py` | **New** | Request/resolve coordination module |
| `pricepilot_agent_v4/server.py` | **Rewritten** | Merged SSE generator, `/api/tool-response` endpoint |
| `pricepilot_agent_v4/tools/cart_tools.py` | **Rewritten** | Uses `request_browser_action()` instead of Playwright |
| `pricepilot_agent_v4/tools/auth_tools.py` | **Rewritten** | Uses `request_browser_action()` instead of Playwright |
| `pricepilot_agent_v4/tools/handoff_tools.py` | **Rewritten** | Uses `request_browser_action()` instead of Playwright |
| `pricepilot_agent_v4/config.py` | **Modified** | Removed Playwright settings, added `browser_bridge_timeout` |
| `pricepilot_agent_v4/pyproject.toml` | **Modified** | Removed `playwright` dependency |
| `pricepilot_agent_v4/Dockerfile` | **Modified** | Removed Playwright system deps |
| `pricepilot_extension/` | **New** | Chrome Extension (MV3) |
| `services/extensionBridge.ts` | **New** | Frontend extension detection + communication |
| `services/agentService.ts` | **Modified** | Handles `browser_action_request` SSE events |
| `components/PriceAgentChat.tsx` | **Modified** | Streaming tool status display |
| `vite.config.ts` | **Modified** | Proxy default port 8000 → 8080 |

### Multi-Store Scalability

The extension architecture is designed for multiple supermarkets:
- **Generic layer** (built once): extension shell, messaging bridge, tool protocol
- **Store adapter layer** (one per store): store-specific tool implementations in `background.js`
- Adding a new supermarket = adding new tool handlers + manifest URL patterns

### UX Flow (April 5, 2026)

1. **Welcome screen** in Lista shows PricePilot intro, extension status (blocks start if not installed), and Rami Levy info
2. User clicks "Start Building Cart" → agent calls `initialize_shopping_session` → extension opens Rami Levy tab silently
3. Agent shows current cart with full details (name, qty, unit price, promo info, line total, subtotal, delivery ₪29.90, grand total)
4. Agent adds items **autonomously** — picks best match, adds without asking. Only asks if genuinely ambiguous.
5. Agent verifies with `read_cart` after each mutation — detects out-of-stock (line_total=0), removes them, calls `find_replacements` (Rami Levy related items API), presents alternatives
6. Agent shows promo info from cart (promo_text, original vs discounted price, quantity deals)
7. At checkout, agent provides clickable link to Rami Levy checkout — user clicks from Lista chat

### Key Technical Details

- **Out-of-stock detection**: Search API `in_stock` is unreliable. Agent adds items first, then `read_cart` detects out-of-stock by `line_total === 0 && amount > 0`. Uses `find_replacements` tool (`GET /api/items/related`) for Rami Levy's own alternative recommendations.
- **Promo extraction**: `read_cart` extracts `promo_text`, `original_price`, `has_promo` from Vuex cart item fields (promotion, price.promotion, badge).
- **Delivery fee**: Always ₪29.90 (Rami Levy standard), defaults in extension if not found in cart.
- **Price type safety**: `club_price` from Rami Levy API can be a dict or number — safely extracted with type checks.

### Status

End-to-end working: cart reading, adding items, out-of-stock detection + replacement suggestions, promo display, autonomous product selection. Welcome screen with extension detection.

**Location**: `pricepilot_agent_v4/`, `pricepilot_extension/`
**Full details**: `pricepilot_extension/pricepilot_extension_log.md`

---

## Session: April 6, 2026

### Changes Made

#### 1. Logo Click → Shopping Homepage
- Made the "Lista" logo clickable in both organize and shopping mode headers (`Header.tsx`)
- Clicking the logo navigates to shopping mode (the main homepage)

#### 2. Sub-subcategory Ordering for Fresh Vegetables
- Added `SUBCATEGORY_ORDER` config in `ProductCatalogArea.tsx` defining custom display order for sub-subcategories within "ירקות טריים": עגבניות → מלפפונים → פלפלים → בצלים ושום → פטריות → ירקות עלים → ירקות שורש
- Applied via `sortSubItems()` helper to both the subcategory chips in `ProductCatalogArea.tsx` and the category dropdown in `CategoryNavBar.tsx`
- Extensible: add more subcategories to `SUBCATEGORY_ORDER` dict as needed

#### 3. API-Level Product Sorting (sub_subcategory_order)
- Added `sort_by=sub_subcategory_order` parameter support to `browseProducts()` in `priceDbService.ts`
- When browsing "ירקות טריים" without a specific sub-subcategory selected, the API sorts products by sub-subcategory group order with `is_weighted=true` products first within each group
- This ensures fresh loose vegetables (נמכר במשקל) appear before packaged products in each category
- Client-side fallback sort also added in `displayProducts` useMemo for resilience
- API change was implemented by the db-api agent in the external price database API

#### 4. PricePilot v4: dotenv Fix
- Fixed `server.py` to load `.env` via `python-dotenv` into `os.environ` before Google ADK imports
- Root cause: ADK's `google.genai` client reads `GOOGLE_API_KEY` from OS environment directly, not from pydantic-settings
- Updated `GOOGLE_API_KEY` in `pricepilot_agent_v4/.env`

#### 5. Product Groups & GroupDetailModal
- Added `getProductGroups()` and `getGroupDetail()` API functions in `priceDbService.ts`
- Added `GroupDetailModal` component integration in `ProductCatalogArea.tsx` for grouped product views
- Products with `product_group_id` are deduplicated in display, showing cheapest representative with curated group image

---

---

## Session: April 8–9, 2026

### Changes Made

#### 1. Consistent Product Card Info Layout (`ProductCard.tsx`)
Redesigned product card info section to show consistent data based on `is_weighted`:

- **Weighted products (`is_weighted=true`):**
  1. Product name
  2. "נמכר במשקל" badge (with weight icon, amber color)
  3. Price per unit (e.g., "₪8.90 / ק״ג")

- **Unit products (`is_weighted=false`):**
  1. Product name
  2. "יחידה" label + package size (e.g., "יחידה | 400 גרם")
  3. Price per unit (e.g., "₪10.90 ליח׳")
  4. Price per 100g (e.g., "₪3.12 ל-100 גרם") — only when `unit_qty` has numeric weight data

- Removed old mixed manufacturer/unitQty line and bottom-placed weighted badge
- Removed `formatWeightedSubprice` usage (no longer showing ≈ per-100g for weighted products)

#### 2. Weight Filter in Filter Panel (`ProductCatalogArea.tsx`)
Added "סוג מוצר" (Product type) filter section with two options:
- **נמכר במשקל** (amber) — shows only `is_weighted=true` products
- **יחידה** (blue) — shows only `is_weighted=false/null` products
- Behaves as radio buttons (selecting one deselects the other)
- Active filter chip shown in summary row with dismiss button
- Included in filter count badge and clear-all action

#### 3. Default Sort Changed to `'default'`
- Changed initial sort from `'price_asc'` to `'default'` to preserve API ordering
- Prevents products from reshuffling when loading more pages

#### 4. Auto-fetch for Client-Side Filters
- When client-side filters (weight, on-sale, price range) reduce visible products below 16, automatically fetches next page from API
- Prevents showing only 2 products when most of a page is filtered out

#### 5. API-Level Sorting Integration (new sort_by options)
Wired up three new API sort modes in the browse fetch logic:
- **Category level** (no subcategory selected): `sort_by=subcategory_order` — groups products by subcategory (largest first), weighted products first within each
- **Subcategory level** (with sub-subcategory order): `sort_by=sub_subcategory_order` — existing, now fully API-driven
- **Any other level**: `sort_by=is_weighted` — weighted products appear first
- Removed hardcoded `SUBCATEGORY_ORDER` for ירקות טריים (now empty `{}`) — sub-subcategory ordering is fully handled by the API
- Simplified client-side default sort to just preserve API order

#### 6. API-Side Fixes (db-api agent)
- **`unit_qty` normalization**: Fixed bare unit names (e.g., "גרמים") to include numeric values (e.g., "500 גרם") across all 5 chain ETLs. Enables per-100g pricing display on product cards.
- **New sort_by options**: `subcategory_order`, `is_weighted`, and improved `sub_subcategory_order` — all sort weighted products first within their groups.
- API version bumped to 1.6.0

### Files Changed (Lista Frontend)
- `components/ProductCard.tsx` — Consistent card info layout for weighted vs unit products
- `components/ProductCatalogArea.tsx` — Weight filter, default sort, auto-fetch, API sort integration

#### 7. API Display Fields Integration (display_price, display_unit, price_per_100g)
The API now provides backend-computed display fields so the frontend no longer guesses how to format prices from `unit_of_measure`. This fixed the bug where deli products (e.g., גבינת עמק 28%) showed ₪52.30 "per 100g" when the actual price was ₪52.30 per kg.

**New API fields used:**
- `display_min_price` / `display_price` / `display_effective_price` — consumer-friendly price (always per-kg for weighted)
- `display_unit` — unit label ("ק״ג" for weighted, null for unit products)
- `min_price_per_100g` / `price_per_100g` / `effective_price_per_100g` — price ÷ 10 for weighted products

**Frontend rendering (matches Israeli supermarket websites):**
- Weighted products: main price per kg (big) + per-100g below (small)
- Non-weighted products: price per unit + per-100g from `unit_qty` computation

**Added `formatDisplayPrice()` utility** — simple renderer: `₪{price} / {unit}` when unit exists, `₪{price}` when null. Replaces the old `effectiveUnit() → unitSuffix()` chain for display.

#### 8. Fully API-Driven Sub-subcategory Ordering
- Removed `SUBCATEGORY_ORDER` config entirely (was already emptied, now `sortSubItems()` is a passthrough)
- The API's `/categories` endpoint now returns sub-subcategories in custom order (e.g., עגבניות → מלפפונים → פלפלים for ירקות טריים)
- `sort_by=subcategory_order` used for both category and subcategory level browse
- `sort_by=is_weighted` used at sub-subcategory level only

### Files Changed (all sessions combined)
- `types.ts` — Added `display_min_price`, `display_unit`, `min_price_per_100g`, `display_price`, `display_effective_price`, `price_per_100g`, `effective_price_per_100g`, `item_status` to product/price interfaces
- `utils/priceFormat.ts` — Added `formatDisplayPrice()` helper
- `components/ProductCard.tsx` — Uses `display_min_price` + `display_unit` + `min_price_per_100g`
- `components/ProductDetailModal.tsx` — Uses `display_effective_price` + `effective_price_per_100g` per chain
- `components/GroupDetailModal.tsx` — Uses `display_effective_price` + `effective_price_per_100g`, removed hardcoded "/ ק״ג"
- `components/ProductCatalogArea.tsx` — Weight filter, API-driven sorting, auto-fetch
- `components/BasketBreakdownView.tsx` — Uses `displayPrice` + `pricePer100g` per item
- `components/SavingsReport.tsx` — Uses `displayPrice` + `displayUnit` per item
- `services/priceDbService.ts` — Maps new API display fields into `ItemPriceDetail`

#### 9. Category-Based Quantity Steps for Weighted Products
Weighted product quantity selectors now use different step sizes based on category:
- **פירות וירקות**: 0.5 kg steps (unchanged)
- **מוצרי חלב וביצים**: 0.1 kg steps (100g increments for deli/cheese)
- **בשר עוף דגים ומעדניה**: 0.1 kg steps (100g increments for meat/deli)

Applied in three places:
- `components/ProductCard.tsx` — quantity selector on product cards
- `components/ProductDetailModal.tsx` — quantity selector in product detail
- `components/ShoppingInputArea.tsx` — quantity input in the shopping cart

#### 10. Sort by Price Difference (%)
Added two new sort options to the sort dropdown:
- **פער מחיר: גבוה ← נמוך** (`savings_desc`) — products with the biggest price spread % across supermarkets first
- **פער מחיר: נמוך ← גבוה** (`savings_asc`) — products with the smallest price spread first
- Computed as `(1 - min_price / max_price)` — products with no spread sort to the bottom/top
- Files: `types.ts`, `ProductCatalogArea.tsx`, `constants/translations.ts`

---

---

## Session: April 10–12, 2026

### Changes Made

#### 1. Promotion System Overhaul
- **`has_promotion` field**: Product cards show "במבצע" tag only when API returns `has_promotion === true` (actual promotion records, not price differences)
- **`promotion_summary` field**: Product cards show promo details (supermarket name + description + bundle deal info) in an amber info box below the price
- **Promotion types updated**: Added `discounted_price`, `min_qty`, `club_id` to all promotion interfaces
- **"במבצע" filter fixed**: Now uses `has_promotion` instead of `labels` field (which contains product attributes like "טבעוני", not promo data)

#### 2. Promo Pricing in Detail Modal
- Store rows now show `discounted_price` from promos as the main price with original price struck through
- Falls back to parsing price from promo description text when `discounted_price` is null
- Bundle deals (min_qty >= 2) show per-unit price below promo description (e.g., "₪14.00 ליחידה")
- "הכי זול" badge only shows when cheapest store is strictly cheaper than most expensive (not when all equal)
- Sorting accounts for promo `discounted_price` — stores with promo deals rank correctly

#### 3. Detail Modal Cleanup
- Removed `unit_qty` (e.g., "300 גרם"), per-100g price, and unit price line from individual store rows — keeps rows clean
- Package size info stays in the price hero area only
- Price hero uses real cheapest price accounting for promos

#### 4. Hide Unit Count Labels
- `normalizeUnitQty()` now filters out values like "3 יחידות", "1 יחידה" — these are not useful package info
- Only actual package sizes like "300 גרם", "1 ליטר" are displayed

#### 5. Default to `store_type=online`
- `selectedShoppingMode` defaults to `'online'` instead of `null`
- All API calls (search, browse, detail, groups, shopping-list/compare) now pass `store_type=online`
- Eliminates price/promo mismatch bugs caused by mixing online and physical store data
- Physical store mode deferred to future release when data is fully loaded

#### 6. API-Side Fixes (db-api agent, this session)
- **Promo bug fixed**: Detail endpoint was missing promotions for bundle deals where `effective_price === price`. Condition removed — promos now returned whenever a promotion record exists.
- **Store data cleanup**: Each chain now has exactly 1 canonical active online store. Stale/duplicate stores deactivated. ETL uses consistent store_id for both prices and promos.
- **`promotion_summary` added**: Browse/search endpoints return best promo per product (supermarket, description, discounted_price, min_qty).
- **Promotion detail fields added**: `discounted_price`, `min_qty`, `club_id` on all promotion objects across all endpoints.

### Files Changed
- `App.tsx` — Default `selectedShoppingMode` to `'online'`
- `types.ts` — Updated promotion interfaces with `discounted_price`, `min_qty`, `club_id`, `has_promotion`, `promotion_summary`
- `components/ProductCard.tsx` — Promo tag via `has_promotion`, promo summary box with store name + deal info
- `components/ProductDetailModal.tsx` — Promo pricing in store rows, cleaned up rows, smart "הכי זול" logic
- `components/ProductCatalogArea.tsx` — "במבצע" filter uses `has_promotion`
- `services/priceDbService.ts` — Maps new promo fields in shopping list comparison
- `utils/priceFormat.ts` — Hide unit count labels ("3 יחידות")

#### 7. Structured Promo Display (replaces raw XML descriptions)
Promo labels are now built from structured API fields (`min_qty`, `discounted_price`) instead of raw chain-specific description text. Applied across all modals:

**ProductDetailModal + GroupDetailModal:**
- Bundle deal (min_qty >= 2): "במבצע: 3 ב-₪20 (₪6.67 ליחידה)"
- Single item deal: "במבצע: ₪19.90"
- Fallback: raw description when structured fields are null
- Discount % badge on promo rows
- Price column shows promo price with strikethrough original
- "הכי זול" badge respects promo prices in GroupDetailModal too

**ProductCard promo summary:**
- Same structured logic — clean display from `min_qty` + `discounted_price`

**API-side (db-api agent):**
- `min_qty` and `discounted_price` now 100% populated across all 5 chains
- Rami Levy coupons (personal/wallet deals) filtered from all endpoints
- ETL crons now run daily on Railway via Bright Data proxy for Israeli sources
- Rami Levy switched from e-commerce API to government-mandated XML

#### 8. Enforce `store_type=online` on ALL API calls
Fixed price mismatch issue where physical store prices leaked into online mode (e.g., Rami Levy showing ₪12.50 from physical store instead of ₪13.10 from online store).

- `getProductDetail()` — added `storeType` param, passes `store_type` to API
- `ProductDetailModal` — accepts `storeType` prop from parent, passes to `getProductDetail`
- `ProductCatalogArea` — passes `storeType` to `ProductDetailModal` and `getProductGroups`
- `SmartListPanel` — passes `storeType="online"` to `ProductDetailModal`
- `getProductGroups()` — added `storeType` param for consistency
- All search, browse, detail, group, and compare calls now consistently pass `store_type=online`

### Files Changed (this update)
- `services/priceDbService.ts` — `getProductDetail` + `getProductGroups` accept `storeType`
- `components/ProductDetailModal.tsx` — Structured promo labels + `storeType` prop
- `components/GroupDetailModal.tsx` — Promo display + discount badge + promo pricing
- `components/ProductCard.tsx` — Clean structured promo summary
- `components/ProductCatalogArea.tsx` — Pass `storeType` to detail modal + product groups
- `agents_and_ai/product-discovery-assistant/SmartListPanel.tsx` — Pass `storeType="online"`

#### 9. Hebrew Store Names + Online Indicator
- All supermarket names now display in Hebrew across all modals (ProductDetailModal, GroupDetailModal)
- Added `getStoreDisplayName()` utility that maps English API names to Hebrew
- Online stores show a small blue "אונליין" tag next to the store name
- Applied in both ProductDetailModal and GroupDetailModal store rows

#### 10. Landing Page Product Sections — Multi-Store Enforcement + Promo Row
Rework of the three horizontal product rails shown on the category landing view in `ProductCatalogArea.tsx`.

**"שווה להשוות" (Worth Comparing)**
- Expanded `popularQueries` from 16 → 24 staples
- Takes top 2 candidates per query (instead of 1), increasing max display from 8 → 16
- Still filters by `max_price > min_price` so every item is implicitly carried in 2+ stores with price variance

**"מוצרים יומיומיים" (Everyday Essentials)**
- Stricter multi-supermarket guarantee: for each staple query, fetch candidates then call `getProductDetail` to count unique chains in `prices[]`, keep only products with `≥3` chains, pick the variant with the highest chain count
- This fixes the "3% cottage cheese only in 2 stores" regression — the 5% variant (in more stores) now wins
- Expanded staple list from 8 → 16 queries; cap raised from 8 → 16 items
- Trade-off: adds ~8×6 detail API calls on first landing load; results are cached per-session

**"מחירים חדשים במבצע" (Hot Deals — Fresh Price Drops) — NEW**
- Reuses the same `popularQueries` fetch as the worth-comparing row (no extra API calls)
- Filters for products where `has_promotion === true`, takes top 2 per query, ranks globally by discount depth `(min_price − discounted_price) / min_price`
- Amber-themed card with store name + `-X%` pill. Badge row always renders (`min-h-[28px]`) so cards stay vertically aligned even when a percentage can't be computed
- Store name goes through `SUPERMARKET_NAME_MAP` → Hebrew (Rami Levy → רמי לוי, Victory → ויקטורי, Market Warehouses → מחסני השוק, etc.)

**Scroll affordance**
- Each of the three rails now shows a "החלק לעוד ←" hint with a `ChevronLeft` icon next to the heading when `items.length > 4`, signaling the row is horizontally scrollable

**Files Changed**
- `components/ProductCatalogArea.tsx` — New `promoProducts` state + fetch branch, stricter common-product scoring via `getProductDetail`, expanded query lists, scroll hints, Hebrew store mapping on promo badge, aligned badge row
- `constants/translations.ts` — Added `promoProducts` and `scrollForMore` keys (en + he)

#### 11. Detail Modals Respect Delivery-Check Area Availability
Problem: after picking a city, the user sees a "חנויות זמינות" banner listing only the supermarkets that deliver to / are physically near their address, but when opening a product detail modal, prices from every chain in the DB were rendered — including stores the user can't actually buy from (e.g. H. Cohen and Market Warehouses shown to a user in קריית אונו whose available set is Rami Levy / Shufersal / Victory).

Fix: the `effectiveChains` list already computed in `ShoppingInputArea` (derived from `deliveryCheck.chains`, filtered by `shoppingMode` — deliverable / click-and-collect for online, all nearby for physical) is now plumbed all the way into the detail modals and used to filter the price list before rendering.

- `ProductDetailModal` — new `availableChains?: string[]` prop. Builds `filteredRawPrices = product.prices.filter(p => availableChains.includes(p.supermarket))` before sorting. All downstream calculations (`sortedPrices`, `cheapestPrice`, `mostExpensivePrice`, `maxSavings`, `overallDiscountPct`, "עד ₪X.XX בחנויות אחרות") now operate on the filtered set, so the savings badge reflects only relevant stores.
- `GroupDetailModal` — same `availableChains?: string[]` prop, same filter applied to `detail.prices` at the top of the render path.
- `ProductCatalogArea` — passes `availableChains={selectedChains}` to both modals. `selectedChains` here is the already-computed `effectiveChains` from the parent.
- **Fallback:** if `availableChains` is undefined or empty (e.g. no city selected, no delivery check yet), both modals show every price as before — nothing regresses for users without location data.

**Files Changed**
- `components/ProductDetailModal.tsx` — `availableChains` prop + `filteredRawPrices` filter
- `components/GroupDetailModal.tsx` — `availableChains` prop + filtered `prices` derivation
- `components/ProductCatalogArea.tsx` — Passes `selectedChains` through to both detail modals

#### 12. Promo Rail Respects Delivery-Check Available Chains
Follow-up to §10 + §11: the "מחירים חדשים במבצע" rail was still showing promo cards whose `promotion_summary.supermarket` belonged to a chain the user can't buy from (e.g. Market Warehouses showing for a קריית אונו user whose area is Rami Levy / Shufersal / Victory).

Fix: added a `visiblePromoProducts` `useMemo` in `ProductCatalogArea` that filters `promoProducts` by `selectedChains.includes(promotion_summary.supermarket)`. Reactive to chain changes — no refetch needed. Falls back to the unfiltered list when `selectedChains` is empty (no delivery check yet). Both the section's visibility gate and the map over cards now use `visiblePromoProducts`.

**Known limitation:** the "שווה להשוות" and "מוצרים יומיומיים" rails still compute their min/max prices across every chain in the DB, since the landing fetch doesn't pull per-store data. The savings badge on those cards can therefore reference a chain the user can't access. Scoping those sections to in-area prices would require detail-level fetching or a backend filter and is deferred.

**Files Changed**
- `components/ProductCatalogArea.tsx` — Added `visiblePromoProducts` memo + swapped render usages

#### 13. GroupDetailModal — Drop Backend `city` Filter to Fix Missing Chains
Problem: opening a product group (e.g. עגבניה / VEG-001) showed only **1 chain** in the "השוואת מחירים בין רשתות" list and "1 רשתות" in the header, even for users whose available-stores banner listed 3 chains delivering to their city. Expectation was that all deliverable chains with a price in the group show up.

Root cause (NOT a rendering bug — the map loop was already correct): `/api/delivery/check` and `/api/groups/{id}?city=...` disagreed about chain availability. For a Petah Tikva user, delivery-check confirmed Rami Levy + Shufersal + Victory all deliver (`eligible_store_ref_ids=[26, 22, 23]`), but `GET /api/groups/142?city=פתח תקווה&store_type=online` returned **only Rami Levy** — the backend's `city` filter appears to require a physical store in the city even for online-only prices, dropping Victory's online price from the response. By the time the frontend's `availableChains` filter ran, the row was already gone.

Fix: stop passing `city` to `getGroupDetail`. The modal now fetches all chains and relies on the existing `availableChains` filter (derived from delivery-check) as the single source of truth for which chains to show. Matches the pattern `ProductDetailModal` already uses. For the Petah Tikva tomato this now correctly renders both Rami Levy and Victory.

- `components/GroupDetailModal.tsx` — `getGroupDetail(groupId, undefined, storeType)` in the effect; `city` prop removed from interface + destructure; `useEffect` deps updated. Frontend filter at lines 47-52 unchanged — already handles delivery-aware chain filtering correctly.
- `components/ProductCatalogArea.tsx` — Stopped passing `city={city}` to `<GroupDetailModal>`; now only passes `storeType` + `availableChains={selectedChains}`.

**Backend follow-up (deferred, non-blocking):** filed task with db-api agent to align `/api/groups/{id}?city=...` with delivery-check's availability model, or to accept `eligible_store_ref_ids` explicitly so callers can opt in. Agent confirmed the frontend workaround is correct and stable — no backend change needed right now. Same underlying inconsistency likely affects `/api/groups/?city=...` list aggregations (`chain_count`, `min_price`, `max_price`) when a city is supplied.

**Files Changed**
- `components/GroupDetailModal.tsx` — Drop `city` from API call + interface
- `components/ProductCatalogArea.tsx` — Stop passing `city` to `<GroupDetailModal>`

---

**Last Updated**: April 17, 2026
**Version**: 5.9.3
**Status**: Production Ready

