# PricePilot v4 — Rami Levi Agent Development Log

**Created**: April 2, 2026  
**Last updated**: April 5, 2026

## Current Purpose

`pricepilot_agent_v4` is the active Rami Levy shopping agent.

Its current job is to:

1. open or reuse a live Rami Levy browser session
2. authenticate the user with OTP when needed
3. read the current cart before shopping
4. apply cart actions requested by the user
5. send the user back to the same already-open browser window for checkout

This file should be treated as the current source of truth for the v4 agent.

## Current Architecture

- **Framework**: Google ADK with `gemini-2.5-flash`
- **Browser runtime**: Playwright persistent Chromium context
- **Persistent profile**: `.rami_levy_profile_v4`
- **Session model**: one shared live browser session reused across ADK session ids
- **Auth source of truth**: `localStorage.ramilevy.authuser.user.token`
- **Cart read source of truth**: `$nuxt.$store.state.cart.items`
- **Checkout model**: live-browser handoff, not external-link handoff

## Current Exposed Agent Tools

| Tool | Status | Purpose |
|---|---|---|
| `initialize_shopping_session` | ✅ Current | Preferred startup tool for frontend or first actionable user turn |
| `open_rami_levy_browser` | ✅ Current | Opens or reuses the live market browser session |
| `start_login` | ✅ Current | Opens login modal, enters email, triggers OTP |
| `submit_otp` | ✅ Current | Submits the SMS OTP code and persists auth state |
| `search_products` | ✅ Current | Searches catalog and returns internal `product_id` values |
| `read_cart` | ✅ Current | Reads current cart items from Vuex |
| `add_items_to_cart` | ✅ Current | Adds items using auth token + cookies from live browser |
| `clear_cart` | ✅ Current | Clears the cart from the live session |
| `remove_cart_item` | ✅ Current | Removes a specific item from the live session |
| `verify_session_continuity` | ✅ Current | Verifies auth, cart presence, and checkout reachability |
| `generate_handoff` | ✅ Current | Moves the live browser to checkout and tells the user to continue there |

## Canonical User Flow

### Frontend flow

The frontend should render the welcome text itself.

ADK web does not automatically run the agent on bare session creation without a user turn, so the recommended frontend behavior is:

1. render welcome text and usage instructions
2. wait for the user's first real action
3. let the agent use `initialize_shopping_session`
4. continue with regular shopping actions

### Agent flow

1. `initialize_shopping_session`
2. tell the user whether they are already connected
3. if authenticated, tell the user what is currently in the cart
4. if not authenticated:
   - ask for email
   - call `start_login`
   - ask for OTP
   - call `submit_otp`
   - call `read_cart`
5. execute add / update / remove / clear actions
6. after each cart mutation, call `read_cart` again
7. when the user wants checkout:
   - call `verify_session_continuity`
   - call `generate_handoff`
   - tell the user to continue in the already-open Rami Levy browser window

## Current Key Behaviors

### 1. Browser startup is market-first

`open_rami_levy_browser` now targets:

`https://www.rami-levy.co.il/he/online/market`

It no longer starts from `https://www.rami-levy.co.il/he/online-shopping`.

### 2. Browser reuse is resilient

The browser manager now repairs stale or closed Playwright pages.

This fixed the reuse failure mode where `open_rami_levy_browser` could crash with `TargetClosedError` after refresh or page reuse.

### 3. OTP flow is the official authentication path

The current auth path is:

1. `open_rami_levy_browser`
2. `start_login`
3. `submit_otp`
4. optional manual delivery area / address selection in the opened browser

### 4. Startup bootstrap is centralized

`initialize_shopping_session` is the preferred first tool.

It does three things:

1. opens or reuses the live browser
2. checks whether the user is authenticated
3. reads the current cart immediately when auth already exists

This is the startup tool the frontend should rely on after the welcome message.

### 5. Checkout handoff is live-browser only

The agent no longer treats a normal external checkout URL as the main handoff.

Current rule:

- `generate_handoff` navigates the already-open Playwright browser to checkout
- the user must continue payment in that same browser window
- a normal external link is not a valid primary handoff because it will not share the live authenticated session

## Current Implementation Notes

### Browser/session layer

- `BrowserManager` uses `launch_persistent_context(...)`
- all ADK sessions are mapped onto the same live browser session
- browser state survives across tool calls and across refreshed ADK sessions

### Auth detection

Auth is read from:

```js
localStorage.ramilevy.authuser.user.token
```

### Cart reading

Cart reading is based on:

```js
window.$nuxt.$store.state.cart.items
```

`read_cart` reloads the market page first so Vuex state reflects the latest cart.

### Product IDs

