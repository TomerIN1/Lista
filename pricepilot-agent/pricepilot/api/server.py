"""FastAPI REST API server for Lista app integration.

Provides endpoints to create sessions, send messages, and manage
the PricePilot agent workflow.
"""

from __future__ import annotations

import json
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel

from pricepilot.agent import root_agent
from pricepilot.config import HOST, PORT

# ---------------------------------------------------------------------------
# Session service & runner
# ---------------------------------------------------------------------------

session_service = InMemorySessionService()

runner = Runner(
    agent=root_agent,
    app_name="pricepilot",
    session_service=session_service,
)

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class CreateSessionRequest(BaseModel):
    user_id: str
    list_id: str
    grocery_list: list[dict[str, Any]]


class CreateSessionResponse(BaseModel):
    session_id: str
    messages: list[dict[str, Any]]


class MessageRequest(BaseModel):
    user_id: str
    text: str


class MessageResponse(BaseModel):
    messages: list[dict[str, Any]]
    workflow_phase: Optional[str] = None


class SessionResponse(BaseModel):
    session_id: str
    workflow_phase: Optional[str] = None
    messages: list[dict[str, Any]]
    state: dict[str, Any]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_chat_message(role: str, text: str) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "type": "bot" if role == "model" else "user",
        "text": text,
        "timestamp": time.time() * 1000,
    }


def _extract_response_messages(events: list) -> list[dict[str, Any]]:
    """Extract chat messages from ADK runner events."""
    messages: list[dict[str, Any]] = []
    for event in events:
        if hasattr(event, "content") and event.content:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text:
                    messages.append(
                        _make_chat_message(event.content.role, part.text)
                    )
    return messages


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="PricePilot Agent API",
    description="REST API for the PricePilot shopping agent",
    version="0.1.0",
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


@app.post("/sessions", response_model=CreateSessionResponse)
async def create_session(body: CreateSessionRequest):
    """Create a new PricePilot agent session.

    Initializes the session with the user's grocery list and sends
    the initial greeting message from the agent.
    """
    session_id = str(uuid.uuid4())

    # Create ADK session with initial state
    session = await session_service.create_session(
        app_name="pricepilot",
        user_id=body.user_id,
        session_id=session_id,
        state={
            "list_id": body.list_id,
            "shopping_list_raw": json.dumps(body.grocery_list),
            "workflow_phase": "list_received",
        },
    )

    # Send initial message to trigger the agent
    items_summary = ", ".join(
        item.get("name", item.get("rawText", "item"))
        for item in body.grocery_list[:5]
    )
    if len(body.grocery_list) > 5:
        items_summary += f" (+{len(body.grocery_list) - 5} more)"

    initial_text = (
        f"I have a shopping list with {len(body.grocery_list)} items: {items_summary}. "
        "Please help me find the best prices."
    )

    content = types.Content(
        role="user",
        parts=[types.Part(text=initial_text)],
    )

    events = []
    async for event in runner.run_async(
        user_id=body.user_id,
        session_id=session_id,
        new_message=content,
    ):
        events.append(event)

    messages = _extract_response_messages(events)

    return CreateSessionResponse(session_id=session_id, messages=messages)


@app.post("/sessions/{session_id}/message", response_model=MessageResponse)
async def send_message(session_id: str, body: MessageRequest):
    """Send a user message to the agent and get responses."""
    content = types.Content(
        role="user",
        parts=[types.Part(text=body.text)],
    )

    events = []
    async for event in runner.run_async(
        user_id=body.user_id,
        session_id=session_id,
        new_message=content,
    ):
        events.append(event)

    messages = _extract_response_messages(events)

    # Get current workflow phase from session state
    session = await session_service.get_session(
        app_name="pricepilot",
        user_id=body.user_id,
        session_id=session_id,
    )
    workflow_phase = session.state.get("workflow_phase") if session else None

    return MessageResponse(messages=messages, workflow_phase=workflow_phase)


@app.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str, user_id: str):
    """Get the current session state and message history."""
    session = await session_service.get_session(
        app_name="pricepilot",
        user_id=user_id,
        session_id=session_id,
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Extract messages from session events
    messages: list[dict[str, Any]] = []
    if hasattr(session, "events"):
        for event in session.events:
            if hasattr(event, "content") and event.content:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        messages.append(
                            _make_chat_message(event.content.role, part.text)
                        )

    return SessionResponse(
        session_id=session_id,
        workflow_phase=session.state.get("workflow_phase"),
        messages=messages,
        state=dict(session.state),
    )


@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user_id: str):
    """End a session and clean up resources."""
    session = await session_service.get_session(
        app_name="pricepilot",
        user_id=user_id,
        session_id=session_id,
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await session_service.delete_session(
        app_name="pricepilot",
        user_id=user_id,
        session_id=session_id,
    )
    return {"status": "deleted", "session_id": session_id}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "agent": "pricepilot"}


# ---------------------------------------------------------------------------
# Run directly
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
