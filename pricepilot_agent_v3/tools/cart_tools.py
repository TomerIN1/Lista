from __future__ import annotations
"""Cart management tools — using proven approaches from v2 manual testing.

Key findings:
- READ cart: use $nuxt.$store.state.cart.items on the market/checkout page (Vuex store)
- ADD items: use $nuxt.$api.cart.addLineToCart({id, quantity, isClub}) — account-level
- CLEAR cart: use $nuxt.$api.cart.deleteCart() — account-level
- DO NOT use POST /api/v2/cart with empty items for reading (returns 0)
"""

import json
import logging

from google.adk.tools import ToolContext

from config import settings
from services.browser import BrowserManager
from services.observer import observer

logger = logging.getLogger(__name__)


async def _get_authenticated_page(session_id: str) -> tuple:
    """Get authenticated browser page or return error."""
    manager = await BrowserManager.get_instance()
    bs = await manager.get_session(session_id)
    if not bs:
        return None, {"status": "error", "message": "No browser session. Call open_supermarket first."}
    if not bs.authenticated:
        return None, {"status": "error", "message": "Not authenticated. Login required first."}
    return bs.page, None


async def _get_store_id(page) -> str:
    """Get the actual store ID from Vuex state (matches the user's delivery area)."""
    store_id = await page.evaluate("""() => {
        try {
            if (window.$nuxt && window.$nuxt.$store && window.$nuxt.$store.state.cart) {
                return String(window.$nuxt.$store.state.cart.storeId || '');
            }
            return '';
        } catch(e) { return ''; }
    }""")
    if store_id:
        return store_id
    # Fallback to config default
    return str(settings.rami_levy_default_store)


async def read_cart(tool_context: ToolContext) -> dict:
    """Read the current contents of the shopping cart from the Vuex store.

    Must be called after authentication. Returns all items currently in the cart.
    Uses $nuxt.$store.state.cart.items — the only reliable way to read the persisted cart.

    Returns:
        dict with status and list of cart items with names, quantities, and prices.
    """
    session_id = tool_context.state.get("session_id", "default")
    observer.log_tool_start(session_id, "read_cart", {})
    page, error = await _get_authenticated_page(session_id)
    if error:
        observer.log_error(session_id, "read_cart", error.get("message", "auth error"))
        return error

    try:
        import asyncio as _asyncio

        # Reload page to get fresh Vuex state (httpx adds don't update Vuex)
        await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            await _asyncio.sleep(3)
        await _asyncio.sleep(3)

        await observer.capture_screenshot(session_id, page, "before_read_cart")

        # Read cart from Vuex store — the ONLY reliable method
        items = await page.evaluate("""() => {
            try {
                if (window.$nuxt && window.$nuxt.$store && window.$nuxt.$store.state.cart) {
                    const cart = window.$nuxt.$store.state.cart;
                    if (cart.items && Array.isArray(cart.items)) {
                        return cart.items
                            .filter(i => !i.is_delivery && i.name !== 'מחיר משלוח')
                            .map(i => {
                                const isWeighted = !!(i.prop && (i.prop.sw_shakil || i.prop.by_kilo));
                                const amount = i.amount || 1;
                                const multiplication = i.multiplication || 1;
                                return {
                                    id: i.id,
                                    name: i.name || '',
                                    barcode: i.barcode || '',
                                    amount: amount,
                                    multiplication: multiplication,
                                    is_weighted: isWeighted,
                                    quantity_display: isWeighted
                                        ? amount + ' ק"ג'
                                        : amount + ' יחידות',
                                    price: i.price && i.price.price ? i.price.price : (typeof i.price === 'number' ? i.price : 0),
                                    total_price: i.price && i.price.finalPrice ? i.price.finalPrice : (i.sumPrice || 0),
                                };
                            });
                    }
                }
                return [];
            } catch(e) { return []; }
        }""")

        tool_context.state["current_cart"] = items
        tool_context.state["cart_item_count"] = len(items)

        result = {
            "status": "success",
            "items": items,
            "item_count": len(items),
            "message": f"Cart has {len(items)} item(s)." if items else "Cart is empty.",
        }
        observer.log_tool_end(session_id, "read_cart", result, {
            "cart_item_count": len(items),
        })
        logger.info("Read cart: %d items", len(items))
        return result

    except Exception as e:
        logger.error("Read cart failed: %s", e, exc_info=True)
        observer.log_error(session_id, "read_cart", str(e))
        return {"status": "error", "message": f"Failed to read cart: {e}"}


