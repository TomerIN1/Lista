"""Shufersal store adapter stub.

Shufersal (שופרסל) is the largest supermarket chain in Israel.
Their API has not been researched yet. This stub provides the adapter
interface so the registry can list it and the agent can report
"not yet supported" gracefully.

TODO: Research Shufersal's web/mobile API endpoints.
"""

from __future__ import annotations

from pricepilot.stores.base import StoreAdapter
from pricepilot.types import CartPreview, LoginConfig, StoreProduct


class ShufersalAdapter(StoreAdapter):
    """Stub adapter for Shufersal. All operations raise NotImplementedError."""

    @property
    def chain_name(self) -> str:
        return "Shufersal"

    @property
    def chain_name_he(self) -> str:
        return "שופרסל"

    @property
    def default_store_id(self) -> str:
        return ""

    async def search_by_barcode(
        self, barcode: str, store_id: str | None = None
    ) -> list[StoreProduct]:
        raise NotImplementedError(
            "Shufersal adapter is not implemented yet. "
            "API research is required before this store can be supported."
        )

    async def search_by_name(
        self, name: str, store_id: str | None = None, limit: int = 10
    ) -> list[StoreProduct]:
        raise NotImplementedError(
            "Shufersal adapter is not implemented yet."
        )

    async def calculate_cart(
        self,
        store_id: str,
        items: dict[str, int],
        is_club: bool = False,
    ) -> CartPreview:
        raise NotImplementedError(
            "Shufersal adapter is not implemented yet."
        )

    async def persist_cart(
        self,
        store_id: str,
        items: dict[str, int],
        auth_token: str,
        is_club: bool = False,
    ) -> bool:
        raise NotImplementedError(
            "Shufersal adapter is not implemented yet."
        )

    def get_login_config(self) -> LoginConfig:
        raise NotImplementedError(
            "Shufersal adapter is not implemented yet."
        )

    def get_checkout_url(self) -> str:
        raise NotImplementedError(
            "Shufersal adapter is not implemented yet."
        )
