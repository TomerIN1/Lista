"""Environment configuration and model settings for PricePilot."""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# LLM settings
# ---------------------------------------------------------------------------

# LiteLLM model identifier for Anthropic Claude via ADK
MODEL_ID = "litellm/anthropic/claude-sonnet-4-5-20250929"

# ---------------------------------------------------------------------------
# Google Cloud
# ---------------------------------------------------------------------------

GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "")
GCP_REGION = os.getenv("GCP_REGION", "me-west1")

# ---------------------------------------------------------------------------
# Playwright / browser
# ---------------------------------------------------------------------------

BROWSER_HEADLESS = os.getenv("BROWSER_HEADLESS", "true").lower() == "true"
BROWSER_TIMEOUT = int(os.getenv("BROWSER_TIMEOUT", "30000"))
BROWSER_VIEWPORT_WIDTH = 1280
BROWSER_VIEWPORT_HEIGHT = 720

# ---------------------------------------------------------------------------
# Agent limits
# ---------------------------------------------------------------------------

MAX_BROWSER_ACTIONS = int(os.getenv("MAX_BROWSER_ACTIONS", "50"))
SAVINGS_FEE_PERCENT = float(os.getenv("SAVINGS_FEE_PERCENT", "5"))

# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# ---------------------------------------------------------------------------
# Known Israeli supermarkets
# ---------------------------------------------------------------------------

ISRAELI_SUPERMARKETS = [
    {
        "id": "shufersal",
        "name": "Shufersal",
        "name_he": "שופרסל",
        "url": "https://www.shufersal.co.il",
        "delivery_fee": 30,
    },
    {
        "id": "rami-levy",
        "name": "Rami Levy",
        "name_he": "רמי לוי",
        "url": "https://www.rami-levy.co.il",
        "delivery_fee": 25,
    },
    {
        "id": "victory",
        "name": "Victory",
        "name_he": "ויקטורי",
        "url": "https://www.victory.co.il",
        "delivery_fee": 20,
    },
    {
        "id": "market-warehouses",
        "name": "Market Warehouses",
        "name_he": "מחסני השוק",
        "delivery_fee": 25,
    },
    {
        "id": "h-cohen",
        "name": "H. Cohen",
        "name_he": "ח. כהן",
        "delivery_fee": 25,
    },
]
