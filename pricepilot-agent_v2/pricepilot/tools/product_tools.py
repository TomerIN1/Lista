"""Product resolution tools.

These tools resolve Lista items (barcode + name) to store-internal product IDs.
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
