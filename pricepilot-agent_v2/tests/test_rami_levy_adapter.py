"""Tests for the Rami Levy store adapter.

Uses respx to mock HTTP calls to Rami Levy APIs.
Tests verify request format, response parsing, and error handling.
"""

from __future__ import annotations

import pytest
import respx
import httpx

from pricepilot.stores.rami_levy import (
    RamiLevyAdapter,
    CATALOG_ENDPOINT,
    CART_ENDPOINT,
)


@pytest.fixture
def adapter():
    return RamiLevyAdapter()


# ------------------------------------------------------------------
# Catalog: barcode search
# ------------------------------------------------------------------


@respx.mock
@pytest.mark.asyncio
async def test_search_by_barcode_found(adapter):
    """Barcode search returns exactly 1 product."""
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
                        "department": {"name": "חלב", "id": 50},
                        "group": {"name": "גבינות", "id": 202},
                        "subGroup": {"name": "שמנת", "id": 189},
                        "images": {
                            "small": "/product/5711953106583/small.jpg",
                            "original": "/product/5711953106583/large.jpg",
                        },
                        "available_in": [179, 279, 331],
                        "sale": [
                            {"name": "2 יח' ב-24.90", "scm": 24.9, "cmt": 2}
                        ],
                        "prop": {"sw_shakil": 0, "by_kilo": 0, "status": 2},
                    }
                ],
            },
        )
    )

    results = await adapter.search_by_barcode("5711953106583", "331")
    assert len(results) == 1
    p = results[0]
    assert p.store_product_id == "358996"
    assert p.barcode == "5711953106583"
    assert p.name == "ארלה גבינת שמנת טבעי 200 גר"
    assert p.price == 14.9
    assert p.in_stock is True
    assert p.promotion is not None
    assert p.promotion.description == "2 יח' ב-24.90"
    assert p.promotion.promo_price == 24.9
    assert p.promotion.min_quantity == 2


@respx.mock
@pytest.mark.asyncio
async def test_search_by_barcode_not_found(adapter):
    """Barcode search returns 0 results."""
    respx.post(CATALOG_ENDPOINT).mock(
        return_value=httpx.Response(200, json={"total": 0, "data": []})
    )

    results = await adapter.search_by_barcode("0000000000000", "331")
    assert len(results) == 0


@respx.mock
@pytest.mark.asyncio
async def test_search_by_barcode_http_error(adapter):
    """Catalog API returns an error."""
    respx.post(CATALOG_ENDPOINT).mock(
        return_value=httpx.Response(500, text="Internal Server Error")
    )

    results = await adapter.search_by_barcode("5711953106583", "331")
    assert len(results) == 0


# ------------------------------------------------------------------
# Catalog: name search
# ------------------------------------------------------------------


@respx.mock
@pytest.mark.asyncio
async def test_search_by_name_multiple(adapter):
    """Name search returns multiple candidates."""
    respx.post(CATALOG_ENDPOINT).mock(
        return_value=httpx.Response(
            200,
            json={
                "total": 3,
                "data": [
                    {
                        "id": 100,
                        "name": "חלב תנובה 3% 1 ליטר",
                        "barcode": 7290000001,
                        "price": {"price": 6.9},
                        "images": {},
                        "available_in": [331],
                        "sale": [],
                        "prop": {"status": 2},
                    },
                    {
                        "id": 101,
                        "name": "חלב תנובה 1% 1 ליטר",
                        "barcode": 7290000002,
                        "price": {"price": 6.5},
                        "images": {},
                        "available_in": [331],
                        "sale": [],
                        "prop": {"status": 2},
                    },
                    {
                        "id": 102,
                        "name": "חלב תנובה 3% חצי ליטר",
                        "barcode": 7290000003,
                        "price": {"price": 4.9},
                        "images": {},
                        "available_in": [331],
                        "sale": [],
                        "prop": {"status": 2},
                    },
                ],
            },
        )
    )

    results = await adapter.search_by_name("חלב תנובה", "331", limit=3)
    assert len(results) == 3
    assert results[0].store_product_id == "100"
    assert results[2].price == 4.9


# ------------------------------------------------------------------
# Cart: calculate
# ------------------------------------------------------------------


@respx.mock
@pytest.mark.asyncio
async def test_calculate_cart(adapter):
    """Cart calculation returns pricing with delivery fee."""
    respx.post(CART_ENDPOINT).mock(
        return_value=httpx.Response(
            200,
            json={
                "status": 200,
                "price": 44.8,
                "priceClub": 44.8,
                "discount": 0,
                "quantity": 2,
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

    preview = await adapter.calculate_cart("331", {"358996": 1})
    assert preview.total_price == 44.8
    assert preview.delivery_fee == 29.9
    assert preview.item_count == 1  # excludes delivery
    assert len(preview.items) == 2  # includes delivery item


# ------------------------------------------------------------------
# Cart: persist
# ------------------------------------------------------------------


@respx.mock
@pytest.mark.asyncio
async def test_persist_cart_success(adapter):
    """Cart persist with valid auth returns True."""
    respx.post(CART_ENDPOINT).mock(
        return_value=httpx.Response(
            200,
            json={"status": 200, "price": 44.8, "items": []},
        )
    )

    result = await adapter.persist_cart("331", {"358996": 1}, "valid-jwt-token")
    assert result is True


@respx.mock
@pytest.mark.asyncio
async def test_persist_cart_auth_expired(adapter):
    """Cart persist with expired token returns False."""
    respx.post(CART_ENDPOINT).mock(
        return_value=httpx.Response(401, text="Unauthorized")
    )

    result = await adapter.persist_cart("331", {"358996": 1}, "expired-token")
    assert result is False


# ------------------------------------------------------------------
# Login config
# ------------------------------------------------------------------


def test_login_config(adapter):
    """Login config has correct WebView setup for Rami Levy."""
    config = adapter.get_login_config()
    assert "rami-levy.co.il/he" in config.base_url
    assert "OpenLoginModal" in config.js_trigger
    assert "localStorage.ramilevy" in config.token_extraction_js
    assert config.manual_instruction  # not empty
    assert "checkout" in config.checkout_url


def test_checkout_url(adapter):
    assert "checkout" in adapter.get_checkout_url()
