from __future__ import annotations
"""Product search tools using Rami Levy catalog API (httpx, no auth needed)."""

import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)

CATALOG_URL = f"{settings.rami_levy_base_url}/api/catalog"
SEARCH_TIMEOUT = 15.0


async def search_products(query: str, store_id: int = 0, max_results: int = 5) -> dict:
    """Search for products in the Rami Levy catalog by name or barcode.

    Args:
        query: Product name in Hebrew or English, or a barcode number.
        store_id: Store branch ID. Uses the default store if 0.
        max_results: Maximum number of results to return (1-20).

    Returns:
        dict with status and list of matching products.
    """
    if not query or not query.strip():
        return {"status": "error", "message": "Search query cannot be empty."}

    effective_store = store_id if store_id > 0 else settings.rami_levy_default_store
    max_results = max(1, min(max_results, 20))

    # Detect if query looks like a barcode (all digits)
    search_type = "barcode" if query.strip().isdigit() else "name"

    payload = {
        "store": str(effective_store),
        "q": query.strip(),
        "from": "0",
        "size": str(max_results),
        "type": search_type,
    }

    try:
        async with httpx.AsyncClient(timeout=SEARCH_TIMEOUT) as client:
            resp = await client.post(CATALOG_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException:
        logger.warning("Search timed out for query: %s", query)
        return {"status": "error", "message": "Search request timed out. Try again."}
    except httpx.HTTPStatusError as e:
        logger.error("Search HTTP error: %s", e)
        return {"status": "error", "message": f"Search failed with HTTP {e.response.status_code}."}
    except Exception as e:
        logger.error("Search unexpected error: %s", e)
        return {"status": "error", "message": "Search failed unexpectedly."}

    # Parse results
    products = []
    items = data if isinstance(data, list) else data.get("data", data.get("items", []))
    if not isinstance(items, list):
        items = []

    for item in items[:max_results]:
        if not isinstance(item, dict):
            continue
        prop = item.get("prop", {})
        is_weighted = bool(prop.get("sw_shakil") or prop.get("by_kilo"))
        multiplication = item.get("multiplication", 1)
        product = {
            "product_id": item.get("id", ""),
            "barcode": str(item.get("barcode", "")),
            "name": item.get("name", ""),
            "price": item.get("price1") or item.get("price2") or item.get("price", 0),
            "in_stock": item.get("in_stock", True),
            "is_weighted": is_weighted,
            "multiplication": multiplication,
            "unit_info": f"{'per kg, step=' + str(multiplication) + 'kg' if is_weighted else 'per unit'}",
        }
        if "store_price" in item:
            product["store_price"] = item["store_price"]
        if "club_price" in item:
            product["club_price"] = item["club_price"]
        products.append(product)

    if not products:
        return {
            "status": "success",
            "products": [],
            "message": f"No products found for '{query}'.",
        }

    return {
        "status": "success",
        "products": products,
        "count": len(products),
    }
