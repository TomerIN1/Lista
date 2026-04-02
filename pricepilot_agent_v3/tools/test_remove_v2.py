"""Test remove approaches: send ONLY the item to remove with different quantity values.
Tests: 0, -1, 0.0, "0", "0.00", -0.5, None
"""
from __future__ import annotations
import asyncio, os, json, httpx
from datetime import datetime, timedelta, timezone
from playwright.async_api import async_playwright

OTP_FILE = "/tmp/otp_code.txt"
ITEM_TO_REMOVE = "2968"  # אשל 4.5%

async def test():
    if os.path.exists(OTP_FILE): os.remove(OTP_FILE)
    p = await async_playwright().start()
    browser = await p.chromium.launch(headless=True)
    ctx = await browser.new_context(locale="he-IL", timezone_id="Asia/Jerusalem",
        viewport={"width": 1280, "height": 800},
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
    page = await ctx.new_page()

    # Login
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)
    for s in ['button:has-text("אישור")', 'button:has-text("הבנתי")']:
        try:
            b = page.locator(s).first
            if await b.is_visible(timeout=1000): await b.click()
        except: pass
    try: await page.evaluate("window.$nuxt.$root.$emit('OpenLoginModal')"); await asyncio.sleep(2)
    except: pass
    for s in ['input[type="email"]', 'input[type="tel"]']:
        try:
            i = page.locator(s).first
            if await i.is_visible(timeout=2000): await i.fill("tomerikoka@gmail.com"); break
        except: pass
    for s in ['button:has-text("שלח")']:
        try:
            b = page.locator(s).first
            if await b.is_visible(timeout=1000): await b.click(); break
        except: pass
    await asyncio.sleep(3)
    try:
        sms = page.locator('text="הודעת SMS"').first
        if await sms.is_visible(timeout=3000):
            await sms.click(); await asyncio.sleep(1)
            for s in ['button:has-text("שלח קוד")', 'button:has-text("שלח")']:
                try:
                    b = page.locator(s).first
                    if await b.is_visible(timeout=2000): await b.click(); break
                except: pass
            await asyncio.sleep(3)
    except: pass
    print("OTP_SENT", flush=True)

    code = None
    for _ in range(300):
        if os.path.exists(OTP_FILE):
            with open(OTP_FILE) as f: c = f.read().strip()
            if len(c) >= 4: code = c; break
        await asyncio.sleep(1)
    if not code: print("TIMEOUT"); return
    print(f"CODE={code}", flush=True)

    for s in ['input[placeholder*="קוד"]']:
        try:
            i = page.locator(s).first
            if await i.is_visible(timeout=3000): await i.fill(code); break
        except: pass
    await asyncio.sleep(1)
    for s in ['button:has-text("אמת קוד")']:
        try:
            b = page.locator(s).first
            if await b.is_visible(timeout=1000): await b.click(); break
        except: pass
    await asyncio.sleep(5)
    token = None
    for i in range(10):
        try:
            token = await page.evaluate("() => { try { return JSON.parse(localStorage.getItem('ramilevy')).authuser.user.token; } catch(e) { return null; } }")
            if token: break
        except: pass
        await asyncio.sleep(2)
    if not token: print("NO_TOKEN"); return
    print("LOGGED_IN", flush=True)

    # Navigate to market
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)

    # Get store ID from Vuex
    store_id = await page.evaluate("""() => {
        try { return String(window.$nuxt.$store.state.cart.storeId || '331'); }
        catch(e) { return '331'; }
    }""")
    print(f"STORE_ID: {store_id}", flush=True)

    # Extract token + cookies
    cookies = await ctx.cookies()
    cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00.000Z")
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "locale": "he",
        "Accept": "application/json, text/plain, */*",
        "Authorization": f"Bearer {token}",
        "ecomtoken": token,
        "Origin": "https://www.rami-levy.co.il",
        "Referer": "https://www.rami-levy.co.il/he/online/market",
        "Cookie": cookie_str,
    }

    # First add the item so we can test removing it
    print(f"\n=== FIRST: ADD {ITEM_TO_REMOVE} so we can remove it ===", flush=True)
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        resp = await client.post("https://www.rami-levy.co.il/api/v2/cart", headers=headers,
            json={"store": store_id, "isClub": 0, "supplyAt": tomorrow, "items": {ITEM_TO_REMOVE: 1.0}, "meta": None})
    print(f"ADD status: {resp.status_code}", flush=True)

    # Verify it was added
    await page.goto("https://www.google.com", wait_until="domcontentloaded", timeout=15000)
    await asyncio.sleep(2)
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)
    cart_before = await page.evaluate("""() => {
        try {
            const cart = window.$nuxt.$store.state.cart;
            return cart.items.filter(i => !i.is_delivery).map(i => ({id: i.id, name: i.name}));
        } catch(e) { return []; }
    }""")
    has_item = any(str(i["id"]) == ITEM_TO_REMOVE for i in cart_before)
    print(f"Item in cart before tests: {'YES' if has_item else 'NO'} ({len(cart_before)} items)", flush=True)

    # Refresh cookies after navigation
    cookies = await ctx.cookies()
    cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
    headers["Cookie"] = cookie_str

    # Now test different removal approaches
    test_values = [
        ("0 (int)", {ITEM_TO_REMOVE: 0}),
        ("0.0 (float)", {ITEM_TO_REMOVE: 0.0}),
        ('"0" (string)', {ITEM_TO_REMOVE: "0"}),
        ('"0.00" (string)', {ITEM_TO_REMOVE: "0.00"}),
        ("-1 (negative)", {ITEM_TO_REMOVE: -1}),
        ("-0.5 (neg float)", {ITEM_TO_REMOVE: -0.5}),
        ("null", {ITEM_TO_REMOVE: None}),
        ("empty string", {ITEM_TO_REMOVE: ""}),
    ]

    for label, items in test_values:
        print(f"\n--- TEST: items={{{ITEM_TO_REMOVE}: {label}}} ---", flush=True)
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.post("https://www.rami-levy.co.il/api/v2/cart", headers=headers,
                json={"store": store_id, "isClub": 0, "supplyAt": tomorrow, "items": items, "meta": None})
        data = resp.json()
        result_items = [i for i in data.get("items", []) if not i.get("is_delivery")]
        has_target = any(i["id"] == int(ITEM_TO_REMOVE) for i in result_items)
        print(f"  Status: {data.get('status')}, Items: {len(result_items)}, Target in response: {has_target}", flush=True)

        # Quick verify
        await page.goto("https://www.google.com", wait_until="domcontentloaded", timeout=15000)
        await asyncio.sleep(2)
        await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(5)
        final = await page.evaluate(f"""() => {{
            try {{
                const cart = window.$nuxt.$store.state.cart;
                return cart.items.some(i => String(i.id) === '{ITEM_TO_REMOVE}');
            }} catch(e) {{ return true; }}
        }}""")
        print(f"  PERSISTED: {'NO ✅ REMOVED!' if not final else 'YES ❌ still there'}", flush=True)

        if not final:
            print(f"\n🎉 FOUND WORKING APPROACH: {label}", flush=True)
            # Re-add for next test
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                await client.post("https://www.rami-levy.co.il/api/v2/cart", headers=headers,
                    json={"store": store_id, "isClub": 0, "supplyAt": tomorrow, "items": {ITEM_TO_REMOVE: 1.0}, "meta": None})
            await asyncio.sleep(3)

        # Refresh cookies
        cookies = await ctx.cookies()
        cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
        headers["Cookie"] = cookie_str

    await browser.close(); await p.stop()

asyncio.run(test())
