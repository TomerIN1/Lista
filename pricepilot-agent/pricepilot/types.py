"""Pydantic models for PricePilot cart-building agent."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Cart items (input from Lista)
# ---------------------------------------------------------------------------


class CartItem(BaseModel):
    """A single item to add to the online store cart."""

    name: str
    quantity: int = 1
    barcode: Optional[str] = None
    manufacturer: Optional[str] = None


# ---------------------------------------------------------------------------
# API request models
# ---------------------------------------------------------------------------


class BuildCartRequest(BaseModel):
    """Request to start a cart-building session."""

    user_id: str
    store_name: str
    store_url: Optional[str] = None  # Override for unlisted stores
    city: Optional[str] = None
    items: list[CartItem]


class MessageRequest(BaseModel):
    """User reply during an active session (disambiguation, OTP, etc.)."""

    user_id: str
    text: str


# ---------------------------------------------------------------------------
# API response models
# ---------------------------------------------------------------------------


class ChatMessageOut(BaseModel):
    """A single message in the agent chat."""

    id: str
    type: str  # "bot" | "user" | "system"
    text: str
    timestamp: float


class SessionCreatedResponse(BaseModel):
    """Response when a new cart-building session is created."""

    session_id: str
    messages: list[ChatMessageOut] = Field(default_factory=list)


class MessageResponse(BaseModel):
    """Response to a user message within a session."""

    messages: list[ChatMessageOut] = Field(default_factory=list)
    status: Optional[str] = None  # in_progress | checkout_ready | error


class SessionStatusResponse(BaseModel):
    """Full session status with progress details."""

    session_id: str
    status: str  # in_progress | checkout_ready | completed | error
    messages: list[ChatMessageOut] = Field(default_factory=list)
    checkout_url: Optional[str] = None
    items_added: int = 0
    items_failed: list[str] = Field(default_factory=list)
