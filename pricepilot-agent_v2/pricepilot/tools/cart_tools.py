"""Cart management tools.

These tools handle cart preview (price calculation), cart persistence
(saving to user's store account), and checkout URL generation.

Design note: The cart preview works without auth. Persistence requires
an auth token obtained via the OTP login flow (see auth_tools.py).

Cart persistence uses the authenticated browser session (Playwright) from
the OTP login flow. After successful OTP verification, the browser session
stays alive with full cookies and localStorage auth. The persist tool
executes a fetch() call *from within* the browser context, which is
indistinguishable from the user adding items on the site. This ensures
the cart is truly persisted — unlike the old httpx-based approach which
only calculated prices.
"""

from __future__ import annotations

import logging
from typing import Any

from google.adk.tools import ToolContext

from pricepilot.stores import get_adapter
from pricepilot.tools.auth_tools import (
    browser_add_to_cart,
    cleanup_browser_session,
    get_authenticated_session,
    _get_session_id,
)

logger = logging.getLogger(__name__)


async def calculate_cart_preview(
    store_name: str,
    store_id: str,
    tool_context: ToolContext,
    is_club: bool = False,
) -> dict[str, Any]:
    """Calculate cart prices for all resolved items.

    Reads resolved_items from session state (set by resolve_products).
    If auth_token is available in state, passes it to get address-based pricing.
    Returns itemized pricing, delivery fee, promotions, and total.

    Args:
        store_name: Chain name.
        store_id: Branch ID.
        tool_context: ADK ToolContext for state access.
        is_club: Whether to use club member pricing.

    Returns:
        Dict with cart preview details or error.
    """
    adapter = get_adapter(store_name)
    if adapter is None:
        return {"status": "error", "error": f"Store '{store_name}' is not supported."}

    resolved = tool_context.state.get("resolved_items", [])
    if not resolved:
        return {
            "status": "error",
            "error": "No resolved items in session. Run resolve_products first.",
        }

    # Build items map: store_product_id -> quantity
    items_map: dict[str, int] = {}
    for item in resolved:
        pid = item["store_product_id"]
        qty = item.get("quantity", 1)
        # Aggregate if same product appears multiple times
        items_map[pid] = items_map.get(pid, 0) + qty

    # Use auth token if available for address-based pricing
    auth_token = tool_context.state.get("auth_token")

    try:
        preview = await adapter.calculate_cart(
            store_id, items_map, is_club=is_club, auth_token=auth_token
        )
    except (RuntimeError, NotImplementedError) as exc:
        return {"status": "error", "error": str(exc)}

    # Save preview to state
    tool_context.state["cart_preview"] = preview.model_dump()
    tool_context.state["cart_items_map"] = items_map

    # Build human-readable summary
    product_lines = []
    for ci in preview.items:
        if ci.is_delivery_fee:
            continue
        line = f"  {ci.name}: {ci.quantity}x = {ci.total_price:.2f} NIS"
        if ci.savings > 0:
            line += f" (saved {ci.savings:.2f})"
        product_lines.append(line)

    promo_text = ""
    if preview.promotions_applied:
        promo_text = "\nPromotions: " + "; ".join(preview.promotions_applied)

    summary = (
        f"Cart at {store_name}:\n"
        + "\n".join(product_lines)
        + f"\n\nSubtotal: {preview.total_price - preview.delivery_fee:.2f} NIS"
        + f"\nDelivery: {preview.delivery_fee:.2f} NIS"
        + f"\nTotal: {preview.total_price:.2f} NIS"
        + (f"\nClub price: {preview.club_price:.2f} NIS" if preview.club_price else "")
        + promo_text
    )

    return {
        "status": "success",
        "total_price": preview.total_price,
        "delivery_fee": preview.delivery_fee,
        "club_price": preview.club_price,
        "item_count": preview.item_count,
        "items": [ci.model_dump() for ci in preview.items if not ci.is_delivery_fee],
        "promotions": preview.promotions_applied,
        "summary": summary,
    }


