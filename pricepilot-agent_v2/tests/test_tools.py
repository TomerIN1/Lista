"""Tests for PricePilot tools.

Tests the tool functions directly with a FakeToolContext, using respx
to mock store API HTTP calls. Verifies tool return shapes, state updates,
and error handling.
"""

from __future__ import annotations

import pytest
import respx
import httpx

from pricepilot.stores.rami_levy import CATALOG_ENDPOINT, CART_ENDPOINT
from pricepilot.tools.product_tools import (
    resolve_products,
    search_product_by_barcode,
    search_product_by_name,
)
from pricepilot.tools.cart_tools import (
    calculate_cart_preview,
    persist_cart_to_store,
    get_checkout_info,
)


class FakeToolContext:
    """Minimal mock of google.adk.tools.ToolContext for testing tools directly."""

    def __init__(self, initial_state: dict | None = None):
        self.state: dict = initial_state or {}


# ------------------------------------------------------------------
# Product tools
# ------------------------------------------------------------------


@respx.mock
@pytest.mark.asyncio
async def test_resolve_products_returns_status_success():
    """resolve_products returns status: success on the happy path."""
    respx.post(CATALOG_ENDPOINT).mock(
        return_value=httpx.Response(
            200,
            json={
                "total": 1,
                "data": [
                    {
                        "id": 358996,
                        "name": "ארלה גבינת שמנת טבעי 200 גר",
                        "barcode": 5711953106583,
                        "price": {"price": 14.9},
                        "images": {},
                        "available_in": [331],
                        "sale": [],
                    }
                ],
            },
        )
    )

    ctx = FakeToolContext()
    result = await resolve_products(
        store_name="Rami Levy",
        store_id="331",
        items=[{"barcode": "5711953106583", "name": "ארלה גבינת שמנת", "quantity": 1}],
        tool_context=ctx,
    )

    assert result["status"] == "success"
    assert len(result["resolved"]) == 1
    assert result["resolved"][0]["store_product_id"] == "358996"
    assert "resolved_items" in ctx.state


@respx.mock
@pytest.mark.asyncio
async def test_resolve_products_unsupported_store():
    """resolve_products returns error for unknown store."""
    ctx = FakeToolContext()
    result = await resolve_products(
        store_name="Unknown Store",
        store_id="999",
        items=[{"barcode": "123", "name": "test", "quantity": 1}],
        tool_context=ctx,
    )

    assert result["status"] == "error"
    assert "not supported" in result["error"]


@respx.mock
@pytest.mark.asyncio
async def test_search_product_by_barcode_found():
    """search_product_by_barcode returns product details when found."""
    respx.post(CATALOG_ENDPOINT).mock(
        return_value=httpx.Response(
            200,
            json={
                "total": 1,
                "data": [
                    {
                        "id": 100,
                        "name": "חלב תנובה 3%",
                        "barcode": 7290000001,
                        "price": {"price": 6.9},
                        "images": {},
                        "available_in": [331],
                        "sale": [],
                    }
                ],
            },
        )
    )

    result = await search_product_by_barcode(
        store_name="Rami Levy", store_id="331", barcode="7290000001"
    )

    assert result["status"] == "success"
    assert result["found"] is True
    assert result["store_product_id"] == "100"
    assert result["price"] == 6.9


@respx.mock
@pytest.mark.asyncio
async def test_search_product_by_barcode_not_found():
    """search_product_by_barcode returns found: False when not found."""
    respx.post(CATALOG_ENDPOINT).mock(
        return_value=httpx.Response(200, json={"total": 0, "data": []})
    )

    result = await search_product_by_barcode(
        store_name="Rami Levy", store_id="331", barcode="0000000000"
    )

    assert result["status"] == "success"
    assert result["found"] is False


@respx.mock
@pytest.mark.asyncio
async def test_search_product_by_name_returns_candidates():
    """search_product_by_name returns list of candidates."""
    respx.post(CATALOG_ENDPOINT).mock(
        return_value=httpx.Response(
            200,
            json={
                "total": 2,
                "data": [
                    {
                        "id": 100,
                        "name": "חלב תנובה 3% 1 ליטר",
                        "barcode": 7290000001,
                        "price": {"price": 6.9},
                        "images": {},
                        "available_in": [331],
                        "sale": [],
                    },
                    {
                        "id": 101,
                        "name": "חלב תנובה 1% 1 ליטר",
                        "barcode": 7290000002,
                        "price": {"price": 6.5},
                        "images": {},
                        "available_in": [331],
                        "sale": [],
                    },
                ],
            },
        )
    )

    result = await search_product_by_name(
        store_name="Rami Levy", store_id="331", name="חלב תנובה"
    )

    assert result["status"] == "success"
    assert result["count"] == 2
    assert len(result["products"]) == 2


