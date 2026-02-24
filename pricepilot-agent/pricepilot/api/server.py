"""FastAPI REST API server for Lista app integration.

Provides endpoints to create cart-building sessions, send messages,
and manage the PricePilot browser agent.
"""

from __future__ import annotations

import json
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from pricepilot.agent import root_agent
from pricepilot.config import HOST, PORT, STORE_URLS
from pricepilot.tools.browser_tools import close_browser
from pricepilot.types import (
    BuildCartRequest,
    ChatMessageOut,
    MessageRequest,
    MessageResponse,
    SessionCreatedResponse,
    SessionStatusResponse,
)

# ---------------------------------------------------------------------------
# Session service & runner
# ---------------------------------------------------------------------------

session_service = InMemorySessionService()

runner = Runner(
    agent=root_agent,
    app_name="pricepilot",
    session_service=session_service,
)

# Track user_id per session for lookups without requiring user_id in query
_session_user_map: dict[str, str] = {}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_chat_message(role: str, text: str) -> ChatMessageOut:
    return ChatMessageOut(
        id=str(uuid.uuid4()),
        type="bot" if role == "model" else "user",
        text=text,
        timestamp=time.time() * 1000,
    )


def _extract_response_messages(events: list) -> list[ChatMessageOut]:
    """Extract chat messages from ADK runner events."""
    messages: list[ChatMessageOut] = []
    for event in events:
        if hasattr(event, "content") and event.content:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text:
                    messages.append(
                        _make_chat_message(event.content.role, part.text)
                    )
    return messages


def _resolve_store_url(store_name: str, store_url: str | None) -> str:
    """Resolve store URL from name or explicit override."""
    if store_url:
        return store_url
    url = STORE_URLS.get(store_name)
    if url:
        return url
    # Try case-insensitive lookup
    lower = store_name.lower().strip()
    for key, val in STORE_URLS.items():
        if key.lower() == lower:
            return val
    raise ValueError(f"Unknown store: {store_name}")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Cleanup browser on shutdown
    try:
        await close_browser()
    except Exception:
        pass


app = FastAPI(
    title="PricePilot Agent API",
    description="REST API for the PricePilot cart-building agent",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.post("/sessions", response_model=SessionCreatedResponse)
async def create_session(body: BuildCartRequest):
    """Start a new cart-building session.

    Resolves the store URL from STORE_URLS (or uses the provided override),
    then sends the full payload as the first user message to the agent.
    """
    # Resolve store URL
    try:
        store_url = _resolve_store_url(body.store_name, body.store_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    session_id = str(uuid.uuid4())

    # Create ADK session
    await session_service.create_session(
        app_name="pricepilot",
        user_id=body.user_id,
        session_id=session_id,
        state={
            "store_name": body.store_name,
            "store_url": store_url,
            "status": "in_progress",
        },
    )

    _session_user_map[session_id] = body.user_id

    # Build the JSON payload the agent expects
    payload = {
        "store_name": body.store_name,
        "store_url": store_url,
        "city": body.city,
        "items": [item.model_dump(exclude_none=True) for item in body.items],
    }

    content = types.Content(
        role="user",
        parts=[types.Part(text=json.dumps(payload, ensure_ascii=False))],
    )

    events: list[Any] = []
    try:
        async for event in runner.run_async(
            user_id=body.user_id,
            session_id=session_id,
            new_message=content,
        ):
            events.append(event)
    except Exception as e:
        error_msg = str(e)
        print(f"Agent error during session creation: {error_msg[:200]}")
        messages = _extract_response_messages(events)
        messages.append(_make_chat_message("model", f"Sorry, I encountered an error: {error_msg[:150]}"))
        return SessionCreatedResponse(session_id=session_id, messages=messages)

    messages = _extract_response_messages(events)
    return SessionCreatedResponse(session_id=session_id, messages=messages)


@app.post("/sessions/{session_id}/message", response_model=MessageResponse)
async def send_message(session_id: str, body: MessageRequest):
    """Send a user message (disambiguation reply, OTP, etc.) to the agent."""
    content = types.Content(
        role="user",
        parts=[types.Part(text=body.text)],
    )

    events: list[Any] = []
    try:
        async for event in runner.run_async(
            user_id=body.user_id,
            session_id=session_id,
            new_message=content,
        ):
            events.append(event)
    except Exception as e:
        error_msg = str(e)
        print(f"Agent error during message: {error_msg[:200]}")
        messages = _extract_response_messages(events)
        messages.append(_make_chat_message("model", f"Sorry, I encountered an error: {error_msg[:150]}"))
        return MessageResponse(messages=messages, status="error")

    messages = _extract_response_messages(events)

    # Determine status from session state
    session = await session_service.get_session(
        app_name="pricepilot",
        user_id=body.user_id,
        session_id=session_id,
    )
    status = session.state.get("status", "in_progress") if session else "in_progress"

    return MessageResponse(messages=messages, status=status)


@app.get("/sessions/{session_id}", response_model=SessionStatusResponse)
async def get_session(session_id: str, user_id: str):
    """Get the current session status and message history."""
    session = await session_service.get_session(
        app_name="pricepilot",
        user_id=user_id,
        session_id=session_id,
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Extract messages from session events
    messages: list[ChatMessageOut] = []
    if hasattr(session, "events"):
        for event in session.events:
            if hasattr(event, "content") and event.content:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        messages.append(
                            _make_chat_message(event.content.role, part.text)
                        )

    return SessionStatusResponse(
        session_id=session_id,
        status=session.state.get("status", "in_progress"),
        messages=messages,
        checkout_url=session.state.get("checkout_url"),
        items_added=session.state.get("items_added", 0),
        items_failed=session.state.get("items_failed", []),
    )


@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user_id: str):
    """End a session, close the browser, and clean up resources."""
    session = await session_service.get_session(
        app_name="pricepilot",
        user_id=user_id,
        session_id=session_id,
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Close browser to free resources
    try:
        await close_browser()
    except Exception:
        pass

    await session_service.delete_session(
        app_name="pricepilot",
        user_id=user_id,
        session_id=session_id,
    )

    _session_user_map.pop(session_id, None)
    return {"status": "deleted", "session_id": session_id}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "version": "0.2.0"}


# ---------------------------------------------------------------------------
# Run directly
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
