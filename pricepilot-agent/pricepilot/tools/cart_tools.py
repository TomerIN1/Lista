"""Cart management and savings calculation tools.

Pure computation tools — no browser needed. Used by the Checkout Builder agent.
"""

from __future__ import annotations

import json
from collections import defaultdict

from pricepilot.config import SAVINGS_FEE_PERCENT


async def calculate_savings(
    found_products_json: str,
    stores_json: str,
) -> str:
    """Calculate savings by comparing prices across stores.

    Uses a greedy algorithm: for each item, pick the cheapest option across stores.
    Then calculates the optimal plan vs the baseline (single most expensive store).

    Args:
        found_products_json: JSON array of products found during browsing.
            Each product: {"sku", "store_id", "name", "price", "sale_price"?, ...}
        stores_json: JSON array of stores with delivery fees.
            Each store: {"id", "name", "delivery_fee"}
    """
    products = json.loads(found_products_json)
    stores = json.loads(stores_json)
    store_map = {s["id"]: s for s in stores}

    if not products:
        return json.dumps({"error": "No products to compare"})

    # Group products by item name (normalized)
    by_item: dict[str, list[dict]] = defaultdict(list)
    for p in products:
        key = p.get("name", "").lower().strip()
        if key:
            by_item[key].append(p)

    # Greedy: pick cheapest per item
    best_items: list[dict] = []
    for _item_name, options in by_item.items():
        cheapest = min(
            options,
            key=lambda p: p.get("sale_price") or p.get("price", float("inf")),
        )
        best_items.append(cheapest)

    # Build per-store breakdown for optimal plan
    store_items: dict[str, list[dict]] = defaultdict(list)
    for item in best_items:
        store_items[item["store_id"]].append(item)

    best_breakdown = []
    best_subtotal = 0.0
    best_delivery = 0.0
    for store_id, items in store_items.items():
        store_info = store_map.get(store_id, {"name": store_id, "delivery_fee": 0})
        sub = sum(p.get("sale_price") or p["price"] for p in items)
        fee = store_info.get("delivery_fee", 0)
        best_subtotal += sub
        best_delivery += fee
        best_breakdown.append({
            "store_id": store_id,
            "store_name": store_info.get("name", store_id),
            "items_count": len(items),
            "subtotal": round(sub, 2),
            "delivery_fee": fee,
            "total": round(sub + fee, 2),
        })

    best_total = round(best_subtotal + best_delivery, 2)

    # Baseline: most expensive single-store option
    baseline_total = 0.0
    baseline_store = ""
    for store_id, items in store_items.items():
        store_info = store_map.get(store_id, {"delivery_fee": 0})
        total = sum(p.get("price", 0) for p in items) + store_info.get("delivery_fee", 0)
        if total > baseline_total:
            baseline_total = total
            baseline_store = store_id

    savings_amount = round(max(0, baseline_total - best_total), 2)
    savings_percent = round((savings_amount / baseline_total * 100) if baseline_total > 0 else 0, 1)
    fee = round(savings_amount * SAVINGS_FEE_PERCENT / 100, 2)

    return json.dumps({
        "best_plan": {
            "stores": list(store_items.keys()),
            "subtotal": round(best_subtotal, 2),
            "delivery_fees": round(best_delivery, 2),
            "total": best_total,
            "store_breakdown": best_breakdown,
        },
        "baseline_total": round(baseline_total, 2),
        "baseline_store": baseline_store,
        "savings_amount": savings_amount,
        "savings_percent": savings_percent,
        "fee": fee,
        "net_benefit": round(savings_amount - fee, 2),
    })


async def build_pricing_plan(selected_products_json: str, stores_json: str) -> str:
    """Build a detailed pricing plan grouping selected products by store.

    Args:
        selected_products_json: JSON array of final selected products.
        stores_json: JSON array of stores with delivery fees.
    """
    products = json.loads(selected_products_json)
    stores = json.loads(stores_json)
    store_map = {s["id"]: s for s in stores}

    store_items: dict[str, list[dict]] = defaultdict(list)
    for p in products:
        store_items[p["store_id"]].append(p)

    breakdown = []
    total_subtotal = 0.0
    total_delivery = 0.0
    for store_id, items in store_items.items():
        store_info = store_map.get(store_id, {"name": store_id, "delivery_fee": 0})
        sub = sum(p.get("sale_price") or p["price"] for p in items)
        fee = store_info.get("delivery_fee", 0)
        total_subtotal += sub
        total_delivery += fee
        breakdown.append({
            "store_id": store_id,
            "store_name": store_info.get("name", store_id),
            "items": [{"name": p["name"], "price": p.get("sale_price") or p["price"]} for p in items],
            "subtotal": round(sub, 2),
            "delivery_fee": fee,
            "total": round(sub + fee, 2),
        })

    return json.dumps({
        "stores": list(store_items.keys()),
        "subtotal": round(total_subtotal, 2),
        "delivery_fees": round(total_delivery, 2),
        "total": round(total_subtotal + total_delivery, 2),
        "store_breakdown": breakdown,
    })


async def format_savings_report(savings_json: str) -> str:
    """Format a savings report for display in chat.

    Args:
        savings_json: JSON savings calculation result from calculate_savings.
    """
    data = json.loads(savings_json)

    if "error" in data:
        return json.dumps({"formatted": data["error"]})

    lines = [
        "💰 **Savings Report**",
        "",
        f"Best plan total: ₪{data['best_plan']['total']:.2f}",
        f"Baseline total: ₪{data['baseline_total']:.2f}",
        f"You save: ₪{data['savings_amount']:.2f} ({data['savings_percent']}%)",
        f"PricePilot fee (5%): ₪{data['fee']:.2f}",
        f"**Net benefit: ₪{data['net_benefit']:.2f}**",
        "",
    ]

    for store_bd in data["best_plan"]["store_breakdown"]:
        lines.append(f"📦 {store_bd['store_name']}: ₪{store_bd['total']:.2f} ({store_bd['items_count']} items)")

    return json.dumps({"formatted": "\n".join(lines)})
