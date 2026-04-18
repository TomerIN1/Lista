# Task: Upgrade the Lista "עוזר חכם" AI Shopping Assistant

## Context

Lista is a grocery price-comparison app (Vite + React, deployed on Vercel) that compares prices across Israeli supermarket chains (Rami Levy, Shufersal, Victory, Market Warehouses). It has an AI helper feature called "עוזר חכם" that lets users type a shopping list or natural language query and get matching products from the catalog.

### Current Architecture

```
User Input (text)
    ↓
OpenAI API (POST /v1/chat/completions) — called from CLIENT-SIDE
    ↓  parses user input into product search terms
Product Search API (GET /price-api/api/products/search?q={term}&limit=5&store_type=online&chain=...)
    ↓  returns matched products per term
OpenAI API (POST /v1/chat/completions) — second call
    ↓  generates Hebrew summary text about the results
UI renders: summary text + product cards grouped by store category + "הוסף" buttons
```

**Tech stack:**
- Frontend: Vite + React (single bundle: `assets/index-*.js`), Tailwind CSS
- Backend: Vercel serverless functions (`/price-api/api/...`)
- Database: Firebase Firestore (`projects/lista-ef72c/databases/(default)`)
- AI: OpenAI API (`/v1/chat/completions`) — **called directly from the client (API key exposed!)**
- Product images: `/price-api/api/images/{barcode}.jpg`
- Category icons: `/category-icons/{name}.svg`

### Current Issues Found During Testing

I tested the AI helper with a 20-item grocery list across 4 different queries. Here are the specific issues:

#### CRITICAL: API Key Security
- The OpenAI API is called **directly from the browser** (`api.openai.com/v1/chat/completions`). This means the API key is embedded in the client-side JavaScript bundle. This is a major security vulnerability — anyone can extract it and abuse it.

#### Issue 1: No Smart Default Selection (Severity: HIGH)
- When searching for 12 items, the AI returned **32 products**. Users must scroll through all of them and click "הוסף" individually on each one they want.
- There's no "best match" or "recommended pick" per search term. For example, searching "סוכר" returns 5 types of sugar with no indication of which one most people want (regular white sugar).
- The only bulk action is "הוסף הכל (32)" which adds EVERYTHING — no selective bulk add.

#### Issue 2: Results Grouped by Store Category, Not by Search Term (Severity: HIGH)
- If user searches "חמאה, יוגורט", both appear under "מוצרי חלב וביצים" mixed together.
- The user can't tell which results belong to which search term.
- Expected: Results should be grouped as "חמאה: [options...]" then "יוגורט: [options...]"

#### Issue 3: Fresh Produce Missing from Catalog (Severity: MEDIUM)
- Searching for עגבניות (tomatoes), תפוחי אדמה (potatoes), תפוחים (apples), בננות (bananas) all return zero results.
- The AI acknowledges this: "לא מצאנו עגבניות, מומלץ להוסיף אותן ידנית" — but offers no way to actually add them manually.
- Fresh produce is the backbone of any grocery list. This is a catalog gap.

#### Issue 4: No Conversation Memory (Severity: MEDIUM)
- Each query is independent. The AI doesn't know what was already searched/added.
- Can't do follow-ups like "actually, I want organic eggs instead" or "add 2 more of the milk".
- The chat UI looks conversational but isn't — it's just a search box with a chat skin.

#### Issue 5: No Quantity Support (Severity: MEDIUM)
- Can't say "2 קרטוני חלב" or "חבילה גדולה של אורז".
- All products are added as quantity 1.

#### Issue 6: Multiple OpenAI Calls Per Query (Severity: LOW)
- A single user query triggers 2-5 separate OpenAI API calls (observed in network traffic). For a 12-item query, this is slow and expensive.
- The flow should be: 1 call to parse → N parallel searches → 1 call to summarize. Currently unclear if parsing and summarization are being done efficiently.

### What Works Well (Keep These)
- Multi-item comma-separated parsing works correctly
- Natural language understanding is good (tested "אני מכין פסטה הערב, מה אני צריך?" — returned pasta, sauce, garlic, parmesan, olives)
- Products display with images, prices, brand names, and price ranges across stores
- Per-product "הוסף" buttons work
- Categorized display by store department
- Hebrew text summary with cheapest option highlighted

---

## Goals

1. **Migrate from OpenAI to Google Gemini** — for potentially better Hebrew support, lower cost, and faster responses
2. **Move AI calls server-side** — fix the security vulnerability of client-side API key exposure
3. **Implement smart matching** — return 1 best-match per search term with expandable alternatives
4. **Build a selection UI** — checkboxes, per-item grouping, selective bulk add
5. **Add conversation memory** — multi-turn interactions with context
6. **Support quantities** — parse and handle item quantities

---

## Implementation Phases

