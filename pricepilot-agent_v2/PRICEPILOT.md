# PricePilot v2 — AI Cart Builder for Israeli Supermarkets

## Overview

PricePilot is a Google ADK agent that automates online grocery cart building for Israeli supermarkets. It takes a shopping list from Lista (items with barcodes, names, quantities), resolves them to store products via the store's API, calculates a cart preview with pricing and promotions, and persists the cart to the user's store account — all without browser automation.

**Key insight**: Israeli supermarkets like Rami Levy expose REST APIs for catalog search and cart management. No Playwright, no screenshots, no browser automation needed. Just HTTP requests — 200x cheaper than browser-based approaches.

---

## Architecture

```
Single LlmAgent + 6 Tools + Store Adapter Pattern
```

```
User (Lista app or ADK web UI)
  |
  v
PricePilot Agent (gemini-2.5-flash, configurable)
  |
  v
6 Tools (deterministic HTTP, no LLM inside tools)
  |
  v
Store Adapters (one per supermarket chain)
  |
  v
Supermarket REST APIs
```

### Why Single Agent?

- One coherent flow: resolve → preview → auth → persist → checkout
- The LLM does minimal work (disambiguation + conversational UX)
- Multi-agent would add latency for no gain
- Store abstraction lives in code (adapters), not in separate agents

### Model

- Default: `gemini-2.5-flash` (fast, cheap — most work is HTTP, not LLM)
- Configurable via `LLM_MODEL` env var
- Claude supported via LiteLLM: `LLM_MODEL=anthropic/claude-sonnet-4-20250514`

---

## The 5-Phase Flow

```
Phase 1: RESOLVE    — Match items to store product IDs (barcode → name → LLM)
Phase 2: PREVIEW    — Calculate cart with prices, promotions, delivery fee
Phase 3: AUTH       — Guide user through login (WebView in app, manual in test)
Phase 4: PERSIST    — Save cart to user's store account via API
Phase 5: CHECKOUT   — Provide checkout URL → user pays
```

### Runtime Example (tested & working)

```
1. User: "Build cart at Rami Levy with ארלה גבינת שמנת (barcode: 5711953106583)"
2. Agent calls resolve_products → barcode search → found product ID 358996
3. Agent calls calculate_cart_preview → 14.90 NIS + 29.90 delivery = 54.80 NIS
   → Promotion detected: "גבינת שמנת ארלה 2 יח' ב-24.90 ש"ח"
4. User confirms → Agent asks for auth token
5. JWT provided → Agent calls persist_cart_to_store → cart saved
6. Agent: "פתח את הקופה: https://www.rami-levy.co.il/he/dashboard/checkout"
```

---

## Tools

| Tool | Phase | Auth? | LLM? | Purpose |
|------|-------|-------|------|---------|
| `resolve_products` | Resolve | No | No | Batch search items by barcode, fallback to name |
| `search_product_by_barcode` | Resolve | No | No | Single barcode lookup |
| `search_product_by_name` | Resolve | No | No | Name-based search for disambiguation |
| `calculate_cart_preview` | Preview | No | No | Get pricing, promotions, delivery fee |
| `persist_cart_to_store` | Persist | Yes | No | Save cart to user's store account |
| `get_checkout_info` | Auth/Checkout | No | No | Return login config + checkout URL |

All tools return `{"status": "success/error"}` dicts. The LLM agent only does disambiguation and conversational UX.

---

## Supported Stores

| Chain | Hebrew | Status | Notes |
|-------|--------|--------|-------|
| Rami Levy | רמי לוי | **Fully implemented** | REST API, tested end-to-end |
| Shufersal | שופרסל | Stub | Adapter needed — API research required |
| Victory | ויקטורי | Stub | Adapter needed — API research required |
| Market Warehouses | מחסני השוק | Stub | Adapter needed — API research required |
| H. Cohen | ח. כהן | Stub | Adapter needed — API research required |

### Store Adapter Pattern

