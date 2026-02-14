# PricePilot Agent

An autonomous online grocery shopping agent built with **Google ADK** (Agent Development Kit), **Anthropic Claude**, and **Playwright**. PricePilot navigates Israeli supermarket websites, finds the best prices for a user's shopping list, builds carts, and returns checkout links — all through the Lista app's chat UI.

## Architecture

PricePilot uses a multi-agent orchestrator pattern powered by Google ADK's native agent transfer:

```
                    ┌─────────────────────┐
                    │   OrchestratorAgent  │  Routes workflow phases
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                     │
    ┌─────▼─────┐      ┌──────▼──────┐      ┌──────▼──────┐
    │   List     │      │   Store     │      │  Checkout   │
    │ Interpreter│      │  Navigator  │      │  Builder    │
    └───────────┘      └──────┬──────┘      └─────────────┘
                               │
                        ┌──────▼──────┐
                        │   Browser   │
                        │   Agent     │
                        │ + Playwright│
                        └─────────────┘
```

### Agents

| Agent | File | Purpose | Tools |
|-------|------|---------|-------|
| **Orchestrator** | `agents/orchestrator.py` | Routes workflow between sub-agents based on `session.state["workflow_phase"]` | Agent transfer (ADK built-in) |
| **List Interpreter** | `agents/list_interpreter.py` | Parses natural language shopping lists (Hebrew/English) into structured `ShoppingItem` objects | `parse_shopping_list` |
| **Store Navigator** | `agents/store_navigator.py` | Helps user select stores, discovers store URLs | `get_available_stores`, `search_store_url`, `confirm_store` |
| **Browser Agent** | `agents/browser_agent.py` | Autonomously navigates supermarket websites using Playwright + Claude vision | `navigate`, `screenshot`, `click`, `type_text`, `press_key`, `scroll`, `get_page_info`, `extract_products`, `wait_for`, `close_browser` |
| **Checkout Builder** | `agents/checkout_builder.py` | Calculates savings, builds pricing plans, generates checkout links | `calculate_savings`, `build_pricing_plan`, `format_savings_report`, `generate_checkout_links`, `get_checkout_summary` |

### Workflow Phases

Tracked in ADK `session.state["workflow_phase"]`:

1. `list_received` → List Interpreter parses the shopping list
2. `list_parsed` → Store Navigator helps user pick stores
3. `stores_confirmed` → Browser Agent navigates each store's website
4. `products_found` → Orchestrator handles product disambiguation
5. `products_selected` → Checkout Builder calculates savings
6. `checkout_ready` → Checkout links presented to user

## Project Structure

```
pricepilot-agent/
├── pyproject.toml              # Dependencies and build config
├── .env.example                # Required environment variables
├── PRICEPILOT.md               # This file
│
├── pricepilot/
│   ├── __init__.py
│   ├── agent.py                # Root agent (ADK entry point)
│   ├── config.py               # Environment config, model settings
│   ├── types.py                # Pydantic models
│   │
│   ├── agents/
│   │   ├── orchestrator.py     # Main workflow orchestrator
│   │   ├── list_interpreter.py # Shopping list parser
│   │   ├── store_navigator.py  # Store discovery & selection
│   │   ├── browser_agent.py    # Autonomous browser with Playwright
│   │   └── checkout_builder.py # Savings & checkout links
│   │
│   ├── tools/
│   │   ├── browser_tools.py    # Playwright automation (10 tools)
│   │   ├── search_tools.py     # Store discovery (3 tools)
│   │   ├── cart_tools.py       # Cart & savings calculation
│   │   └── checkout_tools.py   # Checkout URL generation
│   │
│   └── api/
│       └── server.py           # FastAPI REST API
│
├── tests/
│   ├── test_list_interpreter.py
│   ├── test_browser_tools.py
│   └── test_checkout.py
│
└── deploy/
    ├── Dockerfile              # Python 3.11 + Playwright + Chromium
    ├── cloudbuild.yaml         # Cloud Build CI/CD → Cloud Run
    └── vertex_config.yaml      # Vertex AI Agent Engine config
```

## Data Models

Defined in `pricepilot/types.py` as Pydantic models:

| Model | Purpose |
|-------|---------|
| `ShoppingItem` | Parsed shopping list item (name, quantity, unit, brand, category) |
| `Product` | Product from a store catalog (sku, price, sale_price, image_url, etc.) |
| `Store` | Supermarket info (name, delivery_fee, url) |
| `CartItem` | Product + quantity in cart |
| `StoreBreakdown` | Price breakdown for one store |
| `PricingPlan` | Complete pricing plan across stores |
| `SavingsReport` | Baseline vs best plan comparison with 5% fee |
| `DisambiguationItem` | Item needing user choice between product options |
| `ChatMessage` | Message in the PricePilot chat UI |

## API Endpoints

FastAPI server at `pricepilot/api/server.py`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sessions` | Create new agent session with grocery list |
| `POST` | `/sessions/{id}/message` | Send user message, get agent response |
| `GET` | `/sessions/{id}?user_id=` | Get session state and messages |
| `DELETE` | `/sessions/{id}?user_id=` | End session and clean up |
| `GET` | `/health` | Health check |

## Setup

### Prerequisites

- Python 3.11+
- Anthropic API key
- Google Cloud project (for Vertex AI deployment)

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

# Run with ADK dev UI
adk web

# Or run the FastAPI server directly
python -m pricepilot.api.server
```

### Run Tests

```bash
cd pricepilot-agent
pytest tests/ -v
```

### Deploy to Vertex AI

```bash
# Build and deploy via Cloud Build
gcloud builds submit --config deploy/cloudbuild.yaml

# Or deploy directly to Vertex AI Agent Engine
python -c "
from pricepilot.agent import root_agent
from vertexai import agent_engines

remote = agent_engines.create(
    agent=root_agent,
    requirements=['google-adk', 'litellm', 'playwright', 'pydantic', 'fastapi'],
    display_name='PricePilot Agent',
)
print(remote.resource_name)
"
```

## Configuration

Environment variables (see `.env.example`):

| Variable | Purpose | Default |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Claude LLM access | (required) |
| `GCP_PROJECT_ID` | Google Cloud project | (required for deploy) |
| `GCP_REGION` | Deployment region | `me-west1` |
| `BROWSER_HEADLESS` | Run browser headless | `true` |
| `BROWSER_TIMEOUT` | Page load timeout (ms) | `30000` |
| `MAX_BROWSER_ACTIONS` | Max tool calls per store | `50` |
| `SAVINGS_FEE_PERCENT` | PricePilot fee on savings | `5` |
| `HOST` | Server bind address | `0.0.0.0` |
| `PORT` | Server port | `8000` |

## LLM Configuration

Uses Claude via LiteLLM wrapper for ADK compatibility:
- Model ID: `litellm/anthropic/claude-sonnet-4-5-20250929`
- Configured in `pricepilot/config.py`

## Known Israeli Supermarkets

Pre-configured stores in `config.py`:

| Store | Hebrew | Delivery Fee |
|-------|--------|-------------|
| Shufersal | שופרסל | ₪30 |
| Rami Levy | רמי לוי | ₪25 |
| Victory | ויקטורי | ₪20 |
| Market Warehouses | מחסני השוק | ₪25 |
| H. Cohen | ח. כהן | ₪25 |

## Lista App Integration

The Lista app (`services/agentService.ts`) calls the PricePilot API with automatic fallback to local mock logic when the API is unavailable. Set the API URL via `NEXT_PUBLIC_AGENT_API_URL` environment variable.

- **Local dev**: `http://localhost:8000`
- **Production**: Vertex AI endpoint URL
