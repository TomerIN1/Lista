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

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from google.adk.tools import ToolContext

from pricepilot.stores import get_adapter
from pricepilot.tools.auth_tools import (
    browser_add_to_cart,
    browser_read_full_cart,
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

    Uses the authenticated browser session to delete the cart via the
    store's own API. Multi-strategy approach:

    Strategy 1 (primary): Call $nuxt.$api.cart.deleteCart() — the same
        JS method the site's own "רוקן סל" button uses. This triggers
        DELETE https://www-api.rami-levy.co.il/api/v2/site/cart/delete
        with proper auth headers from the browser session.

    Strategy 2 (fallback): Direct fetch() to the DELETE endpoint from
        the browser context, with auth token from localStorage.

    Strategy 3 (last resort): POST /api/v2/cart with quantity 0 for
        each item individually.

    Args:
        store_name: Chain name (e.g. "Rami Levy").
        store_id: Branch ID (e.g. "331").
        tool_context: ADK ToolContext for state access.

    Returns:
        Dict with status indicating whether the cart was cleared.
    """
    import asyncio as _asyncio

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

        logger.info(
            "clear_existing_cart: session=%s, store=%s — starting cart clear",
            session_id, store_id,
        )

        # ---- Strategy 1: Call $nuxt.$api.cart.deleteCart() ----
        # This is the exact same JS method the site's "רוקן סל" button
        # calls. It makes DELETE /api/v2/site/cart/delete with auth.
        # Must be on a Rami Levy page for $nuxt to be available.
        current_url = page.url
        if "rami-levy.co.il" not in current_url:
            await page.goto(
                "https://www.rami-levy.co.il/he/online/market",
                wait_until="domcontentloaded",
                timeout=30_000,
            )
            try:
                await page.wait_for_load_state("networkidle", timeout=15_000)
            except Exception:
                await _asyncio.sleep(3)

        logger.info(
            "clear_existing_cart: Strategy 1 — calling $nuxt.$api.cart.deleteCart(), session=%s",
            session_id,
        )

        api_delete_result = await page.evaluate("""
            async () => {
                try {
                    if (window.$nuxt && window.$nuxt.$api && window.$nuxt.$api.cart &&
                        typeof window.$nuxt.$api.cart.deleteCart === 'function') {
                        var result = await window.$nuxt.$api.cart.deleteCart();
                        return { method: 'nuxt_api', success: !!result, result: String(result) };
                    }
                    return { method: 'nuxt_api', success: false, error: 'deleteCart not available' };
                } catch(e) {
                    return { method: 'nuxt_api', success: false, error: e.message || String(e) };
                }
            }
        """)

        logger.info(
            "clear_existing_cart: Strategy 1 result: %s, session=%s",
            str(api_delete_result)[:300], session_id,
        )

        if api_delete_result.get("success"):
            # deleteCart() returned true — the server-side DELETE was called
            # and succeeded. Trust this result: the Rami Levy site's own JS
            # method confirmed the cart was cleared.
            #
            # NOTE: Do NOT verify via browser_read_full_cart here. The
            # deleteCart() call also commits cart/removeAllItems which
            # empties the Vuex store. Navigating to checkout afterwards
            # finds an empty Vuex store and returns item_count=-1 (error),
            # which falsely triggers fallback strategies.
            await _asyncio.sleep(1)
            tool_context.state["existing_cart_items"] = []
            tool_context.state["existing_cart_count"] = 0
            logger.info("clear_existing_cart: Strategy 1 (deleteCart API) succeeded, session=%s", session_id)
            return {"status": "success", "message": "העגלה נוקתה בהצלחה."}

        # ---- Strategy 2: Direct DELETE fetch from browser ----
        logger.info(
            "clear_existing_cart: Strategy 2 — direct DELETE fetch, session=%s",
            session_id,
        )

        direct_delete_result = await page.evaluate("""
            async () => {
                try {
                    var token = null;
                    try {
                        var rlData = JSON.parse(localStorage.getItem('ramilevy'));
                        if (rlData && rlData.authuser && rlData.authuser.user) {
                            token = rlData.authuser.user.token;
                        }
                    } catch(e) {}

                    if (!token) {
                        return { success: false, error: 'no_token' };
                    }

                    var headers = {
                        'Content-Type': 'application/json;charset=UTF-8',
                        'Authorization': 'Bearer ' + token,
                        'ecomtoken': token,
                        'locale': 'he',
                        'Accept': 'application/json, text/plain, */*',
                    };

                    var resp = await fetch(
                        'https://www-api.rami-levy.co.il/api/v2/site/cart/delete',
                        {
                            method: 'DELETE',
                            headers: headers,
                            credentials: 'include',
                        }
                    );

                    var data = null;
                    try { data = await resp.json(); } catch(e) { data = await resp.text(); }

                    return {
                        method: 'direct_delete',
                        success: resp.ok,
                        status: resp.status,
                        data: JSON.stringify(data).substring(0, 500),
                    };
                } catch(e) {
                    return { method: 'direct_delete', success: false, error: e.message || String(e) };
                }
            }
        """)

        logger.info(
            "clear_existing_cart: Strategy 2 result: %s, session=%s",
            str(direct_delete_result)[:500], session_id,
        )

        if direct_delete_result.get("success"):
            await _asyncio.sleep(2)
            verify2 = await browser_read_full_cart(session_id)
            remaining2 = verify2.get("item_count", -1)

            logger.info(
                "clear_existing_cart: Strategy 2 verification: %d items remain, session=%s",
                remaining2, session_id,
            )

            if remaining2 == 0:
                tool_context.state["existing_cart_items"] = []
                tool_context.state["existing_cart_count"] = 0
                logger.info("clear_existing_cart: Strategy 2 succeeded, session=%s", session_id)
                return {"status": "success", "message": "העגלה נוקתה בהצלחה."}

        # ---- Strategy 3: POST /api/v2/cart with quantity 0 ----
        logger.info(
            "clear_existing_cart: Strategy 3 — POST with zero quantities, session=%s",
            session_id,
        )

        # Read current items to get their IDs
        cart_data = await browser_read_full_cart(session_id)
        current_items = cart_data.get("items", [])

        if not current_items:
            tool_context.state["existing_cart_items"] = []
            tool_context.state["existing_cart_count"] = 0
            return {"status": "success", "message": "העגלה נוקתה בהצלחה."}

        item_ids = [
            str(item.get("id", item.get("store_product_id", "")))
            for item in current_items
            if item.get("id") or item.get("store_product_id")
        ]
        zero_items = {item_id: 0 for item_id in item_ids if item_id}

        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime(
            "%Y-%m-%dT00:00:00.000Z"
        )

        zero_result = await page.evaluate(
            """async (args) => {
                try {
                    var token = null;
                    try {
                        var rlData = JSON.parse(localStorage.getItem('ramilevy'));
                        if (rlData && rlData.authuser && rlData.authuser.user) {
                            token = rlData.authuser.user.token;
                        }
                    } catch(e) {}

                    var headers = {
                        'Content-Type': 'application/json;charset=UTF-8',
                        'locale': 'he',
                        'Accept': 'application/json, text/plain, */*',
                    };
                    if (token) {
                        headers['Authorization'] = 'Bearer ' + token;
                        headers['ecomtoken'] = token;
                    }

                    var resp = await fetch('/api/v2/cart', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({
                            store: args.storeId,
                            isClub: 0,
                            supplyAt: args.supplyAt,
                            items: args.zeroItems,
                            meta: null,
                        }),
                        credentials: 'include',
                    });

                    var data = await resp.json();
                    var remaining = (data.items || []).filter(
                        function(i) { return !i.is_delivery && !(i.name || '').includes('משלוח'); }
                    );
                    return {
                        method: 'zero_qty',
                        ok: resp.ok,
                        status: resp.status,
                        remaining: remaining.length,
                    };
                } catch(e) {
                    return { method: 'zero_qty', ok: false, error: e.message || String(e) };
                }
            }""",
            {"zeroItems": zero_items, "storeId": store_id, "supplyAt": tomorrow},
        )

        logger.info(
            "clear_existing_cart: Strategy 3 result: %s, session=%s",
            str(zero_result)[:300], session_id,
        )

        await _asyncio.sleep(2)
        verify3 = await browser_read_full_cart(session_id)
        remaining3 = verify3.get("item_count", -1)

        if remaining3 == 0:
            tool_context.state["existing_cart_items"] = []
            tool_context.state["existing_cart_count"] = 0
            logger.info("clear_existing_cart: Strategy 3 succeeded, session=%s", session_id)
            return {"status": "success", "message": "העגלה נוקתה בהצלחה."}

        # All strategies failed
        logger.error(
            "clear_existing_cart: ALL strategies failed. %d items remain, session=%s",
            remaining3, session_id,
        )
        return {
            "status": "partial",
            "message": f"ניסיתי לנקות את העגלה, אבל עדיין נשארו {remaining3} מוצרים.",
            "remaining_items": remaining3,
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
        # After persisting our items, read the FULL cart from the checkout
        # page to detect old items from previous sessions. The cart API
        # only returns items we sent, so we need a separate read.
        full_cart = await browser_read_full_cart(session_id)
        full_items = full_cart.get("items", [])

        sent_ids = set(str(k) for k in items_map.keys())
        old_items = []
        all_items_summary = []

        for item in full_items:
            item_id = str(item.get("id", item.get("store_product_id", "")))
            item_info = {
                "store_product_id": item_id,
                "name": item.get("name", ""),
                "quantity": item.get("quantity", 1),
                "price": item.get("price", 0),
                "total_price": item.get("total_price", 0),
            }
            all_items_summary.append(item_info)
            if item_id and item_id not in sent_ids:
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


# ------------------------------------------------------------------
# Composable browser interaction tools
# ------------------------------------------------------------------
#
# These tools replace the old monolithic sync_cart_on_checkout. Each tool
# does ONE thing, returns the current cart state, and lets the agent
# decide what to do next. This follows the composable-tool pattern used
# by Browser-Use, Playwright MCP, and Skyvern.
#
# Key improvements over the old approach:
# 1. Uses Playwright native locator.click() — NOT JS element.click()
# 2. Every tool verifies its action and returns current cart state
# 3. Agent controls the loop — can retry/recover from individual failures
# 4. Cart reading uses the proven POST /api/v2/cart API, not DOM scraping

# Timeout for individual Playwright operations (clicks, waits)
_BROWSER_ELEMENT_TIMEOUT_MS = 8_000
# Delay after clicks to let the SPA re-render
_CLICK_DELAY_S = 0.7
# Maximum +/- clicks per item (safety limit)
_MAX_CLICKS_PER_ITEM = 30

CHECKOUT_URL = "https://www.rami-levy.co.il/he/dashboard/checkout"


async def _read_cart_via_api(page: Any, store_id: str) -> list[dict[str, Any]]:
    """Read cart items using the POST /api/v2/cart API from browser context.

    This is the proven approach from read_existing_cart — sending an empty
    items dict to the cart API returns the full persisted cart contents.
    Much more reliable than DOM scraping or Vuex store inspection.

    Returns a list of item dicts, or an empty list on failure.
    """
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime(
        "%Y-%m-%dT00:00:00.000Z"
    )

    result = await page.evaluate(
        """async (args) => {
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
                    body: JSON.stringify({
                        store: args.storeId,
                        isClub: 0,
                        supplyAt: args.supplyAt,
                        items: {},
                        meta: null,
                    }),
                    credentials: 'include',
                });

                if (!resp.ok) {
                    return { ok: false, status: resp.status, items: [] };
                }

                const data = await resp.json();
                return { ok: true, items: data.items || [] };
            } catch(e) {
                return { ok: false, error: e.message || String(e), items: [] };
            }
        }""",
        {"storeId": store_id, "supplyAt": tomorrow},
    )

    if not result.get("ok"):
        logger.warning("_read_cart_via_api failed: %s", result)
        return []

    raw_items = result.get("items", [])
    items = []
    for item in raw_items:
        is_delivery = item.get("is_delivery", False)
        if is_delivery or "משלוח" in item.get("name", ""):
            continue
        items.append({
            "store_product_id": str(item.get("id", "")),
            "name": item.get("name", ""),
            "quantity": item.get("quantity", 1),
            "price": item.get("price", 0),
            "total_price": item.get("FormatedTotalPrice", 0),
        })

    return items


def _get_browser_page(tool_context: ToolContext) -> tuple[Any, str] | None:
    """Get the authenticated browser page and session_id.

    Returns (page, session_id) or None if no valid session.
    Validates that the page is still alive.
    """
    session_id = _get_session_id(tool_context)
    bs = get_authenticated_session(session_id)

    if bs is None:
        return None

    page = bs.page

    # Verify the page is still alive
    try:
        _ = page.url
    except Exception:
        logger.error("Browser page is dead for session %s", session_id)
        return None

    return page, session_id


async def browser_go_to_checkout(
    store_name: str,
    store_id: str,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Navigate to the checkout page and read the current cart contents.

    Call this FIRST after login to see what items are currently in the
    user's cart. Returns the full list of existing cart items so the agent
    can compare with the lista items and decide what to add/remove/adjust.

    Args:
        store_name: Chain name (e.g. "Rami Levy").
        store_id: Branch ID (e.g. "331").

    Returns:
        Dict with status, list of current cart items, and checkout URL.
    """
    import asyncio as _asyncio

    adapter = get_adapter(store_name)
    if adapter is None:
        return {"status": "error", "message": f"חנות '{store_name}' לא נתמכת."}

    result = _get_browser_page(tool_context)
    if result is None:
        return {
            "status": "error",
            "message": "אין חיבור פעיל. צריך להתחבר קודם.",
        }
    page, session_id = result

    try:
        # Step 1: Navigate to checkout page
        logger.info(
            "browser_go_to_checkout: navigating to checkout, session=%s",
            session_id,
        )
        await page.goto(
            CHECKOUT_URL,
            wait_until="domcontentloaded",
            timeout=30_000,
        )
        try:
            await page.wait_for_load_state("networkidle", timeout=15_000)
        except Exception:
            await _asyncio.sleep(3)

        # Step 2: Click "הצג" button using Playwright locator (native click)
        show_btn = page.locator(
            'button:has-text("הצג"), '
            'a:has-text("הצג"), '
            'span:has-text("הצג")'
        ).first
        try:
            await show_btn.wait_for(
                state="visible", timeout=_BROWSER_ELEMENT_TIMEOUT_MS
            )
            await show_btn.click()
            logger.info("browser_go_to_checkout: clicked 'הצג' button")
            await _asyncio.sleep(1.5)
        except Exception as e:
            logger.info(
                "browser_go_to_checkout: 'הצג' button not found or already "
                "expanded: %s",
                e,
            )

        # Step 3: Read cart items via the proven API approach
        items = await _read_cart_via_api(page, store_id)
        logger.info(
            "browser_go_to_checkout: found %d items in cart, session=%s",
            len(items),
            session_id,
        )

        # Step 4: Discover available $nuxt.$api.cart methods for later use
        api_methods = await page.evaluate("""
            () => {
                try {
                    if (window.$nuxt && window.$nuxt.$api && window.$nuxt.$api.cart) {
                        return Object.keys(window.$nuxt.$api.cart).filter(
                            k => typeof window.$nuxt.$api.cart[k] === 'function'
                        );
                    }
                    return [];
                } catch(e) { return []; }
            }
        """)
        logger.info(
            "browser_go_to_checkout: available $nuxt.$api.cart methods: %s",
            api_methods,
        )

        # Save cart state
        tool_context.state["existing_cart_items"] = items
        tool_context.state["existing_cart_count"] = len(items)

        return {
            "status": "success",
            "items": items,
            "item_count": len(items),
            "checkout_url": CHECKOUT_URL,
        }

    except Exception as exc:
        logger.exception(
            "browser_go_to_checkout failed for session %s: %s",
            session_id,
            exc,
        )
        return {
            "status": "error",
            "message": "שגיאה בטעינת עמוד הקופה.",
        }


