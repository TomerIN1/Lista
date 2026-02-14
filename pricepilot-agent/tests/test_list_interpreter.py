"""Tests for the list interpreter tool."""

import json

import pytest

from pricepilot.tools.search_tools import get_available_stores


@pytest.mark.asyncio
async def test_parse_shopping_list_basic():
    from pricepilot.agents.list_interpreter import parse_shopping_list

    result = await parse_shopping_list("milk\nbread\ntomatoes")
    items = json.loads(result)

    assert len(items) == 3
    assert items[0]["name"] == "milk"
    assert items[1]["name"] == "bread"
    assert items[2]["name"] == "tomatoes"
    assert all(item["category"] == "grocery" for item in items)
    assert all(item["quantity"] == 1 for item in items)


@pytest.mark.asyncio
async def test_parse_shopping_list_comma_separated():
    from pricepilot.agents.list_interpreter import parse_shopping_list

    result = await parse_shopping_list("eggs, butter, cheese")
    items = json.loads(result)

    assert len(items) == 3
    assert items[0]["name"] == "eggs"
    assert items[1]["name"] == "butter"
    assert items[2]["name"] == "cheese"


@pytest.mark.asyncio
async def test_parse_shopping_list_hebrew():
    from pricepilot.agents.list_interpreter import parse_shopping_list

    result = await parse_shopping_list("חלב\nלחם\nעגבניות")
    items = json.loads(result)

    assert len(items) == 3
    assert items[0]["name"] == "חלב"


@pytest.mark.asyncio
async def test_parse_shopping_list_empty():
    from pricepilot.agents.list_interpreter import parse_shopping_list

    result = await parse_shopping_list("")
    items = json.loads(result)

    assert len(items) == 0


@pytest.mark.asyncio
async def test_get_available_stores():
    result = await get_available_stores()
    stores = json.loads(result)

    assert len(stores) >= 4
    store_ids = [s["id"] for s in stores]
    assert "shufersal" in store_ids
    assert "rami-levy" in store_ids
    assert "victory" in store_ids