### Phase 1: Security Fix + Gemini Migration (Priority: CRITICAL)

**Goal:** Move AI calls to a Vercel serverless API route and switch from OpenAI to Gemini.

#### 1.1 Create a server-side AI endpoint

Create a new Vercel API route that proxies AI requests:

```
/api/ai/chat  (POST)
```

Request body:
```json
{
  "message": "חלב, ביצים, לחם",
  "conversationHistory": [],  // for future multi-turn
  "store_type": "online",
  "chains": ["Rami Levy", "Shufersal", "Victory", "Market Warehouses"]
}
```

Response:
```json
{
  "summary": "מצאנו 3 מוצרים...",
  "items": [
    {
      "searchTerm": "חלב",
      "recommended": { "product_id": "...", "name": "חלב 3% מהדרין שקית 1 ל׳", "price": 6.35, ... },
      "alternatives": [ ... ],
      "status": "found"
    },
    {
      "searchTerm": "ביצים",
      "recommended": { ... },
      "alternatives": [ ... ],
      "status": "found"
    }
  ],
  "notFound": ["עגבניות"]
}
```

#### 1.2 Install and configure Gemini

```bash
npm install @google/generative-ai
```

Use `gemini-2.0-flash` for the main model (fast, cheap, good Hebrew support).

Set up environment variable in Vercel:
```
GEMINI_API_KEY=your-key-here
```

#### 1.3 Design the Gemini system prompt

The AI needs to do two jobs in ONE call (not multiple):

**Job 1 — Parse user input into structured search terms:**

```
System prompt (Hebrew-optimized):

אתה עוזר קניות חכם באפליקציית השוואת מחירים של סופרמרקטים בישראל.

כשהמשתמש שולח הודעה, עליך:
1. לזהות אם זו רשימת קניות, שאלה על מוצר, או בקשה כללית (כמו מתכון)
2. לחלץ את כל פריטי הקניות מההודעה
3. עבור כל פריט, לספק את מונח החיפוש הטוב ביותר לחיפוש בקטלוג

ענה תמיד ב-JSON בלבד, בפורמט הבא:
{
  "type": "shopping_list" | "question" | "recipe",
  "items": [
    {
      "original": "הטקסט המקורי של המשתמש",
      "searchTerm": "מונח חיפוש מותאם לקטלוג",
      "quantity": 1,
      "unit": "יח׳",
      "category_hint": "מוצרי חלב" 
    }
  ],
  "message": "הודעה ידידותית למשתמש אם רלוונטי"
}

דוגמאות:
- "2 קרטוני חלב ולחם" → items: [{searchTerm: "חלב", quantity: 2}, {searchTerm: "לחם", quantity: 1}]
- "אני מכין פסטה" → type: "recipe", items: [{searchTerm: "פסטה"}, {searchTerm: "רוטב עגבניות"}, {searchTerm: "שמן זית"}, {searchTerm: "גבינה פרמזן"}]
- "מה הכי זול מבין החלבים?" → type: "question", items: [{searchTerm: "חלב"}]
```

**Job 2 — After search results come back, generate summary:**

```
Given these search results for the user's shopping list, generate a short Hebrew summary.
For each item, the "recommended" product is the one with the lowest price.
Mention items not found so the user knows.
Keep it conversational and brief (2-3 sentences max).
```

#### 1.4 Update the frontend

- Remove all direct OpenAI API calls from the client-side code
- Replace with calls to `/api/ai/chat`
- Remove the hardcoded OpenAI API key from the bundle

#### 1.5 Remove the exposed API key

- Search the entire codebase for any OpenAI API key strings (`sk-...`)
- Remove from environment variables, `.env` files, and client code
- Rotate the compromised key in OpenAI dashboard immediately

---

### Phase 2: Smart Matching + Selection UI (Priority: HIGH)

**Goal:** One best-match per item, checkboxes, expandable alternatives, selective add-to-cart.

#### 2.1 Server-side ranking logic

In the API route, after fetching search results for each term:

```javascript
function rankProducts(products, searchTerm) {
  return products
    .map(p => ({
      ...p,
      relevanceScore: calculateRelevance(p.name, searchTerm),
      priceScore: 1 / p.price,  // cheaper = better
      // Combine scores: relevance matters more than price
      totalScore: calculateRelevance(p.name, searchTerm) * 0.7 + (1 / p.price) * 0.3
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

function calculateRelevance(productName, searchTerm) {
  // Exact match > starts-with > contains > fuzzy
  if (productName === searchTerm) return 1.0;
  if (productName.startsWith(searchTerm)) return 0.9;
  if (productName.includes(searchTerm)) return 0.7;
  // Add Hebrew-aware fuzzy matching here
  return 0.3;
}
```

