"""Test: page.evaluate(fetch) with FULL auth headers (token + ecomtoken).
Previous test only sent Content-Type. This one adds Authorization + ecomtoken.
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

    # Login (same flow)
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

    # Read cart
    current_items = await page.evaluate("""() => {
        try {
            const cart = window.$nuxt.$store.state.cart;
            if (!cart || !cart.items) return {};
            const items = {};
            for (const item of cart.items) {
                const qty = parseFloat(item.amount || item.quantity || 1);
                items[String(item.id)] = qty.toFixed(2);
            }
            return items;
        } catch(e) { return null; }
    }""")
    print(f"\nCart: {json.dumps(current_items, ensure_ascii=False)}", flush=True)

    # Pick first non-delivery item
    to_remove = None
    for k in current_items:
        if k != "164854":
            to_remove = k
            break
    print(f"REMOVING: {to_remove}", flush=True)

    new_items = {k: v for k, v in current_items.items() if k != to_remove}
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00.000Z")

    # page.evaluate(fetch) WITH full auth headers
    print("\n=== page.evaluate(fetch) WITH Authorization + ecomtoken ===", flush=True)
    result = await page.evaluate("""async (args) => {
        try {
            let token = null;
            try {
                token = JSON.parse(localStorage.getItem('ramilevy')).authuser.user.token;
            } catch(e) {}

            const headers = {
                'Content-Type': 'application/json;charset=UTF-8',
                'locale': 'he',
                'Accept': 'application/json, text/plain, */*',
            };
            if (token) {
                headers['Authorization'] = 'Bearer ' + token;
                headers['ecomtoken'] = token;
            }

            const resp = await fetch('/api/v2/cart', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(args.payload),
                credentials: 'include',
            });
            const data = await resp.json();
            return {
                ok: resp.ok,
                status: resp.status,
                itemCount: (data.items || []).filter(i => !i.is_delivery).length,
                hasToken: !!token,
            };
        } catch(e) {
            return { ok: false, error: e.message };
        }
    }""", {"payload": {"store": "331", "isClub": 0, "supplyAt": tomorrow, "items": new_items, "meta": None}})
    print(f"Result: {json.dumps(result, ensure_ascii=False)}", flush=True)

    # Verify
    print("\n=== Verify ===", flush=True)
    await page.goto("https://www.google.com", wait_until="domcontentloaded", timeout=15000)
    await asyncio.sleep(3)
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)
    still = await page.evaluate(f"""() => {{
        try {{
            return window.$nuxt.$store.state.cart.items.some(i => String(i.id) === '{to_remove}');
        }} catch(e) {{ return true; }}
    }}""")
    print(f"Item still in headless cart: {'YES' if still else 'NO'}", flush=True)
    print(f"\n>>> NOW CHECK RAMI-LEVY WEBSITE — is item {to_remove} gone? <<<", flush=True)

    await browser.close(); await p.stop()

asyncio.run(test())
