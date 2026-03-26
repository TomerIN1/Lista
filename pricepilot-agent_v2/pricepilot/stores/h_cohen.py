"""H. Cohen store adapter stub.

H. Cohen (ח. כהן) is an Israeli supermarket chain.
Their API has not been researched yet.

TODO: Research H. Cohen's web/mobile API endpoints.
"""

from __future__ import annotations

from pricepilot.stores.base import StoreAdapter
from pricepilot.types import CartPreview, LoginConfig, StoreProduct


class HCohenAdapter(StoreAdapter):
    """Stub adapter for H. Cohen. All operations raise NotImplementedError."""

    @property
    def chain_name(self) -> str:
        return "H. Cohen"

    @property
    def chain_name_he(self) -> str:
        return "ח. כהן"

    @property
    def default_store_id(self) -> str:
        return ""

    async def search_by_barcode(
        self, barcode: str, store_id: str | None = None
    ) -> list[StoreProduct]:
        raise NotImplementedError(
            "H. Cohen adapter is not implemented yet."
        )

    async def search_by_name(
        self, name: str, store_id: str | None = None, limit: int = 10
    ) -> list[StoreProduct]:
        raise NotImplementedError(
            "H. Cohen adapter is not implemented yet."
        )

    async def calculate_cart(
        self,
        store_id: str,
        items: dict[str, int],
        is_club: bool = False,
        auth_token: str | None = None,
    ) -> CartPreview:
        raise NotImplementedError(
            "H. Cohen adapter is not implemented yet."
        )

    async def persist_cart(
        self,
        store_id: str,
        items: dict[str, int],
        auth_token: str,
        is_club: bool = False,
    ) -> bool:
        raise NotImplementedError(
            "H. Cohen adapter is not implemented yet."
        )

    def get_login_config(self) -> LoginConfig:
        raise NotImplementedError(
            "H. Cohen adapter is not implemented yet."
        )

    def get_checkout_url(self) -> str:
        raise NotImplementedError(
            "H. Cohen adapter is not implemented yet."
        )
