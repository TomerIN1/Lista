"""Store adapter registry.

Maps store names (English, Hebrew, slug variants) to adapter instances.
Only Rami Levy is fully implemented. All others are stubs that raise
NotImplementedError on any operation.

To add a new store:
1. Create the adapter in stores/<name>.py
2. Add entries to _ADAPTERS and _CANONICAL below
3. Update the __init__.py exports
"""

from __future__ import annotations

import logging

from pricepilot.stores.base import StoreAdapter
from pricepilot.stores.h_cohen import HCohenAdapter
from pricepilot.stores.market_warehouses import MarketWarehousesAdapter
from pricepilot.stores.rami_levy import RamiLevyAdapter
from pricepilot.stores.shufersal import ShufersalAdapter
from pricepilot.stores.victory import VictoryAdapter

logger = logging.getLogger(__name__)

# Singleton adapters (stateless, safe to share across requests)
_rami_levy = RamiLevyAdapter()
_shufersal = ShufersalAdapter()
_victory = VictoryAdapter()
_market_warehouses = MarketWarehousesAdapter()
_h_cohen = HCohenAdapter()

_ADAPTERS: dict[str, StoreAdapter] = {
    "rami levy": _rami_levy,
    "rami_levy": _rami_levy,
    "ramilevy": _rami_levy,
    "shufersal": _shufersal,
    "victory": _victory,
    "market warehouses": _market_warehouses,
    "market_warehouses": _market_warehouses,
    "machsanei hashuk": _market_warehouses,
    "h. cohen": _h_cohen,
    "h cohen": _h_cohen,
    "h_cohen": _h_cohen,
}

# Canonical name mapping (including Hebrew keys)
_CANONICAL: dict[str, str] = {
    "rami levy": "rami levy",
    "rami_levy": "rami levy",
    "ramilevy": "rami levy",
    "רמי לוי": "rami levy",
    "shufersal": "shufersal",
    "שופרסל": "shufersal",
    "victory": "victory",
    "ויקטורי": "victory",
    "market warehouses": "market warehouses",
    "market_warehouses": "market warehouses",
    "machsanei hashuk": "market warehouses",
    "מחסני השוק": "market warehouses",
    "h. cohen": "h. cohen",
    "h cohen": "h. cohen",
    "h_cohen": "h. cohen",
    "ח. כהן": "h. cohen",
    "ח כהן": "h. cohen",
}


def get_adapter(store_name: str) -> StoreAdapter | None:
    """Look up the adapter for a store by name (case-insensitive, Hebrew supported).

    Returns None if the store is not recognized at all. Note that stub adapters
    will be returned for recognized-but-unimplemented stores; callers should
    handle NotImplementedError from those adapters.
    """
    key = store_name.lower().strip()

    # Direct lookup
    if key in _ADAPTERS:
        return _ADAPTERS[key]

    # Try canonical mapping (for Hebrew names and aliases)
    canonical = _CANONICAL.get(key)
    if canonical and canonical in _ADAPTERS:
        return _ADAPTERS[canonical]

    # Fuzzy: check if key is a substring of any adapter key
    for adapter_key, adapter in _ADAPTERS.items():
        if key in adapter_key or adapter_key in key:
            return adapter

    logger.warning("No adapter found for store: %s", store_name)
    return None


def list_supported_stores() -> list[dict[str, str]]:
    """Return list of all registered stores with names in both languages.

    Includes both fully implemented and stub stores. Check the adapter's
    methods to determine if it's actually operational.
    """
    seen: set[str] = set()
    stores: list[dict[str, str]] = []
    for _key, adapter in _ADAPTERS.items():
        if adapter.chain_name not in seen:
            seen.add(adapter.chain_name)
            stores.append({
                "name": adapter.chain_name,
                "name_he": adapter.chain_name_he,
                "default_store_id": adapter.default_store_id,
            })
    return stores
