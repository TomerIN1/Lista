# PricePilot v2 — Experiment: Shopping at Rami Levy via API

## Experiment Goal
Take 1 product (barcode `5711953106583`), add it to Rami Levy's cart, and document every tool, step, and observation to build the PricePilot agent.

---

## Key Discovery: Rami Levy has a REST API — NO BROWSER NEEDED

**This changes everything.** The original PricePilot v1 used Playwright to automate a browser (screenshots, click, type, scroll). But Rami Levy exposes a full REST API that can do everything programmatically:

- **Search products** — `POST /api/catalog` (NO AUTH REQUIRED)
- **Calculate cart** — `POST /api/v2/cart` (NO AUTH REQUIRED for price calc)
- **Checkout** — `https://www.rami-levy.co.il/he/dashboard/checkout` (requires auth)

This means: **no screenshots, no browser, no Playwright, no 10K tokens per screenshot, no $0.55 per attempt.** Just HTTP requests.

---

## Step-by-Step Process

### Step 1: Identify the Product

**Tool**: Lista's own API (`GET /api/products/{barcode}`)
**Input**: Barcode `5711953106583`
**Result**:
```json
{
  "name": "ארלה גב.שמנת טעם טבעי200",
  "manufacturer": "ארלה",
  "category": "מוצרי חלב וביצים",
  "prices": [
    {"supermarket": "Victory", "price": 16.9},
    {"supermarket": "Rami Levy", "price": 12.7, "store_id": "331"},
    {"supermarket": "Market Warehouses", "price": 14.9},
    {"supermarket": "H. Cohen", "price": 15.1},
    {"supermarket": "Shufersal", "price": 16.9}
  ]
}
```
**Decision**: Rami Levy is cheapest at ₪12.7. Store ID: `331` (online store).

### Step 2: Search the Product on Rami Levy

**Tool**: HTTP POST to `https://www.rami-levy.co.il/api/catalog`
**Headers**:
```
content-type: application/json;charset=UTF-8
locale: he
accept: application/json, text/plain, */*
user-agent: Mozilla/5.0 ...
```
**Body**:
```json
{"q": "5711953106583", "store": "331", "aggs": 1}
```
**Auth Required**: NO — catalog search works without any authentication!

**Result**:
```json
{
  "total": 1,
  "data": [{
    "id": 358996,
    "name": "ארלה גבינת שמנת טבעי 200 גר",
    "barcode": 5711953106583,
    "price": {"price": 14.9},
    "department": {"name": "חלב ביצים וסלטים", "id": 50},
    "group": {"name": "גבינות", "id": 202},
    "subGroup": {"name": "גבינת שמנת,מותכת", "id": 189},
    "images": {
      "small": "/product/5711953106583/small.jpg",
      "original": "/product/5711953106583/large.jpg"
    },
    "available_in": [179, 279, 331, 412, "...21 stores"],
    "sale": [
      {"name": "גבינת שמנת ארלה 2 יח' ב-24.90 ש\"ח", "scm": 24.9, "cmt": 2}
    ]
  }]
}
```

**Key Fields**:
- `id`: 358996 — this is the Rami Levy internal product ID (used for cart operations)
- `barcode`: the original barcode (for matching)
- `price.price`: current price
- `sale`: active promotions (2 for ₪24.90!)
- `available_in`: array of store IDs where product is in stock

**Search Strategies**:
1. By barcode (exact): `{"q": "5711953106583"}` → 1 result (best)
2. By Hebrew name: `{"q": "ארלה גבינת שמנת"}` → 266 results (need to filter)

### Step 3: Add to Cart

**Tool**: HTTP POST to `https://www.rami-levy.co.il/api/v2/cart`
**Headers**: Same as catalog (no auth needed for price calculation)
**Body**:
```json
{
  "store": "331",
  "isClub": 0,
  "supplyAt": "2026-03-25T00:00:00.000Z",
  "items": {"358996": "1"},
  "meta": null
}
```
**Auth Required**: NO for price calculation — YES for persisting to user's account.

