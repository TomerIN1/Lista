"""Abstract base for store adapters.

Each Israeli supermarket chain gets its own adapter implementing this protocol.
The adapter encapsulates all store-specific HTTP calls, URL structures, and
response parsing. The agent and tools never make store-specific calls directly.
"""

from __future__ import annotations

import abc
from typing import Any

from pricepilot.types import (
    CartPreview,
    LoginConfig,
    StoreProduct,
)


class StoreAdapter(abc.ABC):
    """Protocol that every store adapter must implement.

    Design decisions:
    - All methods are async (HTTP I/O bound).
    - Methods return typed Pydantic models, never raw dicts.
    - Auth token is passed explicitly, never stored on the adapter.
    - Adapters are stateless singletons — all state lives in ADK session.
    """

    # ---- identity ----

    @property
    @abc.abstractmethod
    def chain_name(self) -> str:
        """English chain name, e.g. 'Rami Levy'."""

    @property
    @abc.abstractmethod
    def chain_name_he(self) -> str:
        """Hebrew chain name, e.g. 'רמי לוי'."""

    @property
    @abc.abstractmethod
    def default_store_id(self) -> str:
        """Default online store branch ID."""

    # ---- catalog ----

    @abc.abstractmethod
    async def search_by_barcode(
        self, barcode: str, store_id: str | None = None
    ) -> list[StoreProduct]:
        """Search the store catalog by barcode. Returns 0 or 1 results typically."""

    @abc.abstractmethod
    async def search_by_name(
        self, name: str, store_id: str | None = None, limit: int = 10
    ) -> list[StoreProduct]:
        """Search the store catalog by Hebrew product name. May return many results."""

    # ---- cart ----

    @abc.abstractmethod
    async def calculate_cart(
        self,
        store_id: str,
        items: dict[str, int],
        is_club: bool = False,
        auth_token: str | None = None,
    ) -> CartPreview:
        """Cart price calculation. Auth optional but recommended for accurate pricing.

        When auth_token is provided, the API returns prices based on the user's
        delivery address and membership status, which may differ from anonymous pricing.

        Args:
            store_id: Branch ID.
            items: Mapping of store_product_id -> quantity.
            is_club: Whether to use club member pricing.
            auth_token: Optional JWT for address-based pricing.

        Returns:
            CartPreview with itemized prices, delivery fee, promotions.
        """

    @abc.abstractmethod
    async def persist_cart(
        self,
        store_id: str,
        items: dict[str, int],
        auth_token: str,
        is_club: bool = False,
    ) -> bool:
        """Save cart to user's account on the store's server. Requires auth.

        Returns True if cart was successfully persisted.
        """

    # ---- auth & checkout ----

    @abc.abstractmethod
    def get_login_config(self) -> LoginConfig:
        """Return WebView login configuration for this store."""

    @abc.abstractmethod
    def get_checkout_url(self) -> str:
        """Return the checkout page URL (user opens after cart is persisted)."""

    # ---- optional helpers ----

    async def verify_token(self, auth_token: str) -> bool:
        """Check if an auth token is still valid. Default: assume valid."""
        return True

    async def read_persisted_cart(
        self, user_id: str, auth_token: str
    ) -> dict[str, Any] | None:
        """Read the user's current cart from the store. Optional."""
        return None
