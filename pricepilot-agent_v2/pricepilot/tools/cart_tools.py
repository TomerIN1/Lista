"""Cart management tools.

These tools handle cart preview (price calculation), cart persistence
(saving to user's store account), checkout URL generation, and cart
read/clear operations for handling existing carts from previous sessions.

Design note: The cart preview works without auth. Persistence requires
an auth token obtained via the OTP login flow (see auth_tools.py).

Cart persistence uses the authenticated browser session (Playwright) from
the OTP login flow. After successful OTP verification, the browser session
stays alive with full cookies and localStorage auth. The persist tool
executes a fetch() call *from within* the browser context, which is
indistinguishable from the user adding items on the site. This ensures
the cart is truly persisted — unlike the old httpx-based approach which
only calculated prices.

Cart read/clear: After OTP login, the browser session can also read the
user's existing cart (from a previous shopping session) and clear it
before adding new items. This prevents unexpected old items from appearing
at checkout.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
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


async def read_existing_cart(
    store_name: str,
    store_id: str,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Read the user's current cart from the store after login.

    Uses the authenticated browser session to fetch the user's existing
    cart contents. Call this right after OTP verification succeeds to
    check if the user has leftover items from a previous shopping session.

    Args:
        store_name: Chain name (e.g. "Rami Levy").
        store_id: Branch ID (e.g. "331").
        tool_context: ADK ToolContext for state access.

    Returns:
        Dict with status, item count, and item details from the existing
        cart, or error if no authenticated session is available.
    """
    adapter = get_adapter(store_name)
    if adapter is None:
        return {"status": "error", "error": f"Store '{store_name}' is not supported."}

    session_id = _get_session_id(tool_context)
    bs = get_authenticated_session(session_id)

    if bs is None:
        return {
            "status": "error",
            "message": "אין חיבור פעיל. צריך להתחבר קודם.",
        }

    page = bs.page

    try:
        # Verify the page is still alive
        try:
            _ = page.url
        except Exception:
            logger.error("Browser page is dead for session %s", session_id)
            return {
                "status": "error",
                "message": "פג תוקף ההתחברות. צריך להתחבר מחדש.",
            }

        # Build a cart request with empty items to read the current cart
        # state. The Rami Levy /api/v2/cart endpoint returns the persisted
        # cart contents even when we send an empty items dict — the existing
        # items are preserved and returned in the response.
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime(
            "%Y-%m-%dT00:00:00.000Z"
        )

        read_payload = {
            "store": store_id,
            "isClub": 0,
            "supplyAt": tomorrow,
            "items": {},
            "meta": None,
        }

        logger.info(
            "read_existing_cart: session=%s, store=%s",
            session_id, store_id,
        )

        result = await page.evaluate(
            """async (payload) => {
                try {
                    let token = null;
                    try {
                        const rlData = JSON.parse(localStorage.getItem('ramilevy'));
                        if (rlData && rlData.authuser && rlData.authuser.user) {
                            token = rlData.authuser.user.token;
                        }
                    } catch(e) {}

                    const headers = {
                        'Content-Type': 'application/json;charset=UTF-8',
                        'locale': 'he',
                        'Accept': 'application/json, text/plain, */*',
                    };
                    if (token) {
                        headers['Authorization'] = 'Bearer ' + token;
                        headers['ecomtoken'] = token;
                    }

                    const resp = await fetch('/api/v2/cart', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(payload),
                        credentials: 'include',
                    });

                    const data = await resp.json();
                    return {
                        ok: resp.ok,
                        status: resp.status,
                        data: data,
                    };
                } catch(e) {
                    return {
                        ok: false,
                        status: 0,
                        error: e.message || String(e),
                    };
                }
            }""",
            read_payload,
        )

        logger.info(
            "read_existing_cart response: ok=%s, status=%s, session=%s",
            result.get("ok"), result.get("status"), session_id,
        )

        if not result.get("ok"):
            error_msg = result.get("error", "")
            status_code = result.get("status", 0)
            logger.error(
                "read_existing_cart failed: status=%s, error=%s",
                status_code, error_msg,
            )
            if status_code == 401:
                return {
                    "status": "error",
                    "message": "פג תוקף ההתחברות. צריך להתחבר מחדש.",
                }
            return {
                "status": "error",
                "message": "לא הצלחתי לקרוא את העגלה הקיימת.",
            }

        data = result.get("data", {})
        raw_items = data.get("items", [])

        # Filter out delivery fee items and build a clean item list
        existing_items = []
        for item in raw_items:
            is_delivery = item.get("is_delivery", False)
            if is_delivery or "משלוח" in item.get("name", ""):
                continue
            existing_items.append({
                "store_product_id": str(item.get("id", "")),
                "name": item.get("name", ""),
                "quantity": item.get("quantity", 1),
                "price": item.get("price", 0),
                "total_price": item.get("FormatedTotalPrice", 0),
            })

        item_count = len(existing_items)

        # Save existing cart info to state for merge logic
        tool_context.state["existing_cart_items"] = existing_items
        tool_context.state["existing_cart_count"] = item_count

        logger.info(
            "read_existing_cart: found %d existing items, session=%s",
            item_count, session_id,
        )

        return {
            "status": "success",
            "item_count": item_count,
            "items": existing_items,
        }

    except Exception as exc:
        logger.exception(
            "read_existing_cart failed for session %s: %s", session_id, exc
        )
        return {
            "status": "error",
            "message": "שגיאה בקריאת העגלה הקיימת.",
        }


