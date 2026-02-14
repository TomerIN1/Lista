"""Web search tools for store discovery.

Provides tools for the Store Navigator agent to find store URLs and information.
"""

from __future__ import annotations

import json

from pricepilot.config import ISRAELI_SUPERMARKETS


async def get_available_stores() -> str:
    """Get the list of known Israeli supermarket chains with their details.

    Returns a JSON list of stores with id, name, Hebrew name, URL, and delivery fee.
    """
    return json.dumps(ISRAELI_SUPERMARKETS)


async def search_store_url(store_name: str) -> str:
    """Search for a store's online shopping URL.

    In production this would use Google Search API. Currently returns
    known URLs for Israeli supermarkets or a placeholder for unknown stores.

    Args:
        store_name: Name of the store to search for.
    """
    # Check known stores first
    name_lower = store_name.lower()
    for store in ISRAELI_SUPERMARKETS:
        if (
            name_lower in store["name"].lower()
            or name_lower in store.get("name_he", "")
            or name_lower in store["id"]
        ):
            return json.dumps({
                "found": True,
                "store_id": store["id"],
                "name": store["name"],
                "name_he": store.get("name_he", ""),
                "url": store.get("url", ""),
            })

    return json.dumps({
        "found": False,
        "message": f"Store '{store_name}' not found in known stores. "
        "The browser agent can try navigating to the store's website directly.",
    })


async def confirm_store(store_id: str, confirmed: bool) -> str:
    """Mark a store as confirmed or rejected by the user.

    Args:
        store_id: The store identifier.
        confirmed: Whether the user confirmed this store.
    """
    return json.dumps({
        "store_id": store_id,
        "confirmed": confirmed,
        "message": f"Store {store_id} {'confirmed' if confirmed else 'rejected'}.",
    })
