"""FastAPI server that wraps the PricePilot ADK agent.

This server exposes a REST API for the Lista frontend to call.
It manages ADK sessions and proxies messages to/from the agent.

Endpoints:
- POST /api/build-cart       Start a new cart-building session
- POST /api/message          Send a follow-up message (disambiguation, auth token, etc.)
- GET  /api/session/{id}     Get current session state
- GET  /api/stores           List supported stores
- GET  /api/health           Health check
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types
from pydantic import BaseModel, Field

from pricepilot.agent import pricepilot_agent
from pricepilot.config import get_settings
from pricepilot.stores import list_supported_stores
from pricepilot.tools.auth_tools import shutdown_browser
from pricepilot.types import CartBuildRequest

# Configure root logger so all pricepilot.* loggers output to stdout
# (Cloud Run captures stdout/stderr as logs)
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# FastAPI app
# ------------------------------------------------------------------

app = FastAPI(
    title="PricePilot v2",
    description="API-first cart builder for Israeli supermarkets",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://lista-six-psi.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def _shutdown_event():
    """Clean up Playwright browser on server shutdown."""
    await shutdown_browser()

# ------------------------------------------------------------------
# ADK runner setup
# ------------------------------------------------------------------

APP_NAME = "pricepilot"
session_service = InMemorySessionService()

runner = Runner(
    agent=pricepilot_agent,
    app_name=APP_NAME,
    session_service=session_service,
)


# ------------------------------------------------------------------
# Request/response models
# ------------------------------------------------------------------


class BuildCartResponse(BaseModel):
    session_id: str
    user_id: str
    messages: list[dict[str, Any]]
    cart_script: str | None = None


class MessageRequest(BaseModel):
    session_id: str
    user_id: str
    message: str
    auth_token: str | None = Field(
        default=None,
        description="JWT token from WebView login, sent when user completes auth",
    )


class MessageResponse(BaseModel):
    messages: list[dict[str, Any]]
    phase: str | None = None
    cart_persisted: bool = False
    checkout_url: str | None = None
    cart_script: str | None = None


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------


async def _run_agent(
    session_id: str, user_id: str, message: str
) -> list[dict[str, Any]]:
    """Send a message to the agent and collect all response events."""
    content = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=message)],
    )

    messages: list[dict[str, Any]] = []
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=content,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    messages.append(
                        {
                            "role": event.content.role or "model",
                            "text": part.text,
                            "author": event.author,
                        }
                    )
    return messages


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    settings = get_settings()
    return {
        "status": "ok",
        "version": "2.0.0",
        "model": settings.llm_model,
    }


@app.get("/api/stores")
async def stores():
    """List all supported supermarket chains."""
    return {"stores": list_supported_stores()}


@app.post("/api/build-cart", response_model=BuildCartResponse)
async def build_cart(request: CartBuildRequest):
    """Start a new cart-building session.

    Called when the user taps 'Build Cart at [Store]' in Lista.
    Creates an ADK session, seeds it with the item list and store info,
    and kicks off the resolution phase.
    """
    user_id = f"lista-user-{uuid.uuid4().hex[:8]}"
    session_id = f"cart-{uuid.uuid4().hex[:12]}"

    # Create session with initial state.
    # session_id is stored in state so browser auth tools can use it
    # as a key for the Playwright browser session registry.
    initial_state: dict[str, Any] = {
        "session_id": session_id,
        "store_name": request.store_name,
        "store_id": request.store_id,
        "items_to_add": [item.model_dump() for item in request.items],
        "user_address": request.user_address,
        "user_city": request.user_city,
        "phase": "resolve",
    }

    # If we already have auth credentials, include them
    if request.auth_token:
        initial_state["auth_token"] = request.auth_token
    if request.user_id:
        initial_state["store_user_id"] = request.user_id

    await session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
        state=initial_state,
    )

    # Build the initial message to the agent
    items_summary = "\n".join(
        f"- {item.name} (barcode: {item.barcode}, qty: {item.quantity})"
        for item in request.items
    )
    initial_message = (
        f"Build a cart at {request.store_name} (store ID: {request.store_id}) "
        f"with these items:\n{items_summary}"
    )

    if request.auth_token:
        initial_message += "\n\nAuth token is already available."

    messages = await _run_agent(session_id, user_id, initial_message)

    # Check session state for cart script
    updated = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id,
    )
    cart_script = updated.state.get("cart_script") if updated else None

    return BuildCartResponse(
        session_id=session_id,
        user_id=user_id,
        messages=messages,
        cart_script=cart_script,
    )


@app.post("/api/message", response_model=MessageResponse)
async def send_message(request: MessageRequest):
    """Send a follow-up message to an existing cart-building session.

    Used for:
    - User disambiguation choices ("I want option 2")
    - User confirming cart ("yes, proceed")
    - Auth token delivery (from WebView login)
    - User questions or corrections
    """
    # Verify session exists
    session = await session_service.get_session(
        app_name=APP_NAME,
        user_id=request.user_id,
        session_id=request.session_id,
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # Ensure session_id is available in state for browser auth tools
    session.state["session_id"] = request.session_id

    # Inject auth_token into session state if provided externally
    message = request.message
    if request.auth_token:
        session.state["auth_token"] = request.auth_token
        message = (
            f"{message}\n\n[SYSTEM: Auth token received. "
            f"Token: {request.auth_token}]"
        )

    messages = await _run_agent(request.session_id, request.user_id, message)

    # Get updated session state for response metadata
    updated_session = await session_service.get_session(
        app_name=APP_NAME,
        user_id=request.user_id,
        session_id=request.session_id,
    )

    state = updated_session.state if updated_session else {}

    return MessageResponse(
        messages=messages,
        phase=state.get("phase"),
        cart_persisted=state.get("cart_persisted", False),
        checkout_url=state.get("checkout_url"),
        cart_script=state.get("cart_script"),
    )


@app.get("/api/session/{session_id}")
async def get_session(session_id: str, user_id: str):
    """Get current session state. Used for polling/debugging.

    Requires user_id as a query parameter for session lookup.
    """
    session = await session_service.get_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session_id,
        "state": session.state,
    }


# ------------------------------------------------------------------
# Entry point
# ------------------------------------------------------------------


def main():
    """Run the server."""
    import uvicorn

    settings = get_settings()
    uvicorn.run(app, host=settings.host, port=settings.port)


if __name__ == "__main__":
    main()
