"""Test Browserbase: Create session, connect Playwright, navigate to Rami Levy.
Outputs the Live View URL so the user can watch/control in their browser.
"""
from __future__ import annotations
import asyncio
import json
import os

from browserbase import Browserbase
from playwright.async_api import async_playwright

# Load env
from dotenv import load_dotenv
load_dotenv("/Users/tomer_itzhakov_nevo/Documents/Projects/Lista/pricepilot_agent_v3/.env")

PROJECT_ID = os.getenv("BROWSERBASE_PROJECT_ID")
API_KEY = os.getenv("BROWSERBASE_API_KEY")

async def main():
    print("=== Browserbase Session Test ===\n")

    # Step 1: Create a Browserbase session
    print("Step 1: Creating Browserbase session...")
    bb = Browserbase(api_key=API_KEY)
    session = bb.sessions.create(project_id=PROJECT_ID)
    print(f"  Session ID: {session.id}")
    print(f"  Connect URL: {session.connect_url[:80]}...")

    # Step 2: Get the Live View URL
    debug_url = bb.sessions.debug(session.id)
    print(f"\n  🔗 LIVE VIEW URL: {debug_url.debugger_fullscreen_url}")
    print(f"\n  👆 Open this URL in your browser to watch/control the session!")

    # Write the URL to a file so the test.html can read it
    with open("/Users/tomer_itzhakov_nevo/Documents/Projects/Lista/pricepilot_agent_v3/session_info.json", "w") as f:
        json.dump({
            "session_id": session.id,
            "live_view_url": debug_url.debugger_fullscreen_url,
            "connect_url": session.connect_url,
        }, f)
    print("  Session info saved to session_info.json")

    # Step 3: Connect Playwright to the Browserbase session
    print("\nStep 2: Connecting Playwright...")
    p = await async_playwright().start()
    browser = await p.chromium.connect_over_cdp(session.connect_url)
    context = browser.contexts[0]
    page = context.pages[0]

    # Step 4: Navigate to Rami Levy
    print("Step 3: Navigating to Rami Levy...")
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)
    print(f"  Page loaded: {page.url}")

    # Dismiss overlays
    for s in ['button:has-text("אישור")', 'button:has-text("הבנתי")']:
        try:
            b = page.locator(s).first
            if await b.is_visible(timeout=1000): await b.click()
        except: pass

    print("\n✅ Browser is ready on Rami Levy!")
    print("   You can see and control it via the Live View URL above.")
    print("   Press Ctrl+C when done.\n")

    # Keep alive so user can interact
    try:
        while True:
            await asyncio.sleep(5)
    except KeyboardInterrupt:
        print("\nClosing session...")
        await browser.close()
        await p.stop()

asyncio.run(main())
