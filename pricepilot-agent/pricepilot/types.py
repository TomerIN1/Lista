"""Pydantic models for PricePilot agent data types.

Converted from TypeScript types in Lista's types.ts and
packages_for_online_buying_agent/shared/src/types.ts.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Language(str, Enum):
    EN = "en"
    HE = "he"


class ShoppingCategory(str, Enum):
    GROCERY = "grocery"
    ELECTRONICS = "electronics"
    FASHION = "fashion"
    HOME = "home"
    BEAUTY = "beauty"
    SPORTS = "sports"
    OTHER = "other"


class DisambiguationStatus(str, Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    SKIPPED = "skipped"


class WorkflowPhase(str, Enum):
    """Workflow phases tracked in ADK session.state."""

    IDLE = "idle"
    LIST_RECEIVED = "list_received"
    LIST_PARSED = "list_parsed"
    STORES_CONFIRMED = "stores_confirmed"
    BROWSING = "browsing"
    PRODUCTS_FOUND = "products_found"
    PRODUCTS_SELECTED = "products_selected"
    CHECKOUT_READY = "checkout_ready"
    COMPLETED = "completed"
    ERROR = "error"


# ---------------------------------------------------------------------------
# Core shopping models
# ---------------------------------------------------------------------------


class ShoppingItem(BaseModel):
    """A parsed shopping list item."""

    id: str
    raw_text: str
    name: str
    quantity: float = 1
    unit: Optional[str] = None
    brand: Optional[str] = None
    category: ShoppingCategory = ShoppingCategory.GROCERY
    attributes: list[str] = Field(default_factory=list)


class Product(BaseModel):
    """A product from a store catalog."""

    sku: str
    store_id: str
    name: str
    name_he: Optional[str] = None
    brand: str = ""
    price: float
    sale_price: Optional[float] = None
    currency: str = "ILS"
    unit: str = "pcs"
    unit_size: Optional[float] = None
    image_url: Optional[str] = None
    in_stock: bool = True
    url: Optional[str] = None


class Store(BaseModel):
    """A supermarket / online store."""

    id: str
    name: str
    name_he: str = ""
    logo_url: Optional[str] = None
    delivery_fee: float = 0
    delivery_fee_threshold: Optional[float] = None
    url: Optional[str] = None


class StoreCapabilities(BaseModel):
    """What a store's website supports."""

    has_search: bool = True
    has_cart: bool = True
    has_checkout: bool = True
    requires_login: bool = False
    search_selector: Optional[str] = None
    cart_selector: Optional[str] = None
    checkout_selector: Optional[str] = None
    login_selector: Optional[str] = None


class DiscoveredStore(BaseModel):
    """A store discovered via web search or LLM."""

    id: str
    url: str
    name: str
    name_he: Optional[str] = None
    domain: str
    logo_url: Optional[str] = None
    categories: list[ShoppingCategory] = Field(default_factory=list)
    capabilities: Optional[StoreCapabilities] = None
    is_verified: bool = False


# ---------------------------------------------------------------------------
# Cart & pricing models
# ---------------------------------------------------------------------------


class CartItem(BaseModel):
    """An item in a shopping cart."""

    product: Product
    quantity: float


class StoreBreakdown(BaseModel):
    """Price breakdown for a single store within a pricing plan."""

    store_id: str
    store_name: str
    items: list[CartItem]
    subtotal: float
    delivery_fee: float
    total: float


class PricingPlan(BaseModel):
    """A complete pricing plan across one or more stores."""

    stores: list[str]
    items: list[CartItem]
    subtotal: float
    delivery_fees: float
    total: float
    store_breakdown: list[StoreBreakdown]


class SavingsReport(BaseModel):
    """Comparison of baseline vs best pricing plan."""

    baseline: PricingPlan
    best_plan: PricingPlan
    savings_amount: float
    savings_percent: float
    fee: float  # 5% of savings
    net_benefit: float


# ---------------------------------------------------------------------------
# Disambiguation
# ---------------------------------------------------------------------------


class DisambiguationItem(BaseModel):
    """An item requiring user disambiguation between product options."""

    grocery_item: ShoppingItem
    options: list[Product]
    selected_product: Optional[Product] = None
    status: DisambiguationStatus = DisambiguationStatus.PENDING


# ---------------------------------------------------------------------------
# Chat messages (for API responses to Lista app)
# ---------------------------------------------------------------------------


class ChatButton(BaseModel):
    """An interactive button in a chat message."""

    id: str
    label: str
    action: str
    variant: str = "primary"


class ChatMessage(BaseModel):
    """A message in the PricePilot chat."""

    id: str
    type: str  # "bot" | "user" | "system"
    text: str
    timestamp: float
    buttons: list[ChatButton] = Field(default_factory=list)
    products: list[Product] = Field(default_factory=list)
    savings_report: Optional[SavingsReport] = None
    grocery_list: list[ShoppingItem] = Field(default_factory=list)
