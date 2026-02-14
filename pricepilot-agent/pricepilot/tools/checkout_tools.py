"""Checkout URL generation tools.

Used by the Checkout Builder agent to produce checkout links
that the user clicks in the Lista app to complete their purchase.
"""

from __future__ import annotations

import json


async def generate_checkout_links(pricing_plan_json: str) -> str:
    """Generate checkout URLs for each store in the pricing plan.

    In production, these URLs are extracted during the browser session
    (the browser agent navigates to checkout and captures the URL).
    This tool assembles the final checkout link payload.

    Args:
        pricing_plan_json: JSON pricing plan from build_pricing_plan.
    """
    plan = json.loads(pricing_plan_json)

    checkout_links: dict[str, str] = {}
    for store_bd in plan.get("store_breakdown", []):
        store_id = store_bd["store_id"]
        # In production the URL comes from the browser session's checkout page.
        # Here we construct a placeholder showing the structure.
        checkout_links[store_id] = (
            f"https://{store_id}.co.il/checkout?session=pricepilot"
        )

    return json.dumps({
        "checkout_links": checkout_links,
        "total": plan.get("total", 0),
        "store_count": len(checkout_links),
    })


async def get_checkout_summary(
    checkout_links_json: str,
    savings_json: str,
) -> str:
    """Build the final checkout summary to present to the user.

    Args:
        checkout_links_json: JSON result from generate_checkout_links.
        savings_json: JSON savings report from calculate_savings.
    """
    links = json.loads(checkout_links_json)
    savings = json.loads(savings_json)

    summary_lines = [
        "✅ **Your carts are ready!**",
        "",
    ]

    for store_id, url in links.get("checkout_links", {}).items():
        summary_lines.append(f"🛒 [{store_id}]({url})")

    summary_lines.extend([
        "",
        f"Total: ₪{links.get('total', 0):.2f}",
        f"You save: ₪{savings.get('savings_amount', 0):.2f}",
        "",
        "Click the links above to complete your purchase at each store.",
    ])

    return json.dumps({
        "summary": "\n".join(summary_lines),
        "checkout_links": links.get("checkout_links", {}),
        "total": links.get("total", 0),
        "savings_amount": savings.get("savings_amount", 0),
    })
