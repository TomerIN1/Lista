from __future__ import annotations
"""Cart management tools — browser bridge edition.

All cart operations are executed by the Chrome extension in the user's real
browser session on rami-levy.co.il. The extension has full session access
(including HttpOnly cookies), so add/remove/update/clear all persist.
"""

import json
import logging

from google.adk.tools import ToolContext

from tools.browser_bridge import request_browser_action

logger = logging.getLogger(__name__)


async def read_cart(tool_context: ToolContext) -> dict:
    """Read the current contents of the shopping cart.

    The Chrome extension reads from $nuxt.$store.state.cart.items in the
    user's real Rami Levy browser tab.

    Returns:
        dict with status and list of cart items with names, quantities, and prices.
    """
    session_id = tool_context.state.get("session_id", "default")
    result = await request_browser_action(session_id, "read_cart", {})

    if result.get("status") == "success":
        tool_context.state["current_cart"] = result.get("items", [])
        tool_context.state["cart_item_count"] = result.get("item_count", 0)

    return result


async def add_items_to_cart(items_json: str, tool_context: ToolContext) -> dict:
    """Add items to the shopping cart.

    The Chrome extension uses fetch() on rami-levy.co.il (same-origin),
    which automatically includes all cookies (including HttpOnly cf_clearance).
    This means add operations persist to the user's real account.

    Args:
        items_json: JSON string mapping product IDs to quantities,
                    e.g. '{{"2968": 2, "361918": 1.5}}'

    Returns:
        dict with status and details of items added.
    """
    try:
        items = json.loads(items_json)
    except (json.JSONDecodeError, TypeError):
        return {"status": "error", "message": "Invalid items_json. Must be valid JSON object."}

    if not items or not isinstance(items, dict):
        return {"status": "error", "message": "items_json must be a non-empty JSON object."}

    # Normalize: keep floats for weighted products
    normalized = {str(k): float(v) for k, v in items.items()}

    session_id = tool_context.state.get("session_id", "default")
    result = await request_browser_action(
        session_id, "add_items_to_cart", {"items": normalized},
    )
    return result


async def clear_cart(tool_context: ToolContext) -> dict:
    """Clear all items from the shopping cart.

    The Chrome extension calls $nuxt.$api.cart.deleteCart() in the user's
    real browser session. After clearing, ALWAYS call read_cart to verify.

    Returns:
        dict with status indicating whether cart was cleared.
    """
    session_id = tool_context.state.get("session_id", "default")
    result = await request_browser_action(session_id, "clear_cart", {})
    return result


async def remove_cart_item(product_id: str, tool_context: ToolContext) -> dict:
    """Remove a single item from the cart.

    The Chrome extension uses the "full cart + negative qty" approach via
    same-origin fetch(). Since it runs on rami-levy.co.il with all cookies,
    this persists to the user's real account.

    Args:
        product_id: The internal product ID to remove (from read_cart results).

    Returns:
        dict with status indicating whether the item was removed.
    """
    if not product_id:
        return {"status": "error", "message": "product_id is required."}

    session_id = tool_context.state.get("session_id", "default")
    result = await request_browser_action(
        session_id, "remove_cart_item", {"product_id": str(product_id)},
    )
    return result