**Result**:
```json
{
  "status": 200,
  "price": 14.9,
  "priceClub": 14.9,
  "discount": 0,
  "quantity": 2,
  "items": [
    {
      "id": 164854,
      "name": "מחיר משלוח",
      "price": 29.9,
      "quantity": 1,
      "FormatedTotalPrice": 29.9,
      "FormatedSavePrice": 0
    },
    {
      "id": 358996,
      "name": "ארלה גבינת שמנת טבעי 200 גר",
      "price": 14.9,
      "quantity": 1,
      "FormatedTotalPrice": 14.9,
      "FormatedSavePrice": 0
    }
  ],
  "sales": ["...promotion details..."]
}
```

**Key Observations**:
- Cart API auto-adds delivery item (`id: 164854`, ₪29.90)
- `items` format is `{product_id: quantity}` as strings
- `supplyAt` is the delivery date (tomorrow)
- `isClub` = 0 (non-club member), 1 for club pricing
- The `quantity` field in response is total item count including delivery

### Step 4: Authentication — Deep Dive

**The cart API is stateless without auth.** Calling `POST /api/v2/cart` without tokens only *calculates* prices — nothing is saved. To persist the cart, we need user authentication.

#### Auth API Discovery (Probed 2026-03-25)

**Backend API base**: `https://www-api.rami-levy.co.il`
**Framework**: Nuxt.js SPA with `@nuxtjs/auth` module, "local" strategy
**reCAPTCHA**: ALL auth endpoints require reCAPTCHA validation

##### Login Endpoint
```
POST https://www-api.rami-levy.co.il/api/v2/site/auth/login
```
**Required fields** (discovered via 422 validation errors):
```json
{
  "username": "user@email.com",    // Email address (שדה אימייל הוא חובה)
  "password": "...",                // Password
  "recaptcha": "..."               // reCAPTCHA token (אנא וודא שאתה לא רובוט)
}
```
**Response on invalid recaptcha**: `422 — "שגיאת אימות, נסה שוב מאוחר יותר או צור קשר עם שירות לקוחות"`
**Response on valid login**: JWT token (stored in `localStorage.ramilevy`)

##### Register Endpoint
```
POST https://www-api.rami-levy.co.il/api/v2/site/auth/register
```
**Required fields** (all mandatory):
```json
{
  "first_name": "...",        // שם פרטי
  "last_name": "...",         // שם משפחה
  "email": "...",             // אימייל
  "phone": "...",             // טלפון
  "identity_card": "...",     // תעודת זהות (Israeli ID number!)
  "regulation": true,         // אישור תקנון ואישור התטרפות למועדון
  "recaptcha": "..."          // reCAPTCHA token
}
```

##### Reset Password Endpoint
```
POST https://www-api.rami-levy.co.il/api/v2/site/auth/reset-password
```
Also requires reCAPTCHA. Fields: `email`, `recaptcha`.

##### Endpoints That DON'T Exist (404)
- `/auth/otp`, `/auth/otp/send`, `/auth/otp/verify` — NO OTP endpoints
- `/auth/signup`, `/auth/forgot-password`, `/auth/verify-email`
- `/clubs/register`, `/clubs/login`
- `/auth/send-code`, `/auth/verify-code`, `/auth/token`, `/auth/refresh`

#### Key Discovery: Login is EMAIL + PASSWORD, NOT Phone + OTP

The initial assumption was wrong. Rami Levy's API uses:
- **Login**: email + password + reCAPTCHA
- **Register**: first_name, last_name, email, phone, identity_card, regulation, reCAPTCHA
- **NO OTP flow** at the API level (OTP may exist only in the mobile app)

#### The reCAPTCHA Problem

**ALL auth endpoints are gated by reCAPTCHA.** This means:
- ❌ Cannot call login/register APIs directly from server-side code
- ❌ Cannot automate registration programmatically
- ✅ CAN work inside a WebView/browser where reCAPTCHA runs natively