async def add_items_to_cart(items_json: str, tool_context: ToolContext) -> dict:
    """Add items to the shopping cart using $nuxt.$api.cart.addLineToCart.

    This is an account-level operation that persists across browser sessions.
    Items must be provided as a JSON string mapping product IDs to quantities.
    Product IDs come from search_products results (internal 'id' field, NOT barcode).

    Args:
        items_json: JSON string mapping product IDs to quantities,
                    e.g. '{{"2968": 2, "361918": 1}}'

    Returns:
        dict with status and details of items added.
    """
    try:
        items = json.loads(items_json)
    except (json.JSONDecodeError, TypeError):
        return {"status": "error", "message": "Invalid items_json. Must be valid JSON object."}

    if not items or not isinstance(items, dict):
        return {"status": "error", "message": "items_json must be a non-empty JSON object."}

    session_id = tool_context.state.get("session_id", "default")
    observer.log_tool_start(session_id, "add_items_to_cart", {"item_count": len(items), "items": items})
    page, error = await _get_authenticated_page(session_id)
    if error:
        observer.log_error(session_id, "add_items_to_cart", error.get("message", "auth error"))
        return error

    try:
        import asyncio
        import httpx as _httpx
        from datetime import datetime, timedelta, timezone as _tz

        # Keep float values — int() truncates 2.5 to 2!
        # Weighted products accept 0.5 steps (0.5, 1, 1.5, 2, 2.5...)
        normalized = {str(k): float(v) for k, v in items.items()}
        store = await _get_store_id(page)

        # Navigate to market page to get fresh cookies (AWSALB may be stale)
        await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            await asyncio.sleep(3)
        await asyncio.sleep(2)

        # Extract token from browser's localStorage
        token = await page.evaluate("""() => {
            try { return JSON.parse(localStorage.getItem('ramilevy')).authuser.user.token; }
            catch(e) { return null; }
        }""")
        if not token:
            return {"status": "error", "message": "No auth token. Login required."}

        # Extract cookies from browser context
        manager = await BrowserManager.get_instance()
        bs = await manager.get_session(session_id)
        browser_cookies = await bs.context.cookies() if bs else []
        cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in browser_cookies)

        # Use httpx with token + cookies — PROVEN to persist to user's REAL account
        tomorrow = (datetime.now(_tz.utc) + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00.000Z")
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "locale": "he",
            "Accept": "application/json, text/plain, */*",
            "Authorization": f"Bearer {token}",
            "ecomtoken": token,
            "Origin": "https://www.rami-levy.co.il",
            "Referer": "https://www.rami-levy.co.il/he/online/market",
            "Cookie": cookie_str,
        }

        # Log cookies for debugging
        cookie_names = [c['name'] for c in browser_cookies]
        logger.info("Adding items via httpx. Token len=%d, cookies=%s, items=%s",
                     len(token), cookie_names, normalized)
        observer.log_state_change(session_id, "httpx_add_request", {
            "token_len": len(token), "cookie_count": len(browser_cookies),
            "cookie_names": cookie_names, "items": normalized,
        })

        async with _httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.post(
                "https://www.rami-levy.co.il/api/v2/cart",
                headers=headers,
                json={"store": str(store), "isClub": 0, "supplyAt": tomorrow, "items": normalized, "meta": None},
            )

        data = resp.json()
        cart_items = [
            {"id": i.get("id"), "name": i.get("name", ""), "qty": i.get("quantity", 1)}
            for i in data.get("items", [])
            if not i.get("is_delivery") and "משלוח" not in i.get("name", "")
        ]
        results = {"ok": resp.is_success, "status": data.get("status"), "cart_items": cart_items, "cart_count": len(cart_items)}

        await observer.capture_screenshot(session_id, page, "after_add_items")

        if results.get("ok"):
            ret = {
                "status": "success",
                "items_added": normalized,
                "cart_items": results.get("cart_items", []),
                "cart_count": results.get("cart_count", 0),
                "message": f"Added {len(normalized)} product(s). Cart now has {results.get('cart_count', '?')} items.",
            }
        else:
            ret = {
                "status": "error",
                "message": f"Failed to add items: {results.get('error', 'unknown')}",
            }

        observer.log_tool_end(session_id, "add_items_to_cart", ret)
        observer.log_state_change(session_id, f"Added {len(items)} items to cart", {"items": items})
        logger.info("Add to cart result: %s", ret.get("status"))
        return ret

    except Exception as e:
        logger.error("Add to cart failed: %s", e, exc_info=True)
        observer.log_error(session_id, "add_items_to_cart", str(e))
        return {"status": "error", "message": f"Failed to add items: {e}"}


