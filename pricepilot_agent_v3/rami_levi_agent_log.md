# PricePilot v3 — Rami Levy Agent Development Log

## Architecture

- **Framework**: Google ADK (Agent Development Kit) with `gemini-2.5-flash`
- **Browser automation**: Playwright headless browser for OTP authentication flow
- **Cart operations**: `httpx` for HTTP requests using JWT token + cookies extracted from the headless browser
- **Observability**: Custom Observer module — screenshots, structured logs, session tracking saved to `logs_and_pictures/sessions/{timestamp}/`
- **Local dev**: `adk web --port 8080`

## Tools Built & Status

| # | Tool | Status | Description |
|---|------|--------|-------------|
| 1 | `open_supermarket` | ✅ Done | Opens rami-levy.co.il/he/online/market, dismisses overlays |
| 2 | `start_login` | ✅ Done | Opens login modal via `$nuxt` Vue event, enters email, handles SMS method selection, triggers OTP |
| 3 | `submit_otp` | ✅ Done | Enters 6-digit code, clicks "אמת קוד", extracts JWT from localStorage |
| 4 | `check_auth_status` | ✅ Done | Checks localStorage for ramilevy auth token |
| 5 | `search_products` | ✅ Done | POST /api/catalog, returns product_id, is_weighted, multiplication |
| 6 | `read_cart` | ✅ Done | Reads from `$nuxt.$store.state.cart.items` (Vuex), reloads page first for fresh data. Weighted products: amount field = kg directly |
| 7 | `add_items_to_cart` | ✅ Done | Uses httpx with token+cookies. Quantities as float. Proven to persist to user's real account |
| 8 | `clear_cart` | ✅ Done | Uses `$nuxt.$api.cart.deleteCart()` via page.evaluate. Proven account-level |
| 9 | `remove_cart_item` | ❌ Not working | See "Remove Item — Deep Investigation" section below |
| 10 | `verify_session_continuity` | Untested | |
| 11 | `generate_handoff` | Untested | |

## Key Discoveries