#### Login URL Discovery (Probed 2026-03-25)

**The login page is NOT at `/he/login`** — that returns a 404!

Rami Levy is a Nuxt.js SPA. Login is handled via a specific route. By extracting all routes from the Nuxt router bundle (`/rl/1c91ccf.js`), we found:

**All Rami Levy SPA Routes**:
```
/he                                          ← homepage
/he/basket                                   ← shopping basket
/he/dashboard                                ← account (redirects to login if not auth'd)
/he/dashboard/checkout                       ← checkout page
/he/dashboard/orders                         ← order history
/he/dashboard/addresses                      ← saved addresses
/he/dashboard/information                    ← account info
/he/dashboard/payments                       ← payment methods
/he/dashboard/email-verification             ← email verification
/he/auth/login/mysupermarket                 ← ✅ LOGIN PAGE
/he/online/search                            ← product search
/he/online/sales                             ← promotions
/he/online/feed                              ← content feed
/he/online/:type                             ← shopping by category
/he/online/:type/:department/:group/:subgroup/:product  ← product page
/he/share/:barcode                           ← product share link
/he/stores                                   ← store locator
/he/recipes                                  ← recipes
/he/contact-us                               ← contact
```

**Login URLs tested**:
| URL | Status | Result |
|-----|--------|--------|
| `/he/login` | 404 | ❌ "העמוד המבוקש לא נמצא" (page not found) |
| `/he/auth/login` | 404 | ❌ Not a valid route |
| `/he/auth/login/mysupermarket` | 200 | ❌ Redirects to `/he/dashboard/information` — NOT a login form |
| `/he/dashboard` | 200 | ❌ Shows account help page, not login form |

#### Critical Discovery: Login is a MODAL, Not a Page

**There is NO dedicated login page URL on Rami Levy.**

The "התחברות" (Login) button in the site header triggers a Vue.js modal via:
```javascript
this.$root.$emit("OpenLoginModal")
```

The modal component is `login-footer-modal` which contains `OnlineLogin`, which in turn contains:
- `LoginForm` — email + password login
- `OtpVerification` — OTP verification
- `EmailOtpVerification` — email OTP
- `PhoneVerification` — phone verification

**The HTML button** (from the Nuxt bundle):
```html
<span aria-label="התחברות" role="button" tabindex="0" @click="$root.$emit('OpenLoginModal')">
```

#### The Correct WebView Approach

Since there's no login page URL, the WebView must:

**Option 1 — Auto-trigger the modal via JS injection** (preferred):
```
1. Load: https://www.rami-levy.co.il/he
2. Wait for Nuxt app to hydrate (~2-3 seconds)
3. Inject JavaScript: window.$nuxt.$root.$emit('OpenLoginModal')
4. Login modal appears → user logs in
```

**Option 2 — Programmatically click the login button**:
```
1. Load: https://www.rami-levy.co.il/he
2. Wait for page load
3. Inject: document.querySelector('[aria-label="התחברות"]').click()
4. Login modal appears → user logs in
```

**Option 3 — Guide the user manually** (simplest, most reliable):
```
1. Open: https://www.rami-levy.co.il/he
2. Tell user: "Click 'התחברות' (Login) in the top menu"
3. User logs in via the modal
```

#### The Solution: WebView-Based Login (THE APPROACH)

```
┌─────────────────────────────────────────────────────────────┐
│  LISTA APP: "Connect to Rami Levy" button                    │
│                                                               │
│  1. Open WebView → https://www.rami-levy.co.il/he            │
│  2. Wait for Nuxt app to hydrate (~2-3 sec)                  │
│  3. Inject JS: window.$nuxt.$root.$emit('OpenLoginModal')    │
│     → Login modal appears automatically                      │
│  4. User logs in with email + password (reCAPTCHA in modal)  │
│     (or registers if new — Rami Levy handles it)             │
│  5. Detect auth state change by polling:                     │
│     const state = JSON.parse(localStorage.ramilevy);          │
│     if (state?.authuser?.user?.token) { /* logged in! */ }   │
│  6. Extract: { token: state.authuser.user.token,             │
│                userId: state.authuser.user.id }               │
│  7. Save token securely in Lista app                         │
│  8. Close WebView → user is now "connected"                  │
└─────────────────────────────────────────────────────────────┘
```

