"""Tests for the store adapter registry."""

import pytest

from pricepilot.stores import get_adapter, list_supported_stores
from pricepilot.stores.rami_levy import RamiLevyAdapter
from pricepilot.stores.shufersal import ShufersalAdapter
from pricepilot.stores.victory import VictoryAdapter
from pricepilot.stores.market_warehouses import MarketWarehousesAdapter
from pricepilot.stores.h_cohen import HCohenAdapter


# ------------------------------------------------------------------
# Rami Levy lookups
# ------------------------------------------------------------------


def test_get_adapter_english():
    adapter = get_adapter("Rami Levy")
    assert adapter is not None
    assert isinstance(adapter, RamiLevyAdapter)


def test_get_adapter_lowercase():
    adapter = get_adapter("rami levy")
    assert adapter is not None
    assert isinstance(adapter, RamiLevyAdapter)


def test_get_adapter_underscore():
    adapter = get_adapter("rami_levy")
    assert adapter is not None
    assert isinstance(adapter, RamiLevyAdapter)


def test_get_adapter_hebrew_rami_levy():
    adapter = get_adapter("רמי לוי")
    assert adapter is not None
    assert isinstance(adapter, RamiLevyAdapter)


# ------------------------------------------------------------------
# Stub store lookups
# ------------------------------------------------------------------


def test_get_adapter_shufersal():
    adapter = get_adapter("Shufersal")
    assert adapter is not None
    assert isinstance(adapter, ShufersalAdapter)


def test_get_adapter_shufersal_hebrew():
    adapter = get_adapter("שופרסל")
    assert adapter is not None
    assert isinstance(adapter, ShufersalAdapter)


def test_get_adapter_victory():
    adapter = get_adapter("Victory")
    assert adapter is not None
    assert isinstance(adapter, VictoryAdapter)


def test_get_adapter_victory_hebrew():
    adapter = get_adapter("ויקטורי")
    assert adapter is not None
    assert isinstance(adapter, VictoryAdapter)


def test_get_adapter_market_warehouses():
    adapter = get_adapter("Market Warehouses")
    assert adapter is not None
    assert isinstance(adapter, MarketWarehousesAdapter)


def test_get_adapter_market_warehouses_hebrew():
    adapter = get_adapter("מחסני השוק")
    assert adapter is not None
    assert isinstance(adapter, MarketWarehousesAdapter)


def test_get_adapter_h_cohen():
    adapter = get_adapter("H. Cohen")
    assert adapter is not None
    assert isinstance(adapter, HCohenAdapter)


def test_get_adapter_h_cohen_hebrew():
    adapter = get_adapter("ח. כהן")
    assert adapter is not None
    assert isinstance(adapter, HCohenAdapter)


# ------------------------------------------------------------------
# Stub stores raise NotImplementedError
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_shufersal_stub_raises():
    adapter = get_adapter("Shufersal")
    with pytest.raises(NotImplementedError):
        await adapter.search_by_barcode("123")


@pytest.mark.asyncio
async def test_victory_stub_raises():
    adapter = get_adapter("Victory")
    with pytest.raises(NotImplementedError):
        await adapter.search_by_name("test")


@pytest.mark.asyncio
async def test_market_warehouses_stub_raises():
    adapter = get_adapter("Market Warehouses")
    with pytest.raises(NotImplementedError):
        await adapter.calculate_cart("1", {"1": 1})


@pytest.mark.asyncio
async def test_h_cohen_stub_raises():
    adapter = get_adapter("H. Cohen")
    with pytest.raises(NotImplementedError):
        await adapter.persist_cart("1", {"1": 1}, "token")


# ------------------------------------------------------------------
# Negative cases
# ------------------------------------------------------------------


def test_get_adapter_unsupported():
    adapter = get_adapter("nonexistent store")
    assert adapter is None


# ------------------------------------------------------------------
# List stores
# ------------------------------------------------------------------


def test_list_supported_stores():
    stores = list_supported_stores()
    assert len(stores) >= 5
    names = {s["name"] for s in stores}
    assert "Rami Levy" in names
    assert "Shufersal" in names
    assert "Victory" in names
    assert "Market Warehouses" in names
    assert "H. Cohen" in names


def test_list_supported_stores_has_hebrew():
    stores = list_supported_stores()
    rami = next(s for s in stores if s["name"] == "Rami Levy")
    assert rami["name_he"] == "רמי לוי"
    assert rami["default_store_id"] == "331"
