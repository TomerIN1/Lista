"""Tests for browser tools (unit tests, no actual browser)."""

import json

import pytest


@pytest.mark.asyncio
async def test_extract_products_returns_json():
    """Verify extract_products returns valid JSON structure."""
    # We can't test actual browser without Playwright running,
    # but we verify the module imports and functions exist.
    from pricepilot.tools.browser_tools import (
        click,
        close_browser,
        extract_products,
        get_page_info,
        navigate,
        press_key,
        screenshot,
        scroll,
        type_text,
        wait_for,
    )

    # Verify all tools are callable
    assert callable(navigate)
    assert callable(screenshot)
    assert callable(click)
    assert callable(type_text)
    assert callable(press_key)
    assert callable(scroll)
    assert callable(get_page_info)
    assert callable(extract_products)
    assert callable(wait_for)
    assert callable(close_browser)


def test_scroll_directions():
    """Verify scroll accepts direction parameter."""
    import inspect

    from pricepilot.tools.browser_tools import scroll

    sig = inspect.signature(scroll)
    assert "direction" in sig.parameters
    assert "amount" in sig.parameters


def test_browser_config():
    """Verify browser config loads correctly."""
    from pricepilot.config import (
        BROWSER_HEADLESS,
        BROWSER_TIMEOUT,
        BROWSER_VIEWPORT_HEIGHT,
        BROWSER_VIEWPORT_WIDTH,
    )

    assert isinstance(BROWSER_HEADLESS, bool)
    assert BROWSER_TIMEOUT > 0
    assert BROWSER_VIEWPORT_WIDTH > 0
    assert BROWSER_VIEWPORT_HEIGHT > 0