def test_search_product_by_name_unsupported_store():
    """search_product_by_name is sync-callable for unsupported store check."""
    import asyncio

    result = asyncio.run(
        search_product_by_name(
            store_name="Nonexistent", store_id="0", name="test"
        )
    )
    assert result["status"] == "error"


# ------------------------------------------------------------------
# Cart tools
# ------------------------------------------------------------------


@respx.mock
@pytest.mark.asyncio
async def test_calculate_cart_preview_success():
    """calculate_cart_preview returns pricing when resolved items exist."""
    respx.post(CART_ENDPOINT).mock(
        return_value=httpx.Response(
            200,
            json={
                "status": 200,
                "price": 44.8,
                "priceClub": 44.8,
                "discount": 0,
                "quantity": 1,
                "items": [
                    {
                        "id": 164854,
                        "name": "מחיר משלוח",
                        "price": 29.9,
                        "quantity": 1,
                        "FormatedTotalPrice": 29.9,
                        "FormatedSavePrice": 0,
                        "is_delivery": True,
                    },
                    {
                        "id": 358996,
                        "name": "ארלה גבינת שמנת טבעי 200 גר",
                        "price": 14.9,
                        "quantity": 1,
                        "FormatedTotalPrice": 14.9,
                        "FormatedSavePrice": 0,
                    },
                ],
                "sales": [],
            },
        )
    )

    ctx = FakeToolContext(
        initial_state={
            "resolved_items": [
                {"store_product_id": "358996", "quantity": 1},
            ]
        }
    )

    result = await calculate_cart_preview(
        store_name="Rami Levy", store_id="331", tool_context=ctx
    )

    assert result["status"] == "success"
    assert result["total_price"] == 44.8
    assert result["delivery_fee"] == 29.9
    assert "cart_preview" in ctx.state
    assert "cart_items_map" in ctx.state


@pytest.mark.asyncio
async def test_calculate_cart_preview_no_resolved_items():
    """calculate_cart_preview returns error when no items are resolved."""
    ctx = FakeToolContext()
    result = await calculate_cart_preview(
        store_name="Rami Levy", store_id="331", tool_context=ctx
    )

    assert result["status"] == "error"
    assert "No resolved items" in result["error"]


@respx.mock
@pytest.mark.asyncio
async def test_persist_cart_success():
    """persist_cart_to_store returns success with checkout URL."""
    # First mock: token verification (empty cart call)
    # Second mock: actual persist
    respx.post(CART_ENDPOINT).mock(
        return_value=httpx.Response(
            200, json={"status": 200, "price": 14.9, "items": []}
        )
    )

    ctx = FakeToolContext(
        initial_state={"cart_items_map": {"358996": 1}}
    )

    result = await persist_cart_to_store(
        store_name="Rami Levy",
        store_id="331",
        auth_token="valid-jwt",
        tool_context=ctx,
    )

    assert result["status"] == "success"
    assert "checkout" in result["checkout_url"]
    assert ctx.state["cart_persisted"] is True
    assert ctx.state["checkout_url"] is not None


@pytest.mark.asyncio
async def test_persist_cart_no_items():
    """persist_cart_to_store returns error when no cart items exist."""
    ctx = FakeToolContext()
    result = await persist_cart_to_store(
        store_name="Rami Levy",
        store_id="331",
        auth_token="some-token",
        tool_context=ctx,
    )

    assert result["status"] == "error"
    assert "No cart to persist" in result["error"]


@pytest.mark.asyncio
async def test_get_checkout_info_rami_levy():
    """get_checkout_info returns login config for Rami Levy."""
    ctx = FakeToolContext()
    result = await get_checkout_info(
        store_name="Rami Levy", tool_context=ctx
    )

    assert result["status"] == "success"
    assert "checkout" in result["checkout_url"]
    assert "OpenLoginModal" in result["login_config"]["js_trigger"]
    assert "localStorage.ramilevy" in result["login_config"]["token_extraction_js"]
    assert result["has_auth_token"] is False


@pytest.mark.asyncio
async def test_get_checkout_info_unsupported_store():
    """get_checkout_info returns error for unsupported store."""
    ctx = FakeToolContext()
    result = await get_checkout_info(
        store_name="Nonexistent Store", tool_context=ctx
    )

    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_get_checkout_info_stub_store():
    """get_checkout_info returns error for stub (unimplemented) store."""
    ctx = FakeToolContext()
    result = await get_checkout_info(
        store_name="Shufersal", tool_context=ctx
    )

    assert result["status"] == "error"
    assert "not implemented" in result["error"].lower()
