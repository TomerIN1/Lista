"""Test: Use the EXACT same add approach with negative quantity to remove.
Step 1: Login
Step 2: Add an item (confirm add works)
Step 3: Verify item added on reload
Step 4: Remove same item using negative quantity (same httpx code)
Step 5: Verify item removed on reload
"""
from __future__ import annotations
import asyncio, os, json, httpx
from datetime import datetime, timedelta, timezone
from playwright.async_api import async_playwright

OTP_FILE = "/tmp/otp_code.txt"
TEST_PRODUCT = "305741"  # פודינג שוקולד

async def do_httpx_cart_call(page, ctx, items_dict):
    """Exact same httpx code as add_items_to_cart tool."""
    # Navigate to market page for fresh cookies
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    try:
        await page.wait_for_load_state("networkidle", timeout=15000)
    except:
        await asyncio.sleep(3)
    await asyncio.sleep(2)

    # Extract token
    token = await page.evaluate("""() => {
        try { return JSON.parse(localStorage.getItem('ramilevy')).authuser.user.token; }
        catch(e) { return null; }
    }""")

    # Extract cookies
    browser_cookies = await ctx.cookies()
    cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in browser_cookies)

    # Build headers — EXACT same as add_items_to_cart
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

    # Store ID — use 331 (same as working add)
    store = "331"

    # EXACT same httpx call as add_items_to_cart
    normalized = {str(k): float(v) for k, v in items_dict.items()}
    print(f"  Sending: store={store}, items={normalized}", flush=True)
    print(f"  Token len={len(token)}, cookies={len(browser_cookies)}", flush=True)

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        resp = await client.post(
            "https://www.rami-levy.co.il/api/v2/cart",
            headers=headers,
            json={"store": store, "isClub": 0, "supplyAt": tomorrow, "items": normalized, "meta": None},
        )

    data = resp.json()
    items = [i for i in data.get("items", []) if not i.get("is_delivery")]
    print(f"  Response: status={data.get('status')}, items={len(items)}", flush=True)
    return data


async def check_cart(page):
    """Navigate away and back, read Vuex."""
    await page.goto("https://www.google.com", wait_until="domcontentloaded", timeout=15000)
    await asyncio.sleep(2)
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)
    items = await page.evaluate("""() => {
        try {
            const cart = window.$nuxt.$store.state.cart;
            if (cart && cart.items) return cart.items
                .filter(i => !i.is_delivery && i.name !== 'מחיר משלוח')
                .map(i => ({id: String(i.id), name: i.name}));
            return [];
        } catch(e) { return []; }
    }""")
    return items


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

    # === STEP 1: Check current cart ===
    print("\n=== STEP 1: Check current cart ===", flush=True)
    cart = await check_cart(page)
    has_product = any(i["id"] == TEST_PRODUCT for i in cart)
    print(f"Cart: {len(cart)} items, {TEST_PRODUCT} in cart: {has_product}", flush=True)

    # === STEP 2: ADD the item (positive qty) ===
    print("\n=== STEP 2: ADD item (qty=1) ===", flush=True)
    await do_httpx_cart_call(page, ctx, {TEST_PRODUCT: 1})

    # === STEP 3: Verify ADD worked ===
    print("\n=== STEP 3: Verify ADD ===", flush=True)
    cart = await check_cart(page)
    has_product = any(i["id"] == TEST_PRODUCT for i in cart)
    print(f"Cart: {len(cart)} items, {TEST_PRODUCT} in cart: {'YES ✅' if has_product else 'NO ❌'}", flush=True)

    # === STEP 4: REMOVE same item (negative qty) — EXACT same httpx call ===
    print("\n=== STEP 4: REMOVE item (qty=-1) ===", flush=True)
    await do_httpx_cart_call(page, ctx, {TEST_PRODUCT: -1})

    # === STEP 5: Verify REMOVE worked ===
    print("\n=== STEP 5: Verify REMOVE ===", flush=True)
    cart = await check_cart(page)
    has_product = any(i["id"] == TEST_PRODUCT for i in cart)
    print(f"Cart: {len(cart)} items, {TEST_PRODUCT} in cart: {'YES ❌ still there' if has_product else 'NO ✅ REMOVED!'}", flush=True)

    if has_product:
        print("\n❌ Negative qty didn't work via httpx", flush=True)
    else:
        print("\n🎉 Negative qty works via httpx!", flush=True)

    await browser.close(); await p.stop()

asyncio.run(test())
