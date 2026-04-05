from __future__ import annotations
"""Session handoff tools — browser bridge edition.

Since the Chrome extension runs in the user's real browser, the handoff is
simply navigating to the checkout page. The user is already authenticated
in their own browser — no session transfer needed.
"""

import logging

from google.adk.tools import ToolContext

from config import settings
from tools.browser_bridge import request_browser_action

logger = logging.getLogger(__name__)


async def verify_session_continuity(tool_context: ToolContext) -> dict:
    """Verify that the user's browser session is still authenticated and cart is intact.

    The Chrome extension checks:
    1. Authentication via localStorage token
    2. Cart items are present
    3. Checkout page is reachable without login redirect

    This MUST be called before generating a handoff.

    Returns:
        dict with verification results for auth, cart, and checkout access.
    """
    session_id = tool_context.state.get("session_id", "default")
    result = await request_browser_action(session_id, "verify_session", {})

    if result.get("verified"):
        tool_context.state["session_verified"] = True
    else:
        tool_context.state["session_verified"] = False

    return result


async def generate_handoff(tool_context: ToolContext) -> dict:
    """Navigate the user's browser to the checkout page.

    Since the extension runs in the user's real browser, there's no session
    transfer — the user is already authenticated. This simply navigates
    their Rami Levy tab to the checkout page.

    IMPORTANT: Only call this AFTER verify_session_continuity confirms all checks pass.

    Returns:
        dict describing the checkout state.
    """
    session_verified = tool_context.state.get("session_verified", False)
    if not session_verified:
        return {
            "status": "error",
            "message": "Session not verified. Call verify_session_continuity first.",
        }

    session_id = tool_context.state.get("session_id", "default")
    result = await request_browser_action(session_id, "go_to_checkout", {})

    if result.get("status") == "success":
        tool_context.state["handoff_ready"] = True
        tool_context.state["handoff_mode"] = "user_browser"
        tool_context.state["current_url"] = result.get("url", "")

    return result
