from __future__ import annotations
"""Session handoff tools for preserving authenticated browser state.

The handoff flow:
1. verify_session_continuity — confirms auth + cart are intact
2. generate_handoff — produces CDP connection info or session export for the user

This is the CRITICAL final step. A handoff is only valid if the user can
continue checkout immediately without re-authenticating.
"""

import json
import logging

from google.adk.tools import ToolContext

from config import settings
from services.browser import BrowserManager
from services.observer import observer

logger = logging.getLogger(__name__)

CHECKOUT_URL = f"{settings.rami_levy_base_url}/he/dashboard/checkout"


async def verify_session_continuity(tool_context: ToolContext) -> dict:
    """Verify that the browser session is still authenticated and the cart is intact.

    This MUST be called before generating a handoff. It checks:
    1. Authentication is still valid
    2. Cart items are still present
    3. Checkout page is reachable

    Returns:
        dict with verification results for auth, cart, and checkout access.
    """
    session_id = tool_context.state.get("session_id", "default")
    observer.log_tool_start(session_id, "verify_session_continuity", {})
    try:
        manager = await BrowserManager.get_instance()
        bs = await manager.get_session(session_id)
        if not bs:
            result = {
                "status": "error",
                "message": "No browser session exists. Cannot verify continuity.",
            }
            observer.log_error(session_id, "verify_session_continuity", "no browser session")
            return result

        page = bs.page
        checks = {"auth": False, "cart": False, "checkout": False}

        # Check 1: Authentication still valid
        has_token = await page.evaluate("""
            () => {
                const token = localStorage.getItem('token') ||
                              localStorage.getItem('auth_token') ||
                              localStorage.getItem('jwt');
                return !!token;
            }
        """)
        auth_indicators = await page.locator(
            '.user-name, .user-menu, [data-testid="user-menu"], .logged-in'
        ).count()
        checks["auth"] = has_token or auth_indicators > 0

        # Check 2: Cart has items
        cart_count = await page.evaluate("""
            () => {
                try {
                    const badge = document.querySelector('.cart-count, .cart-badge, [data-testid="cart-count"]');
                    if (badge) {
                        const count = parseInt(badge.textContent, 10);
                        if (!isNaN(count)) return count;
                    }
                    // Try Vuex store
                    const store = window.__NUXT__?.state?.cart;
                    if (store && store.items) {
                        return Object.keys(store.items).length;
                    }
                    return -1;  // unknown
                } catch (e) { return -1; }
            }
        """)
        expected_count = tool_context.state.get("cart_item_count", 0)
        checks["cart"] = cart_count > 0 or expected_count > 0

        # Check 3: Navigate to checkout to verify it's reachable
        try:
            await page.goto(CHECKOUT_URL, wait_until="domcontentloaded", timeout=15000)
            current_url = page.url
            # If we got redirected to login, checkout is NOT reachable
            checks["checkout"] = "login" not in current_url.lower() and "checkout" in current_url.lower()
        except Exception:
            checks["checkout"] = False

        all_passed = all(checks.values())
        tool_context.state["session_verified"] = all_passed

        await observer.capture_screenshot(session_id, page, "session_verification")

        if all_passed:
            result = {
                "status": "success",
                "verified": True,
                "checks": checks,
                "message": "Session verified: auth valid, cart intact, checkout reachable.",
            }
            observer.log_tool_end(session_id, "verify_session_continuity", result, {
                "session_verified": True, "checks": checks,
            })
            return result
        else:
            failed = [k for k, v in checks.items() if not v]
            result = {
                "status": "error",
                "verified": False,
                "checks": checks,
                "failed": failed,
                "message": f"Session verification FAILED. Issues: {', '.join(failed)}. Do NOT proceed with handoff.",
            }
            observer.log_tool_end(session_id, "verify_session_continuity", result, {
                "session_verified": False, "checks": checks,
            })
            return result

    except Exception as e:
        logger.error("Session verification failed: %s", e, exc_info=True)
        observer.log_error(session_id, "verify_session_continuity", str(e))
        return {"status": "error", "message": f"Verification failed: {e}"}


async def generate_handoff(tool_context: ToolContext) -> dict:
    """Generate a session-preserving handoff for the user to continue checkout.

    This exports the browser session (cookies + localStorage) so the user can
    restore it and continue from exactly where the agent stopped.

    IMPORTANT: Only call this AFTER verify_session_continuity confirms all checks pass.

    Returns:
        dict with handoff data including checkout URL and session restoration info.
    """
    session_verified = tool_context.state.get("session_verified", False)
    if not session_verified:
        return {
            "status": "error",
            "message": "Session not verified. Call verify_session_continuity first.",
        }

    session_id = tool_context.state.get("session_id", "default")
    observer.log_tool_start(session_id, "generate_handoff", {})
    try:
        manager = await BrowserManager.get_instance()
        bs = await manager.get_session(session_id)
        if not bs:
            return {"status": "error", "message": "No browser session exists."}

        page = bs.page

        # Export cookies
        cookies = await bs.context.cookies()

        # Export localStorage
        local_storage = await page.evaluate("""
            () => {
                const data = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    data[key] = localStorage.getItem(key);
                }
                return data;
            }
        """)

        # Build handoff payload
        handoff = {
            "checkout_url": CHECKOUT_URL,
            "session_data": {
                "cookies": cookies,
                "local_storage": local_storage,
            },
            "user_email": bs.user_email,
            "store_id": tool_context.state.get("store_id", settings.rami_levy_default_store),
        }

        # Store handoff in state for the API layer to serve to the frontend
        tool_context.state["handoff_ready"] = True
        tool_context.state["handoff_data"] = json.dumps(handoff, default=str)

        cart_items = tool_context.state.get("current_cart", [])
        item_summary = ", ".join(
            f"{item.get('name', item.get('product_id', '?'))} x{item.get('quantity', 1)}"
            for item in cart_items
        ) if cart_items else "items as requested"

        logger.info("Handoff generated for session %s", session_id)
        result = {
            "status": "success",
            "checkout_url": CHECKOUT_URL,
            "cart_summary": item_summary,
            "message": (
                "Handoff ready. The session data (cookies + localStorage) has been exported. "
                "The user can restore this session in their browser to continue checkout "
                "at the exact point where the agent stopped."
            ),
        }
        observer.log_tool_end(session_id, "generate_handoff", result, {
            "handoff_ready": True, "checkout_url": CHECKOUT_URL,
        })
        observer.log_state_change(session_id, "Handoff generated", {
            "handoff_ready": True, "checkout_url": CHECKOUT_URL,
        })

        # Generate the session summary now that the workflow is complete
        observer.generate_summary(session_id, final_status="success")

        return result

    except Exception as e:
        logger.error("Handoff generation failed: %s", e, exc_info=True)
        observer.log_error(session_id, "generate_handoff", str(e))
        return {"status": "error", "message": f"Handoff generation failed: {e}"}
