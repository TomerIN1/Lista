"""Test: Login → Read cart → Remove one item using exact website approach."""
from __future__ import annotations
import asyncio, os, json, httpx
from datetime import datetime, timedelta, timezone
from playwright.async_api import async_playwright

OTP_FILE = "/tmp/otp_code.txt"

async def test():
    if os.path.exists(OTP_FILE): os.remove(OTP_FILE)
    p = await async_playwright().start()
    browser = await p.chromium.launch(headless=True)
    ctx = await browser.new_context(locale="he-IL", timezone_id="Asia/Jerusalem",
        viewport={"width": 1280, "height": 800},
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
    page = await ctx.new_page()

    # Login flow (same as always)
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

    # Navigate to market and read cart
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)

    # Read ALL items from Vuex (including delivery)
    all_items = await page.evaluate("""() => {
        try {
            const cart = window.$nuxt.$store.state.cart;
            if (cart && cart.items) return cart.items.map(i => ({
                id: String(i.id), amount: i.amount || 1, name: i.name,
                is_delivery: !!i.is_delivery
            }));
            return [];
        } catch(e) { return []; }
    }""")

    print(f"\nCURRENT CART ({len(all_items)} items):", flush=True)
    for item in all_items:
        print(f"  id={item['id']}, amount={item['amount']}, name={item['name']}, delivery={item['is_delivery']}", flush=True)

    # Pick first non-delivery item to remove
    to_remove = None
    for item in all_items:
        if not item['is_delivery'] and item['name'] != 'מחיר משלוח':
            to_remove = item
            break

    if not to_remove:
        print("No item to remove!"); return

    print(f"\nREMOVING: {to_remove['name']} (id={to_remove['id']})", flush=True)

    # Build items dict: ALL items EXCEPT the one to remove
    # Use string format "1.00" like the real website
    new_items = {}
    for item in all_items:
        if item['id'] == to_remove['id']:
            continue
        new_items[item['id']] = f"{float(item['amount']):.2f}"

    print(f"SENDING {len(new_items)} items: {json.dumps(new_items, ensure_ascii=False)}", flush=True)

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

    # Send via httpx
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        resp = await client.post(
            "https://www.rami-levy.co.il/api/v2/cart",
            headers=headers,
            json={"store": "179", "isClub": 0, "supplyAt": tomorrow,
                  "items": new_items, "meta": None},
        )

    data = resp.json()
    result_items = [i for i in data.get("items", []) if not i.get("is_delivery")]
    print(f"\nAPI RESPONSE: status={data.get('status')}, items={len(result_items)}", flush=True)
    for i in result_items:
        print(f"  {i['name']} (id={i['id']}, qty={i.get('quantity')})", flush=True)

    # Verify: navigate away and back
    print("\nVERIFYING...", flush=True)
    await page.goto("https://www.google.com", wait_until="domcontentloaded", timeout=15000)
    await asyncio.sleep(3)
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)

    final = await page.evaluate("""() => {
        try {
            const cart = window.$nuxt.$store.state.cart;
            if (cart && cart.items) return cart.items
                .filter(i => !i.is_delivery && i.name !== 'מחיר משלוח')
                .map(i => ({name: i.name, id: i.id}));
            return [];
        } catch(e) { return []; }
    }""")
    print(f"\nFINAL CART: {len(final)} items", flush=True)
    removed_still = any(str(i['id']) == to_remove['id'] for i in final)
    print(f"REMOVED ITEM STILL IN CART: {'YES ❌' if removed_still else 'NO ✅'}", flush=True)

    await browser.close(); await p.stop()

asyncio.run(test())