### Rami Levy API: SET vs APPEND Modes
The cart API (`POST /api/v2/cart`) behaves differently based on session ownership:
- **Full session auth** (user's own browser with all cookies) → **SET mode** — can add, remove, replace, modify cart
- **Partial session auth** (headless browser httpx with extracted cookies) → **APPEND mode** — can only add new items, cannot remove or replace

This is the fundamental reason why add works but remove doesn't from the agent.

### Session Isolation
Headless Playwright browser has its own session context. Even after OTP login with the same user account, the headless browser's session is treated as a SEPARATE session by Rami Levy's server.

### httpx Breakthrough (Add Only)
Extract JWT token + ALL cookies from headless browser, make API calls via httpx OUTSIDE the browser. This persists to user's account for ADD operations only (append mode).

### Config Loading Bug
Pydantic Settings crashed silently when loading `.env` from parent directory (Lista's Firebase/OpenAI keys rejected as extra fields). Fixed with `"extra": "ignore"` in model_config. Without this fix, `rami_levy_default_store` was never set properly.

### Store ID
- User's cart is on store 179 (קורצ'ק קריית אונו)
- Rami Levy website sends store "179" in payloads
- Vuex `cart.storeId` is always 0 (not useful for auto-detection)
- Config default used as fallback
- Store ID doesn't affect whether add/remove persists — the session ownership is what matters

### Cart API Details
- **Endpoint**: `POST https://www.rami-levy.co.il/api/v2/cart`
- **No separate delete endpoint** — confirmed via Rami Levy MCP docs and API research
- Website removes items by POSTing the FULL cart state without the removed item (SET operation)
- Quantities sent as strings: "1.00", "2.00", "10.00"
- Items dict: `{product_id: quantity}` where product_id is the internal Rami Levy ID

### deleteCart() Works Account-Level
`$nuxt.$api.cart.deleteCart()` reliably clears the entire cart across sessions from the headless browser. This is the ONLY cart modification (besides add) that persists from the headless browser.

### addLineToCart() Times Out in Headless
Vue API method `$nuxt.$api.cart.addLineToCart()` hangs indefinitely in headless Playwright. Cannot be used.

### Weighted Products
- `sw_shakil=1` or `by_kilo=1` indicates weighted product
- `amount` field = kg directly (not multiplication units)
- `multiplication` = UI step size for +/- buttons (e.g., 0.5)
- Cart API accepts float quantities (0.5, 1.5, 2.5)
- Must use `float(v)` not `int(v)` — int truncates 2.5 to 2

### OTP Details
- Login modal opens via `window.$nuxt.$root.$emit('OpenLoginModal')`
- Verify button text: "אמת קוד" (not "אישור")
- SMS method selection screen appears after multiple attempts — click "הודעת SMS" then "שלח קוד אימות"
- Rate limiting: 3-minute cooldown after too many attempts ("יש לנסות שוב בעוד...")
- Each email submit triggers a NEW OTP, invalidating previous codes

### Cross-Origin Limitations
- Lista (vercel.app) cannot inject JS into a rami-levy popup (cross-origin blocked)
- `window.eval()`, `postMessage` (no listener), script injection — all blocked
- Browser extension is the only way to control a cross-origin page

## Remove Item — Deep Investigation (April 2-3, 2026)

### Approaches Tested (ALL Failed to Persist)

| Approach | API Response | Vuex Shows Removed | Persists on Rami Levy |
|----------|-------------|-------------------|----------------------|
| httpx with `{item: 0}` | 200 | Yes | ❌ No |
| httpx with `{item: -1}` | 200 | Yes | ❌ No |
| httpx with `{item: null}` | 200 | Yes | ❌ No |
| httpx with `{item: ""}` | 200 | Yes | ❌ No |
| httpx SET (all items minus removed) | 200 | Yes | ❌ No |
| httpx SET with store 179 | 200 | Yes | ❌ No |
| httpx SET with store 331 | 200 | Yes | ❌ No |
| `page.evaluate(fetch)` minimal headers | 200 | Yes | ❌ No |
| `page.evaluate(fetch)` with Auth+ecomtoken | 200 | Yes | ❌ No |
| Negative qty duplicate of add code | 200 | Yes | ❌ No |

### What DOES Work for Remove
- **User's browser console**: `fetch('/api/v2/cart', {items: {"id": -1}})` → persists ✅
- **User's browser console**: `fetch('/api/v2/cart', {items: {"id": 0}})` → persists ✅
- **User clicking minus button on website** → persists ✅
- **`$nuxt.$api.cart.deleteCart()`** from headless → clears ALL items ✅

### Root Cause Analysis
The Rami Levy server identifies session ownership through a combination of cookies, tokens, and possibly browser fingerprint. The headless browser's session is valid enough for:
- APPEND operations (adding items) — works via httpx
- DELETE ALL (deleteCart) — works via page.evaluate

But NOT for:
- SET operations (replacing cart state)
- MODIFY operations (changing quantities, removing individual items)

These require the request to come from the session that "owns" the cart — which is the user's real browser.

### False Positive Warning
The headless browser's Vuex store shows items as removed after API calls, but this is the SESSION cache, not the account state. Always verify on the actual Rami Levy website, not in the headless browser's Vuex.

## Options for Fixing Remove

1. **deleteCart() + re-add** — Both proven. Clear all items (account-level), then re-add everything except the removed item via httpx. Downside: temporarily empties the cart.
2. **Browser extension** — Runs on rami-levy.co.il with full session access. Can execute any cart command. Downside: users must install it.
3. **Native app with WebView** — WebView can control the rami-levy page directly. Downside: requires native app.
4. **Bookmarklet** — User drags a bookmarklet to their toolbar, clicks it on rami-levy.co.il. Agent generates the payload, user executes it. Downside: manual step.

## What's Left To Do

1. **Fix remove_cart_item** — Choose and implement one of the options above
2. **Deploy to Cloud Run** — v3 is local only (adk web). Need Dockerfile + server.py for production
3. **Integrate with Lista frontend** — Connect PriceAgentChat to v3 API
4. **Session handoff** — `verify_session_continuity` and `generate_handoff` need testing
5. **Error handling** — Add cooldown detection for OTP rate limiting
6. **Store ID auto-detection** — Vuex cart.storeId is always 0, need alternative source

## Running Locally

```bash
# Create symlink for ADK
ln -s /path/to/pricepilot_agent_v3 /tmp/adk_agents/pricepilot_v3

# Start ADK web UI
cd /tmp/adk_agents && adk web --port 8080

# Open http://localhost:8080, select pricepilot_v3
```

## File Structure

```
pricepilot_agent_v3/
├── agent.py              — ADK agent definition, system instruction
├── config.py             — Settings (store ID=331, model, extra=ignore)
├── server.py             — FastAPI server for production
├── Dockerfile            — Cloud Run deployment
├── .env.example          — Required env vars
├── supermarket_agent_architecture.md — Architecture spec
├── google_adk_builder_prompt.txt — Agent behavior spec
├── rami_levi_agent_log.md — This file
├── test_popup.html        — Cross-origin popup experiment
├── services/
│   ├── browser.py        — Playwright BrowserManager (singleton, multi-session)
│   └── observer.py       — Session logging, screenshots, timestamped folders
├── tools/
│   ├── auth_tools.py     — OTP login flow
│   ├── cart_tools.py     — read/add/remove/clear cart
│   ├── search_tools.py   — Product search (POST /api/catalog)
│   ├── handoff_tools.py  — Session handoff (untested)
│   ├── test_remove.py    — Standalone remove test (store 331)
│   ├── test_remove_v2.py — Multi-approach remove test
│   ├── test_add_negative.py — Negative qty test
│   ├── test_headers_compare.py — Full auth comparison test
│   ├── test_page_eval_remove.py — page.evaluate remove test
│   └── test_page_eval_full_auth.py — page.evaluate with auth headers
└── tests/
    ├── test_agent.py
    ├── test_search_tools.py
    └── test_server.py
```

## Session Handoff Investigation (April 3, 2026)

### The Core Realization
ALL cart tools (add, remove, clear, read) work correctly within the agent's Playwright session. The screenshot confirms `deleteCart()` empties the cart to ₪0.00. The problem is that the user's browser has a DIFFERENT session — they can't see the agent's changes.

### Approaches Researched

#### 1. Browserbase (Remote Browser Service) — BLOCKED
- Tested with free tier account
- Creates a cloud browser that agent and user share via Live View iframe
- Agent connects via `chromium.connect_over_cdp(session.connect_url)`
- User gets a Live View URL to watch/control the same browser
- **Result**: Cloudflare blocked the Browserbase browser IP — "Sorry, you have been blocked"
- Rami Levy uses Cloudflare protection that detects cloud data center IPs
- Could potentially work with Browserbase's residential proxy add-on (extra cost)

#### 2. ChatGPT Operator Model (Inspiration)
- ChatGPT Operator uses a virtual browser that pauses for user authentication
- User takes control → enters password/OTP → returns control to agent
- Session cookies persist after user login
- This is exactly what Browserbase enables, but Cloudflare blocks it for Rami Levy

#### 3. DIY Cookie Export/Import — NOT VIABLE
- Playwright `storageState()` exports cookies + localStorage to JSON
- But cross-origin restrictions prevent injecting cookies for rami-levy.co.il from Lista's domain
- Would need a redirect through rami-levy.co.il which we can't create

#### 4. Cross-Origin Popup — BLOCKED
- Tested with test_popup.html
- `window.eval()`, `postMessage`, script injection — ALL blocked by browser security
- Cannot control a rami-levy.co.il popup from a different origin

### Viable Options for Next Session

1. **deleteCart() + re-add** — Both proven within agent's session. Clear all → re-add everything except removed item via httpx. Pragmatic, works now.
2. **Browserbase with residential proxies** — May bypass Cloudflare. Extra cost ($$$).
3. **Native app with WebView** — Full control over the browser, no cross-origin restrictions. Requires native iOS/Android app.
4. **Browser extension** — Runs on rami-levy.co.il with full session access. Users must install it.

### Priority Recommendation
Ship with **deleteCart() + re-add** for now (both proven). Explore Browserbase residential proxies or native app for a premium experience later.

---

**Created**: April 2, 2026
**Last updated**: April 3, 2026