Each store implements `StoreAdapter` (abstract base class):
- `search_by_barcode(barcode, store_id)` → `list[StoreProduct]`
- `search_by_name(name, store_id, limit)` → `list[StoreProduct]`
- `calculate_cart(store_id, items, is_club)` → `CartPreview`
- `persist_cart(store_id, items, auth_token, is_club)` → `bool`
- `get_login_config()` → `LoginConfig`
- `get_checkout_url()` → `str`

To add a new store: implement the adapter, register in `stores/registry.py`.

---

## Rami Levy API Reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/catalog` | POST | No | Product search (barcode or name) |
| `/api/v2/cart` | POST | No | Cart price calculation |
| `/api/v2/cart` | POST | Yes | Cart persist (same endpoint, add JWT headers) |
| `/api/v2/site/clubs/customer/{id}` | GET | Yes | Read user's persisted cart |

**Base URLs**:
- Main: `https://www.rami-levy.co.il`
- API: `https://www-api.rami-levy.co.il`
- Images: `https://static.rami-levy.co.il`

**Auth headers** (same JWT for both):
```
Authorization: Bearer {JWT}
ecomtoken: {JWT}
```

**Login**: Modal-based (no login page URL). Trigger via `window.$nuxt.$root.$emit('OpenLoginModal')`. Token in `localStorage.ramilevy → authuser.user.token`.

---

## Project Structure

```
pricepilot-agent_v2/
  PRICEPILOT.md               ← This file (main documentation)
  EXPERIMENT_LOG.md            ← Original API research & discovery log
  pyproject.toml               ← Dependencies and project config
  .env.example                 ← Environment variables template
  pricepilot/
    __init__.py
    agent.py                   ← ADK agent definition (root_agent)
    config.py                  ← Settings from env vars
    types.py                   ← All Pydantic models
    stores/
      __init__.py
      base.py                  ← StoreAdapter abstract base class
      rami_levy.py             ← Full Rami Levy implementation
      shufersal.py             ← Stub
      victory.py               ← Stub
      market_warehouses.py     ← Stub
      h_cohen.py               ← Stub
      registry.py              ← Store name → adapter lookup
    tools/
      __init__.py
      product_tools.py         ← resolve_products, search_by_barcode, search_by_name
      cart_tools.py            ← calculate_cart_preview, persist_cart_to_store, get_checkout_info
    api/
      __init__.py
      server.py                ← FastAPI server for Lista integration
  tests/
    __init__.py
    test_rami_levy_adapter.py
    test_store_registry.py
    test_tools.py
    test_eval.py
```

---

## Local Development

### Prerequisites
- Python 3.11+
- Google API key (Gemini)

### Setup
```bash
cd pricepilot-agent_v2
uv venv --python 3.11 .venv
source .venv/bin/activate
uv pip install -e .

# Create .env
cp .env.example .env
# Add your GOOGLE_API_KEY
```

### Run (ADK Web UI — best for testing)
```bash
adk web --port 8000
# Open http://localhost:8000 → select "pricepilot" agent
```

### Run (FastAPI Server — for Lista integration)
```bash
python -m pricepilot.api.server
# API at http://localhost:8000/api/
```

### Run (ADK CLI)
```bash
adk run pricepilot
```

### Test Prompt
```
תבנה לי עגלה ברמי לוי סניף 331 עם: ארלה גבינת שמנת (ברקוד: 5711953106583, כמות: 1)
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_API_KEY` | (required) | Gemini API key |
| `GOOGLE_GENAI_USE_VERTEXAI` | `FALSE` | Use Vertex AI instead of Google AI Studio |
| `LLM_MODEL` | `gemini-2.5-flash` | LLM model (supports LiteLLM format) |
| `PRICEPILOT_HOST` | `0.0.0.0` | FastAPI server host |
| `PRICEPILOT_PORT` | `8000` | FastAPI server port |
| `HTTP_TIMEOUT` | `15.0` | HTTP request timeout (seconds) |
| `HTTP_MAX_RETRIES` | `2` | Max HTTP retries |
| `RAMI_LEVY_STORE_ID` | `331` | Default Rami Levy online store ID |