async def browser_remove_cart_item(
    store_name: str,
    store_id: str,
    product_id: str,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Remove a single item from the cart.

    Tries multiple strategies in order:
    1. POST /api/v2/cart with quantity 0 for this product (API approach)
    2. Use $nuxt.$api.cart remove method if available
    3. Find the item row on the checkout page and click the remove button
       using Playwright native locator clicks

    After removal, re-reads the cart via API to verify and return the
    updated state.

    Args:
        store_name: Chain name (e.g. "Rami Levy").
        store_id: Branch ID (e.g. "331").
        product_id: The store product ID to remove.

    Returns:
        Dict with status, whether removal succeeded, and updated cart items.
    """
    import asyncio as _asyncio

    adapter = get_adapter(store_name)
    if adapter is None:
        return {"status": "error", "message": f"חנות '{store_name}' לא נתמכת."}

    browser = _get_browser_page(tool_context)
    if browser is None:
        return {
            "status": "error",
            "message": "אין חיבור פעיל. צריך להתחבר קודם.",
        }
    page, session_id = browser

    product_id = str(product_id)

    try:
        # Read cart before removal so we can verify afterward
        items_before = await _read_cart_via_api(page, store_id)
        ids_before = {item["store_product_id"] for item in items_before}

        if product_id not in ids_before:
            logger.info(
                "browser_remove_cart_item: product %s not in cart, nothing to remove",
                product_id,
            )
            return {
                "status": "success",
                "removed": True,
                "message": "המוצר לא נמצא בעגלה.",
                "items": items_before,
                "item_count": len(items_before),
            }

        # --- Strategy 1: POST /api/v2/cart with quantity 0 ---
        logger.info(
            "browser_remove_cart_item: Strategy 1 — API with qty 0 for %s, "
            "session=%s",
            product_id,
            session_id,
        )

        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime(
            "%Y-%m-%dT00:00:00.000Z"
        )

        api_result = await page.evaluate(
            """async (args) => {
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

                    const items = {};
                    items[args.productId] = "0";

                    const resp = await fetch('/api/v2/cart', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({
                            store: args.storeId,
                            isClub: 0,
                            supplyAt: args.supplyAt,
                            items: items,
                            meta: null,
                        }),
                        credentials: 'include',
                    });

                    return { ok: resp.ok, status: resp.status };
                } catch(e) {
                    return { ok: false, error: e.message || String(e) };
                }
            }""",
            {
                "productId": product_id,
                "storeId": store_id,
                "supplyAt": tomorrow,
            },
        )

        if api_result.get("ok"):
            logger.info(
                "browser_remove_cart_item: Strategy 1 (API qty 0) succeeded "
                "for %s",
                product_id,
            )
        else:
            logger.warning(
                "browser_remove_cart_item: Strategy 1 failed: %s", api_result
            )

            # --- Strategy 2: $nuxt.$api.cart remove method ---
            logger.info(
                "browser_remove_cart_item: Strategy 2 — $nuxt API remove for "
                "%s, session=%s",
                product_id,
                session_id,
            )

            nuxt_result = await page.evaluate(
                """async (productId) => {
                    try {
                        if (window.$nuxt && window.$nuxt.$api &&
                            window.$nuxt.$api.cart) {
                            const cart = window.$nuxt.$api.cart;
                            if (typeof cart.removeItem === 'function') {
                                await cart.removeItem(productId);
                                return { success: true, method: 'removeItem' };
                            }
                            if (typeof cart.deleteItem === 'function') {
                                await cart.deleteItem(productId);
                                return { success: true, method: 'deleteItem' };
                            }
                            if (typeof cart.remove === 'function') {
                                await cart.remove(productId);
                                return { success: true, method: 'remove' };
                            }
                        }
                        return { success: false, error: 'no_method' };
                    } catch(e) {
                        return { success: false, error: e.message || String(e) };
                    }
                }""",
                product_id,
            )

            if nuxt_result.get("success"):
                logger.info(
                    "browser_remove_cart_item: Strategy 2 succeeded via %s",
                    nuxt_result.get("method"),
                )
            else:
                logger.warning(
                    "browser_remove_cart_item: Strategy 2 failed: %s",
                    nuxt_result,
                )

                # --- Strategy 3: Playwright locator click on remove button ---
                logger.info(
                    "browser_remove_cart_item: Strategy 3 — DOM click for %s, "
                    "session=%s",
                    product_id,
                    session_id,
                )

                # Make sure we're on the checkout page
                current_url = page.url
                if "checkout" not in current_url:
                    await page.goto(
                        CHECKOUT_URL,
                        wait_until="domcontentloaded",
                        timeout=30_000,
                    )
                    try:
                        await page.wait_for_load_state(
                            "networkidle", timeout=15_000
                        )
                    except Exception:
                        await _asyncio.sleep(3)

                    # Click "הצג" to expand
                    try:
                        show_btn = page.locator(
                            'button:has-text("הצג"), '
                            'a:has-text("הצג"), '
                            'span:has-text("הצג")'
                        ).first
                        await show_btn.wait_for(
                            state="visible",
                            timeout=_BROWSER_ELEMENT_TIMEOUT_MS,
                        )
                        await show_btn.click()
                        await _asyncio.sleep(1.5)
                    except Exception:
                        pass

                # Find the item name from our pre-read items
                item_name = ""
                for it in items_before:
                    if it["store_product_id"] == product_id:
                        item_name = it.get("name", "")
                        break

                # Try to find the item row and click remove using Playwright
                # native locators (NOT JS element.click())
                removed_via_dom = False
                if item_name:
                    row = page.locator(".online-checkout-item").filter(
                        has_text=item_name
                    ).first
                    try:
                        await row.wait_for(
                            state="visible",
                            timeout=_BROWSER_ELEMENT_TIMEOUT_MS,
                        )
                        remove_btn = row.locator(
                            ".remove-item, "
                            "[class*='remove-item'], "
                            "button[class*='delete'], "
                            "button[class*='remove']"
                        ).first
                        await remove_btn.click()
                        removed_via_dom = True
                        logger.info(
                            "browser_remove_cart_item: Strategy 3 — clicked "
                            "remove button for %s",
                            product_id,
                        )
                        await _asyncio.sleep(_CLICK_DELAY_S)

                        # Handle confirmation dialog
                        try:
                            confirm_btn = page.locator(
                                'button:has-text("אישור"), '
                                'button:has-text("מחק"), '
                                'button:has-text("כן"), '
                                'button:has-text("הסר")'
                            ).first
                            await confirm_btn.wait_for(
                                state="visible", timeout=3_000
                            )
                            await confirm_btn.click()
                            await _asyncio.sleep(_CLICK_DELAY_S)
                            logger.info(
                                "browser_remove_cart_item: confirmed deletion "
                                "dialog"
                            )
                        except Exception:
                            pass

                    except Exception as e:
                        logger.warning(
                            "browser_remove_cart_item: Strategy 3 failed: %s",
                            e,
                        )

                if not removed_via_dom:
                    logger.warning(
                        "browser_remove_cart_item: all strategies failed for "
                        "%s",
                        product_id,
                    )

        # Verify: re-read cart to check if removal succeeded
        await _asyncio.sleep(1)
        items_after = await _read_cart_via_api(page, store_id)
        ids_after = {item["store_product_id"] for item in items_after}
        removed = product_id not in ids_after

        logger.info(
            "browser_remove_cart_item: product %s removed=%s, "
            "items_before=%d, items_after=%d, session=%s",
            product_id,
            removed,
            len(items_before),
            len(items_after),
            session_id,
        )

        return {
            "status": "success" if removed else "error",
            "removed": removed,
            "items": items_after,
            "item_count": len(items_after),
            "message": (
                "המוצר הוסר מהעגלה."
                if removed
                else "לא הצלחתי להסיר את המוצר. אפשר לנסות שוב."
            ),
        }

    except Exception as exc:
        logger.exception(
            "browser_remove_cart_item failed for product %s, session %s: %s",
            product_id,
            session_id,
            exc,
        )
        return {
            "status": "error",
            "removed": False,
            "message": "שגיאה בהסרת המוצר מהעגלה.",
            "items": [],
            "item_count": 0,
        }


async def browser_set_item_quantity(
    store_name: str,
    store_id: str,
    product_id: str,
    quantity: int,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Set a single item's quantity to an exact value.

    Tries multiple strategies:
    1. POST /api/v2/cart with {product_id: quantity} to set directly via API
    2. Use Playwright native locator clicks on +/- buttons, verifying after
       each click

    After adjustment, re-reads the cart via API to verify and return updated
    state.

    Args:
        store_name: Chain name (e.g. "Rami Levy").
        store_id: Branch ID (e.g. "331").
        product_id: The store product ID to adjust.
        quantity: The desired quantity (must be >= 1).

    Returns:
        Dict with status, old/new quantities, and updated cart items.
    """
    import asyncio as _asyncio

    adapter = get_adapter(store_name)
    if adapter is None:
        return {"status": "error", "message": f"חנות '{store_name}' לא נתמכת."}

    browser = _get_browser_page(tool_context)
    if browser is None:
        return {
            "status": "error",
            "message": "אין חיבור פעיל. צריך להתחבר קודם.",
        }
    page, session_id = browser

    product_id = str(product_id)
    quantity = int(quantity)

    if quantity < 1:
        return {
            "status": "error",
            "message": "הכמות חייבת להיות 1 לפחות. להסרת מוצר השתמשו בכלי ההסרה.",
        }

    try:
        # Read current cart to find this item's current quantity
        items_before = await _read_cart_via_api(page, store_id)
        old_quantity = 0
        item_name = ""
        for it in items_before:
            if it["store_product_id"] == product_id:
                old_quantity = it.get("quantity", 1)
                item_name = it.get("name", "")
                break

        if old_quantity == 0:
            logger.warning(
                "browser_set_item_quantity: product %s not found in cart",
                product_id,
            )
            return {
                "status": "error",
                "message": "המוצר לא נמצא בעגלה.",
                "items": items_before,
                "item_count": len(items_before),
            }

        if old_quantity == quantity:
            logger.info(
                "browser_set_item_quantity: product %s already at qty %d",
                product_id,
                quantity,
            )
            return {
                "status": "success",
                "product_id": product_id,
                "old_quantity": old_quantity,
                "new_quantity": quantity,
                "items": items_before,
                "item_count": len(items_before),
                "message": f"הכמות כבר {quantity}.",
            }

        # --- Strategy 1: API approach — POST with desired quantity ---
        logger.info(
            "browser_set_item_quantity: Strategy 1 — API set qty for %s to "
            "%d, session=%s",
            product_id,
            quantity,
            session_id,
        )

        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime(
            "%Y-%m-%dT00:00:00.000Z"
        )

        api_result = await page.evaluate(
            """async (args) => {
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

                    const items = {};
                    items[args.productId] = String(args.quantity);

                    const resp = await fetch('/api/v2/cart', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({
                            store: args.storeId,
                            isClub: 0,
                            supplyAt: args.supplyAt,
                            items: items,
                            meta: null,
                        }),
                        credentials: 'include',
                    });

                    return { ok: resp.ok, status: resp.status };
                } catch(e) {
                    return { ok: false, error: e.message || String(e) };
                }
            }""",
            {
                "productId": product_id,
                "quantity": quantity,
                "storeId": store_id,
                "supplyAt": tomorrow,
            },
        )

        api_worked = False
        if api_result.get("ok"):
            # Verify the quantity actually changed
            await _asyncio.sleep(0.5)
            items_check = await _read_cart_via_api(page, store_id)
            for it in items_check:
                if it["store_product_id"] == product_id:
                    if it.get("quantity", 1) == quantity:
                        api_worked = True
                    break

        if api_worked:
            logger.info(
                "browser_set_item_quantity: Strategy 1 (API) succeeded for "
                "%s: %d -> %d",
                product_id,
                old_quantity,
                quantity,
            )
            items_after = items_check
        else:
            # --- Strategy 2: Playwright +/- clicks ---
            logger.info(
                "browser_set_item_quantity: Strategy 2 — Playwright clicks "
                "for %s, session=%s",
                product_id,
                session_id,
            )

            # Make sure we're on the checkout page
            current_url = page.url
            if "checkout" not in current_url:
                await page.goto(
                    CHECKOUT_URL,
                    wait_until="domcontentloaded",
                    timeout=30_000,
                )
                try:
                    await page.wait_for_load_state(
                        "networkidle", timeout=15_000
                    )
                except Exception:
                    await _asyncio.sleep(3)

                # Click "הצג" to expand
                try:
                    show_btn = page.locator(
                        'button:has-text("הצג"), '
                        'a:has-text("הצג"), '
                        'span:has-text("הצג")'
                    ).first
                    await show_btn.wait_for(
                        state="visible", timeout=_BROWSER_ELEMENT_TIMEOUT_MS
                    )
                    await show_btn.click()
                    await _asyncio.sleep(1.5)
                except Exception:
                    pass

            # Re-read to get current quantity (may have changed from
            # Strategy 1 partial effect)
            items_current = await _read_cart_via_api(page, store_id)
            current_qty = old_quantity
            for it in items_current:
                if it["store_product_id"] == product_id:
                    current_qty = it.get("quantity", 1)
                    break

            diff = quantity - current_qty
            clicks_needed = min(abs(diff), _MAX_CLICKS_PER_ITEM)

            if item_name and clicks_needed > 0:
                # Find the item row
                row = page.locator(".online-checkout-item").filter(
                    has_text=item_name
                ).first

                try:
                    await row.wait_for(
                        state="visible",
                        timeout=_BROWSER_ELEMENT_TIMEOUT_MS,
                    )

                    for i in range(clicks_needed):
                        if diff > 0:
                            btn = row.locator(".plus").first
                        else:
                            btn = row.locator(".minus").first

                        try:
                            await btn.click()
                            logger.debug(
                                "browser_set_item_quantity: clicked %s "
                                "(%d/%d) for %s",
                                "plus" if diff > 0 else "minus",
                                i + 1,
                                clicks_needed,
                                product_id,
                            )
                        except Exception as click_err:
                            logger.warning(
                                "browser_set_item_quantity: click %d/%d "
                                "failed: %s",
                                i + 1,
                                clicks_needed,
                                click_err,
                            )
                            break

                        await _asyncio.sleep(_CLICK_DELAY_S)

                except Exception as e:
                    logger.warning(
                        "browser_set_item_quantity: Strategy 2 failed to "
                        "find/click row: %s",
                        e,
                    )

            # Re-read to verify
            await _asyncio.sleep(1)
            items_after = await _read_cart_via_api(page, store_id)

        # Find the final quantity
        new_quantity = 0
        for it in items_after:
            if it["store_product_id"] == product_id:
                new_quantity = it.get("quantity", 1)
                break

        success = new_quantity == quantity

        logger.info(
            "browser_set_item_quantity: product %s: %d -> %d (wanted %d), "
            "success=%s, session=%s",
            product_id,
            old_quantity,
            new_quantity,
            quantity,
            success,
            session_id,
        )

        return {
            "status": "success" if success else "error",
            "product_id": product_id,
            "old_quantity": old_quantity,
            "new_quantity": new_quantity,
            "items": items_after,
            "item_count": len(items_after),
            "message": (
                f"הכמות עודכנה ל-{new_quantity}."
                if success
                else f"לא הצלחתי לעדכן ל-{quantity}. הכמות הנוכחית: {new_quantity}."
            ),
        }

    except Exception as exc:
        logger.exception(
            "browser_set_item_quantity failed for product %s, session %s: %s",
            product_id,
            session_id,
            exc,
        )
        return {
            "status": "error",
            "message": "שגיאה בעדכון הכמות.",
            "items": [],
            "item_count": 0,
        }


