"""Test: Login → Delete cart → Click + button on product → Read cart → Verify."""
from __future__ import annotations
import asyncio, os
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

    # Navigate
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)
    for s in ['button:has-text("אישור")', 'button:has-text("הבנתי")']:
        try:
            b = page.locator(s).first
            if await b.is_visible(timeout=1000): await b.click()
        except: pass

    # Login
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

    # Go to market page
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)

    # Read cart before
    cart_before = await page.evaluate("""() => {
        try {
            const cart = window.$nuxt.$store.state.cart;
            if (cart && cart.items) return cart.items.filter(i => !i.is_delivery && i.name !== 'מחיר משלוח').map(i => i.name);
            return [];
        } catch(e) { return []; }
    }""")
    print(f"BEFORE: {len(cart_before)} items: {cart_before}", flush=True)

    # Search for product
    print("SEARCHING for אשל...", flush=True)
    search_input = page.locator('input[type="search"], input[placeholder*="חיפוש"], input[placeholder*="חפש"]').first
    await search_input.fill("אשל 4.5%")
    await search_input.press("Enter")
    await asyncio.sleep(3)

    # Find and click the + button for אשל
    plus_btn = page.locator('button[aria-label*="הוסף"][aria-label*="אשל"]').first
    try:
        await plus_btn.wait_for(state="visible", timeout=5000)
        label = await plus_btn.get_attribute("aria-label")
        print(f"CLICKING: {label}", flush=True)
        await plus_btn.click()
        await asyncio.sleep(3)
        print("CLICKED +", flush=True)
    except Exception as e:
        print(f"CLICK FAILED: {e}", flush=True)

    await page.screenshot(path="/tmp/test_after_click_add.png")

    # Navigate away and back to verify
    print("NAVIGATING AWAY...", flush=True)
    await page.goto("https://www.google.com", wait_until="domcontentloaded", timeout=15000)
    await asyncio.sleep(3)
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)

    cart_after = await page.evaluate("""() => {
        try {
            const cart = window.$nuxt.$store.state.cart;
            if (cart && cart.items) return cart.items.filter(i => !i.is_delivery && i.name !== 'מחיר משלוח').map(i => ({name: i.name, id: i.id}));
            return [];
        } catch(e) { return []; }
    }""")
    print(f"AFTER: {len(cart_after)} items", flush=True)
    for item in cart_after:
        print(f"  {item['name']} (id={item['id']})", flush=True)

    # Check if אשל is in the cart
    has_eshel = any("אשל" in (i.get("name", "") or "") for i in cart_after)
    print(f"\nאשל IN CART: {'YES ✅' if has_eshel else 'NO ❌'}", flush=True)

    await browser.close()
    await p.stop()

asyncio.run(test())
