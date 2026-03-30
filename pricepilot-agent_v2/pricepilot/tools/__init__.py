"""PricePilot ADK tools.

These are the tools available to the PricePilot agent. Each tool is a plain
async function. The agent calls them based on its reasoning.

Tool design principles:
- Tools do the work, the LLM decides what to call and interprets results.
- Tools return structured data (dicts with "status" key), never raw API responses.
- Tools handle their own errors and return descriptive error messages.
- Store-specific logic lives in adapters, not in tools.
"""

from pricepilot.tools.auth_tools import (
    browser_request_otp,
    browser_verify_otp,
    shutdown_browser,
)
from pricepilot.tools.cart_tools import (
    read_existing_cart,
    clear_existing_cart,
    calculate_cart_preview,
    persist_cart_to_store,
    get_checkout_info,
    browser_go_to_checkout,
    browser_remove_cart_item,
    browser_set_item_quantity,
    browser_read_cart_items,
)
from pricepilot.tools.product_tools import (
    resolve_products,
    search_product_by_barcode,
    search_product_by_name,
    find_alternatives,
    modify_cart,
)
from pricepilot.tools.store_tools import list_supported_stores

__all__ = [
    "browser_request_otp",
    "browser_verify_otp",
    "shutdown_browser",
    "read_existing_cart",
    "clear_existing_cart",
    "calculate_cart_preview",
    "persist_cart_to_store",
    "get_checkout_info",
    "browser_go_to_checkout",
    "browser_remove_cart_item",
    "browser_set_item_quantity",
    "browser_read_cart_items",
    "resolve_products",
    "search_product_by_barcode",
    "search_product_by_name",
    "find_alternatives",
    "modify_cart",
    "list_supported_stores",
]