async def persist_cart_to_store(
    store_name: str,
    store_id: str,
    tool_context: ToolContext,
    is_club: bool = False,
) -> dict[str, Any]:
    """Save the cart to the user's store account using the browser session.

    Uses the authenticated Playwright browser session from the OTP login
    flow to add items to the cart. The browser session carries full auth
    state (cookies + localStorage JWT), making the API call identical to
    a real user interaction on the site.

    Reads cart_items_map from session state (set by calculate_cart_preview).
    Requires a prior successful browser_verify_otp call.

    Args:
        store_name: Chain name.
        store_id: Branch ID.
        tool_context: ADK ToolContext for state access.
        is_club: Whether user is a club member.

    Returns:
        Dict with success status and checkout URL, or error.
    """
    adapter = get_adapter(store_name)
    if adapter is None:
        return {"status": "error", "error": f"Store '{store_name}' is not supported."}

    items_map = tool_context.state.get("cart_items_map")
    if not items_map:
        return {
            "status": "error",
            "error": "No cart to persist. Run calculate_cart_preview first.",
        }

    session_id = _get_session_id(tool_context)

    logger.info(
        "persist_cart_to_store called: store=%s, store_id=%s, items=%s, session=%s",
        store_name, store_id, items_map, session_id,
    )

    # Check for an authenticated browser session
    bs = get_authenticated_session(session_id)
    if bs is None:
        logger.warning(
            "No authenticated browser session for session %s", session_id
        )
        # Fall back: provide checkout URL without persistence
        checkout_url = adapter.get_checkout_url()
        return {
            "status": "error",
            "message": (
                f"ההתחברות ל-{adapter.chain_name_he} פגה. "
                "צריך להתחבר מחדש כדי לשמור את העגלה."
            ),
            "checkout_url": checkout_url,
        }

    # Use the browser session to add items to cart
    result = await browser_add_to_cart(
        session_id=session_id,
        items=items_map,
        store_id=store_id,
    )

    if result.get("status") == "success":
        tool_context.state["cart_persisted"] = True
        checkout_url = adapter.get_checkout_url()
        tool_context.state["checkout_url"] = checkout_url
        logger.info("Cart persisted via browser! checkout_url=%s", checkout_url)

        # Clean up the browser session — cart is saved, no longer needed
        await cleanup_browser_session(session_id)

        return {
            "status": "success",
            "checkout_url": checkout_url,
            "message": (
                f"העגלה נשמרה בחשבון {adapter.chain_name_he} שלך. "
                f"לחץ על הלינק כדי לעבור לקופה ולשלם."
            ),
        }
    else:
        error_type = result.get("error", "")
        user_message = result.get("message", "")
        logger.error(
            "Browser cart persist failed: error=%s, message=%s",
            error_type, user_message,
        )

        # If auth expired, clean up and suggest re-login
        if error_type in ("auth_expired", "session_expired", "page_dead", "no_browser_session"):
            checkout_url = adapter.get_checkout_url()
            return {
                "status": "error",
                "message": (
                    f"ההתחברות ל-{adapter.chain_name_he} פגה. "
                    "צריך להתחבר מחדש כדי לשמור את העגלה."
                ),
                "checkout_url": checkout_url,
            }

        return {
            "status": "error",
            "message": (
                user_message
                or f"לא הצלחתי לשמור את העגלה ב-{adapter.chain_name_he}. "
                "אפשר לנסות שוב."
            ),
        }


async def get_checkout_info(
    store_name: str,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Get checkout URL and login configuration for a store.

    Returns the checkout URL and current auth state. Used as a fallback
    when OTP login is not available or when the user declines to log in.

    Args:
        store_name: Chain name.
        tool_context: ADK ToolContext for state access.

    Returns:
        Dict with checkout_url, login_config, and current auth state.
    """
    adapter = get_adapter(store_name)
    if adapter is None:
        return {"status": "error", "error": f"Store '{store_name}' is not supported."}

    try:
        login_config = adapter.get_login_config()
        checkout_url = adapter.get_checkout_url()
    except NotImplementedError as exc:
        return {"status": "error", "error": str(exc)}

    has_token = bool(tool_context.state.get("auth_token"))
    cart_persisted = tool_context.state.get("cart_persisted", False)

    return {
        "status": "success",
        "checkout_url": checkout_url,
        "cart_persisted": cart_persisted,
        "has_auth_token": has_token,
        "login_config": {
            "base_url": login_config.base_url,
            "js_trigger": login_config.js_trigger,
            "js_fallback": login_config.js_fallback,
            "manual_instruction": login_config.manual_instruction,
            "token_extraction_js": login_config.token_extraction_js,
        },
    }
