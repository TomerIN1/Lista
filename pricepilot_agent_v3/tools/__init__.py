from __future__ import annotations
"""PricePilot Agent tools — organized by domain."""

from tools.auth_tools import (
    check_auth_status,
    open_supermarket,
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
    search_products,
)

__all__ = [
    # Auth
    "open_supermarket",
    "start_login",
    "submit_otp",
    "check_auth_status",
    # Cart
    "read_cart",
    "clear_cart",
    "add_items_to_cart",
    "remove_cart_item",
    # Search
    "search_products",
    # Handoff
    "verify_session_continuity",
    "generate_handoff",
]