async def browser_read_cart_items(
    store_name: str,
    store_id: str,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Read the current cart contents without making any changes.

    Simple read-only tool to re-check what's in the cart at any point.
    Uses the proven POST /api/v2/cart API with empty items.

    Args:
        store_name: Chain name (e.g. "Rami Levy").
        store_id: Branch ID (e.g. "331").

    Returns:
        Dict with status and list of current cart items.
    """
    adapter = get_adapter(store_name)
    if adapter is None:
        return {"status": "error", "message": f"חנות '{store_name}' לא נתמכת."}

    browser = _get_browser_page(tool_context)
    if browser is None:
        return {
            "status": "error",
            "message": "אין חיבור פעיל. צריך להתחבר קודם.",
        }
    page, session_id = browser

    try:
        items = await _read_cart_via_api(page, store_id)
        logger.info(
            "browser_read_cart_items: found %d items, session=%s",
            len(items),
            session_id,
        )

        return {
            "status": "success",
            "items": items,
            "item_count": len(items),
        }

    except Exception as exc:
        logger.exception(
            "browser_read_cart_items failed for session %s: %s",
            session_id,
            exc,
        )
        return {
            "status": "error",
            "message": "שגיאה בקריאת העגלה.",
            "items": [],
            "item_count": 0,
        }


async def generate_cart_script(
    store_name: str,
    store_id: str,
    clear_existing: bool,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Generate a JavaScript snippet for the Lista frontend to execute in the user's browser.

    Due to session isolation, the headless browser cannot modify the user's real cart.
    This tool generates JS commands that must be executed in the user's browser context
    on rami-levy.co.il to actually clear/add items.

    Args:
        store_name: Chain name.
        store_id: Branch ID.
        clear_existing: Whether to clear old items first.

    Returns:
        Dict with JavaScript snippet and summary.
    """
    items_map = tool_context.state.get("cart_items_map", {})
    resolved = tool_context.state.get("resolved_items", [])

    if not items_map:
        return {
            "status": "error",
            "message": "אין מוצרים להוספה. הפעל calculate_cart_preview קודם.",
        }

    # Build items dict string for JS
    items_js = ", ".join(f"'{pid}': {qty}" for pid, qty in items_map.items())

    # Build the combined script
    parts = []
    if clear_existing:
        parts.append("await window.$nuxt.$api.cart.deleteCart();")

    parts.append(
        f"const t = JSON.parse(localStorage.getItem('ramilevy')).authuser.user.token;\n"
        f"const d = new Date(Date.now()+86400000).toISOString().split('T')[0]+'T00:00:00.000Z';\n"
        f"await fetch('/api/v2/cart', {{\n"
        f"  method: 'POST',\n"
        f"  headers: {{'Content-Type':'application/json;charset=UTF-8','locale':'he','Authorization':'Bearer '+t,'ecomtoken':t}},\n"
        f"  body: JSON.stringify({{store:'{store_id}',isClub:0,supplyAt:d,items:{{{items_js}}},meta:null}}),\n"
        f"  credentials: 'include'\n"
        f"}});\n"
        f"location.reload();"
    )

    combined = "(async () => {\n" + "\n".join(parts) + "\n})();"

    # Build summary
    item_lines = []
    for item in resolved:
        name = item.get("store_product_name") or item.get("lista_name", "?")
        qty = item.get("quantity", 1)
        item_lines.append(f"\u2022 {name} ({qty} \u05d9\u05d7')")

    summary = "\u05d4\u05db\u05e0\u05ea\u05d9 \u05d0\u05ea \u05d4\u05e2\u05d2\u05dc\u05d4 \u05e9\u05dc\u05da:\n" + "\n".join(item_lines)
    if clear_existing:
        summary += "\n\n(\u05d4\u05de\u05d5\u05e6\u05e8\u05d9\u05dd \u05d4\u05d9\u05e9\u05e0\u05d9\u05dd \u05d9\u05d9\u05de\u05d7\u05e7\u05d5)"

    tool_context.state["cart_script"] = combined
    tool_context.state["cart_script_ready"] = True

    return {
        "status": "ready",
        "script": combined,
        "summary": summary,
        "checkout_url": "https://www.rami-levy.co.il/he/dashboard/checkout",
        "message": summary + "\n\n\u05d4\u05e1\u05e7\u05e8\u05d9\u05e4\u05d8 \u05de\u05d5\u05db\u05df \u05dc\u05d4\u05e4\u05e2\u05dc\u05d4 \u05d1\u05d3\u05e4\u05d3\u05e4\u05df \u05e9\u05dc\u05da.",
    }
