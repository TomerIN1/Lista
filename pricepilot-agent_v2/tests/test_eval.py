"""Evaluation test cases for PricePilot agent.

These tests verify the agent's end-to-end behavior using mocked store APIs.
They test the agent's ability to:
1. Resolve products correctly
2. Handle disambiguation
3. Handle missing items
4. Generate correct cart previews
5. Guide auth flow

Run with: pytest tests/test_eval.py -v
"""

from __future__ import annotations

import pytest
import respx
import httpx

from pricepilot.stores.rami_levy import CATALOG_ENDPOINT, CART_ENDPOINT
from pricepilot.tools.product_tools import resolve_products
from pricepilot.tools.cart_tools import calculate_cart_preview


class FakeToolContext:
    """Minimal mock of google.adk.tools.ToolContext for testing tools directly."""

    def __init__(self, initial_state: dict | None = None):
        self.state: dict = initial_state or {}


# ------------------------------------------------------------------
# Eval: Product resolution
# ------------------------------------------------------------------


@respx.mock
@pytest.mark.asyncio
async def test_eval_resolve_all_by_barcode():
    """All items resolve by barcode — the happy path."""
    # Mock: each barcode returns exactly 1 result
    def catalog_handler(request):
        body = request.content.decode()
        if "5711953106583" in body:
            return httpx.Response(200, json={
                "total": 1,
                "data": [{
                    "id": 358996, "name": "ארלה גבינת שמנת טבעי 200 גר",
                    "barcode": 5711953106583, "price": {"price": 14.9},
                    "images": {}, "available_in": [331], "sale": [],
                }],
            })
        if "7290000001" in body:
            return httpx.Response(200, json={
                "total": 1,
                "data": [{
                    "id": 100, "name": "חלב תנובה 3% 1 ליטר",
                    "barcode": 7290000001, "price": {"price": 6.9},
                    "images": {}, "available_in": [331], "sale": [],
                }],
            })
        return httpx.Response(200, json={"total": 0, "data": []})

    respx.post(CATALOG_ENDPOINT).mock(side_effect=catalog_handler)

    ctx = FakeToolContext()
    result = await resolve_products(
        store_name="Rami Levy",
        store_id="331",
        items=[
            {"barcode": "5711953106583", "name": "ארלה גבינת שמנת", "quantity": 2},
            {"barcode": "7290000001", "name": "חלב תנובה", "quantity": 1},
        ],
        tool_context=ctx,
    )

    assert result["status"] == "success"
    assert len(result["resolved"]) == 2
    assert len(result["needs_disambiguation"]) == 0
    assert len(result["not_found"]) == 0
    assert result["resolved"][0]["method"] == "barcode"
    assert result["resolved"][0]["quantity"] == 2

    # State should be updated
    assert len(ctx.state["resolved_items"]) == 2


@respx.mock
@pytest.mark.asyncio
async def test_eval_resolve_with_name_fallback():
    """Barcode not found, falls back to name search with single result."""
    call_count = {"n": 0}

    def catalog_handler(request):
        call_count["n"] += 1
        body = request.content.decode()
        # First call: barcode search returns 0
        if "9999999999" in body:
            return httpx.Response(200, json={"total": 0, "data": []})
        # Second call: name search returns 1 result
        if "שוקולד" in body:
            return httpx.Response(200, json={
                "total": 1,
                "data": [{
                    "id": 500, "name": "שוקולד פרה 100 גר",
                    "barcode": 7290000500, "price": {"price": 8.9},
                    "images": {}, "available_in": [331], "sale": [],
                }],
            })
        return httpx.Response(200, json={"total": 0, "data": []})

    respx.post(CATALOG_ENDPOINT).mock(side_effect=catalog_handler)

    ctx = FakeToolContext()
    result = await resolve_products(
        store_name="Rami Levy",
        store_id="331",
        items=[
            {"barcode": "9999999999", "name": "שוקולד פרה", "quantity": 1},
        ],
        tool_context=ctx,
    )

    assert result["status"] == "success"
    assert len(result["resolved"]) == 1
    assert result["resolved"][0]["method"] == "name_exact"
    assert result["resolved"][0]["store_product_id"] == "500"


