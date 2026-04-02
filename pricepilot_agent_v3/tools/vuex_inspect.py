"""Inspect full Vuex cart item structure for weighted products."""
from __future__ import annotations
import asyncio, os, json
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

    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)

    # Dump FULL structure of weighted items
    result = await page.evaluate("""() => {
        try {
            const cart = window.$nuxt.$store.state.cart;
            if (!cart || !cart.items) return [];
            return cart.items
                .filter(i => !i.is_delivery && i.name !== 'מחיר משלוח')
                .map(i => {
                    // Get ALL fields for debugging
                    const keys = Object.keys(i);
                    const dump = {};
                    for (const k of keys) {
                        const v = i[k];
                        if (typeof v !== 'object' || v === null) {
                            dump[k] = v;
                        } else if (k === 'price' || k === 'prop') {
                            dump[k] = v;
                        }
                    }
                    return dump;
                });
        } catch(e) { return [{error: e.message}]; }
    }""")

    print("\n=== FULL VUEX CART ITEM DUMP ===")
    for item in result:
        name = item.get('name', '?')
        print(f"\n--- {name} ---")
        print(json.dumps(item, ensure_ascii=False, indent=2))

    await browser.close()
    await p.stop()

asyncio.run(test())
