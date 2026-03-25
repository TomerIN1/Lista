"""Shared types for PricePilot v2."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ------------------------------------------------------------------
# Enums
# ------------------------------------------------------------------

class Phase(str, Enum):
    """Cart-building execution phase."""
    RESOLVE = "resolve"
    PREVIEW = "preview"
    AUTH = "auth"
    PERSIST = "persist"
    CHECKOUT = "checkout"
    DONE = "done"
    ERROR = "error"


class ItemResolutionStatus(str, Enum):
    """Status of resolving a Lista item to a store product."""
    PENDING = "pending"
    RESOLVED = "resolved"
    DISAMBIGUATION_NEEDED = "disambiguation_needed"
    NOT_FOUND = "not_found"
    OUT_OF_STOCK = "out_of_stock"


# ------------------------------------------------------------------
# Input from Lista frontend
# ------------------------------------------------------------------

class CartBuildRequest(BaseModel):
    """Payload sent from Lista when user taps 'Build Cart'."""
    store_name: str = Field(description="Supermarket chain name, e.g. 'Rami Levy'")
    store_id: str = Field(description="Store branch ID, e.g. '331' for Rami Levy Online")
    items: list[CartItem] = Field(description="Items to add to cart")
    user_address: str | None = Field(default=None, description="User delivery address")
    user_city: str | None = Field(default=None, description="User city")
    auth_token: str | None = Field(default=None, description="Saved JWT token if available")
    user_id: str | None = Field(default=None, description="Store user ID if available")


class CartItem(BaseModel):
    """Single item from Lista's shopping list."""
    barcode: str = Field(description="Product barcode (EAN)")
    name: str = Field(description="Product name (Hebrew)")
    quantity: int = Field(default=1, ge=1)
    price: float | None = Field(default=None, description="Expected price from Lista DB")
    manufacturer: str | None = Field(default=None)


# ------------------------------------------------------------------
# Store adapter types
# ------------------------------------------------------------------

class StoreProduct(BaseModel):
    """A product as returned by a store's catalog API."""
    store_product_id: str = Field(description="Store-internal product ID (used for cart ops)")
    barcode: str
    name: str = Field(description="Product name (Hebrew)")
    price: float
    image_url: str | None = None
    in_stock: bool = True
    promotion: StorePromotion | None = None
    raw: dict[str, Any] = Field(default_factory=dict, description="Raw API response for debugging")


class StorePromotion(BaseModel):
    """Active promotion on a store product."""
    description: str
    promo_price: float | None = None
    min_quantity: int | None = None


class CartPreview(BaseModel):
    """Result of a stateless cart price calculation."""
    total_price: float
    club_price: float | None = None
    delivery_fee: float = 0.0
    item_count: int
    items: list[CartPreviewItem]
    promotions_applied: list[str] = Field(default_factory=list)


class CartPreviewItem(BaseModel):
    """Single item in a cart preview."""
    store_product_id: str
    name: str
    unit_price: float
    quantity: int
    total_price: float
    savings: float = 0.0
    is_delivery_fee: bool = False


class LoginConfig(BaseModel):
    """Configuration for store login flow (WebView-based)."""
    base_url: str = Field(description="URL to open in WebView")
    js_trigger: str | None = Field(
        default=None,
        description="JavaScript to inject to open login modal"
    )
    js_fallback: str | None = Field(
        default=None,
        description="Fallback JS if primary trigger fails"
    )
    manual_instruction: str = Field(description="Human-readable login instruction (Hebrew)")
    token_extraction_js: str = Field(
        description="JS to run in WebView to extract auth token after login"
    )
    checkout_url: str = Field(description="URL to redirect user after cart is built")


# ------------------------------------------------------------------
# Resolved item tracking
# ------------------------------------------------------------------

class ResolvedItem(BaseModel):
    """An item that has been resolved to a store product."""
    barcode: str
    lista_name: str
    store_product_id: str
    store_product_name: str
    quantity: int
    price: float
    status: ItemResolutionStatus = ItemResolutionStatus.RESOLVED
    resolution_method: str = Field(description="'barcode', 'name_exact', 'name_disambiguated'")


class UnresolvedItem(BaseModel):
    """An item that could not be automatically resolved."""
    barcode: str
    lista_name: str
    quantity: int
    status: ItemResolutionStatus
    candidates: list[StoreProduct] = Field(default_factory=list)
    reason: str = ""
