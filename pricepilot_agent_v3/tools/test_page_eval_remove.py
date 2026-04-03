"""Test: Remove item using page.evaluate(fetch(...)) with SET approach.
No httpx. No manual cookies. Let the browser handle everything.
"""
from __future__ import annotations
import asyncio, os, json
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

    # Step 1: Read current cart from Vuex
    print("\n=== STEP 1: Read cart ===", flush=True)
    current_items = await page.evaluate("""() => {
        try {
            const cart = window.$nuxt.$store.state.cart;
            if (!cart || !cart.items) return {};
            const items = {};
            for (const item of cart.items) {
                const qty = parseFloat(item.amount || item.quantity || item.qty || 1);
                items[String(item.id)] = qty.toFixed(2);
            }
            return items;
        } catch(e) { return null; }
    }""")
    print(f"Current cart: {json.dumps(current_items, ensure_ascii=False)}", flush=True)

    # Pick first non-delivery item to remove
    to_remove = None
    for k in current_items:
        if k != "164854":  # skip delivery
            to_remove = k
            break
    if not to_remove:
        print("No item to remove!"); return
    print(f"REMOVING: {to_remove}", flush=True)

    # Step 2: Build items WITHOUT the removed one
    new_items = {k: v for k, v in current_items.items() if k != to_remove}
    print(f"New items (without {to_remove}): {json.dumps(new_items, ensure_ascii=False)}", flush=True)

    # Step 3: POST via page.evaluate(fetch(...)) — browser context, full session
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00.000Z")
    payload = {
        "store": "331",
        "isClub": 0,
        "supplyAt": tomorrow,
        "items": new_items,
        "meta": None,
    }

    print("\n=== STEP 3: page.evaluate(fetch) — SET approach ===", flush=True)
    result = await page.evaluate("""async (payload) => {
        try {
            const resp = await fetch('https://www.rami-levy.co.il/api/v2/cart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                    'locale': 'he',
                    'Accept': 'application/json, text/plain, */*',
                },
                body: JSON.stringify(payload),
            });
            const data = await resp.json();
            return { ok: resp.ok, status: resp.status, itemCount: (data.items || []).length, apiStatus: data.status };
        } catch(e) {
            return { ok: false, error: e.message };
        }
    }""", payload)
    print(f"Result: {json.dumps(result, ensure_ascii=False)}", flush=True)

    # Step 4: Verify — navigate away and back
    print("\n=== STEP 4: Verify ===", flush=True)
    await page.goto("https://www.google.com", wait_until="domcontentloaded", timeout=15000)
    await asyncio.sleep(3)
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)

    final = await page.evaluate("""() => {
        try {
            const cart = window.$nuxt.$store.state.cart;
            if (cart && cart.items) return cart.items
                .filter(i => !i.is_delivery && i.name !== 'מחיר משלוח')
                .map(i => ({id: String(i.id), name: i.name}));
            return [];
        } catch(e) { return []; }
    }""")
    still_there = any(i["id"] == to_remove for i in final)
    print(f"Final cart: {len(final)} items", flush=True)
    print(f"Removed item still in cart: {'YES ❌' if still_there else 'NO ✅ REMOVED!'}", flush=True)

    await browser.close(); await p.stop()

asyncio.run(test())
