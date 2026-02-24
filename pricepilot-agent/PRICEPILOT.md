# PricePilot Agent

A single-agent browser automation system built with **Google ADK**, **Anthropic Claude**, and **Playwright**. PricePilot receives a store + shopping list from the Lista app, navigates the supermarket website, adds items to cart, and returns the checkout URL.

## Architecture

PricePilot uses a **single LlmAgent** with 10 Playwright browser tools. No sub-agents, no orchestration overhead.

```
Lista App
    │
    ▼
┌─────────────────────────────────────┐
│  FastAPI Server  (api/server.py)    │
│  - POST /sessions (BuildCartRequest)│
│  - POST /sessions/{id}/message      │
│  - GET  /sessions/{id}              │
│  - DELETE /sessions/{id}            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  cart_builder  (agent.py)           │
│  Single LlmAgent — Claude Sonnet   │
│  10 Playwright tools                │
│                                     │
│  Phase 1: Navigate to store         │
│  Phase 2: Search & add each item    │
│  Phase 3: Go to cart → checkout     │
└─────────────────────────────────────┘
```

### How it works

1. Lista app sends a `BuildCartRequest` with `store_name`, `city`, and `items[]`
2. Server resolves the store URL from `STORE_URLS` config
3. Agent receives the JSON payload and begins browsing:
   - Navigates to store, dismisses popups, sets delivery address
   - For each item: searches, evaluates results, adds to cart
   - If ambiguous: asks user and waits for reply
   - Goes to cart, proceeds to checkout
4. Returns the checkout URL to the user

### Browser Tools

| Tool | Purpose |
|------|---------|
| `navigate` | Go to a URL |
| `screenshot` | Capture current page as compressed JPEG (~10K tokens) |
| `click` | Click an element by CSS selector |
| `type_text` | Type into an input field |
| `press_key` | Press keyboard key (Enter, Escape, etc.) |
| `scroll` | Scroll page up/down |
| `get_page_info` | Get URL, title, and interactive elements |
| `extract_products` | Extract product cards from page |
| `wait_for` | Wait N milliseconds |
| `close_browser` | Clean shutdown |

## Project Structure

```
pricepilot-agent/
├── pyproject.toml              # Dependencies and build config
├── .env.example                # Required environment variables
├── PRICEPILOT.md               # This file
│
├── pricepilot/
│   ├── __init__.py
│   ├── agent.py                # Single LlmAgent (root_agent)
│   ├── config.py               # Env config + STORE_URLS mapping
│   ├── types.py                # Pydantic models (BuildCartRequest, etc.)
│   │
│   ├── tools/
│   │   ├── __init__.py
│   │   └── browser_tools.py    # 10 Playwright automation tools
│   │
│   └── api/
│       ├── __init__.py
│       └── server.py           # FastAPI REST API
│
├── tests/
│   ├── __init__.py
│   ├── test_browser_tools.py   # Browser tool unit tests
│   ├── test_agent.py           # Agent definition tests
│   └── test_api.py             # API endpoint tests
│
└── test_agent.py               # Interactive integration test script
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sessions` | Start cart-building session (BuildCartRequest) |
| `POST` | `/sessions/{id}/message` | Send user reply (disambiguation, OTP) |
| `GET` | `/sessions/{id}?user_id=` | Get session status and messages |
| `DELETE` | `/sessions/{id}?user_id=` | End session, close browser |
| `GET` | `/health` | Health check |

### POST /sessions

```json
{
  "user_id": "user-123",
  "store_name": "שופרסל",
  "city": "תל אביב",
  "items": [
    {"name": "חלב תנובה 3% 1 ליטר", "quantity": 2, "barcode": "7290000066318"},
    {"name": "ביצים L 12 יחידות", "quantity": 1}
  ]
}
```

Returns `{session_id, messages[]}`. Returns 400 if `store_name` is unknown and no `store_url` override provided.

### POST /sessions/{id}/message

```json
{"user_id": "user-123", "text": "1"}
```

Returns `{messages[], status}` where status is `in_progress`, `checkout_ready`, or `error`.

## Supported Stores

Configured in `config.py` as `STORE_URLS`:

| Store | Hebrew | URL |
|-------|--------|-----|
| Shufersal | שופרסל | shufersal.co.il/online |
| Rami Levy | רמי לוי | rami-levy.co.il/he |
| Victory | ויקטורי | victoryonline.co.il |
| Machsanei HaShuk | מחסני השוק | mh-hashuk.co.il |
| H. Cohen | ח. כהן | hcohen.co.il |
| Yochananof | יוחננוף | yochananof.co.il |
| Osher Ad | אושר עד | osherad.co.il |

## Setup

### Prerequisites

- Python 3.11+
- Anthropic API key

### Local Development

```bash
cd pricepilot-agent

# Install dependencies
pip install -e ".[dev]"

# Install Playwright browsers
playwright install chromium

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run the FastAPI server
python -m pricepilot.api.server

# Or run with ADK dev UI
adk web
```

### Run Tests

```bash
cd pricepilot-agent
pytest tests/ -v
```

### Integration Test

```bash
# Terminal 1: start server
python -m pricepilot.api.server

# Terminal 2: run test
python test_agent.py
```

## Configuration

Environment variables (see `.env.example`):

| Variable | Purpose | Default |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Claude LLM access | (required) |
| `GCP_PROJECT_ID` | Google Cloud project | (optional) |
| `GCP_REGION` | Deployment region | `me-west1` |
| `BROWSER_HEADLESS` | Run browser headless | `true` |
| `BROWSER_TIMEOUT` | Page load timeout (ms) | `30000` |
| `MAX_BROWSER_ACTIONS` | Max tool calls per session | `100` |
| `HOST` | Server bind address | `0.0.0.0` |
| `PORT` | Server port | `8000` |

## Browser Tools: Error Handling & Token Optimization

All 10 browser tools wrap Playwright calls in try/except and return `{"error": "..."}` JSON on failure instead of raising exceptions. This lets the agent recover from timeouts, missing elements, and navigation errors without crashing the session.

**Screenshot optimization**: Screenshots use JPEG at quality 40 (~44K base64 chars, ~10K tokens) instead of PNG (~588K chars, ~150K tokens). This prevents the context window from blowing up — the old PNG approach caused 210K token sessions on a single screenshot.

## Lista App Integration

The Lista app calls the PricePilot API after the user picks a store from the price comparison results. Set the API URL via `NEXT_PUBLIC_AGENT_API_URL` environment variable.

- **Local dev**: `http://localhost:8000`
- **Production**: Cloud Run / Vertex AI endpoint URL