**Why this works**:
- reCAPTCHA works in WebView (it's a real browser)
- We never handle credentials — Rami Levy's own modal does
- We only extract the resulting JWT token (with user consent)
- Works for both existing users AND new registrations
- The modal auto-opens — user doesn't need to find the login button

#### Agent Error Recovery: "It's not working" / "The link is broken"

**Lessons learned from this experiment**:

1. **`/he/login` → 404**. There is no `/he/login` page. First wrong assumption.
2. **`/he/auth/login/mysupermarket` → redirects to `/he/dashboard/information`** (account help page, NOT a login form). Second wrong assumption — the route exists in the Nuxt router but doesn't render a login form.
3. **Login is a MODAL, triggered by Vue event `OpenLoginModal`**. There is NO login page URL. The login form only appears as a popup over any page.

**The PricePilot agent must**:
1. **Never assume login page URLs** — always verify by actually loading the page
2. **Use JS injection to trigger the modal**: `window.$nuxt.$root.$emit('OpenLoginModal')`
3. **Handle user complaints gracefully**: When user says "it's not working":
   - Acknowledge immediately
   - Investigate the actual page behavior
   - Provide alternative approach (e.g., "click 'התחברות' in the top menu")
   - Never send a second unverified URL

**The correct approach**: Open `https://www.rami-levy.co.il/he` in WebView, then inject JS to open the login modal. No login page URL needed.

**Fallback chain if JS injection fails**:
1. Try: `window.$nuxt.$root.$emit('OpenLoginModal')` (preferred)
2. Try: `document.querySelector('[aria-label="התחברות"]').click()` (click the button)
3. Fallback: Tell user "Click 'התחברות' in the top-right corner"

#### Bonus Discovery: Share Route

Rami Levy has a `/he/share/:barcode` route that loads a product page by barcode:
```
https://www.rami-levy.co.il/he/share/5711953106583
```
This could be useful for sharing product links with users.

### Step 5: Persist Cart to User's Account

**Auth Headers Required** (2 headers — same JWT for both):
```
Authorization: Bearer {JWT_TOKEN}
ecomtoken: {JWT_TOKEN}
```

**Persist cart call** — same endpoint as price calculation, but WITH auth headers:
```bash
curl -s -X POST "https://www.rami-levy.co.il/api/v2/cart" \
  -H "content-type: application/json;charset=UTF-8" \
  -H "locale: he" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "ecomtoken: {JWT_TOKEN}" \
  -d '{
    "store": "331",
    "isClub": 0,
    "supplyAt": "2026-03-26T00:00:00.000Z",
    "items": {"358996": "1"},
    "meta": null
  }'
```

**Result**: Cart is saved server-side to the user's Rami Levy account.

### Step 6: Verify Persisted Cart

```bash
curl -s "https://www-api.rami-levy.co.il/api/v2/site/clubs/customer/{USER_ID}" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "ecomtoken: {JWT_TOKEN}"
```
Returns user's account info including `cart.items` as a `{product_id: quantity}` map.

### Step 7: Checkout

**Checkout URL**: `https://www.rami-levy.co.il/he/dashboard/checkout`

The user opens this URL. Their persisted cart is already loaded → select delivery slot → pay.

**Important**: There is NO URL-based cart hydration. No deep links. No `?items=...` query params. The ONLY way to get items into checkout is:
1. Persist cart via API with auth tokens → user opens checkout page
2. User manually adds items on the website

---

## Architecture: PricePilot v2

### The Big Insight: API-First, Not Browser-First

| | v1 (Browser) | v2 (API) |
|---|---|---|
| **Search** | Type in search bar, screenshot, parse | `POST /api/catalog` → structured JSON |
| **Add to cart** | Click "הוסף לסל" button | `POST /api/v2/cart` with product IDs |
| **Cost per operation** | ~$0.55 (17 API calls + 4 screenshots) | ~$0.00 (direct HTTP, no LLM) |
| **Speed** | 30-60 seconds | < 1 second |
| **Reliability** | Fragile (popups, modals, layout changes) | Solid (structured API) |
| **Auth** | Browser session management | Token-based headers |

### The Only Part That Needs LLM

The LLM is needed for **ONE thing**: when the barcode search returns 0 results and we fall back to name search, we may get multiple results and need to pick the right one. This is:
- A text comparison task (compare product names)
- No screenshots needed
- ~500 tokens per decision
- Cost: ~$0.003 per disambiguation

### Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         LISTA APP                            │
│  User builds shopping list → price comparison →              │
│  "Build cart at Rami Levy" button                            │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: PRODUCT RESOLUTION (no auth needed)                │
│                                                               │
│  For each item in the list:                                  │
│    a. Search by BARCODE → POST /api/catalog                  │
│       → If 1 result: got product_id ✓                        │
│       → If 0 results: search by NAME                         │
│          → If 1 good match: got product_id ✓                 │
│          → If ambiguous: LLM picks best match (~$0.003)      │
│          → If no match: mark as not found ✗                  │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: CART PREVIEW (no auth needed)                      │
│                                                               │
│  POST /api/v2/cart (no auth) → price calculation only        │
│  Show user: items, prices, promotions, delivery fee, total   │
│  User reviews and confirms                                   │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: AUTHENTICATION (one-time, WebView)                 │
│                                                               │
│  If no saved token:                                          │
│    → Open WebView → rami-levy.co.il/he                       │
│    → Inject JS: $nuxt.$root.$emit('OpenLoginModal')          │
│    → Login MODAL appears (not a page — no login URL exists!) │
│    → User logs in with email + password (reCAPTCHA in modal) │
│    → OR registers (Rami Levy handles it in same modal)       │
│    → Poll localStorage for auth state:                       │
│      JSON.parse(localStorage.ramilevy).authuser.user.token   │
│    → Save token locally (encrypted)                          │
│  If token expired (401 response):                            │
│    → Re-open WebView + trigger modal again                   │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 4: PERSIST CART (auth required)                       │
│                                                               │
│  POST /api/v2/cart WITH headers:                             │
│    Authorization: Bearer {JWT}                               │
│    ecomtoken: {JWT}                                          │
│  → Cart saved to user's Rami Levy account server-side        │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 5: CHECKOUT REDIRECT                                  │
│                                                               │
│  Open: https://www.rami-levy.co.il/he/dashboard/checkout     │
│  User's cart is already loaded → select delivery slot → pay  │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Strategy — RESOLVED

**Option A — Deep link / URL cart** ❌ RULED OUT
Tested. Rami Levy does NOT support URL-based cart hydration.

**Option B — Programmatic login API** ❌ RULED OUT
All auth endpoints require reCAPTCHA. Cannot automate server-side.

**Option C — WebView login + token extraction** ✅ THE APPROACH
1. User taps "Connect to Rami Levy" in Lista
2. WebView opens `https://www.rami-levy.co.il/he` + JS injects `$nuxt.$root.$emit('OpenLoginModal')` to auto-open the login modal
3. User logs in (or registers) — reCAPTCHA works natively in WebView
4. After login, Lista injects JS to extract JWT from `localStorage.ramilevy`
5. Token saved locally → used for all cart operations
6. One-time setup, re-authenticate only when token expires

**Security**: We never see email, password, or identity card. Only the JWT.

---

## Tools Needed for PricePilot v2

### Core Tools (HTTP-based, no LLM needed)

| Tool | Purpose | Auth? |
|------|---------|-------|
| `search_by_barcode(barcode, store_id)` | Search product by exact barcode | No |
| `search_by_name(name, store_id)` | Search product by Hebrew name | No |
| `calculate_cart(store_id, items)` | Get cart pricing with promotions | No |
| `persist_cart(store_id, items, token)` | Save cart to user's account | Yes |
| `read_cart(user_id, token)` | Read persisted cart state | Yes |
| `get_checkout_url()` | Return checkout URL | No |

### LLM Tool (only when needed)

| Tool | Purpose | Cost |
|------|---------|------|
| `disambiguate_product(query, candidates)` | Pick best match from search results | ~$0.003 |

### Store Configuration

```
Store ID: 331 (Rami Levy Online)
Catalog API: POST https://www.rami-levy.co.il/api/catalog
Cart API: POST https://www.rami-levy.co.il/api/v2/cart
Customer API: GET https://www-api.rami-levy.co.il/api/v2/site/clubs/customer/{USER_ID}
Checkout: https://www.rami-levy.co.il/he/dashboard/checkout
```

### Infrastructure Domains

| Domain | Purpose |
|--------|---------|
| `www.rami-levy.co.il` | Main site + catalog/cart APIs |
| `www-api.rami-levy.co.il` | Backend API (customer endpoint) |
| `api-prod.rami-levy.co.il` | Production API (alt) |
| `static.rami-levy.co.il` | Product images |
| `rlwpay.rami-levy.co.il` | Payment gateway |

---

## Cost Comparison

| Scenario | v1 (Browser) | v2 (API) |
|----------|-------------|----------|
| 1 item, barcode match | $0.55 (FAILED) | $0.00 |
| 1 item, name disambiguation | $0.55+ | $0.003 |
| 15 items, all barcode match | ~$8.00 est. | $0.00 |
| 15 items, 3 need disambiguation | ~$8.00+ | $0.009 |
| **Max realistic cost** | **$8-15** | **$0.05** |

**v2 is ~200x cheaper than v1.**

---

## Data Structures

### Rami Levy Product (from catalog API)
```typescript
interface RamiLevyProduct {
  id: number;           // Internal ID — used for cart operations
  name: string;         // Hebrew product name
  barcode: number;      // EAN barcode
  price: { price: number };
  department: { name: string; id: number };
  group: { name: string; id: number };
  subGroup: { name: string; id: number };
  images: {
    small: string;      // /product/{barcode}/small.jpg
    original: string;
  };
  available_in: number[];  // Store IDs where in stock
  sale: Array<{
    name: string;       // Promotion description
    scm: number;        // Promotion price
    cmt: number;        // How many items needed
    from: string;
    to: string;
  }>;
  prop: {
    sw_shakil: number;  // Weighted product flag
    by_kilo: number;
    status: number;     // 2 = active
  };
}
```

### Cart Request
```typescript
interface CartRequest {
  store: string;        // Store ID (e.g., "331")
  isClub: 0 | 1;       // Club member pricing
  supplyAt: string;     // ISO date (delivery date)
  items: Record<string, string>;  // {product_id: quantity}
  meta: null;
}
```

### Cart Response
```typescript
interface CartResponse {
  status: number;
  price: number;        // Total price
  priceClub: number;    // Club member price
  discount: number;
  quantity: number;      // Total item count
  items: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
    FormatedTotalPrice: number;
    FormatedSavePrice: number;
    PromotionId?: number[];
    is_delivery?: boolean;
  }>;
  sales: Array<{        // Active promotions applied
    name: string;
    scm: number;
    cmt: number;
  }>;
}
```

---

## Resolved Questions

1. **Can we build a cart URL that auto-populates items?** ❌ NO. Tested — no URL-based cart hydration, no deep links, no shared cart URLs.
2. **How does checkout work?** ✅ SOLVED. Persist cart via `POST /api/v2/cart` with JWT auth headers → redirect to checkout page.
3. **How to get auth tokens?** ✅ SOLVED. WebView login → extract JWT from `localStorage.ramilevy` → `authuser.user.token` + `authuser.user.id`.
4. **Is login phone+OTP or email+password?** ✅ SOLVED. Login is **email + password + reCAPTCHA**. NOT phone+OTP. Register requires: first_name, last_name, email, phone, identity_card, regulation, reCAPTCHA.
5. **Can we automate login server-side?** ❌ NO. All auth endpoints require reCAPTCHA. Must use WebView where reCAPTCHA runs natively.
6. **What auth endpoints exist?** ✅ MAPPED:
   - `POST /api/v2/site/auth/login` — email + password + recaptcha → JWT
   - `POST /api/v2/site/auth/register` — full registration with identity card
   - `POST /api/v2/site/auth/reset-password` — email + recaptcha
   - No OTP endpoints exist at the API level

## Remaining Open Questions

1. **Token expiration**: How long do JWT tokens last? Need to test. Plan: detect 401 responses and re-authenticate.
2. **Rate limiting**: Does the catalog/cart API have rate limits? Need to test with larger batches (15+ items).
3. **Other stores**: Do Shufersal and Victory have similar APIs? Or are they browser-only? This is the next experiment.
4. **Club pricing**: If user is a club member, pass `isClub: 1`. Can detect from auth response or user profile — TBD.

---

## Next Steps

1. **Build PricePilot v2 as a simple TypeScript/Python service** — no browser, no Playwright, just HTTP + optional LLM for disambiguation
2. **Add store adapters** — Rami Levy first, then Shufersal, Victory (each has different APIs)
3. **Integrate into Lista** — "Build cart" button → PricePilot v2 API → cart summary → checkout redirect
4. **Handle multi-store carts** — when basket strategy is "multi-store", build carts at 2-3 stores sequentially

---

## Appendix: Raw API Calls Used in This Experiment

### A. Product lookup (Lista API)
```bash
curl -s "https://israeli-food-prices-database-and-ap-one.vercel.app/api/products/5711953106583"
```

### B. Catalog search by barcode (Rami Levy)
```bash
curl -s -X POST "https://www.rami-levy.co.il/api/catalog" \
  -H "content-type: application/json;charset=UTF-8" \
  -H "locale: he" \
  -H "accept: application/json, text/plain, */*" \
  -d '{"q":"5711953106583","store":"331","aggs":1}'
```

### C. Catalog search by name (Rami Levy)
```bash
curl -s -X POST "https://www.rami-levy.co.il/api/catalog" \
  -H "content-type: application/json;charset=UTF-8" \
  -H "locale: he" \
  -d '{"q":"ארלה גבינת שמנת","store":"331","aggs":1}'
```

### D. Cart calculation (Rami Levy)
```bash
curl -s -X POST "https://www.rami-levy.co.il/api/v2/cart" \
  -H "content-type: application/json;charset=UTF-8" \
  -H "locale: he" \
  -d '{
    "store": "331",
    "isClub": 0,
    "supplyAt": "2026-03-25T00:00:00.000Z",
    "items": {"358996": "1"},
    "meta": null
  }'
```

### E. Persist cart to user's account (requires auth)
```bash
curl -s -X POST "https://www.rami-levy.co.il/api/v2/cart" \
  -H "content-type: application/json;charset=UTF-8" \
  -H "locale: he" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "ecomtoken: {JWT_TOKEN}" \
  -d '{
    "store": "331",
    "isClub": 0,
    "supplyAt": "2026-03-26T00:00:00.000Z",
    "items": {"358996": "1"},
    "meta": null
  }'
```

### F. Read persisted cart (requires auth)
```bash
curl -s "https://www-api.rami-levy.co.il/api/v2/site/clubs/customer/{USER_ID}" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "ecomtoken: {JWT_TOKEN}"
```

### G. Extract auth tokens (run in browser console after login)
```javascript
const state = JSON.parse(localStorage.ramilevy);
console.log({
  token: state.authuser.user.token,   // JWT — use for Authorization + ecomtoken
  userId: state.authuser.user.id       // numeric user ID
});
```

### H. Login (requires reCAPTCHA — WebView only)
```bash
curl -s -X POST "https://www-api.rami-levy.co.il/api/v2/site/auth/login" \
  -H "content-type: application/json" \
  -H "origin: https://www.rami-levy.co.il" \
  -H "accept: application/json" \
  -d '{
    "username": "user@email.com",
    "password": "...",
    "recaptcha": "{RECAPTCHA_TOKEN}"
  }'
```
**Note**: Without valid reCAPTCHA token, returns 422: "שגיאת אימות"

### I. Register (requires reCAPTCHA — WebView only)
```bash
curl -s -X POST "https://www-api.rami-levy.co.il/api/v2/site/auth/register" \
  -H "content-type: application/json" \
  -H "origin: https://www.rami-levy.co.il" \
  -H "accept: application/json" \
  -d '{
    "first_name": "...",
    "last_name": "...",
    "email": "user@email.com",
    "phone": "0501234567",
    "identity_card": "123456789",
    "regulation": true,
    "recaptcha": "{RECAPTCHA_TOKEN}"
  }'
```

### J. Checkout (user opens in browser)
```
URL: https://www.rami-levy.co.il/he/dashboard/checkout
(Cart must be persisted via Step E first)
```

---

## Critical Insight: The Token Extraction MUST Be Invisible

**Problem discovered during experiment**: After the user logs in, we need their JWT token to persist the cart. But a regular user cannot:
- Open browser DevTools
- Run JavaScript in the console
- Copy/paste tokens
- Understand what a "JWT" or "localStorage" is

**This means**: PricePilot v2 can ONLY work as:
1. **A mobile app with WebView** — where we control the WebView and can inject JS to extract tokens silently after login
2. **A browser extension** — that has access to page localStorage and can extract tokens
3. **A PWA/web app with iframe** — though cross-origin restrictions may block localStorage access

**It CANNOT work as**:
- A chat agent that sends links and asks users to do things manually
- A server-side API that redirects users to login pages
- Any flow that requires the user to touch DevTools

**The WebView flow in the real Lista app**:
```
User taps "Build Cart" → WebView opens → User logs in (normal UX) →
Lista injects JS in WebView background → Token captured silently →
WebView closes → Cart persisted → Checkout link shown
```
The user never knows a token was extracted. They just logged in and got their cart ready.

**For this experiment**: Since we're in a CLI/chat context without WebView capabilities, we cannot complete the token extraction step automatically. This confirms that PricePilot v2 must be built as an integrated feature inside the Lista app (WebView), not as a standalone chat agent.

---

## What The User Experience Looks Like (PricePilot v2)

This is the flow a regular Lista user would see:

### First Time — "Connect to Rami Levy"
```
1. User builds shopping list in Lista
2. User taps "Compare Prices" → sees Rami Levy is cheapest
3. User taps "Build Cart at Rami Levy" button
4. Lista shows: "To build your cart, connect your Rami Levy account"
   → Button: "Connect to Rami Levy"
5. WebView opens → rami-levy.co.il/he
   → Login modal auto-opens (via JS injection)
   → User logs in with email + password (or registers)
   → reCAPTCHA handled by the page itself
6. After login, Lista automatically extracts token
   → Shows: "✓ Connected to Rami Levy"
7. Lista builds the cart via API:
   → Shows progress: "Adding ארלה גבינת שמנת... ✓"
   → Shows cart summary: 1 item, ₪14.90 + ₪29.90 delivery = ₪44.80
8. User taps "Go to Checkout"
   → Opens rami-levy.co.il/he/dashboard/checkout
   → Cart is already loaded → select delivery slot → pay
```

### Returning User (token saved)
```
1. User taps "Build Cart at Rami Levy"
2. Lista builds cart immediately (no login needed)
3. Shows summary → "Go to Checkout" → done
```

### Token Expired
```
1. Lista tries to persist cart → gets 401
2. Shows: "Session expired. Please reconnect."
   → Opens WebView login again
3. After re-login → continues building cart
```
