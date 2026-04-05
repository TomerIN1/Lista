from __future__ import annotations

"""Browser session manager using a persistent Playwright browser profile.

The v4 tools still pass ADK session ids around, but the underlying browser is a
single persistent Rami Levi session so OTP-authenticated state and cart contents
survive across tool calls and agent sessions.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path

from playwright.async_api import BrowserContext, Page, async_playwright

from config import settings

STORAGE_STATE_PATH = Path(__file__).parent.parent / "storage_state.json"
USER_DATA_DIR = Path(__file__).resolve().parents[2] / ".rami_levy_profile_v4"

logger = logging.getLogger(__name__)

SESSION_TTL_SECONDS = 900  # 15 minutes


@dataclass
class BrowserSession:
    """A managed browser session with Playwright context."""

    session_id: str
    context: BrowserContext
    page: Page
    created_at: float = field(default_factory=time.time)
    authenticated: bool = False
    user_email: str = ""
    auth_token: str = ""

    @property
    def is_expired(self) -> bool:
        return (time.time() - self.created_at) > SESSION_TTL_SECONDS

    def refresh_ttl(self) -> None:
        self.created_at = time.time()


class BrowserManager:
    """Manages Playwright browser instances and sessions.

    Singleton — one browser process, multiple isolated contexts.
    """

    _instance: "BrowserManager | None" = None
    _lock = asyncio.Lock()

    def __init__(self) -> None:
        self._playwright = None
        self._context: BrowserContext | None = None
        self._sessions: dict[str, BrowserSession] = {}
        self._headless: bool | None = None

    @classmethod
    async def get_instance(cls, headless: bool | None = None) -> "BrowserManager":
        async with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
                await cls._instance._start(headless=headless)
            elif headless is not None and cls._instance._headless != headless:
                await cls._instance.shutdown()
                cls._instance = cls()
                await cls._instance._start(headless=headless)
            return cls._instance

    async def _start(self, headless: bool | None = None) -> None:
        self._playwright = await async_playwright().start()
        self._headless = settings.playwright_headless if headless is None else headless
        await self._launch_context()
        logger.info("Browser manager started (headless=%s)", self._headless)

    async def _launch_context(self) -> None:
        """Launch or relaunch the shared persistent browser context."""
        if self._playwright is None:
            raise RuntimeError("Playwright is not started")
        USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._context = await self._playwright.chromium.launch_persistent_context(
            user_data_dir=str(USER_DATA_DIR),
            headless=self._headless,
            viewport={"width": 1280, "height": 800},
            locale="he-IL",
            timezone_id="Asia/Jerusalem",
            ignore_https_errors=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--lang=he-IL",
            ],
        )

    async def _ensure_context(self) -> None:
        """Ensure the persistent context is still usable."""
        if self._playwright is None:
            await self._start(headless=self._headless)
            return
        if self._context is None:
            await self._launch_context()
            return
        try:
            _ = self._context.pages
        except Exception:
            try:
                await self._context.close()
            except Exception:
                pass
            self._context = None
            await self._launch_context()

    async def _get_live_page(self) -> Page:
        """Return an open page, creating one when needed."""
        await self._ensure_context()
        assert self._context is not None
        for page in reversed(self._context.pages):
            try:
                if not page.is_closed():
                    page.set_default_timeout(settings.playwright_timeout_ms)
                    return page
            except Exception:
                continue
        page = await self._context.new_page()
        page.set_default_timeout(settings.playwright_timeout_ms)
        return page

    async def _ensure_session_page(self, session: BrowserSession) -> bool:
        """Repair a session whose page reference went stale or closed."""
        try:
            await self._ensure_context()
            assert self._context is not None
            session.context = self._context
            if session.page and not session.page.is_closed():
                session.page.set_default_timeout(settings.playwright_timeout_ms)
                return True
        except Exception:
            pass
        try:
            session.page = await self._get_live_page()
            return True
        except Exception:
            return False

    async def get_or_create_session(self, session_id: str) -> BrowserSession:
        """Return the shared persistent browser session for this agent session id."""
        self._cleanup_expired()
        existing = await self.get_session(session_id)
        if existing:
            return existing

        page = await self._get_live_page()

        shared = next(iter(self._sessions.values()), None)
        if shared is None:
            assert self._context is not None
            shared = BrowserSession(session_id=session_id, context=self._context, page=page)
        else:
            await self._ensure_session_page(shared)

        shared.session_id = session_id
        shared.page = page
        shared.refresh_ttl()
        self._sessions[session_id] = shared
        logger.info("Bound browser session alias: %s", session_id)
        return shared

    async def get_session(self, session_id: str) -> BrowserSession | None:
        """Get an existing browser session or fall back to the shared persistent one."""
        self._cleanup_expired()
        bs = self._sessions.get(session_id)
        if bs and await self._ensure_session_page(bs):
            bs.refresh_ttl()
            return bs
        for fallback in self._sessions.values():
            if await self._ensure_session_page(fallback):
                fallback.refresh_ttl()
                self._sessions[session_id] = fallback
                return fallback
        return None

    async def save_storage_state(self, session_id: str) -> None:
        """Persist cookies + localStorage so the next session reuses the same device identity."""
        bs = self._sessions.get(session_id)
        if bs:
            await bs.context.storage_state(path=str(STORAGE_STATE_PATH))
            logger.info("Saved storage state to %s", STORAGE_STATE_PATH)

    async def close_session(self, session_id: str) -> None:
        """Close and remove a browser session."""
        await self._close_session(session_id)

    async def _close_session(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    def _cleanup_expired(self) -> None:
        if len(self._sessions) <= 1:
            return
        expired = [sid for sid, bs in self._sessions.items() if bs.is_expired]
        for sid in expired:
            self._sessions.pop(sid, None)

    async def shutdown(self) -> None:
        """Shut down all sessions and the browser."""
        self._sessions.clear()
        if self._context:
            await self._context.close()
            self._context = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
        logger.info("Browser manager shut down")
