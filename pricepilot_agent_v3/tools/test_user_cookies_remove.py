"""Test: can we remove a cart item using the USER's real browser cookies?

Usage:
    python test_user_cookies_remove.py

Paste your browser cookies and token when prompted.
"""

import asyncio
import json
from datetime import datetime, timedelta, timezone

import httpx

CART_URL = "https://www.rami-levy.co.il/api/v2/cart"


async def main():
    # Get user's cookies from their real browser
    print("\n=== Test: Remove cart item using USER's browser cookies ===\n")
    cookie_str = input("Paste document.cookie from your browser:\n> ").strip().strip("'\"")
    token = input("\nPaste your JWT token (from localStorage ramilevy.authuser.user.token):\n> ").strip().strip("'\"")
    store = input("\nStore ID (default 179):\n> ").strip() or "179"

    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "locale": "he",
        "Accept": "application/json, text/plain, */*",
        "Authorization": f"Bearer {token}",
        "ecomtoken": token,
        "Origin": "https://www.rami-levy.co.il",
        "Referer": "https://www.rami-levy.co.il/he/online/market",
        "Cookie": cookie_str,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    }

    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00.000Z")

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        # Step 1: Read current cart
        print("\n--- Step 1: Reading cart ---")
        resp = await client.post(
            CART_URL,
            headers=headers,
            json={"store": store, "isClub": 0, "supplyAt": tomorrow, "items": {}, "meta": None},
        )
        print(f"Status: {resp.status_code}")
        data = resp.json()
        items = [
            i for i in data.get("items", [])
            if not i.get("is_delivery") and "משלוח" not in i.get("name", "")
        ]

        if not items:
            print("Cart is empty! Add some items first.")
            return

        print(f"\nCart has {len(items)} items:")
        for i, item in enumerate(items):
            qty = item.get("quantity", item.get("amount", 1))
            print(f"  {i+1}. [{item['id']}] {item.get('name', '?')} — qty: {qty}")

        # Step 2: Pick item to remove
        choice = input(f"\nWhich item to remove? (1-{len(items)}): ").strip()
        idx = int(choice) - 1
        target = items[idx]
        target_id = str(target["id"])
        target_qty = float(target.get("quantity", target.get("amount", 1)))
        print(f"\nWill remove: [{target_id}] {target.get('name')} (qty={target_qty})")

        # Step 3: Try remove with negative quantity
        print("\n--- Step 2: Removing with negative qty ---")
        remove_payload = {
            "store": store,
            "isClub": 0,
            "supplyAt": tomorrow,
            "items": {target_id: -target_qty},
            "meta": None,
        }
        print(f"Payload: {json.dumps(remove_payload, indent=2)}")

        resp = await client.post(CART_URL, headers=headers, json=remove_payload)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        remaining = [
            i for i in data.get("items", [])
            if not i.get("is_delivery") and "משלוח" not in i.get("name", "")
        ]
        print(f"Cart after remove: {len(remaining)} items")
        for item in remaining:
            print(f"  [{item['id']}] {item.get('name', '?')} — qty: {item.get('quantity', '?')}")

        removed = not any(str(i["id"]) == target_id for i in remaining)
        print(f"\nItem {target_id} removed from response: {'YES' if removed else 'NO'}")
        print("\n⚠️  NOW CHECK ON YOUR BROWSER (refresh rami-levy.co.il) — is the item actually gone?")


if __name__ == "__main__":
    asyncio.run(main())
