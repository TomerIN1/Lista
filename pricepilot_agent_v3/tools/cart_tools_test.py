"""Quick test: try adding a product by clicking the + button on rami-levy market page."""
from __future__ import annotations
import asyncio
from playwright.async_api import async_playwright

async def test_add_by_click():
    p = await async_playwright().start()
    browser = await p.chromium.launch(headless=True)
    ctx = await browser.new_context(locale="he-IL", timezone_id="Asia/Jerusalem",
        viewport={"width": 1280, "height": 800})
    page = await ctx.new_page()

    # Navigate to market
    print("Navigating to market...")
    await page.goto("https://www.rami-levy.co.il/he/online/market", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)

    # Search for product using the search bar on the site
    print("Searching for אשל...")
    search_input = page.locator('input[type="search"], input[placeholder*="חיפוש"], input[placeholder*="חפש"]')
    count = await search_input.count()
    print(f"Found {count} search inputs")

    if count > 0:
        await search_input.first.fill("אשל 4.5%")
        await search_input.first.press("Enter")
        await asyncio.sleep(3)
        await page.screenshot(path="/tmp/test_search_result.png")
        print("Search results screenshot saved")

        # Find + buttons on product cards
        plus_buttons = page.locator('button:has-text("+"), button[aria-label*="הוסף"]')
        plus_count = await plus_buttons.count()
        print(f"Found {plus_count} + buttons")

        if plus_count > 0:
            # Get the first button's details
            for i in range(min(3, plus_count)):
                label = await plus_buttons.nth(i).get_attribute("aria-label") or ""
                text = await plus_buttons.nth(i).inner_text()
                print(f"  Button {i}: label='{label}' text='{text}'")
    else:
        # Try the search icon/button
        print("No search input found, checking page structure...")
        # Check what's available for searching
        body = await page.evaluate("document.body.innerText.substring(0, 500)")
        print(f"Page text: {body[:300]}")

    await browser.close()
    await p.stop()

asyncio.run(test_add_by_click())