The only valid mutation ids are the internal Rami Levy product ids returned by `search_products`.

Do not use:

- barcode
- product name
- requested quantity

### Weighted products

Weighted items still use kg directly as quantity.

Examples:

- cucumber 1 kg -> quantity `1`
- onion 2.5 kg -> quantity `2.5`

Do not truncate weighted quantities to integers.

## Current Frontend Guidance

The frontend should own the welcome copy.

Recommended welcome content:

- brief explanation of what the agent can do
- tell the user the agent works with a live Rami Levy browser session
- tell the user the agent may ask for email + OTP if login is required
- tell the user checkout continues in the opened browser window

Recommended first action:

- let the agent run and use `initialize_shopping_session`
- or directly invoke `initialize_shopping_session` if the frontend orchestrates tools itself

Recommended startup UX:

- show whether the user is connected
- show current cart items
- then allow requests like:
  - add items
  - remove item
  - clear cart
  - checkout

## Current Known Constraints

### ADK session-start limitation

With the current ADK web flow, the agent does not spontaneously emit a welcome message and tool run on bare session creation by itself.

Practical resolution:

- frontend renders welcome copy
- first real user action triggers the startup bootstrap

### Manual steps may still be needed

Even after OTP success, the site may still require manual completion of:

- delivery area
- address selection
- modal confirmations

The user must do those in the opened Rami Levy browser window.

### Checkout must stay in the live browser

The user should not expect checkout to continue correctly in a separate regular browser tab opened from a plain URL.

The correct flow is:

- agent prepares checkout
- user continues in the already-open browser window

## Repository Cleanup Performed

On April 5, 2026, the legacy test files and test artifacts under `pricepilot_agent_v4` were removed so the folder reflects the actual agent implementation instead of old experiments.

Removed categories:

- root-level browser test scripts
- `tests/` unit and integration test files
- tool-level experimental `test_*` scripts
- test HTML and screenshot artifacts

## Browser-Bridge Migration (April 5, 2026)

Replaced all Playwright-based tool execution with a Chrome extension bridge architecture.

### What changed

- **tools/browser_bridge.py** — new server-side coordination module (request/resolve with asyncio.Event)
- **tools/cart_tools.py** — rewritten: calls `request_browser_action()` instead of Playwright
- **tools/auth_tools.py** — rewritten: calls `request_browser_action()` instead of Playwright
- **tools/handoff_tools.py** — rewritten: calls `request_browser_action()` instead of Playwright
- **server.py** — merged SSE generator (ADK + bridge queues), new `/api/tool-response` endpoint
- **config.py** — removed Playwright settings, added `browser_bridge_timeout`
- **Dockerfile** — removed Playwright system deps
- **pyproject.toml** — removed `playwright` dependency
- **services/browser.py** — no longer used (kept for reference)

### Why

The headless Playwright browser was a separate device — Rami Levy's server rejected remove/update/clear because the HttpOnly `cf_clearance` cookie was tied to the originating device. The Chrome extension runs in the user's real browser, where `fetch()` includes all cookies automatically.

### Agent instruction updates (April 5, 2026)

- Cart display uses plain text format (no box-drawing characters)
- Search results show price, club/promo price, and availability
- Agent opens Rami Levy tab automatically at startup, tells user to stay in Lista
- Checkout provides a clickable link — user clicks from Lista, no need to leave

## Current File-Level Map

```text
pricepilot_agent_v4/
├── agent.py
├── config.py
├── server.py
├── services/
│   ├── browser.py              (legacy, unused — kept for reference)
│   ├── observer.py             (legacy, unused — kept for reference)
│   └── __init__.py
├── tools/
│   ├── __init__.py
│   ├── auth_tools.py           (browser-bridge)
│   ├── browser_bridge.py       (request/resolve coordination)
│   ├── cart_tools.py            (browser-bridge)
│   ├── handoff_tools.py         (browser-bridge)
│   └── search_tools.py          (cloud httpx, unchanged)
├── supermarket_agent_architecture.md
├── google_adk_builder_prompt.txt
├── rami_levi_agent_log.md
├── session_info.json
├── Dockerfile
├── pyproject.toml
└── __init__.py
```

## Most Important Current Rules

1. Use `initialize_shopping_session` as the preferred first tool.
2. Agent opens Rami Levy tab automatically — user stays in Lista.
3. OTP flow is `start_login` -> `submit_otp`.
4. Always call `read_cart` after cart mutations.
5. Show cart with plain text format: name, quantity, unit price, line total, subtotal, delivery, grand total.
6. Search results must show price, club price, availability.
7. Checkout provides clickable link — user clicks from Lista chat.
8. Frontend owns the welcome text; the agent owns the startup/bootstrap logic after the first real action.
