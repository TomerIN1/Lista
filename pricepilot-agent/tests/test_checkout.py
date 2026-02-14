"""Tests for cart tools and checkout tools."""

import json

import pytest


@pytest.mark.asyncio
async def test_calculate_savings_basic():
    from pricepilot.tools.cart_tools import calculate_savings

    products = json.dumps([
        {"sku": "1", "store_id": "shufersal", "name": "milk", "price": 7.5},
        {"sku": "2", "store_id": "rami-levy", "name": "milk", "price": 6.0},
        {"sku": "3", "store_id": "shufersal", "name": "bread", "price": 10.0},
        {"sku": "4", "store_id": "rami-levy", "name": "bread", "price": 12.0},
    ])
    stores = json.dumps([
        {"id": "shufersal", "name": "Shufersal", "delivery_fee": 30},
        {"id": "rami-levy", "name": "Rami Levy", "delivery_fee": 25},
    ])

    result = json.loads(await calculate_savings(products, stores))

    assert "best_plan" in result
    assert "savings_amount" in result
    assert "savings_percent" in result
    assert "fee" in result
    assert "net_benefit" in result
    assert result["best_plan"]["total"] > 0


@pytest.mark.asyncio
async def test_calculate_savings_empty():
    from pricepilot.tools.cart_tools import calculate_savings

    result = json.loads(await calculate_savings("[]", "[]"))
    assert "error" in result


@pytest.mark.asyncio
async def test_build_pricing_plan():
    from pricepilot.tools.cart_tools import build_pricing_plan

    products = json.dumps([
        {"sku": "1", "store_id": "shufersal", "name": "milk", "price": 7.5},
        {"sku": "2", "store_id": "shufersal", "name": "bread", "price": 10.0},
        {"sku": "3", "store_id": "rami-levy", "name": "eggs", "price": 15.0},
    ])
    stores = json.dumps([
        {"id": "shufersal", "name": "Shufersal", "delivery_fee": 30},
        {"id": "rami-levy", "name": "Rami Levy", "delivery_fee": 25},
    ])

    result = json.loads(await build_pricing_plan(products, stores))

    assert "stores" in result
    assert "subtotal" in result
    assert "delivery_fees" in result
    assert "total" in result
    assert "store_breakdown" in result
    assert len(result["store_breakdown"]) == 2
    assert result["subtotal"] == 32.5
    assert result["delivery_fees"] == 55


@pytest.mark.asyncio
async def test_format_savings_report():
    from pricepilot.tools.cart_tools import format_savings_report

    savings_data = json.dumps({
        "best_plan": {
            "stores": ["shufersal"],
            "subtotal": 50.0,
            "delivery_fees": 30.0,
            "total": 80.0,
            "store_breakdown": [
                {
                    "store_id": "shufersal",
                    "store_name": "Shufersal",
                    "items_count": 3,
                    "subtotal": 50.0,
                    "delivery_fee": 30.0,
                    "total": 80.0,
                }
            ],
        },
        "baseline_total": 100.0,
        "savings_amount": 20.0,
        "savings_percent": 20.0,
        "fee": 1.0,
        "net_benefit": 19.0,
    })

    result = json.loads(await format_savings_report(savings_data))
    assert "formatted" in result
    assert "20.00" in result["formatted"]  # savings amount
    assert "Shufersal" in result["formatted"]


@pytest.mark.asyncio
async def test_generate_checkout_links():
    from pricepilot.tools.checkout_tools import generate_checkout_links

    plan = json.dumps({
        "stores": ["shufersal", "rami-levy"],
        "total": 80.0,
        "store_breakdown": [
            {"store_id": "shufersal", "store_name": "Shufersal"},
            {"store_id": "rami-levy", "store_name": "Rami Levy"},
        ],
    })

    result = json.loads(await generate_checkout_links(plan))

    assert "checkout_links" in result
    assert "shufersal" in result["checkout_links"]
    assert "rami-levy" in result["checkout_links"]
    assert result["store_count"] == 2


@pytest.mark.asyncio
async def test_get_checkout_summary():
    from pricepilot.tools.checkout_tools import get_checkout_summary

    links = json.dumps({
        "checkout_links": {
            "shufersal": "https://shufersal.co.il/checkout?session=pricepilot",
        },
        "total": 80.0,
        "store_count": 1,
    })
    savings = json.dumps({
        "savings_amount": 20.0,
        "fee": 1.0,
    })

    result = json.loads(await get_checkout_summary(links, savings))

    assert "summary" in result
    assert "checkout_links" in result
    assert "shufersal" in result["checkout_links"]
    assert result["total"] == 80.0
