from __future__ import annotations
"""PricePilot Agent tools — organized by domain."""

from tools.auth_tools import (
    check_auth_status,
    initialize_shopping_session,
    open_rami_levy_browser,
    start_login,
    submit_otp,
)
from tools.cart_tools import (
    add_items_to_cart,
    clear_cart,
    read_cart,
    remove_cart_item,
)
from tools.handoff_tools import (
    generate_handoff,
    verify_session_continuity,
)
from tools.search_tools import (
    find_replacements,
    search_products,
)

__all__ = [
    # Auth
    "initialize_shopping_session",
    "open_rami_levy_browser",
    "start_login",
    "submit_otp",
    # Cart
    "read_cart",
    "clear_cart",
    "add_items_to_cart",
    "remove_cart_item",
    # Search
    "search_products",
    "find_replacements",
    # Handoff
    "verify_session_continuity",
    "generate_handoff",
]