async def clear_existing_cart(
    store_name: str,
    store_id: str,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Clear/empty the user's existing cart at the store.

    Uses the authenticated browser session to send an empty cart to the
    store API, effectively removing all items from a previous shopping
    session. Call this before persist_cart_to_store when the user wants
    to start fresh instead of merging with old items.

    Args:
        store_name: Chain name (e.g. "Rami Levy").
        store_id: Branch ID (e.g. "331").
        tool_context: ADK ToolContext for state access.

    Returns:
        Dict with status indicating whether the cart was cleared.
    """
    adapter = get_adapter(store_name)
    if adapter is None:
        return {"status": "error", "error": f"Store '{store_name}' is not supported."}

    session_id = _get_session_id(tool_context)
    bs = get_authenticated_session(session_id)

    if bs is None:
        return {
            "status": "error",
            "message": "אין חיבור פעיל. צריך להתחבר קודם.",
        }

    page = bs.page

    try:
        # Verify the page is still alive
        try:
            _ = page.url
        except Exception:
            logger.error("Browser page is dead for session %s", session_id)
            return {
                "status": "error",
                "message": "פג תוקף ההתחברות. צריך להתחבר מחדש.",
            }

        # POST to /api/v2/cart with empty items dict to clear the cart.
        # When an authenticated user sends items: {}, the API replaces
        # the persisted cart with an empty one.
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime(
            "%Y-%m-%dT00:00:00.000Z"
        )

        clear_payload = {
            "store": store_id,
            "isClub": 0,
            "supplyAt": tomorrow,
            "items": {},
            "meta": None,
        }

        logger.info(
            "clear_existing_cart: session=%s, store=%s",
            session_id, store_id,
        )

        result = await page.evaluate(
            """async (payload) => {
                try {
                    let token = null;
                    try {
                        const rlData = JSON.parse(localStorage.getItem('ramilevy'));
                        if (rlData && rlData.authuser && rlData.authuser.user) {
                            token = rlData.authuser.user.token;
                        }
                    } catch(e) {}

                    const headers = {
                        'Content-Type': 'application/json;charset=UTF-8',
                        'locale': 'he',
                        'Accept': 'application/json, text/plain, */*',
                    };
                    if (token) {
                        headers['Authorization'] = 'Bearer ' + token;
                        headers['ecomtoken'] = token;
                    }

                    const resp = await fetch('/api/v2/cart', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(payload),
                        credentials: 'include',
                    });

                    const data = await resp.json();
                    return {
                        ok: resp.ok,
                        status: resp.status,
                        data: data,
                    };
                } catch(e) {
                    return {
                        ok: false,
                        status: 0,
                        error: e.message || String(e),
                    };
                }
            }""",
            clear_payload,
        )

        logger.info(
            "clear_existing_cart response: ok=%s, status=%s, session=%s",
            result.get("ok"), result.get("status"), session_id,
        )

        if not result.get("ok"):
            error_msg = result.get("error", "")
            status_code = result.get("status", 0)
            logger.error(
                "clear_existing_cart failed: status=%s, error=%s",
                status_code, error_msg,
            )
            if status_code == 401:
                return {
                    "status": "error",
                    "message": "פג תוקף ההתחברות. צריך להתחבר מחדש.",
                }
            return {
                "status": "error",
                "message": "לא הצלחתי לנקות את העגלה.",
            }

        # Clear the existing cart state
        tool_context.state["existing_cart_items"] = []
        tool_context.state["existing_cart_count"] = 0

        logger.info("clear_existing_cart: cart cleared, session=%s", session_id)

        return {
            "status": "success",
            "message": "העגלה נוקתה בהצלחה.",
        }

    except Exception as exc:
        logger.exception(
            "clear_existing_cart failed for session %s: %s", session_id, exc
        )
        return {
            "status": "error",
            "message": "שגיאה בניקוי העגלה.",
        }


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
        cart_data = result.get("cart_data", {})
        response_items = cart_data.get("items", [])

        # Detect old items: items in the API response that we did NOT send
        sent_ids = set(str(k) for k in items_map.keys())
        old_items = []
        all_items_summary = []
        for item in response_items:
            is_delivery = item.get("is_delivery", False)
            if is_delivery or "משלוח" in item.get("name", ""):
                continue
            item_id = str(item.get("id", ""))
            item_info = {
                "store_product_id": item_id,
                "name": item.get("name", ""),
                "quantity": item.get("quantity", 1),
                "price": item.get("price", 0),
                "total_price": item.get("FormatedTotalPrice", 0),
            }
            all_items_summary.append(item_info)
            if item_id not in sent_ids:
                old_items.append(item_info)

        if old_items:
            # Old items detected — DON'T clean up browser session yet,
            # user may want to clear and re-persist
            logger.info(
                "Old items detected: %d old items in cart, session=%s",
                len(old_items), session_id,
            )
            tool_context.state["old_cart_items"] = old_items
            checkout_url = adapter.get_checkout_url()

            return {
                "status": "old_items_detected",
                "old_items": old_items,
                "old_item_count": len(old_items),
                "all_items": all_items_summary,
                "all_item_count": len(all_items_summary),
                "checkout_url": checkout_url,
                "message": (
                    f"יש לך {len(old_items)} מוצרים בעגלה מקנייה קודמת. "
                    "מה תרצה לעשות?\n"
                    "1. להתחיל עגלה חדשה (למחוק את הישנים)\n"
                    "2. להשאיר הכל (הישנים + החדשים)"
                ),
            }

        # No old items — success
        tool_context.state["cart_persisted"] = True
        checkout_url = adapter.get_checkout_url()
        tool_context.state["checkout_url"] = checkout_url
        logger.info("Cart persisted via browser! checkout_url=%s", checkout_url)

        # Clean up the browser session — cart is saved, no longer needed
        await cleanup_browser_session(session_id)

        return {
            "status": "success",
            "checkout_url": checkout_url,
            "all_items": all_items_summary,
            "all_item_count": len(all_items_summary),
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
