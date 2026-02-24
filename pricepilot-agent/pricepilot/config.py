"""Environment configuration and model settings for PricePilot."""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# LLM settings
# ---------------------------------------------------------------------------

# Claude via LiteLLM — "anthropic/" prefix routes through LiteLLM's Anthropic provider
MODEL_ID = "anthropic/claude-sonnet-4-5-20250929"

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

MAX_BROWSER_ACTIONS = int(os.getenv("MAX_BROWSER_ACTIONS", "100"))

# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# ---------------------------------------------------------------------------
# Store URL mapping — Hebrew store name → online shopping URL
# ---------------------------------------------------------------------------

STORE_URLS: dict[str, str] = {
    # Hebrew names (as they come from Lista)
    "שופרסל": "https://www.shufersal.co.il/online",
    "רמי לוי": "https://www.rami-levy.co.il/he",
    "ויקטורי": "https://www.victoryonline.co.il",
    "מחסני השוק": "https://mh-hashuk.co.il",
    "ח. כהן": "https://www.hcohen.co.il",
    "יוחננוף": "https://yochananof.co.il",
    "אושר עד": "https://www.osherad.co.il",
    # English aliases for testing
    "shufersal": "https://www.shufersal.co.il/online",
    "rami levy": "https://www.rami-levy.co.il/he",
    "victory": "https://www.victoryonline.co.il",
}
