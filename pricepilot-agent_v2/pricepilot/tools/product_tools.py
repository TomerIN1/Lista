"""Product resolution and discovery tools.

These tools resolve Lista items (barcode + name) to store-internal product IDs,
find alternative products, and modify the cart after preview.

Resolution strategy:
1. Search by barcode (exact match, fast, reliable)
2. Fall back to name search if barcode yields 0 results
3. If name search returns multiple candidates, the LLM agent disambiguates

The agent orchestrates the resolution loop:
- Calls resolve_products with the full item list
- For items needing disambiguation, the LLM picks the best match
- For items not found, the agent informs the user
"""

from __future__ import annotations

import logging
from typing import Any

from google.adk.tools import ToolContext

from pricepilot.stores import get_adapter

logger = logging.getLogger(__name__)


async def resolve_products(
    store_name: str,
    store_id: str,
    items: list[dict[str, Any]],
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Resolve a batch of Lista items to store product IDs.

    For each item, tries barcode search first, then name search.
    Returns resolved items, items needing disambiguation, and items not found.

    Args:
        store_name: Chain name (e.g. "Rami Levy").
        store_id: Branch ID (e.g. "331").
        items: List of dicts with keys: barcode, name, quantity, price (optional).
        tool_context: ADK ToolContext for state access.

    Returns:
        Dict with keys:
        - status: "success" or "error"
        - resolved: list of {barcode, store_product_id, store_name, quantity, price, method}
        - needs_disambiguation: list of {barcode, lista_name, candidates: [{id, name, price}]}
        - not_found: list of {barcode, lista_name, reason}
        - summary: human-readable summary string
    """
    adapter = get_adapter(store_name)
    if adapter is None:
        return {
            "status": "error",
            "error": f"Store '{store_name}' is not supported yet.",
        }

    resolved: list[dict[str, Any]] = []
    needs_disambiguation: list[dict[str, Any]] = []
    not_found: list[dict[str, Any]] = []

    for item in items:
        barcode = str(item.get("barcode", ""))
        name = item.get("name", "")
        quantity = item.get("quantity", 1)

        # Step 1: Try barcode search
        if barcode:
            try:
                products = await adapter.search_by_barcode(barcode, store_id)
            except NotImplementedError as exc:
                return {"status": "error", "error": str(exc)}

            if len(products) == 1:
                p = products[0]
                resolved.append({
                    "barcode": barcode,
                    "store_product_id": p.store_product_id,
                    "store_product_name": p.name,
                    "quantity": quantity,
                    "price": p.price,
                    "in_stock": p.in_stock,
                    "promotion": p.promotion.description if p.promotion else None,
                    "method": "barcode",
                })
                continue
            if len(products) > 1:
                # Unusual — barcode returned multiple results
                needs_disambiguation.append({
                    "barcode": barcode,
                    "lista_name": name,
                    "quantity": quantity,
                    "candidates": [
                        {
                            "store_product_id": p.store_product_id,
                            "name": p.name,
                            "price": p.price,
                            "in_stock": p.in_stock,
                        }
                        for p in products[:5]
                    ],
                })
                continue

        # Step 2: Barcode not found or not provided — search by name
        if name:
            try:
                products = await adapter.search_by_name(name, store_id, limit=5)
            except NotImplementedError as exc:
                return {"status": "error", "error": str(exc)}

            if len(products) == 0:
                not_found.append({
                    "barcode": barcode,
                    "lista_name": name,
                    "reason": "No results for barcode or name search",
                })
            elif len(products) == 1:
                p = products[0]
                resolved.append({
                    "barcode": barcode,
                    "store_product_id": p.store_product_id,
                    "store_product_name": p.name,
                    "quantity": quantity,
                    "price": p.price,
                    "in_stock": p.in_stock,
                    "promotion": p.promotion.description if p.promotion else None,
                    "method": "name_exact",
                })
            else:
                # Multiple candidates — agent needs to disambiguate
                needs_disambiguation.append({
                    "barcode": barcode,
                    "lista_name": name,
                    "quantity": quantity,
                    "candidates": [
                        {
                            "store_product_id": p.store_product_id,
                            "name": p.name,
                            "price": p.price,
                            "in_stock": p.in_stock,
                        }
                        for p in products[:5]
                    ],
                })
        else:
            not_found.append({
                "barcode": barcode,
                "lista_name": name,
                "reason": "No barcode and no name provided",
            })

    # Save to session state for later phases
    tool_context.state["resolved_items"] = resolved
    tool_context.state["unresolved_items"] = needs_disambiguation
    tool_context.state["not_found_items"] = not_found

    total = len(items)
    summary = (
        f"Resolved {len(resolved)}/{total} items. "
        f"{len(needs_disambiguation)} need your help choosing. "
        f"{len(not_found)} not found."
    )

    return {
        "status": "success",
        "resolved": resolved,
        "needs_disambiguation": needs_disambiguation,
        "not_found": not_found,
        "summary": summary,
    }


async def search_product_by_barcode(
    store_name: str,
    store_id: str,
    barcode: str,
) -> dict[str, Any]:
    """Search a single product by barcode on a store.

    Use this for targeted lookups or re-checks.

    Args:
        store_name: Chain name.
        store_id: Branch ID.
        barcode: Product barcode (EAN).

    Returns:
        Dict with product info or error.
    """
    adapter = get_adapter(store_name)
    if adapter is None:
        return {"status": "error", "error": f"Store '{store_name}' is not supported."}

    try:
        products = await adapter.search_by_barcode(barcode, store_id)
    except NotImplementedError as exc:
        return {"status": "error", "error": str(exc)}

    if not products:
        return {"status": "success", "found": False, "barcode": barcode}

    p = products[0]
    return {
        "status": "success",
        "found": True,
        "barcode": barcode,
        "store_product_id": p.store_product_id,
        "name": p.name,
        "price": p.price,
        "in_stock": p.in_stock,
        "promotion": p.promotion.description if p.promotion else None,
    }


async def search_product_by_name(
    store_name: str,
    store_id: str,
    name: str,
    limit: int = 5,
) -> dict[str, Any]:
    """Search products by Hebrew name on a store.

    Returns up to `limit` results for the agent to evaluate.

    Args:
        store_name: Chain name.
        store_id: Branch ID.
        name: Hebrew product name or search query.
        limit: Max results to return.

    Returns:
        Dict with list of candidates.
    """
    adapter = get_adapter(store_name)
    if adapter is None:
        return {"status": "error", "error": f"Store '{store_name}' is not supported."}

    try:
        products = await adapter.search_by_name(name, store_id, limit=limit)
    except NotImplementedError as exc:
        return {"status": "error", "error": str(exc)}

    return {
        "status": "success",
        "query": name,
        "count": len(products),
        "products": [
            {
                "store_product_id": p.store_product_id,
                "name": p.name,
                "price": p.price,
                "in_stock": p.in_stock,
                "promotion": p.promotion.description if p.promotion else None,
            }
            for p in products
        ],
    }


async def find_alternatives(
    store_name: str,
    store_id: str,
    product_name: str,
    reason: str,
    tool_context: ToolContext,
    original_price: float = 0.0,
    limit: int = 5,
) -> dict[str, Any]:
    """Find alternative products when an item is out of stock, too expensive, or the user wants a different option.

    Searches by Hebrew product name and filters results based on the reason:
    - "cheaper": only returns alternatives priced below original_price.
    - "out_of_stock": only returns in-stock alternatives.
    - "preference": returns all matching alternatives.

    Args:
        store_name: Chain name (e.g. "Rami Levy").
        store_id: Branch ID (e.g. "331").
        product_name: Hebrew product name to search for alternatives.
        reason: Why alternatives are needed: "out_of_stock", "cheaper", or "preference".
        original_price: Price of the original product (required when reason is "cheaper").
        limit: Max number of alternatives to return.

    Returns:
        Dict with list of alternative products or error.
    """
    adapter = get_adapter(store_name)
    if adapter is None:
        return {"status": "error", "error": f"Store '{store_name}' is not supported."}

    if reason == "cheaper" and original_price <= 0:
        return {
            "status": "error",
            "error": "original_price is required when reason is 'cheaper'.",
        }

    try:
        # Fetch more than needed so we can filter and still return up to `limit`
        fetch_limit = limit * 3 if reason in ("cheaper", "out_of_stock") else limit
        products = await adapter.search_by_name(
            product_name, store_id, limit=fetch_limit
        )
    except NotImplementedError as exc:
        return {"status": "error", "error": str(exc)}

    if not products:
        return {
            "status": "success",
            "query": product_name,
            "reason": reason,
            "count": 0,
            "alternatives": [],
            "message": "לא נמצאו חלופות למוצר זה.",
        }

    # Apply reason-based filtering
    if reason == "cheaper":
        products = [p for p in products if p.price < original_price]
    elif reason == "out_of_stock":
        products = [p for p in products if p.in_stock]

    alternatives = [
        {
            "store_product_id": p.store_product_id,
            "name": p.name,
            "price": p.price,
            "in_stock": p.in_stock,
            "promotion": p.promotion.description if p.promotion else None,
        }
        for p in products[:limit]
    ]

    return {
        "status": "success",
        "query": product_name,
        "reason": reason,
        "original_price": original_price if reason == "cheaper" else None,
        "count": len(alternatives),
        "alternatives": alternatives,
    }


async def modify_cart(
    store_name: str,
    store_id: str,
    action: str,
    store_product_id: str,
    tool_context: ToolContext,
    quantity: int = 1,
) -> dict[str, Any]:
    """Add, remove, or update quantity of a single item in the cart after preview.

    Modifies the resolved_items and cart_items_map in session state, then
    recalculates the cart to return an updated preview.

    Actions:
    - "add": search for the product, add it to the cart.
    - "remove": remove the product from the cart.
    - "update_quantity": change the quantity of an existing product.

    Args:
        store_name: Chain name (e.g. "Rami Levy").
        store_id: Branch ID (e.g. "331").
        action: One of "add", "remove", or "update_quantity".
        store_product_id: The store-internal product ID to modify.
        quantity: Desired quantity (for "add" and "update_quantity"). Ignored for "remove".

    Returns:
        Dict with updated cart preview or error.
    """
    adapter = get_adapter(store_name)
    if adapter is None:
        return {"status": "error", "error": f"Store '{store_name}' is not supported."}

    if action not in ("add", "remove", "update_quantity"):
        return {
            "status": "error",
            "error": f"Invalid action '{action}'. Must be 'add', 'remove', or 'update_quantity'.",
        }

    resolved: list[dict[str, Any]] = list(tool_context.state.get("resolved_items", []))
    items_map: dict[str, int] = dict(tool_context.state.get("cart_items_map", {}))

    if action == "add":
        if quantity < 1:
            return {"status": "error", "error": "Quantity must be at least 1."}

        # Check if already in cart — if so, just increase quantity
        existing = next(
            (r for r in resolved if r["store_product_id"] == store_product_id),
            None,
        )
        if existing:
            existing["quantity"] = existing.get("quantity", 1) + quantity
            items_map[store_product_id] = items_map.get(store_product_id, 0) + quantity
        else:
            # Need to look up product details from the store
            try:
                products = await adapter.search_by_barcode(store_product_id, store_id)
                if not products:
                    # Try treating the ID as a name search fallback
                    products = await adapter.search_by_name(
                        store_product_id, store_id, limit=1
                    )
            except NotImplementedError as exc:
                return {"status": "error", "error": str(exc)}

            if not products:
                return {
                    "status": "error",
                    "error": f"לא נמצא מוצר עם מזהה {store_product_id}.",
                }

            p = products[0]
            resolved.append({
                "barcode": p.barcode,
                "store_product_id": p.store_product_id,
                "store_product_name": p.name,
                "quantity": quantity,
                "price": p.price,
                "in_stock": p.in_stock,
                "promotion": p.promotion.description if p.promotion else None,
                "method": "manual_add",
            })
            items_map[p.store_product_id] = quantity

    elif action == "remove":
        original_len = len(resolved)
        resolved = [
            r for r in resolved if r["store_product_id"] != store_product_id
        ]
        if len(resolved) == original_len:
            return {
                "status": "error",
                "error": f"המוצר {store_product_id} לא נמצא בעגלה.",
            }
        items_map.pop(store_product_id, None)

    elif action == "update_quantity":
        if quantity < 1:
            return {
                "status": "error",
                "error": "Quantity must be at least 1. Use 'remove' to delete an item.",
            }
        target = next(
            (r for r in resolved if r["store_product_id"] == store_product_id),
            None,
        )
        if target is None:
            return {
                "status": "error",
                "error": f"המוצר {store_product_id} לא נמצא בעגלה.",
            }
        target["quantity"] = quantity
        items_map[store_product_id] = quantity

    # Persist updated state
    tool_context.state["resolved_items"] = resolved
    tool_context.state["cart_items_map"] = items_map

    if not items_map:
        # Cart is now empty
        tool_context.state["cart_preview"] = None
        return {
            "status": "success",
            "action": action,
            "message": "העגלה ריקה.",
            "total_price": 0,
            "delivery_fee": 0,
            "item_count": 0,
            "items": [],
            "promotions": [],
        }

    # Recalculate the cart
    auth_token = tool_context.state.get("auth_token")
    try:
        preview = await adapter.calculate_cart(
            store_id, items_map, auth_token=auth_token
        )
    except (RuntimeError, NotImplementedError) as exc:
        return {"status": "error", "error": str(exc)}

    tool_context.state["cart_preview"] = preview.model_dump()

    # Build summary (same shape as calculate_cart_preview)
    product_lines = []
    for ci in preview.items:
        if ci.is_delivery_fee:
            continue
        line = f"  {ci.name}: {ci.quantity}x = {ci.total_price:.2f} NIS"
        if ci.savings > 0:
            line += f" (saved {ci.savings:.2f})"
        product_lines.append(line)

    summary = (
        f"Cart updated ({action}):\n"
        + "\n".join(product_lines)
        + f"\n\nSubtotal: {preview.total_price - preview.delivery_fee:.2f} NIS"
        + f"\nDelivery: {preview.delivery_fee:.2f} NIS"
        + f"\nTotal: {preview.total_price:.2f} NIS"
    )

    return {
        "status": "success",
        "action": action,
        "total_price": preview.total_price,
        "delivery_fee": preview.delivery_fee,
        "club_price": preview.club_price,
        "item_count": preview.item_count,
        "items": [ci.model_dump() for ci in preview.items if not ci.is_delivery_fee],
        "promotions": preview.promotions_applied,
        "summary": summary,
    }