The API should return results structured **per search term**:
```json
{
  "items": [
    {
      "searchTerm": "חלב",
      "recommended": { /* best match product */ },
      "alternatives": [ /* 2-4 more options */ ],
      "selected": true  // pre-selected by default
    }
  ]
}
```

#### 2.2 New UI component: `SmartResultsList`

Replace the current flat product list with a new component:

```
┌─────────────────────────────────────────────┐
│ ✅ חלב                                      │
│   ◉ חלב 3% מהדרין שקית 1 ל׳ — ₪6.35 🏷️    │
│     ▸ 3 אפשרויות נוספות                      │
├─────────────────────────────────────────────┤
│ ✅ ביצים                                     │
│   ◉ ביצים 12 יח׳ גדול L — ₪14.50           │
│     ▸ 2 אפשרויות נוספות                      │
├─────────────────────────────────────────────┤
│ ✅ לחם                                       │
│   ◉ לחם 7 דגנים קל 1.1 ק״ג — ₪16.20        │
│     ▸ 3 אפשרויות נוספות                      │
├─────────────────────────────────────────────┤
│ ⚠️ עגבניות — לא נמצא בקטלוג                  │
│     [הוסף ידנית]                             │
├─────────────────────────────────────────────┤
│                                              │
│  סה״כ: ₪37.05 (3 מוצרים)                    │
│  [🛒 הוסף נבחרים לעגלה]                     │
└─────────────────────────────────────────────┘
```

Key behaviors:
- Each search term is a collapsible section
- The best match is pre-selected (radio button)
- Clicking "▸ אפשרויות נוספות" expands to show alternatives with radio buttons
- Selecting a different alternative updates the running total
- Checkbox on each section enables/disables it
- "הוסף נבחרים לעגלה" adds only the checked items with selected variants
- Missing items show a warning with an option to add a custom free-text item

#### 2.3 Running total

Show a sticky footer with the running total price that updates in real-time as checkboxes change:

```
סה״כ: ₪37.05 (3 מוצרים) | [🛒 הוסף נבחרים לעגלה]
```

---

### Phase 3: Conversation Memory + Interactivity (Priority: MEDIUM)

**Goal:** Multi-turn conversations, follow-ups, corrections, quantity support.

#### 3.1 Conversation state management

Create a React context or Zustand store for the conversation:

```javascript
// stores/conversationStore.js
const useConversationStore = create((set, get) => ({
  messages: [],           // chat history
  currentSelection: [],   // selected products from latest results
  sessionId: null,        // for server-side session tracking
  
  addMessage: (role, content) => ...,
  updateSelection: (termIndex, productId) => ...,
  addToCart: () => ...,
  clearConversation: () => ...,
}));
```

#### 3.2 Send conversation history to the API

Update `/api/ai/chat` to accept and use conversation history:

```json
{
  "message": "תחליף את הגבינה הצהובה בגבינת עיזים",
  "conversationHistory": [
    { "role": "user", "content": "חלב, ביצים, גבינה צהובה" },
    { "role": "assistant", "content": "מצאנו 3 מוצרים..." }
  ]
}
```

The Gemini system prompt should understand follow-up commands:
```
אם המשתמש מבקש לשנות, להחליף, להוסיף או להסיר פריט מרשימה קודמת,
הבן את ההקשר מההיסטוריה ועדכן את הרשימה בהתאם.

דוגמאות:
- "תחליף את הגבינה הצהובה בגבינת עיזים" → replace searchTerm "גבינה צהובה" with "גבינת עיזים"
- "הוסף גם מיץ תפוזים" → add new item {searchTerm: "מיץ תפוזים"}
- "תוריד את החמאה" → remove item with searchTerm "חמאה"
- "אני רוצה 2 מהחלב" → update quantity for "חלב" to 2
```

#### 3.3 Quantity support

Update the product card to show quantity controls:

```
◉ חלב 3% מהדרין שקית 1 ל׳ — ₪6.35
  [−] 2 [+]    סה״כ: ₪12.70
```

Parse quantities from user input in the Gemini prompt (see Phase 1 system prompt — already included).

#### 3.4 Interactive responses

The AI should ask clarifying questions when input is ambiguous:

```
User: "גבינה"
AI: "איזה סוג גבינה? 🧀
     • גבינה צהובה
     • גבינה לבנה
     • קוטג׳
     • גבינת שמנת"
```

Each option should be a clickable button that triggers a search.

---

### Phase 4: Advanced Features (Priority: LOW — Future)

#### 4.1 Store-optimized cart
Compare the TOTAL basket cost across all stores, not just per-product:
```
העגלה שלך ב:
🏪 רמי לוי: ₪127.40
🏪 שופרסל: ₪134.20
🏪 ויקטורי: ₪131.80
💡 חיסכון של ₪6.80 ברמי לוי!
```

