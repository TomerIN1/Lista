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
    request_login_otp,
    verify_login_otp,
)
from pricepilot.tools.cart_tools import (
    calculate_cart_preview,
    persist_cart_to_store,
    get_checkout_info,
)
from pricepilot.tools.product_tools import (
    resolve_products,
    search_product_by_barcode,
    search_product_by_name,
)

__all__ = [
    "request_login_otp",
    "verify_login_otp",
    "calculate_cart_preview",
    "persist_cart_to_store",
    "get_checkout_info",
    "resolve_products",
    "search_product_by_barcode",
    "search_product_by_name",
]
