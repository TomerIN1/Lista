"""Rami Levy store adapter.

API endpoints discovered via manual probing (documented in pricepilot-agent_v2.md):
- Catalog search:  POST https://www.rami-levy.co.il/api/catalog
- Cart calc/save:  POST https://www.rami-levy.co.il/api/v2/cart
- Customer info:   GET  https://www-api.rami-levy.co.il/api/v2/site/clubs/customer/{user_id}
- Checkout page:   https://www.rami-levy.co.il/he/dashboard/checkout

Key discoveries:
- Catalog and cart-calc work WITHOUT auth.
- Cart persist requires Authorization + ecomtoken headers (same JWT for both).
- Login is a Vue.js modal, no dedicated login page URL.
- All auth endpoints require reCAPTCHA -> must use WebView.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from pricepilot.stores.base import StoreAdapter
from pricepilot.types import (
    CartPreview,
    CartPreviewItem,
    LoginConfig,
    StoreProduct,
    StorePromotion,
)

logger = logging.getLogger(__name__)

# ---------- Constants ----------

BASE_URL = "https://www.rami-levy.co.il"
API_URL = "https://www-api.rami-levy.co.il"
DEFAULT_STORE_ID = "331"  # Rami Levy Online

CATALOG_ENDPOINT = f"{BASE_URL}/api/catalog"
CART_ENDPOINT = f"{BASE_URL}/api/v2/cart"
CUSTOMER_ENDPOINT = f"{API_URL}/api/v2/site/clubs/customer"

COMMON_HEADERS = {
    "content-type": "application/json;charset=UTF-8",
    "locale": "he",
    "accept": "application/json, text/plain, */*",
    "user-agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
}

# Timeout for HTTP calls (seconds)
HTTP_TIMEOUT = 15.0


class RamiLevyAdapter(StoreAdapter):
    """Adapter for Rami Levy supermarket chain.

    All HTTP calls use httpx.AsyncClient for connection pooling.
    The adapter is stateless — auth tokens are passed per-call.
    """

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            headers=COMMON_HEADERS,
            timeout=HTTP_TIMEOUT,
            follow_redirects=True,
        )

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

    # ---- identity ----

    @property
    def chain_name(self) -> str:
        return "Rami Levy"

    @property
    def chain_name_he(self) -> str:
        return "רמי לוי"

    @property
    def default_store_id(self) -> str:
        return DEFAULT_STORE_ID

    # ---- catalog ----

    async def search_by_barcode(
        self, barcode: str, store_id: str | None = None
    ) -> list[StoreProduct]:
        """Search Rami Levy catalog by exact barcode."""
        store = store_id or self.default_store_id
        payload = {"q": barcode, "store": store, "aggs": 1}

        try:
            resp = await self._client.post(CATALOG_ENDPOINT, json=payload)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as exc:
            logger.error("Rami Levy catalog search failed for barcode %s: %s", barcode, exc)
            return []

        return self._parse_catalog_results(data, store)

    async def search_by_name(
        self, name: str, store_id: str | None = None, limit: int = 10
    ) -> list[StoreProduct]:
        """Search Rami Levy catalog by Hebrew product name."""
        store = store_id or self.default_store_id
        payload = {"q": name, "store": store, "aggs": 1}

        try:
            resp = await self._client.post(CATALOG_ENDPOINT, json=payload)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as exc:
            logger.error("Rami Levy catalog search failed for name '%s': %s", name, exc)
            return []

        results = self._parse_catalog_results(data, store)
        return results[:limit]

    # ---- cart ----

    async def calculate_cart(
        self,
        store_id: str,
        items: dict[str, int],
        is_club: bool = False,
    ) -> CartPreview:
        """Calculate cart prices without auth.

        Args:
            store_id: Branch ID (e.g. "331").
            items: {store_product_id: quantity} mapping.
            is_club: Club member pricing.
        """
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime(
            "%Y-%m-%dT00:00:00.000Z"
        )
        payload = {
            "store": store_id,
            "isClub": 1 if is_club else 0,
            "supplyAt": tomorrow,
            "items": {str(k): str(v) for k, v in items.items()},
            "meta": None,
        }

        try:
            resp = await self._client.post(CART_ENDPOINT, json=payload)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as exc:
            logger.error("Rami Levy cart calculation failed: %s", exc)
            raise RuntimeError(f"Cart calculation failed: {exc}") from exc

        return self._parse_cart_response(data)

    async def persist_cart(
        self,
        store_id: str,
        items: dict[str, int],
        auth_token: str,
        is_club: bool = False,
    ) -> bool:
        """Persist cart to user's Rami Levy account.

        Same endpoint as calculate_cart but WITH auth headers.
        The auth token is used for both Authorization and ecomtoken headers.
        """
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime(
            "%Y-%m-%dT00:00:00.000Z"
        )
        payload = {
            "store": store_id,
            "isClub": 1 if is_club else 0,
            "supplyAt": tomorrow,
            "items": {str(k): str(v) for k, v in items.items()},
            "meta": None,
        }
        auth_headers = {
            "Authorization": f"Bearer {auth_token}",
            "ecomtoken": auth_token,
        }

        try:
            resp = await self._client.post(
                CART_ENDPOINT, json=payload, headers=auth_headers
            )
            if resp.status_code == 401:
                logger.warning("Rami Levy auth token expired or invalid")
                return False
            resp.raise_for_status()
            data = resp.json()
            return data.get("status") == 200
        except httpx.HTTPError as exc:
            logger.error("Rami Levy cart persist failed: %s", exc)
            return False

    # ---- auth & checkout ----

    def get_login_config(self) -> LoginConfig:
        """Return WebView login config for Rami Levy.

        Key discovery: There is NO login page URL. Login is a Vue.js modal
        triggered via $nuxt.$root.$emit('OpenLoginModal').
        """
        return LoginConfig(
            base_url=f"{BASE_URL}/he",
            js_trigger="window.$nuxt.$root.$emit('OpenLoginModal')",
            js_fallback="document.querySelector('[aria-label=\"התחברות\"]').click()",
            manual_instruction=(
                'לחץ על "התחברות" בתפריט העליון של האתר. '
                "אם אין לך חשבון, תוכל להירשם דרך אותו חלון."
            ),
            token_extraction_js=(
                "(() => {"
                "  try {"
                "    const s = JSON.parse(localStorage.ramilevy);"
                "    const u = s.authuser.user;"
                "    return JSON.stringify({token: u.token, userId: u.id});"
                "  } catch(e) { return null; }"
                "})()"
            ),
            checkout_url=f"{BASE_URL}/he/dashboard/checkout",
        )

    def get_checkout_url(self) -> str:
        return f"{BASE_URL}/he/dashboard/checkout"

    # ---- optional helpers ----

    async def verify_token(self, auth_token: str) -> bool:
        """Verify token by making a lightweight authenticated call."""
        auth_headers = {
            "Authorization": f"Bearer {auth_token}",
            "ecomtoken": auth_token,
        }
        try:
            # Use a minimal cart calc as a token validity check
            resp = await self._client.post(
                CART_ENDPOINT,
                json={
                    "store": self.default_store_id,
                    "isClub": 0,
                    "supplyAt": "2099-01-01T00:00:00.000Z",
                    "items": {},
                    "meta": None,
                },
                headers=auth_headers,
            )
            return resp.status_code != 401
        except httpx.HTTPError:
            return False

    async def read_persisted_cart(
        self, user_id: str, auth_token: str
    ) -> dict[str, Any] | None:
        """Read the user's current Rami Levy cart."""
        auth_headers = {
            "Authorization": f"Bearer {auth_token}",
            "ecomtoken": auth_token,
        }
        try:
            resp = await self._client.get(
                f"{CUSTOMER_ENDPOINT}/{user_id}",
                headers=auth_headers,
            )
            if resp.status_code == 401:
                return None
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as exc:
            logger.error("Failed to read Rami Levy cart: %s", exc)
            return None

    # ---- internal parsing ----

    def _parse_catalog_results(
        self, data: dict[str, Any], store_id: str
    ) -> list[StoreProduct]:
        """Parse Rami Levy catalog API response into StoreProduct list."""
        raw_items = data.get("data", [])
        products: list[StoreProduct] = []

        for item in raw_items:
            # Check stock availability for the requested store
            available_stores = item.get("available_in", [])
            in_stock = int(store_id) in available_stores if available_stores else True

            # Parse promotion if present
            promotion = None
            sales = item.get("sale", [])
            if sales:
                sale = sales[0]
                promotion = StorePromotion(
                    description=sale.get("name", ""),
                    promo_price=sale.get("scm"),
                    min_quantity=sale.get("cmt"),
                )

            # Build image URL
            barcode = str(item.get("barcode", ""))
            images = item.get("images", {})
            image_url = None
            if images.get("small"):
                image_url = f"{BASE_URL}{images['small']}"

            price_info = item.get("price", {})
            price = price_info.get("price", 0) if isinstance(price_info, dict) else 0

            products.append(
                StoreProduct(
                    store_product_id=str(item.get("id", "")),
                    barcode=barcode,
                    name=item.get("name", ""),
                    price=price,
                    image_url=image_url,
                    in_stock=in_stock,
                    promotion=promotion,
                    raw=item,
                )
            )

        return products

    def _parse_cart_response(self, data: dict[str, Any]) -> CartPreview:
        """Parse Rami Levy cart API response into CartPreview."""
        cart_items: list[CartPreviewItem] = []
        delivery_fee = 0.0

        for item in data.get("items", []):
            is_delivery = item.get("is_delivery", False)
            # Delivery item has a specific id (164854) and name "מחיר משלוח"
            if is_delivery or "משלוח" in item.get("name", ""):
                delivery_fee = item.get("FormatedTotalPrice", item.get("price", 0))
                cart_items.append(
                    CartPreviewItem(
                        store_product_id=str(item["id"]),
                        name=item["name"],
                        unit_price=item.get("price", 0),
                        quantity=item.get("quantity", 1),
                        total_price=item.get("FormatedTotalPrice", 0),
                        savings=item.get("FormatedSavePrice", 0),
                        is_delivery_fee=True,
                    )
                )
            else:
                cart_items.append(
                    CartPreviewItem(
                        store_product_id=str(item["id"]),
                        name=item["name"],
                        unit_price=item.get("price", 0),
                        quantity=item.get("quantity", 1),
                        total_price=item.get("FormatedTotalPrice", 0),
                        savings=item.get("FormatedSavePrice", 0),
                        is_delivery_fee=False,
                    )
                )

        # Extract promotion descriptions
        promotions: list[str] = []
        for sale in data.get("sales", []):
            if isinstance(sale, dict) and sale.get("name"):
                promotions.append(sale["name"])

        total = data.get("price", 0)
        club_price = data.get("priceClub")
        # Item count excludes delivery
        item_count = sum(1 for ci in cart_items if not ci.is_delivery_fee)

        return CartPreview(
            total_price=total,
            club_price=club_price if club_price != total else None,
            delivery_fee=delivery_fee,
            item_count=item_count,
            items=cart_items,
            promotions_applied=promotions,
        )
