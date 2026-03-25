"""Store adapters for Israeli supermarket chains."""

from pricepilot.stores.base import StoreAdapter
from pricepilot.stores.h_cohen import HCohenAdapter
from pricepilot.stores.market_warehouses import MarketWarehousesAdapter
from pricepilot.stores.rami_levy import RamiLevyAdapter
from pricepilot.stores.registry import get_adapter, list_supported_stores
from pricepilot.stores.shufersal import ShufersalAdapter
from pricepilot.stores.victory import VictoryAdapter

__all__ = [
    "StoreAdapter",
    "RamiLevyAdapter",
    "ShufersalAdapter",
    "VictoryAdapter",
    "MarketWarehousesAdapter",
    "HCohenAdapter",
    "get_adapter",
    "list_supported_stores",
]
