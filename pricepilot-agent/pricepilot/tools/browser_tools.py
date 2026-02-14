"""Playwright-based browser automation tools for the Browser Agent.

Each public async function is registered as an ADK FunctionTool.
The module maintains a per-session browser/page that is lazily initialized.
"""

from __future__ import annotations

import base64
import json
from typing import Optional

from playwright.async_api import Browser, Page, async_playwright

from pricepilot.config import (
    BROWSER_HEADLESS,
    BROWSER_TIMEOUT,
    BROWSER_VIEWPORT_HEIGHT,
    BROWSER_VIEWPORT_WIDTH,
)

# Module-level browser state (one browser session at a time)
_playwright = None
_browser: Optional[Browser] = None
_page: Optional[Page] = None


async def _ensure_browser() -> Page:
    """Lazily launch browser and return the active page."""
    global _playwright, _browser, _page
    if _page is not None:
        return _page

    _playwright = await async_playwright().start()
    _browser = await _playwright.chromium.launch(
        headless=BROWSER_HEADLESS,
    )
    context = await _browser.new_context(
        viewport={"width": BROWSER_VIEWPORT_WIDTH, "height": BROWSER_VIEWPORT_HEIGHT},
        locale="he-IL",
    )
    context.set_default_timeout(BROWSER_TIMEOUT)
    _page = await context.new_page()
    return _page


async def navigate(url: str) -> str:
    """Navigate to a URL. Returns the page title and current URL."""
    page = await _ensure_browser()
    response = await page.goto(url, wait_until="domcontentloaded")
    status = response.status if response else "unknown"
    title = await page.title()
    return json.dumps({"title": title, "url": page.url, "status": status})


async def screenshot() -> dict:
    """Take a screenshot of the current page. Returns base64-encoded PNG image."""
    page = await _ensure_browser()
    image_bytes = await page.screenshot(full_page=False)
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return {"mime_type": "image/png", "data": b64}


async def click(selector: str) -> str:
    """Click an element on the page using a CSS selector.

    Args:
        selector: CSS selector or text selector (e.g. 'text=Add to cart').
    """
    page = await _ensure_browser()
    await page.click(selector, timeout=BROWSER_TIMEOUT)
    await page.wait_for_load_state("domcontentloaded")
    title = await page.title()
    return json.dumps({"clicked": selector, "url": page.url, "title": title})


async def type_text(selector: str, text: str) -> str:
    """Type text into an input field identified by CSS selector.

    Args:
        selector: CSS selector of the input element.
        text: The text to type.
    """
    page = await _ensure_browser()
    await page.fill(selector, text)
    return json.dumps({"typed": text, "into": selector})


async def press_key(key: str) -> str:
    """Press a keyboard key (e.g. 'Enter', 'Escape', 'Tab').

    Args:
        key: The key to press.
    """
    page = await _ensure_browser()
    await page.keyboard.press(key)
    return json.dumps({"pressed": key})


async def scroll(direction: str = "down", amount: int = 500) -> str:
    """Scroll the page in a given direction.

    Args:
        direction: 'up' or 'down'.
        amount: Pixels to scroll.
    """
    page = await _ensure_browser()
    delta = amount if direction == "down" else -amount
    await page.mouse.wheel(0, delta)
    await page.wait_for_timeout(500)
    return json.dumps({"scrolled": direction, "pixels": amount})


async def get_page_info() -> str:
    """Get current page information: URL, title, and a summary of visible elements."""
    page = await _ensure_browser()
    title = await page.title()
    url = page.url

    # Extract a DOM summary: interactive elements
    summary = await page.evaluate("""() => {
        const elements = [];
        const interactable = document.querySelectorAll(
            'a, button, input, select, textarea, [role="button"], [onclick]'
        );
        for (const el of Array.from(interactable).slice(0, 50)) {
            const tag = el.tagName.toLowerCase();
            const text = (el.textContent || '').trim().slice(0, 80);
            const type = el.getAttribute('type') || '';
            const placeholder = el.getAttribute('placeholder') || '';
            const href = el.getAttribute('href') || '';
            const id = el.id || '';
            const cls = el.className ? String(el.className).slice(0, 40) : '';
            elements.push({tag, text, type, placeholder, href, id, cls});
        }
        return elements;
    }""")

    return json.dumps({"title": title, "url": url, "elements": summary})


async def extract_products() -> str:
    """Extract visible product data from the current page.

    Looks for common product card patterns and extracts name, price, and image.
    """
    page = await _ensure_browser()
    products = await page.evaluate("""() => {
        const results = [];
        // Try common product card selectors
        const selectors = [
            '[data-product]', '.product-card', '.product-item',
            '[class*="product"]', '[class*="Product"]',
            '.item-card', '.grocery-item'
        ];

        for (const sel of selectors) {
            const cards = document.querySelectorAll(sel);
            for (const card of Array.from(cards).slice(0, 20)) {
                const name = (
                    card.querySelector('[class*="name"], [class*="title"], h2, h3, h4')
                    ?.textContent || ''
                ).trim();
                const price = (
                    card.querySelector('[class*="price"], [class*="Price"]')
                    ?.textContent || ''
                ).trim();
                const img = card.querySelector('img')?.src || '';
                if (name) {
                    results.push({name, price, image_url: img});
                }
            }
            if (results.length > 0) break;
        }
        return results;
    }""")

    return json.dumps({"products": products, "count": len(products)})


async def wait_for(milliseconds: int = 1000) -> str:
    """Wait for a specified number of milliseconds.

    Args:
        milliseconds: Time to wait in ms.
    """
    page = await _ensure_browser()
    await page.wait_for_timeout(milliseconds)
    return json.dumps({"waited_ms": milliseconds})


async def close_browser() -> str:
    """Close the browser and clean up resources."""
    global _playwright, _browser, _page
    if _page:
        await _page.close()
        _page = None
    if _browser:
        await _browser.close()
        _browser = None
    if _playwright:
        await _playwright.stop()
        _playwright = None
    return json.dumps({"status": "browser_closed"})
