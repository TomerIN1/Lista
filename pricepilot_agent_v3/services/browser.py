from __future__ import annotations

"""Browser session manager using Playwright.

Manages long-lived browser sessions for authentication and cart operations.
Each user session gets its own browser context with isolated cookies/storage.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field

from playwright.async_api import BrowserContext, Page, async_playwright

from config import settings

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
        self._browser = None
        self._sessions: dict[str, BrowserSession] = {}

    @classmethod
    async def get_instance(cls) -> "BrowserManager":
        async with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
                await cls._instance._start()
            return cls._instance

    async def _start(self) -> None:
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=settings.playwright_headless,
        )
        logger.info("Browser manager started (headless=%s)", settings.playwright_headless)

    async def get_or_create_session(self, session_id: str) -> BrowserSession:
        """Get existing browser session or create a new one."""
        self._cleanup_expired()

        if session_id in self._sessions:
            bs = self._sessions[session_id]
            if not bs.is_expired:
                bs.refresh_ttl()
                return bs
            # Expired — close and recreate
            await self._close_session(session_id)

        context = await self._browser.new_context(
            viewport={"width": 1280, "height": 800},
            locale="he-IL",
            timezone_id="Asia/Jerusalem",
        )
        page = await context.new_page()
        page.set_default_timeout(settings.playwright_timeout_ms)

        bs = BrowserSession(session_id=session_id, context=context, page=page)
        self._sessions[session_id] = bs
        logger.info("Created browser session: %s", session_id)
        return bs

    async def get_session(self, session_id: str) -> BrowserSession | None:
        """Get an existing browser session if it exists and is not expired."""
        self._cleanup_expired()
        bs = self._sessions.get(session_id)
        if bs and not bs.is_expired:
            bs.refresh_ttl()
            return bs
        return None

    async def close_session(self, session_id: str) -> None:
        """Close and remove a browser session."""
        await self._close_session(session_id)

    async def _close_session(self, session_id: str) -> None:
        bs = self._sessions.pop(session_id, None)
        if bs:
            try:
                await bs.context.close()
            except Exception:
                logger.warning("Error closing browser context for %s", session_id, exc_info=True)

    def _cleanup_expired(self) -> None:
        expired = [sid for sid, bs in self._sessions.items() if bs.is_expired]
        for sid in expired:
            asyncio.create_task(self._close_session(sid))

    async def shutdown(self) -> None:
        """Shut down all sessions and the browser."""
        for sid in list(self._sessions.keys()):
            await self._close_session(sid)
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        logger.info("Browser manager shut down")
