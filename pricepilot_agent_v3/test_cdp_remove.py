"""Test: Can we remove a cart item via CDP connection to user's real Chrome?

Steps:
1. Connect to Chrome via CDP (localhost:9222)
2. Find the Rami Levy tab
3. Read cart items from Vuex
4. Try to remove one item using fetch() inside the user's real page
5. Verify if it persisted by reloading

Prerequisites:
- Chrome launched with: open -a "Google Chrome" --args --remote-debugging-port=9222
- User logged into rami-levy.co.il with 2+ items in cart
"""

import asyncio
import json
from playwright.async_api import async_playwright


async def main():
    print("=" * 60)
    print("CDP REMOVE TEST — Using user's real Chrome session")
    print("=" * 60)

    async with async_playwright() as p:
        # Step 1: Connect to user's Chrome via CDP
        print("\n[1] Connecting to Chrome via CDP (localhost:9222)...")
        try:
            browser = await p.chromium.connect_over_cdp("http://localhost:9222")
        except Exception as e:
            print(f"FAILED to connect: {e}")
            print("Make sure Chrome is running with --remote-debugging-port=9222")
            return

        print(f"    Connected! {len(browser.contexts)} context(s)")

        # Step 2: Find the Rami Levy tab
        print("\n[2] Looking for Rami Levy tab...")
        rami_page = None
        for context in browser.contexts:
            for page in context.pages:
                print(f"    Tab: {page.url[:80]}")
                if "rami-levy" in page.url:
                    rami_page = page
                    break
            if rami_page:
                break

        if not rami_page:
            print("ERROR: No Rami Levy tab found. Open rami-levy.co.il first.")
            return

        print(f"    Found: {rami_page.url}")

        # Step 3: Read cart from Vuex
        print("\n[3] Reading cart from Vuex...")
        cart_items = await rami_page.evaluate("""() => {
            try {
                const cart = window.$nuxt.$store.state.cart;
                if (!cart || !cart.items) return [];
                return cart.items
                    .filter(i => !i.is_delivery && i.name !== 'מחיר משלוח')
                    .map(i => ({
                        id: i.id,
                        name: i.name,
                        amount: i.amount || 1,
                    }));
            } catch(e) { return [{error: e.message}]; }
        }""")

        if not cart_items:
            print("ERROR: Cart is empty or Vuex not available.")
            print("Make sure you're on the market page and logged in.")
            return

        print(f"    Found {len(cart_items)} item(s):")
        for item in cart_items:
            print(f"      - [{item['id']}] {item['name']} (qty: {item['amount']})")

        # Pick the first item to remove
        target = cart_items[0]
        target_id = str(target["id"])
        target_name = target["name"]
        print(f"\n    Will try to REMOVE: [{target_id}] {target_name}")

        # Step 4: Try removing via fetch() inside the user's real page
        # This runs in the user's browser context — same cf_clearance, same session
        print("\n[4] Sending remove request via fetch() in user's page...")

        # Build payload: all items except the one to remove
        remove_result = await rami_page.evaluate("""async (targetId) => {
            try {
                const cart = window.$nuxt.$store.state.cart;
                const items = {};

                // SET mode: include all items EXCEPT the one to remove
                for (const item of cart.items) {
                    if (item.is_delivery || item.name === 'מחיר משלוח') continue;
                    const id = String(item.id);
                    if (id === targetId) continue; // skip = remove
                    items[id] = (item.amount || 1).toFixed(2);
                }

                // Get store and supply date
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const supplyAt = tomorrow.toISOString().split('T')[0] + 'T00:00:00.000Z';

                const payload = {
                    store: "179",
                    isClub: 0,
                    supplyAt: supplyAt,
                    items: items,
                    meta: null
                };

                console.log('CDP test payload (SET mode):', JSON.stringify(payload));

                const resp = await fetch('/api/v2/cart', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8',
                        'locale': 'he',
                    },
                    body: JSON.stringify(payload),
                    credentials: 'include'  // sends all cookies including HttpOnly
                });

                const data = await resp.json();
                const remaining = (data.items || [])
                    .filter(i => !i.is_delivery && !i.name?.includes('משלוח'));

                return {
                    ok: resp.ok,
                    status: resp.status,
                    payload_sent: payload,
                    remaining_count: remaining.length,
                    remaining: remaining.map(i => ({id: i.id, name: i.name, qty: i.quantity})),
                    target_still_in_cart: remaining.some(i => String(i.id) === targetId),
                };
            } catch(e) {
                return {error: e.message};
            }
        }""", target_id)

        print(f"    Response: HTTP {remove_result.get('status', '?')}")
        print(f"    Remaining items: {remove_result.get('remaining_count', '?')}")
        print(f"    Target still in cart: {remove_result.get('target_still_in_cart', '?')}")

        if remove_result.get("remaining"):
            for item in remove_result["remaining"]:
                print(f"      - [{item['id']}] {item['name']} (qty: {item['qty']})")

        # Step 5: Verify by reloading the page and re-reading Vuex
        print("\n[5] Reloading page to verify persistence...")
        await rami_page.reload(wait_until="domcontentloaded")
        await asyncio.sleep(5)

        cart_after = await rami_page.evaluate("""(targetId) => {
            try {
                const cart = window.$nuxt.$store.state.cart;
                if (!cart || !cart.items) return {items: [], found: false};
                const items = cart.items
                    .filter(i => !i.is_delivery && i.name !== 'מחיר משלוח')
                    .map(i => ({id: i.id, name: i.name, amount: i.amount || 1}));
                const found = items.some(i => String(i.id) === targetId);
                return {items, found};
            } catch(e) { return {error: e.message}; }
        }""", target_id)

        print(f"\n    After reload: {len(cart_after.get('items', []))} item(s)")
        for item in cart_after.get("items", []):
            marker = " ← SHOULD BE GONE" if str(item["id"]) == target_id else ""
            print(f"      - [{item['id']}] {item['name']} (qty: {item['amount']}){marker}")

        # Final verdict
        print("\n" + "=" * 60)
        if not cart_after.get("found", True):
            print("✅ SUCCESS — Item removed and PERSISTED after reload!")
            print("   CDP approach works for remove operations.")
        else:
            print("❌ FAILED — Item still in cart after reload.")
            print("   CDP approach did NOT solve the persistence problem.")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
