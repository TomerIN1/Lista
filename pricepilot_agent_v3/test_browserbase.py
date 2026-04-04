"""Test Browserbase with Israeli residential proxy to bypass Cloudflare.

Previous test was blocked because Browserbase used a data center IP.
This test uses residential proxy with IL geolocation.
"""
from __future__ import annotations
import asyncio
import json
import os

from browserbase import Browserbase
from playwright.async_api import async_playwright

from dotenv import load_dotenv
load_dotenv("/Users/tomer_itzhakov_nevo/Documents/Projects/Lista/pricepilot_agent_v3/.env")

PROJECT_ID = os.getenv("BROWSERBASE_PROJECT_ID")
API_KEY = os.getenv("BROWSERBASE_API_KEY")


async def main():
    print("=== Browserbase + Israeli Residential Proxy Test ===\n")

    # Create session with residential proxy (IL) + stealth
    print("Step 1: Creating session with IL residential proxy...")
    bb = Browserbase(api_key=API_KEY)
    session = bb.sessions.create(
        project_id=PROJECT_ID,
        browser_settings={
            "solve_captchas": True,
            "block_ads": True,
        },
        keep_alive=True,
        region="eu-central-1",  # Closest to Israel
    )
    print(f"  Session ID: {session.id}")
    print(f"  Connect URL: {session.connect_url[:80]}...")

    # Get Live View URL
    debug_url = bb.sessions.debug(session.id)
    live_url = debug_url.debugger_fullscreen_url
    print(f"\n  🔗 LIVE VIEW URL: {live_url}")
    print(f"  👆 Open this in your browser to watch/control!\n")

    with open("/Users/tomer_itzhakov_nevo/Documents/Projects/Lista/pricepilot_agent_v3/session_info.json", "w") as f:
        json.dump({
            "session_id": session.id,
            "live_view_url": live_url,
            "connect_url": session.connect_url,
        }, f, indent=2)

    # Connect Playwright
    print("Step 2: Connecting Playwright...")
    p = await async_playwright().start()
    browser = await p.chromium.connect_over_cdp(session.connect_url)
    context = browser.contexts[0]
    page = context.pages[0]

    # Check our IP first
    print("Step 3: Checking IP address...")
    await page.goto("https://api.ipify.org?format=json", timeout=15000)
    await asyncio.sleep(2)
    ip_text = await page.inner_text("body")
    print(f"  IP: {ip_text}")

    # Navigate to Rami Levy
    print("\nStep 4: Navigating to Rami Levy...")
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)

    # Check if blocked by Cloudflare
    title = await page.title()
    url = page.url
    print(f"  URL: {url}")
    print(f"  Title: {title}")

    # Check for Cloudflare block indicators
    content = await page.content()
    if "Sorry, you have been blocked" in content:
        print("\n  ❌ BLOCKED by Cloudflare!")
    elif "challenge" in content.lower() and "cloudflare" in content.lower():
        print("\n  ⏳ Cloudflare challenge page (waiting for solve_captchas...)")
        await asyncio.sleep(15)
        title = await page.title()
        url = page.url
        print(f"  After wait - URL: {url}")
        print(f"  After wait - Title: {title}")
    elif "רמי לוי" in title or "rami" in url.lower():
        print("\n  ✅ SUCCESS! Rami Levy loaded!")
    else:
        print(f"\n  ⚠️  Unknown state. Check live view.")

    # Dismiss overlays
    for s in ['button:has-text("אישור")', 'button:has-text("הבנתי")', 'button:has-text("סגור")']:
        try:
            b = page.locator(s).first
            if await b.is_visible(timeout=2000):
                await b.click()
                print(f"  Dismissed overlay: {s}")
        except:
            pass

    # Take screenshot
    await page.screenshot(path="/Users/tomer_itzhakov_nevo/Documents/Projects/Lista/pricepilot_agent_v3/browserbase_test_screenshot.png")
    print("  Screenshot saved to browserbase_test_screenshot.png")

    print(f"\n📺 LIVE VIEW: {live_url}")
    print("   Press Ctrl+C when done.\n")

    try:
        while True:
            await asyncio.sleep(5)
    except KeyboardInterrupt:
        print("\nClosing session...")
        await browser.close()
        await p.stop()


asyncio.run(main())