---

## API Endpoints (FastAPI Server)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/build-cart` | POST | Start new cart-building session |
| `/api/message` | POST | Send follow-up message (disambiguation, auth token) |
| `/api/session/{id}` | GET | Get current session state |
| `/api/stores` | GET | List supported stores |
| `/api/health` | GET | Health check |

---

## Cost

| Scenario | Cost |
|----------|------|
| 1 item, barcode match | ~$0.00 (HTTP only) |
| 1 item, name disambiguation | ~$0.003 (one LLM call) |
| 15 items, all barcode match | ~$0.00 |
| 15 items, 3 need disambiguation | ~$0.009 |
| Max realistic cart | ~$0.05 |

---

## Session Log

### Session 1 — March 26, 2026: Initial Build & First Successful Test

**What was done**:
1. Created the google-adk-builder custom Claude Code agent with 5 preloaded skills (architecture, tool development, state/memory/artifacts, debugging, deployment)
2. Designed PricePilot v2 architecture: single agent + 6 tools + store adapter pattern
3. Generated complete production code (21 files) using the ADK builder agent
4. Set up local development environment (Python 3.11 via uv, ADK 1.27.4)
5. Ran first test via `adk web` UI

**Issues encountered & fixed**:
- **Agent skipped to auth**: Initial system instruction made the agent redirect to Lista instead of using tools. Fixed by adding explicit "IMMEDIATELY start Phase 1" instruction.
- **Agent sent user text as JWT**: When user said "אני מחובר" the agent passed the Hebrew text as auth_token to `persist_cart_to_store`, causing 401. Fixed by adding clear instruction that auth_token must be a JWT string starting with "ey".
- **Token extraction JS**: `json.parse` (lowercase) failed in browser console — must be `JSON.parse` (uppercase).

**Test results**:
- Phase 1 (resolve): Product found via barcode search on Rami Levy API
- Phase 2 (preview): Cart calculated — 14.90 NIS + 29.90 delivery, promotion detected (2 for 24.90)
- Phase 3 (auth): JWT manually extracted from `localStorage.ramilevy` after browser login
- Phase 4 (persist): Cart successfully saved to real Rami Levy account
- Phase 5 (checkout): Checkout URL provided → cart visible at rami-levy.co.il/he/dashboard/checkout

**Status**: End-to-end flow working for Rami Levy with single item.

---

### Session 1b — March 26, 2026: Multi-Item Test & Price Accuracy Fix

**What was done**:
1. Tested with 12 items (11 by barcode + 1 by name only)
2. All 11 barcode items resolved successfully, agent handled "בננות" (name-only) gracefully
3. Cart preview showed correct itemized pricing with promotions
4. Cart persisted and visible at checkout

**Issue discovered: Price mismatch (21.70 NIS)**:
- Agent (anonymous API): 219.81 + 29.90 = 249.71 NIS
- Website (logged-in user): 241.51 + 29.90 = 271.41 NIS
- Root cause: Rami Levy API returns **different prices** when called with auth headers (address-based pricing based on delivery zone) vs without auth (generic online prices)

**Fix applied**:
- `StoreAdapter.calculate_cart()` now accepts optional `auth_token` parameter
- `RamiLevyAdapter.calculate_cart()` passes Authorization + ecomtoken headers when token provided
- `calculate_cart_preview` tool reads `auth_token` from session state if available
- Agent instruction updated: when auth token is available early, do auth before cart preview for accurate pricing
- All stub adapters updated with new signature

**Status**: Multi-item flow working. Price accuracy improved when auth token is available.

**Next steps**:
- Integrate with Lista frontend (WebView auth flow)
- Research Shufersal, Victory, Market Warehouses APIs
- Add multi-store cart support (when basket strategy is "multi-store")
