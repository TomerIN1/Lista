"""Test: Login → Extract token → Use httpx (NOT browser) to add items with that token."""
from __future__ import annotations
import asyncio, os, httpx
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

    # Navigate & Login (same flow)
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

    # Extract token
    token = None
    for i in range(10):
        try:
            token = await page.evaluate("() => { try { return JSON.parse(localStorage.getItem('ramilevy')).authuser.user.token; } catch(e) { return null; } }")
            if token: break
        except: pass
        await asyncio.sleep(2)
    if not token: print("NO_TOKEN"); return
    print(f"TOKEN: {token[:50]}...", flush=True)

    # Also extract ALL cookies
    cookies = await ctx.cookies()
    print(f"COOKIES: {len(cookies)} cookies", flush=True)
    for c in cookies:
        print(f"  {c['name']}={c['value'][:30]}... domain={c['domain']}", flush=True)

    # Close browser — we don't need it anymore
    await browser.close()
    await p.stop()

    # Now try adding items via httpx with the extracted token
    print("\n=== TESTING HTTPX ADD ===", flush=True)
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00.000Z")

    # Build cookie string
    cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in cookies)

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

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        # Test 1: Add via POST /api/v2/cart (same-origin URL)
        print("\nTest 1: POST /api/v2/cart (www.rami-levy.co.il)", flush=True)
        resp = await client.post(
            "https://www.rami-levy.co.il/api/v2/cart",
            headers=headers,
            json={"store": "331", "isClub": 0, "supplyAt": tomorrow, "items": {"2968": 1}, "meta": None},
        )
        print(f"  Status: {resp.status_code}", flush=True)
        try:
            data = resp.json()
            items = [i for i in data.get("items", []) if not i.get("is_delivery")]
            print(f"  Items in response: {len(items)}", flush=True)
            for i in items:
                print(f"    {i.get('name', '?')} (id={i.get('id')}, qty={i.get('quantity')})", flush=True)
        except:
            print(f"  Response: {resp.text[:300]}", flush=True)

        # Test 2: Try the www-api endpoint
        print("\nTest 2: POST /api/v2/cart (www-api.rami-levy.co.il)", flush=True)
        resp2 = await client.post(
            "https://www-api.rami-levy.co.il/api/v2/cart",
            headers=headers,
            json={"store": "331", "isClub": 0, "supplyAt": tomorrow, "items": {"2968": 1}, "meta": None},
        )
        print(f"  Status: {resp2.status_code}", flush=True)
        try:
            data2 = resp2.json()
            items2 = [i for i in data2.get("items", []) if not i.get("is_delivery")]
            print(f"  Items: {len(items2)}", flush=True)
        except:
            print(f"  Response: {resp2.text[:300]}", flush=True)

asyncio.run(test())
