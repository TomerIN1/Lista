"""Rami Levy store adapter.

API endpoints discovered via manual probing (documented in pricepilot-agent_v2.md):
- Catalog search:  POST https://www.rami-levy.co.il/api/catalog
- Cart calc/save:  POST https://www.rami-levy.co.il/api/v2/cart
- Customer info:   GET  https://www-api.rami-levy.co.il/api/v2/site/clubs/customer/{user_id}
- Checkout page:   https://www.rami-levy.co.il/he/dashboard/checkout

Key discoveries:
- Catalog and cart-calc work WITHOUT auth.
- Cart persist requires Authorization + ecomtoken headers (same JWT for both).
- Login is OTP-based: POST /api/auth/login twice (send OTP, then verify OTP).
- reCAPTCHA may be required; we attempt with null and fall back gracefully.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from pricepilot.config import get_settings
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

LOGIN_ENDPOINT = f"{API_URL}/api/v2/site/auth/login"
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
        auth_token: str | None = None,
    ) -> CartPreview:
        """Calculate cart prices. Pass auth_token for address-based pricing.

        Args:
            store_id: Branch ID (e.g. "331").
            items: {store_product_id: quantity} mapping.
            is_club: Club member pricing.
            auth_token: Optional JWT — when provided, API returns prices
                based on user's delivery address (may differ from anonymous).
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

        extra_headers = {}
        if auth_token:
            extra_headers = {
                "Authorization": f"Bearer {auth_token}",
                "ecomtoken": auth_token,
            }

        try:
            resp = await self._client.post(
                CART_ENDPOINT, json=payload, headers=extra_headers
            )
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
        cookies: str | None = None,
    ) -> bool:
        """Persist cart to user's Rami Levy account.

        Same endpoint as calculate_cart but WITH auth headers and browser
        cookies. The cookies are essential — without them the API calculates
        prices but does NOT actually save the cart to the user's account.
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
        auth_headers: dict[str, str] = {
            "Authorization": f"Bearer {auth_token}",
            "ecomtoken": auth_token,
            "locale": "he",
        }
        if cookies:
            auth_headers["cookie"] = cookies

        try:
            logger.info(
                "Persisting cart: endpoint=%s, store=%s, items=%s, has_cookies=%s",
                CART_ENDPOINT, store_id, payload["items"], bool(cookies),
            )
            resp = await self._client.post(
                CART_ENDPOINT, json=payload, headers=auth_headers
            )
            logger.info(
                "Cart persist response: status=%d, body=%s",
                resp.status_code, resp.text[:500],
            )
            if resp.status_code == 401:
                logger.warning("Rami Levy auth token expired or invalid")
                return False
            resp.raise_for_status()
            data = resp.json()
            result = data.get("status") == 200
            logger.info("Cart persist data.status=%s, success=%s", data.get("status"), result)
            return result
        except httpx.HTTPError as exc:
            logger.error("Rami Levy cart persist failed: %s", exc)
            return False

    # ---- OTP auth ----

    async def request_login_otp(
        self,
        email: str,
        delivery_method: str = "sms",
        recaptcha_token: str | None = None,
    ) -> dict[str, Any]:
        """Step 1: Send OTP code to the user's registered phone.

        Posts to the login endpoint with email only (no otp_code).
        Requires a reCAPTCHA token solved on the frontend.

        Args:
            email: User's Rami Levy account email.
            delivery_method: "sms" (default) or "voice".
            recaptcha_token: reCAPTCHA response token from frontend.

        Returns:
            Dict with status, phone_last_digits hint, or error info.
        """
        settings = get_settings()
        payload: dict[str, Any] = {
            "username": email,
            "password": None,
            "otp_code": None,
            "recaptcha": recaptcha_token,
            "phone": None,
            "deliveryMethod": delivery_method,
            # OAuth client credentials — may allow the API to skip reCAPTCHA
            # for recognized first-party clients.
            "client_id": "3",
            "client_secret": "ftsV5tiUXp4PsVBHCxbURUEgNAYNoWSlhXLoCtEn",
        }

        extra_headers: dict[str, str] = {}
        if settings.rami_levy_api_client_token:
            extra_headers["Authorization"] = (
                f"Bearer {settings.rami_levy_api_client_token}"
            )

        try:
            resp = await self._client.post(
                LOGIN_ENDPOINT, json=payload, headers=extra_headers
            )
            try:
                data = resp.json()
            except Exception:
                # Got non-JSON (e.g. HTML redirect) — treat as login_unavailable
                logger.warning("Rami Levy login returned non-JSON (status %d)", resp.status_code)
                return {"status": "error", "error": "login_unavailable"}
        except httpx.HTTPError as exc:
            logger.error("Rami Levy OTP request failed: %s", exc)
            return {"status": "error", "error": "network_error"}

        # Check for reCAPTCHA enforcement (status 403, 422 with captcha msg)
        response_text = str(data).lower()
        if resp.status_code == 403 or (
            resp.status_code == 422 and ("captcha" in response_text or "רובוט" in response_text)
        ) or (
            isinstance(data, dict) and "captcha" in response_text
        ):
            logger.warning("Rami Levy login blocked by reCAPTCHA (status %d)", resp.status_code)
            return {
                "status": "error",
                "error": "login_unavailable",
            }

        if resp.status_code >= 400:
            error_msg = data.get("message", data.get("error", "Unknown error"))
            logger.warning(
                "Rami Levy OTP request returned %d: %s",
                resp.status_code,
                error_msg,
            )
            return {"status": "error", "error": str(error_msg)}

        # Success — the API should have sent an OTP to the user's phone.
        phone_hint = data.get("phoneLastDigits", data.get("phone_last_digits"))
        return {
            "status": "otp_sent",
            "phone_last_digits": phone_hint,
            "delivery_method": delivery_method,
        }

    async def verify_login_otp(
        self, email: str, otp_code: str, delivery_method: str = "sms"
    ) -> dict[str, Any]:
        """Step 2: Verify OTP code and obtain JWT token.

        Posts to /api/auth/login with email + otp_code.
        On success, the response contains a JWT token.

        Args:
            email: User's Rami Levy account email.
            otp_code: 6-digit code the user received via SMS/voice.
            delivery_method: "sms" or "voice".

        Returns:
            Dict with status and token on success, or error info.
        """
        settings = get_settings()
        payload = {
            "username": email,
            "password": None,
            "otp_code": otp_code,
            "recaptcha": None,
            "phone": None,
            "deliveryMethod": delivery_method,
        }

        extra_headers: dict[str, str] = {}
        if settings.rami_levy_api_client_token:
            extra_headers["Authorization"] = (
                f"Bearer {settings.rami_levy_api_client_token}"
            )

        try:
            resp = await self._client.post(
                LOGIN_ENDPOINT, json=payload, headers=extra_headers
            )
            try:
                data = resp.json()
            except Exception:
                logger.warning("Rami Levy OTP verify returned non-JSON (status %d)", resp.status_code)
                return {"status": "error", "error": "login_unavailable"}
        except httpx.HTTPError as exc:
            logger.error("Rami Levy OTP verify failed: %s", exc)
            return {"status": "error", "error": "network_error"}

        if resp.status_code >= 400:
            error_msg = data.get("message", data.get("error", "Unknown error"))
            logger.warning(
                "Rami Levy OTP verify returned %d: %s",
                resp.status_code,
                error_msg,
            )
            return {"status": "error", "error": str(error_msg)}

        # Extract JWT token from response
        token = data.get("token")
        if not token:
            logger.error("Rami Levy OTP verify succeeded but no token in response")
            return {
                "status": "error",
                "error": "no_token",
                "message": "Login succeeded but no token was returned.",
            }

        return {
            "status": "success",
            "token": token,
        }

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

        # API "price" is the products-only subtotal (excludes delivery).
        # Add delivery to get the grand total the user will actually pay.
        products_subtotal = data.get("price", 0)
        total = products_subtotal + delivery_fee
        club_price = data.get("priceClub")
        if club_price is not None:
            club_price = club_price + delivery_fee
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