#### 4.2 Smart split
```
💡 קנה פריטים 1-8 ברמי לוי ופריטים 9-12 בשופרסל — חסוך ₪23!
```

#### 4.3 Saved lists
- "שמור כרשימה שבועית" → save to Firestore under user account
- "טען את הרשימה שלי" → load previous list

#### 4.4 Manual item entry for missing products
When a product isn't found in the catalog, let users add it as a free-text item to the cart so their list is complete even without catalog coverage.

---

## File Structure (Expected)

Based on the Vite + React architecture, look for and modify these areas:

```
src/
├── components/
│   ├── SmartAssistant/         ← The AI helper UI (currently "עוזר חכם")
│   │   ├── SmartAssistant.jsx  ← Main component — REFACTOR THIS
│   │   ├── ChatMessage.jsx     ← Message bubbles
│   │   ├── ProductCard.jsx     ← Individual product display
│   │   └── SmartResultsList.jsx  ← NEW: grouped results with checkboxes
│   ├── Cart/                   ← Shopping cart components
│   └── ...
├── services/
│   ├── openai.js              ← REMOVE THIS (client-side OpenAI calls)
│   ├── ai.js                  ← NEW: calls /api/ai/chat instead
│   ├── products.js            ← Product search API calls
│   └── firebase.js            ← Firestore config
├── stores/                    ← State management
│   └── conversationStore.js   ← NEW: conversation state
├── api/ (or pages/api/ or server/)
│   └── ai/
│       └── chat.js            ← NEW: Vercel serverless function
└── ...
```

## Search the codebase for these patterns to find the right files:
- `openai` or `OpenAI` or `sk-` → find API key and client calls
- `chat/completions` → find where AI requests are made
- `עוזר` or `assistant` or `smart` → find the assistant UI component
- `/price-api/api/products/search` → find product search integration
- `הוסף` or `addToCart` → find cart integration
- `firebase` or `firestore` → find database config

---

## Definition of Done

### Phase 1 ✅
- [ ] OpenAI API key removed from client-side code entirely
- [ ] New `/api/ai/chat` Vercel serverless endpoint created
- [ ] Gemini SDK integrated and working with Hebrew
- [ ] Single Gemini call parses user input → returns structured JSON with search terms
- [ ] Second Gemini call generates Hebrew summary from search results
- [ ] Frontend calls `/api/ai/chat` instead of OpenAI directly
- [ ] System prompt handles: shopping lists, natural language, recipes
- [ ] Response time ≤ 5 seconds for a 10-item list

### Phase 2 ✅
- [ ] API returns results grouped by search term with 1 recommended + alternatives
- [ ] New `SmartResultsList` component with checkboxes and radio buttons
- [ ] Pre-selected best match per item (cheapest by default)
- [ ] Collapsible alternatives per item
- [ ] Running total footer that updates in real-time
- [ ] "הוסף נבחרים לעגלה" adds only selected items
- [ ] Missing items shown with warning icon

### Phase 3 ✅
- [ ] Conversation history sent to API and used for context
- [ ] Follow-up commands work: add, remove, replace, change quantity
- [ ] Quantity controls (−/+) on each product card
- [ ] Quantities parsed from natural language input
- [ ] Clarification buttons for ambiguous queries

### Phase 4 ✅
- [ ] Total basket price comparison across all stores
- [ ] Saved/loaded shopping lists
- [ ] Manual free-text item entry for missing products

---

## Testing Checklist

Use these exact queries to validate each phase:

**Basic list parsing:**
```
חלב, ביצים, לחם, עגבניות, גבינה צהובה
```
Expected: 5 grouped sections, עגבניות marked as not found

**Natural language:**
```
אני מכין פסטה הערב, מה אני צריך?
```
Expected: Pasta, sauce, cheese, garlic, olive oil suggested

**Quantities:**
```
2 קרטוני חלב, תריסר ביצים, חצי קילו גבינה צהובה
```
Expected: Quantities parsed correctly (2, 12, 0.5)

**Follow-up:**
```
Query 1: "חלב, ביצים, לחם"
Query 2: "תוסיף גם חמאה ותוריד את הלחם"
```
Expected: Cart updates to חלב + ביצים + חמאה

**Large list (stress test):**
```
חלב, ביצים, לחם, גבינה צהובה, חזה עוף, אורז, שמן זית, בצל, יוגורט, רוטב עגבניות, קפה, סוכר, חמאה, מים מינרלים, פסטה, טונה, קטשופ, מלח, פלפל, שוקולד
```
Expected: 20 grouped sections, responds within 8 seconds

**Ambiguous query:**
```
גבינה
```
Expected: Clarification question with options (צהובה, לבנה, קוטג׳, שמנת)

**Hebrew slang/informal:**
```
תביא לי קוטג׳ ודבר ללחם
```
Expected: Understands קוטג׳ and "דבר ללחם" (spread/jam)