async def clear_cart(tool_context: ToolContext) -> dict:
    """Clear all items from the shopping cart using $nuxt.$api.cart.deleteCart().

    This is an account-level operation. After clearing, ALWAYS call read_cart to verify.

    Returns:
        dict with status indicating whether cart was cleared.
    """
    session_id = tool_context.state.get("session_id", "default")
    observer.log_tool_start(session_id, "clear_cart", {})
    page, error = await _get_authenticated_page(session_id)
    if error:
        observer.log_error(session_id, "clear_cart", error.get("message", "auth error"))
        return error

    try:
        # Use deleteCart() — proven account-level operation
        delete_result = await page.evaluate("""async () => {
            try {
                if (window.$nuxt && window.$nuxt.$api && window.$nuxt.$api.cart &&
                    typeof window.$nuxt.$api.cart.deleteCart === 'function') {
                    const result = await window.$nuxt.$api.cart.deleteCart();
                    return {ok: true, result: String(result)};
                }
                return {ok: false, error: 'deleteCart not available'};
            } catch(e) {
                return {ok: false, error: e.message};
            }
        }""")

        await observer.capture_screenshot(session_id, page, "after_clear_cart")

        if delete_result.get("ok"):
            result = {
                "status": "success",
                "message": "Cart clear command sent. IMPORTANT: Call read_cart to verify the cart is empty.",
            }
        else:
            result = {
                "status": "error",
                "message": f"deleteCart failed: {delete_result.get('error', 'unknown')}",
            }

        observer.log_tool_end(session_id, "clear_cart", result)
        observer.log_state_change(session_id, "Cart clear attempted")
        logger.info("Clear cart: %s", result.get("status"))
        return result

    except Exception as e:
        logger.error("Clear cart failed: %s", e, exc_info=True)
        observer.log_error(session_id, "clear_cart", str(e))
        return {"status": "error", "message": f"Failed to clear cart: {e}"}


async def remove_cart_item(product_id: str, tool_context: ToolContext) -> dict:
    """Remove a single item from the cart using negative quantity.

    Uses the same httpx approach as add_items_to_cart but with negative quantity.
    Key: must re-extract fresh cookies right before the call (session ownership).
    After removing, call read_cart to verify.

    Args:
        product_id: The internal product ID to remove (from read_cart results).

    Returns:
        dict with status indicating whether the item was removed.
    """
    if not product_id:
        return {"status": "error", "message": "product_id is required."}

    pid = str(product_id)
    session_id = tool_context.state.get("session_id", "default")
    observer.log_tool_start(session_id, "remove_cart_item", {"product_id": pid})
    page, error = await _get_authenticated_page(session_id)
    if error:
        observer.log_error(session_id, "remove_cart_item", error.get("message", "auth error"))
        return error

    try:
        import asyncio
        import httpx as _httpx
        from datetime import datetime, timedelta, timezone as _tz

        # Read current quantity from Vuex so we can negate it
        item_amount = await page.evaluate("""(pid) => {
            try {
                const cart = window.$nuxt.$store.state.cart;
                if (cart && cart.items) {
                    const item = cart.items.find(i => String(i.id) === pid);
                    return item ? (item.amount || 1) : 1;
                }
                return 1;
            } catch(e) { return 1; }
        }""", pid)

        neg_qty = -float(item_amount)
        normalized = {pid: neg_qty}
        store = await _get_store_id(page)

        # Navigate to market page to get FRESH cookies (critical for session ownership)
        await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            await asyncio.sleep(3)
        await asyncio.sleep(2)

        # Re-extract token FRESH (not stale from earlier)
        token = await page.evaluate("""() => {
            try { return JSON.parse(localStorage.getItem('ramilevy')).authuser.user.token; }
            catch(e) { return null; }
        }""")
        if not token:
            return {"status": "error", "message": "No auth token. Login required."}

        # Re-extract cookies FRESH (critical: cookies change after navigation)
        manager = await BrowserManager.get_instance()
        bs = await manager.get_session(session_id)
        browser_cookies = await bs.context.cookies() if bs else []
        cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in browser_cookies)

        tomorrow = (datetime.now(_tz.utc) + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00.000Z")
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "locale": "he",
            "Accept": "application/json, text/plain, */*",
            "Authorization": f"Bearer {token}",
            "ecomtoken": token,
            "Origin": "https://www.rami-levy.co.il",
            "Referer": "https://www.rami-levy.co.il/he/online/market",
            "Cookie": cookie_str,
        }

        logger.info("Removing %s via negative qty=%s, store=%s, cookies=%d",
                     pid, neg_qty, store, len(browser_cookies))

        async with _httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.post(
                "https://www.rami-levy.co.il/api/v2/cart",
                headers=headers,
                json={"store": str(store), "isClub": 0, "supplyAt": tomorrow,
                      "items": normalized, "meta": None},
            )

        await observer.capture_screenshot(session_id, page, "after_remove_item")

        ret = {
            "status": "success",
            "removed_id": pid,
            "neg_qty_sent": neg_qty,
            "message": f"Item {pid} removed (qty {neg_qty}). Call read_cart to verify.",
        }

        observer.log_tool_end(session_id, "remove_cart_item", ret)
        observer.log_state_change(session_id, f"Removed item {product_id}")
        return ret

    except Exception as e:
        logger.error("Remove item failed: %s", e, exc_info=True)
        observer.log_error(session_id, "remove_cart_item", str(e), {"product_id": product_id})
        return {"status": "error", "message": f"Failed to remove item: {e}"}
