"""PricePilot v2 configuration.

Loads settings from environment variables with sensible defaults.
All env vars are prefixed or namespaced to avoid collisions.
"""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings loaded from environment variables.

    Not using pydantic-settings to keep dependencies minimal.
    All values are read-only after construction.
    """

    def __init__(self) -> None:
        # -- LLM --
        self.llm_model: str = os.getenv("LLM_MODEL", "gemini-2.5-flash")
        self.google_api_key: str = os.getenv("GOOGLE_API_KEY", "")
        self.google_genai_use_vertexai: bool = (
            os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "FALSE").upper() == "TRUE"
        )

        # -- Server --
        self.host: str = os.getenv("PRICEPILOT_HOST", "0.0.0.0")
        self.port: int = int(
            os.getenv("PORT", os.getenv("PRICEPILOT_PORT", "8000"))
        )

        # -- Rami Levy --
        self.rami_levy_store_id: str = os.getenv("RAMI_LEVY_STORE_ID", "331")
        self.rami_levy_base_url: str = os.getenv(
            "RAMI_LEVY_BASE_URL", "https://www.rami-levy.co.il"
        )
        self.rami_levy_api_url: str = os.getenv(
            "RAMI_LEVY_API_URL", "https://www-api.rami-levy.co.il"
        )
        # Anonymous bearer token from RL JS bundle (used for login endpoint).
        # Set via RAMI_LEVY_API_CLIENT_TOKEN env var.
        self.rami_levy_api_client_token: str = os.getenv(
            "RAMI_LEVY_API_CLIENT_TOKEN", ""
        )

        # -- HTTP --
        self.http_timeout: float = float(os.getenv("HTTP_TIMEOUT", "15.0"))
        self.http_max_retries: int = int(os.getenv("HTTP_MAX_RETRIES", "2"))

    def __repr__(self) -> str:
        return (
            f"Settings(llm_model={self.llm_model!r}, "
            f"host={self.host!r}, port={self.port})"
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached singleton settings instance."""
    return Settings()
