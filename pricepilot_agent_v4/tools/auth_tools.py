from __future__ import annotations
"""Authentication tools — browser bridge edition.

All auth operations are executed by the Chrome extension in the user's real
browser on rami-levy.co.il. The extension handles:
- Opening/detecting the Rami Levy tab
- Reading auth state from localStorage
- Opening the login modal, entering email, triggering OTP
- Submitting OTP code and extracting JWT token
"""

import logging

from google.adk.tools import ToolContext

from tools.browser_bridge import request_browser_action

logger = logging.getLogger(__name__)


async def initialize_shopping_session(tool_context: ToolContext) -> dict:
    """Bootstrap the shopping session via the Chrome extension.

    The extension:
    1. Ensures a Rami Levy tab is open (opens one if needed)
    2. Checks if the user is already authenticated
    3. If authenticated, reads the current cart

    This is the preferred first tool for a new session.
    """
    session_id = tool_context.state.get("session_id", "default")
    tool_context.state["startup_bootstrapped"] = True

    result = await request_browser_action(session_id, "initialize_session", {})

    if result.get("status") == "success":
        tool_context.state["startup_ready"] = True
        tool_context.state["authenticated"] = result.get("authenticated", False)
        tool_context.state["awaiting_authentication"] = not result.get("authenticated", False)
        if result.get("email"):
            tool_context.state["user_email"] = result["email"]
        if result.get("cart", {}).get("items"):
            tool_context.state["current_cart"] = result["cart"]["items"]
            tool_context.state["cart_item_count"] = result["cart"].get("item_count", 0)
    elif result.get("status") == "partial":
        tool_context.state["startup_ready"] = False
        tool_context.state["authenticated"] = False
        tool_context.state["awaiting_authentication"] = True

    return result


async def open_rami_levy_browser(tool_context: ToolContext) -> dict:
    """Ensure a Rami Levy tab is open and check auth state.

    The Chrome extension opens rami-levy.co.il/he/online/market if no tab
    exists, then reads auth state from localStorage.
    """
    session_id = tool_context.state.get("session_id", "default")
    result = await request_browser_action(session_id, "check_auth", {})

    if result.get("status") == "success":
        tool_context.state["browser_active"] = True
        tool_context.state["authenticated"] = result.get("authenticated", False)
        if result.get("email"):
            tool_context.state["user_email"] = result["email"]

    return result


async def start_login(email: str, tool_context: ToolContext) -> dict:
    """Start the login process by entering the user's email address.

    The Chrome extension opens the login modal on rami-levy.co.il,
    enters the email, and submits it. An OTP code will be sent via SMS.

    Args:
        email: The user's email address registered with Rami Levy.

    Returns:
        dict with status indicating whether OTP was sent.
    """
    if not email or "@" not in email:
        return {"status": "error", "message": "Invalid email address."}

    session_id = tool_context.state.get("session_id", "default")
    result = await request_browser_action(
        session_id, "start_login", {"email": email},
    )

    if result.get("status") in ("success", "partial"):
        tool_context.state["login_email"] = email
        tool_context.state["otp_sent"] = result.get("otp_sent", True)

    return result


async def submit_otp(otp_code: str, tool_context: ToolContext) -> dict:
    """Submit the OTP code the user received via SMS to complete login.

    The Chrome extension enters the code in the OTP field on rami-levy.co.il,
    clicks verify, and extracts the JWT token from localStorage.

    Args:
        otp_code: The 6-digit code from SMS.

    Returns:
        dict with status indicating whether login succeeded.
    """
    if not otp_code or not otp_code.strip():
        return {"status": "error", "message": "OTP code cannot be empty."}

    session_id = tool_context.state.get("session_id", "default")
    result = await request_browser_action(
        session_id, "submit_otp", {"otp_code": otp_code.strip()},
    )

    if result.get("authenticated"):
        tool_context.state["authenticated"] = True
        if result.get("email"):
            tool_context.state["user_email"] = result["email"]

    return result


async def check_auth_status(tool_context: ToolContext) -> dict:
    """Check whether the user is authenticated on rami-levy.co.il.

    The Chrome extension reads localStorage.ramilevy.authuser.user.token.

    Returns:
        dict with authentication status and details.
    """
    session_id = tool_context.state.get("session_id", "default")
    result = await request_browser_action(session_id, "check_auth", {})

    if result.get("status") == "success":
        tool_context.state["authenticated"] = result.get("authenticated", False)
        if result.get("email"):
            tool_context.state["user_email"] = result["email"]

    return result
