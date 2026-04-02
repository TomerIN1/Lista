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
| 1 | `open_supermarket` | Done | Opens rami-levy.co.il/he/online/market, dismisses overlays |
| 2 | `start_login` | Done | Opens login modal via `$nuxt` Vue event, enters email, handles SMS method selection, triggers OTP |
| 3 | `submit_otp` | Done | Enters 6-digit code, clicks "אמת קוד", extracts JWT from localStorage |
| 4 | `check_auth_status` | Done | Checks localStorage for ramilevy auth token |
| 5 | `search_products` | Done | POST /api/catalog, returns product_id, is_weighted, multiplication |
| 6 | `read_cart` | Done | Reads from `$nuxt.$store.state.cart.items` (Vuex), reloads page first for fresh data. Weighted products: amount field = kg directly |
| 7 | `add_items_to_cart` | Done | Uses httpx with token+cookies extracted from browser. Navigates to market page first for fresh cookies. Quantities as float (supports 0.5 steps). Proven to persist to user's real account |
| 8 | `clear_cart` | Done | Uses `$nuxt.$api.cart.deleteCart()` via page.evaluate. Proven account-level |
| 9 | `remove_cart_item` | Broken | Sends POST /api/v2/cart with all items except removed one (same as website). API returns 200 but doesn't persist — item returns after page reload |
| 10 | `verify_session_continuity` | Untested | Not fully tested |
| 11 | `generate_handoff` | Untested | Not fully tested |

## Key Discoveries

### Session isolation
Headless browser has its own session. Cart operations via `page.evaluate` don't affect user's real cart.

### httpx breakthrough
Extract JWT token + ALL cookies from headless browser, make API calls via httpx OUTSIDE the browser. This persists to user's account for ADD operations.

### Store ID matters
User's cart is on store 179 (קורצ'ק קריית אונו), not default 331. Must read store ID from Vuex dynamically.

### Cart API is a SET operation
POST /api/v2/cart with items dict defines the complete cart state. Website sends ALL items with quantities as strings ("1.00", "2.00").

### deleteCart() works account-level
`$nuxt.$api.cart.deleteCart()` reliably clears the entire cart across sessions.

### addLineToCart() times out in headless
Can't use Vue API methods for adding in headless browser — they hang.

### Weighted products
`sw_shakil=1` or `by_kilo=1`. `amount` field = kg directly. `multiplication` = UI step size. Quantities accept floats (0.5, 1.5, 2.5).

### OTP button text
"אמת קוד" (not "אישור").

### SMS method selection
Appears after multiple login attempts. Need to click "הודעת SMS" then "שלח קוד אימות".

### Rate limiting
After too many OTP attempts, 3-minute cooldown: "יש לנסות שוב בעוד..."

## What's Left To Do

1. **Fix remove_cart_item** — POST /api/v2/cart SET approach returns 200 but doesn't persist. Need to find why add persists but remove doesn't. Possible causes: stale cookies, wrong session context, or the endpoint only adds/never removes.
2. **Deploy to Cloud Run** — v3 is local only (adk web). Need Dockerfile + server.py for production.
3. **Integrate with Lista frontend** — Connect PriceAgentChat to v3 API.
4. **Session handoff** — `verify_session_continuity` and `generate_handoff` need testing.
5. **Error handling** — Add cooldown detection for OTP rate limiting.
6. **Store ID auto-detection** — Currently reads from Vuex, needs testing across users.

## Running Locally

```bash
cd /tmp/adk_agents  # symlink parent
# or: create symlink: ln -s /path/to/pricepilot_agent_v3 /tmp/adk_agents/pricepilot_v3
adk web --port 8080
# Open http://localhost:8080, select pricepilot_v3
```

## File Structure

```
pricepilot_agent_v3/
├── agent.py              — ADK agent definition, system instruction
├── config.py             — Settings (store ID, model, etc.)
├── server.py             — FastAPI server for production
├── Dockerfile            — Cloud Run deployment
├── services/
│   ├── browser.py        — Playwright BrowserManager
│   └── observer.py       — Session logging, screenshots
├── tools/
│   ├── auth_tools.py     — OTP login flow (open_supermarket, start_login, submit_otp, check_auth_status)
│   ├── cart_tools.py     — read/add/remove/clear cart
│   ├── search_tools.py   — Product search (POST /api/catalog)
│   └── handoff_tools.py  — Session handoff
└── tests/
```

---

**Created**: March 31, 2026
