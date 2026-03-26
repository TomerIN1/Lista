"""Cart management tools.

These tools handle cart preview (price calculation), cart persistence
(saving to user's store account), and checkout URL generation.

Design note: The cart preview works without auth. Persistence requires
an auth token obtained via the OTP login flow (see auth_tools.py).
The agent handles the auth flow conversationally when persistence is needed.
"""

from __future__ import annotations

import logging
from typing import Any

from google.adk.tools import ToolContext

from pricepilot.stores import get_adapter

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
    auth_token: str,
    tool_context: ToolContext,
    is_club: bool = False,
) -> dict[str, Any]:
    """Save the cart to the user's store account. Requires auth token.

    Reads cart_items_map from session state (set by calculate_cart_preview).
    The auth_token comes from WebView login flow (extracted from localStorage).

    Args:
        store_name: Chain name.
        store_id: Branch ID.
        auth_token: JWT from WebView login.
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

    # Verify token is valid
    try:
        token_valid = await adapter.verify_token(auth_token)
    except NotImplementedError:
        token_valid = True  # Stub adapters don't implement verification

    if not token_valid:
        return {
            "status": "error",
            "message": (
                f"ההתחברות ל-{adapter.chain_name_he} פגה. "
                "צריך להתחבר מחדש."
            ),
        }

    try:
        success = await adapter.persist_cart(
            store_id, items_map, auth_token, is_club=is_club
        )
    except NotImplementedError as exc:
        return {"status": "error", "error": str(exc)}

    if success:
        tool_context.state["cart_persisted"] = True
        tool_context.state["auth_token"] = auth_token
        checkout_url = adapter.get_checkout_url()
        tool_context.state["checkout_url"] = checkout_url

        return {
            "status": "success",
            "checkout_url": checkout_url,
            "message": (
                f"The cart has been saved to your {adapter.chain_name_he} account. "
                f"Open the checkout page to review and pay."
            ),
        }
    else:
        return {
            "status": "error",
            "message": (
                f"לא הצלחתי לשמור את העגלה ב-{adapter.chain_name_he}. "
                "ייתכן שההתחברות פגה. אפשר לנסות להתחבר מחדש."
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
