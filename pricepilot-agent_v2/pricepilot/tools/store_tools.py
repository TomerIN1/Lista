"""Store information tools.

These tools provide information about supported supermarket chains,
their operational status, and default store IDs.
"""

from __future__ import annotations

import logging
from typing import Any

from pricepilot.stores.registry import list_supported_stores as _list_stores

logger = logging.getLogger(__name__)


def list_supported_stores() -> dict[str, Any]:
    """List all supermarket chains that PricePilot supports.

    Returns store names in Hebrew and English, default branch IDs,
    and whether each store is currently operational. A store is
    operational if it has a default_store_id configured (stubs do not).

    Returns:
        Dict with list of supported stores.
    """
    stores = _list_stores()

    enriched: list[dict[str, Any]] = []
    for store in stores:
        enriched.append({
            "name": store["name"],
            "name_he": store["name_he"],
            "default_store_id": store["default_store_id"],
            "operational": bool(store["default_store_id"]),
        })

    return {
        "status": "success",
        "count": len(enriched),
        "stores": enriched,
    }
