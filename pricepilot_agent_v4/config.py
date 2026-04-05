from __future__ import annotations
"""Centralized configuration for PricePilot Agent v4 (browser-bridge mode)."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Google AI
    google_api_key: str = ""
    google_genai_use_vertexai: bool = False
    google_cloud_project: str = ""
    google_cloud_location: str = "us-central1"

    # Agent
    agent_model: str = "gemini-2.5-flash"
    agent_log_level: str = "INFO"

    # Rami Levy
    rami_levy_default_store: int = 331
    rami_levy_is_club: bool = True
    rami_levy_base_url: str = "https://www.rami-levy.co.il"

    # Browser bridge
    browser_bridge_timeout: int = 60  # seconds to wait for extension response

    # Session DB
    session_db_url: str = "sqlite+aiosqlite:///./sessions.db"

    # Server
    host: str = "0.0.0.0"
    port: int = 8080

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
