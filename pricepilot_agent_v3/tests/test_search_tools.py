"""Tests for product search tools."""

import json

import pytest
import httpx

# Ensure project root is importable
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture
def mock_catalog_response():
    return [
        {
            "id": "7290000001",
            "barcode": "7290000001",
            "name": "חלב תנובה 3%",
            "price": 6.90,
            "small_image": "https://example.com/milk.jpg",
            "in_stock": True,
        },
        {
            "id": "7290000002",
            "barcode": "7290000002",
            "name": "חלב תנובה 1%",
            "price": 6.50,
            "small_image": "https://example.com/milk2.jpg",
            "in_stock": True,
        },
    ]


@pytest.mark.asyncio
async def test_search_products_success(httpx_mock, mock_catalog_response):
    """search_products returns parsed product list on success."""
    httpx_mock.add_response(
        url="https://www.rami-levy.co.il/api/catalog",
        method="POST",
        json=mock_catalog_response,
    )

    from tools.search_tools import search_products

    result = await search_products(query="חלב", max_results=5)

    assert result["status"] == "success"
    assert len(result["products"]) == 2
    assert result["products"][0]["name"] == "חלב תנובה 3%"
    assert result["products"][0]["id"] == "7290000001"


@pytest.mark.asyncio
async def test_search_products_empty_query():
    """search_products rejects empty queries."""
    from tools.search_tools import search_products

    result = await search_products(query="")
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_search_products_no_results(httpx_mock):
    """search_products handles no results gracefully."""
    httpx_mock.add_response(
        url="https://www.rami-levy.co.il/api/catalog",
        method="POST",
        json=[],
    )

    from tools.search_tools import search_products

    result = await search_products(query="nonexistent_product_xyz")
    assert result["status"] == "success"
    assert result["products"] == []


@pytest.mark.asyncio
async def test_search_products_barcode_detection(httpx_mock, mock_catalog_response):
    """search_products detects barcodes and sets type accordingly."""
    httpx_mock.add_response(
        url="https://www.rami-levy.co.il/api/catalog",
        method="POST",
        json=mock_catalog_response,
    )

    from tools.search_tools import search_products

    result = await search_products(query="7290000001")
    assert result["status"] == "success"

    # Verify the request used type="barcode"
    request = httpx_mock.get_requests()[0]
    body = json.loads(request.content)
    assert body["type"] == "barcode"


@pytest.mark.asyncio
async def test_search_products_timeout(httpx_mock):
    """search_products handles timeout gracefully."""
    httpx_mock.add_exception(httpx.TimeoutException("timeout"))

    from tools.search_tools import search_products

    result = await search_products(query="חלב")
    assert result["status"] == "error"
    assert "timed out" in result["message"].lower()
