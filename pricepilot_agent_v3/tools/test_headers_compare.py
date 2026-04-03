"""Compare EXACTLY what our httpx sends vs what the user's browser sends.
Extract all three: Bearer token, ecomtoken, full cookie string.
Print everything so we can compare.
"""
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
    try:
        await page.wait_for_load_state("networkidle", timeout=15000)
    except:
        await asyncio.sleep(3)
    await asyncio.sleep(2)

    # === EXTRACT ALL THREE ===
    print("\n" + "="*60, flush=True)
    print("=== EXTRACTING ALL AUTH DATA ===", flush=True)
    print("="*60, flush=True)

    # 1. Bearer token from localStorage
    bearer_token = await page.evaluate("""() => {
        try { return JSON.parse(localStorage.getItem('ramilevy')).authuser.user.token; }
        catch(e) { return null; }
    }""")
    print(f"\n1. BEARER TOKEN: {bearer_token[:50]}...({len(bearer_token)} chars)" if bearer_token else "1. BEARER TOKEN: MISSING!", flush=True)

    # 2. Ecomtoken — check if it's different from bearer or stored separately
    ecomtoken = await page.evaluate("""() => {
        try {
            const rl = JSON.parse(localStorage.getItem('ramilevy'));
            // Check various locations
            const sources = {
                'authuser.user.token': rl?.authuser?.user?.token,
                'authuser.user.ecomtoken': rl?.authuser?.user?.ecomtoken,
                'ecomtoken': rl?.ecomtoken,
                'authuser.ecomtoken': rl?.authuser?.ecomtoken,
            };
            return sources;
        } catch(e) { return {error: e.message}; }
    }""")
    print(f"\n2. ECOMTOKEN SOURCES:", flush=True)
    for k, v in ecomtoken.items():
        if v:
            val_str = str(v)[:50] + f"...({len(str(v))} chars)" if v and len(str(v)) > 50 else str(v)
            print(f"   {k}: {val_str}", flush=True)
        else:
            print(f"   {k}: None", flush=True)

    # 3. ALL cookies from browser context
    all_cookies = await ctx.cookies()
    print(f"\n3. COOKIES ({len(all_cookies)} total):", flush=True)
    for c in all_cookies:
        print(f"   {c['name']} = {str(c['value'])[:40]}... (domain={c['domain']})", flush=True)

    # Check for critical cookies
    cookie_names = [c['name'] for c in all_cookies]
    critical = ['auth.strategy', 'AWSALB', 'AWSALBCORS', 'cf_clearance', 'i18n_redirected']
    print(f"\n   CRITICAL COOKIES CHECK:", flush=True)
    for name in critical:
        present = name in cookie_names
        print(f"   {name}: {'✅ PRESENT' if present else '❌ MISSING'}", flush=True)

    # 4. Check what the browser itself sends in a fetch — intercept a real request
    print(f"\n4. INTERCEPTING BROWSER'S OWN FETCH HEADERS:", flush=True)
    intercepted = await page.evaluate("""async () => {
        return new Promise((resolve) => {
            const origFetch = window.fetch;
            window.fetch = async function(...args) {
                const [url, opts] = args;
                if (url && url.includes('/api/v2/cart')) {
                    const headers = {};
                    if (opts && opts.headers) {
                        for (const [k, v] of Object.entries(opts.headers)) {
                            headers[k] = typeof v === 'string' ? v.substring(0, 50) : String(v);
                        }
                    }
                    window.fetch = origFetch;
                    const resp = await origFetch.apply(this, args);
                    resolve({intercepted: true, url: url, headers: headers});
                    return resp;
                }
                return origFetch.apply(this, args);
            };

            // Trigger a cart read to intercept
            try {
                window.$nuxt.$store.dispatch('cart/getCart');
            } catch(e) {}

            // Timeout fallback
            setTimeout(() => resolve({intercepted: false, reason: 'timeout'}), 5000);
        });
    }""")
    print(f"   Intercepted: {json.dumps(intercepted, ensure_ascii=False)[:500]}", flush=True)

    # 5. Now build our httpx headers and compare
    cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in all_cookies)
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00.000Z")

    our_headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "locale": "he",
        "Accept": "application/json, text/plain, */*",
        "Authorization": f"Bearer {bearer_token}",
        "ecomtoken": bearer_token,
        "Origin": "https://www.rami-levy.co.il",
        "Referer": "https://www.rami-levy.co.il/he/online/market",
        "Cookie": cookie_str,
    }

    print(f"\n5. OUR HTTPX HEADERS:", flush=True)
    for k, v in our_headers.items():
        if k == "Cookie":
            print(f"   Cookie: ({len(v)} chars, {len(all_cookies)} cookies)", flush=True)
        elif k == "Authorization":
            print(f"   Authorization: Bearer ...({len(bearer_token)} chars)", flush=True)
        elif k == "ecomtoken":
            print(f"   ecomtoken: ...({len(bearer_token)} chars) [same as Bearer]", flush=True)
        else:
            print(f"   {k}: {v}", flush=True)

    # 6. Test: send ADD (should work) then REMOVE (negative) with same headers
    print(f"\n{'='*60}", flush=True)
    print("=== TEST: ADD then REMOVE with these headers ===", flush=True)
    print("="*60, flush=True)

    print("\nADD (qty=1):", flush=True)
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        resp = await client.post("https://www.rami-levy.co.il/api/v2/cart",
            headers=our_headers,
            json={"store": "331", "isClub": 0, "supplyAt": tomorrow, "items": {"305741": 1.0}, "meta": None})
    print(f"  Status: {resp.status_code}", flush=True)

    # Verify add
    await page.goto("https://www.google.com", wait_until="domcontentloaded", timeout=15000)
    await asyncio.sleep(2)
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)
    has_item = await page.evaluate("""() => {
        try {
            return window.$nuxt.$store.state.cart.items.some(i => String(i.id) === '305741');
        } catch(e) { return false; }
    }""")
    print(f"  Added to real cart: {'YES ✅' if has_item else 'NO ❌'}", flush=True)

    # Re-extract cookies after navigation (may have changed)
    all_cookies_2 = await ctx.cookies()
    cookie_str_2 = "; ".join(f"{c['name']}={c['value']}" for c in all_cookies_2)
    our_headers["Cookie"] = cookie_str_2

    # Also re-extract token
    bearer_token_2 = await page.evaluate("""() => {
        try { return JSON.parse(localStorage.getItem('ramilevy')).authuser.user.token; }
        catch(e) { return null; }
    }""")
    our_headers["Authorization"] = f"Bearer {bearer_token_2}"
    our_headers["ecomtoken"] = bearer_token_2

    print(f"\n  Cookies changed: {len(all_cookies)} -> {len(all_cookies_2)}", flush=True)
    print(f"  Token changed: {bearer_token == bearer_token_2}", flush=True)

    print("\nREMOVE (qty=-1):", flush=True)
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        resp = await client.post("https://www.rami-levy.co.il/api/v2/cart",
            headers=our_headers,
            json={"store": "331", "isClub": 0, "supplyAt": tomorrow, "items": {"305741": -1.0}, "meta": None})
    print(f"  Status: {resp.status_code}", flush=True)

    # Verify remove
    await page.goto("https://www.google.com", wait_until="domcontentloaded", timeout=15000)
    await asyncio.sleep(2)
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)
    still_has = await page.evaluate("""() => {
        try {
            return window.$nuxt.$store.state.cart.items.some(i => String(i.id) === '305741');
        } catch(e) { return false; }
    }""")
    print(f"  Removed from real cart: {'NO ❌ still there' if still_has else 'YES ✅ REMOVED!'}", flush=True)

    await browser.close(); await p.stop()

asyncio.run(test())