@respx.mock
@pytest.mark.asyncio
async def test_eval_resolve_disambiguation_needed():
    """Name search returns multiple candidates — agent must choose."""
    def catalog_handler(request):
        body = request.content.decode()
        if "0000000000" in body:
            return httpx.Response(200, json={"total": 0, "data": []})
        return httpx.Response(200, json={
            "total": 3,
            "data": [
                {"id": 200, "name": "חלב 3% תנובה 1 ליטר", "barcode": 7290000200,
                 "price": {"price": 6.9}, "images": {}, "available_in": [331], "sale": []},
                {"id": 201, "name": "חלב 1% תנובה 1 ליטר", "barcode": 7290000201,
                 "price": {"price": 6.5}, "images": {}, "available_in": [331], "sale": []},
                {"id": 202, "name": "חלב 3% שטראוס 1 ליטר", "barcode": 7290000202,
                 "price": {"price": 7.2}, "images": {}, "available_in": [331], "sale": []},
            ],
        })

    respx.post(CATALOG_ENDPOINT).mock(side_effect=catalog_handler)

    ctx = FakeToolContext()
    result = await resolve_products(
        store_name="Rami Levy",
        store_id="331",
        items=[
            {"barcode": "0000000000", "name": "חלב תנובה 3%", "quantity": 1},
        ],
        tool_context=ctx,
    )

    assert result["status"] == "success"
    assert len(result["resolved"]) == 0
    assert len(result["needs_disambiguation"]) == 1
    dis = result["needs_disambiguation"][0]
    assert dis["lista_name"] == "חלב תנובה 3%"
    assert len(dis["candidates"]) == 3


@respx.mock
@pytest.mark.asyncio
async def test_eval_resolve_item_not_found():
    """Item not found by barcode or name."""
    respx.post(CATALOG_ENDPOINT).mock(
        return_value=httpx.Response(200, json={"total": 0, "data": []})
    )

    ctx = FakeToolContext()
    result = await resolve_products(
        store_name="Rami Levy",
        store_id="331",
        items=[
            {"barcode": "0000000000", "name": "מוצר שלא קיים", "quantity": 1},
        ],
        tool_context=ctx,
    )

    assert result["status"] == "success"
    assert len(result["not_found"]) == 1
    assert result["not_found"][0]["lista_name"] == "מוצר שלא קיים"


# ------------------------------------------------------------------
# Eval: Cart preview
# ------------------------------------------------------------------


@respx.mock
@pytest.mark.asyncio
async def test_eval_cart_preview_with_delivery():
    """Cart preview shows items + delivery fee correctly."""
    respx.post(CART_ENDPOINT).mock(
        return_value=httpx.Response(200, json={
            "status": 200, "price": 51.7, "priceClub": 51.7,
            "discount": 0, "quantity": 3,
            "items": [
                {"id": 164854, "name": "מחיר משלוח", "price": 29.9,
                 "quantity": 1, "FormatedTotalPrice": 29.9, "FormatedSavePrice": 0,
                 "is_delivery": True},
                {"id": 358996, "name": "ארלה גבינת שמנת טבעי 200 גר",
                 "price": 14.9, "quantity": 1, "FormatedTotalPrice": 14.9,
                 "FormatedSavePrice": 0},
                {"id": 100, "name": "חלב תנובה 3% 1 ליטר",
                 "price": 6.9, "quantity": 1, "FormatedTotalPrice": 6.9,
                 "FormatedSavePrice": 0},
            ],
            "sales": [],
        })
    )

    ctx = FakeToolContext(initial_state={
        "resolved_items": [
            {"store_product_id": "358996", "quantity": 1},
            {"store_product_id": "100", "quantity": 1},
        ]
    })

    result = await calculate_cart_preview(
        store_name="Rami Levy",
        store_id="331",
        tool_context=ctx,
    )

    assert result["status"] == "success"
    assert result["total_price"] == 51.7
    assert result["delivery_fee"] == 29.9
    assert result["item_count"] == 2
    assert "cart_preview" in ctx.state


@respx.mock
@pytest.mark.asyncio
async def test_eval_cart_preview_with_promotions():
    """Cart preview includes promotion details."""
    respx.post(CART_ENDPOINT).mock(
        return_value=httpx.Response(200, json={
            "status": 200, "price": 54.8, "priceClub": 49.8,
            "discount": 5.0, "quantity": 2,
            "items": [
                {"id": 164854, "name": "מחיר משלוח", "price": 29.9,
                 "quantity": 1, "FormatedTotalPrice": 29.9, "FormatedSavePrice": 0,
                 "is_delivery": True},
                {"id": 358996, "name": "ארלה גבינת שמנת טבעי 200 גר",
                 "price": 14.9, "quantity": 2, "FormatedTotalPrice": 24.9,
                 "FormatedSavePrice": 4.9},
            ],
            "sales": [
                {"name": "2 יח' ב-24.90 ש\"ח", "id": 1}
            ],
        })
    )

    ctx = FakeToolContext(initial_state={
        "resolved_items": [
            {"store_product_id": "358996", "quantity": 2},
        ]
    })

    result = await calculate_cart_preview(
        store_name="Rami Levy",
        store_id="331",
        tool_context=ctx,
    )

    assert result["status"] == "success"
    assert result["club_price"] == 49.8
    assert len(result["promotions"]) == 1
    assert "24.90" in result["promotions"][0]
