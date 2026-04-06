# PricePilot Chrome Extension — Development Log

**Created**: April 5, 2026
**Last updated**: April 5, 2026

## Purpose

The PricePilot Chrome extension executes supermarket browser tools in the user's real browser session. The cloud agent (PricePilot v4) handles LLM orchestration, while the extension handles all operations that require same-origin access to supermarket websites.

This solves the cross-device session ownership problem: the extension's `fetch()` calls on rami-levy.co.il include all cookies (including HttpOnly `cf_clearance`), giving full cart control (add, remove, update, clear).

## Development Timeline

### April 5, 2026 — Initial Build

#### Attempt 1: Content Script with Inline Script Injection
- Created `rami_levy_bridge.js` content script with `executeInPageContext()` function
- Used `document.createElement('script')` to inject inline JS into page's main world
- **Failed**: Rami Levy's CSP (`script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules'`) blocked all inline script execution
- Error: `Executing inline script violates the following Content Security Policy directive`

#### Attempt 2: Content Script with `window.__PRICEPILOT_EXTENSION__`
- Tried setting `window.__PRICEPILOT_EXTENSION__ = true` from content script
- **Failed**: Content scripts run in Chrome's isolated world — page JS can't see properties set by content scripts

#### Attempt 3: Script Tag Injection for Detection
- Tried injecting `<script>` tag from content script to set window property in main world
- **Failed**: Same CSP issue as Attempt 1

#### Solution: `chrome.scripting.executeScript` with `world: 'MAIN'`
- Moved ALL tool execution from content script to `background.js`
- Background uses `chrome.scripting.executeScript({target: {tabId}, world: 'MAIN', func, args})` — this bypasses page CSP entirely
- Detection uses postMessage ping/pong between page and isolated-world content script
- Added programmatic injection fallback for tabs opened before extension install

### Connection Issues Debugged

1. **"Receiving end does not exist"**: Content script not loaded on Rami Levy tab. Fixed by adding `scripting` permission and programmatic injection fallback.
2. **"Extension context invalidated"**: After reloading extension, existing tabs have dead `chrome.runtime` references. Fixed by requiring fresh tabs after extension reload (dev-only issue).
3. **3 items instead of 5**: `read_cart` was reading stale Vuex state. Fixed by reloading the market page before reading cart.

## Current Architecture

```
Lista page
  → window.postMessage({type: 'PRICEPILOT_TOOL_REQUEST', ...})
  → lista_bridge.js (isolated world, on Lista domain)
  → chrome.runtime.sendMessage to background.js
  → background.js routes to handleToolRequest()
  → chrome.scripting.executeScript({world: 'MAIN', target: ramiLevyTabId})
  → JS runs in rami-levy.co.il page context ($nuxt, localStorage, fetch)
  → result returns to background.js
  → chrome.tabs.sendMessage to Lista tab
  → lista_bridge.js → window.postMessage({type: 'PRICEPILOT_TOOL_RESPONSE', ...})
  → Lista page receives result
  → POST /api/tool-response/{session_id} to cloud server
  → agent tool function resumes
```

## Current Tools

| Tool | Method | What it does |
|------|--------|-------------|
| `check_auth` | `execInPage` | Reads `localStorage.ramilevy.authuser.user.token` |
| `initialize_session` | `check_auth` + `read_cart` | Bootstraps session state |
| `read_cart` | Reload page + `execInPage` | Reads `$nuxt.$store.state.cart.items` |
| `add_items_to_cart` | `execInPage` with `fetch` | POST `/api/v2/cart` with token (same-origin) |
| `remove_cart_item` | `execInPage` with `fetch` | Full cart + negative qty via POST |
| `clear_cart` | `execInPage` | `$nuxt.$api.cart.deleteCart()` |
| `start_login` | `execInPage` + `chrome.scripting` | Opens modal, fills email, submits |
| `submit_otp` | `chrome.scripting` + polling | Fills OTP, clicks verify, polls for token |
| `verify_session` | `check_auth` + `read_cart` | Verifies auth + cart integrity |
| `go_to_checkout` | `chrome.scripting` | Navigates to checkout page |

## Key Learnings

1. **CSP is strict on Rami Levy**: Cannot inject inline scripts. Must use Chrome's `chrome.scripting` API with `world: 'MAIN'`.
2. **Isolated world**: Content scripts cannot set window properties visible to the page. Use postMessage for cross-world communication.
3. **Extension reload**: After reloading the extension during development, ALL tabs must be closed and reopened (old content scripts have dead `chrome.runtime` references).
4. **Vuex staleness**: Must reload the market page before reading cart to get fresh data.
5. **`host_permissions` required**: MV3 requires explicit `host_permissions` for `chrome.scripting.executeScript` on specific domains.

## File Structure

```
pricepilot_extension/
├── manifest.json                        # MV3 manifest
├── background.js                        # All tool execution + message routing
├── content_scripts/
│   ├── lista_bridge.js                  # Lista ↔ extension bridge (postMessage ↔ chrome.runtime)
│   └── rami_levy_keepalive.js           # Minimal keepalive on Rami Levy tabs
├── pricepilot_extension_log.md          # This file
├── pricepilot_extension.md              # General extension documentation
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## UX Updates (April 5, 2026)

### Welcome Screen
- Shows extension status: green (installed), red with install link (not installed), spinner (checking)
- Start button is **blocked** if extension is not installed — cannot proceed without it
- Rami Levy info shows "agent opens it automatically, no need to leave Lista"

### Cart Display
- Agent uses plain text format (no box-drawing characters — they broke in chat)
- Each item shows: name, quantity, unit price, line total
- Bottom shows: subtotal, delivery fee, grand total

### Search Results
- Each product shows: name, regular price, club/promo price, availability (in stock / out of stock)

### User Flow
- Agent opens Rami Levy tab automatically at session start via extension
- User stays in Lista the entire time
- At checkout, agent provides clickable link to Rami Levy checkout page

### read_cart Enrichment
- Now includes: promo_price, line_total, in_stock per item
- Captures delivery_price from the delivery line item (default ₪29.90)
- Returns subtotal, delivery_price, total_with_delivery totals
- Promo fields: promo_text, original_price, has_promo extracted from Vuex
- Out-of-stock detection: line_total === 0 when amount > 0

## Agent Behavior Improvements (April 5, 2026)

### Autonomous Add (no asking)
- Agent picks the best matching product from search and adds it immediately
- Does NOT show search results list or ask the user to choose
- Only asks if search results are genuinely ambiguous

### Out-of-Stock via Cart (not search API)
- Search API `in_stock` is unreliable — agent ignores it
- Agent adds items first, then reads cart to detect out-of-stock (line_total=0)
- Removes out-of-stock items, calls `find_replacements` (Rami Levy related items API)
- Presents relevant alternatives, waits for user choice

### find_replacements Tool
- New tool: calls `GET /api/items/related?q={name}&ignore={id}&store={store}`
- Returns only in-stock alternatives from Rami Levy's own recommendation engine
- Used when cart items are detected as out-of-stock

### Promo Display
- read_cart extracts promo info from Vuex: promotion text, original price, badge
- Agent shows promo details when displaying cart (e.g. "₪33.60 ← מבצע: 1 ב-29.9₪")
- Agent notifies user of quantity deals (e.g. "2 ב-45 — want to update quantity?")
