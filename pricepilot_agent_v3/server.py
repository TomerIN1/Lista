from __future__ import annotations
"""FastAPI server for PricePilot Agent v3.

Provides:
- /api/chat — SSE endpoint for Lista frontend integration
- /api/sessions — session management
- /api/handoff/{session_id} — retrieve session handoff data
- /health — health check
- ADK dev UI at /dev-ui (when enabled)
"""

import asyncio
import json
import logging
import sys
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from google.adk.runners import Runner
from google.adk.sessions import DatabaseSessionService, InMemorySessionService
from google.genai import types

# Ensure project root is importable
sys.path.insert(0, str(Path(__file__).parent))

from config import settings
from services.browser import BrowserManager

logging.basicConfig(
    level=getattr(logging, settings.agent_log_level),
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

APP_NAME = "pricepilot"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info("PricePilot Agent v3 starting up")
    yield
    # Shutdown: close all browser sessions
    try:
        manager = await BrowserManager.get_instance()
        await manager.shutdown()
    except Exception:
        pass
    logger.info("PricePilot Agent v3 shut down")


app = FastAPI(
    title="PricePilot Agent v3",
    description="Deterministic supermarket shopping agent for Rami Levy",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Services ---

# Use DB session service if configured, else in-memory for dev
if settings.session_db_url and "sqlite" in settings.session_db_url:
    session_service = DatabaseSessionService(db_url=settings.session_db_url)
else:
    session_service = InMemorySessionService()


def _get_runner() -> Runner:
    """Lazy-load the agent and create a runner."""
    from agent import root_agent

    return Runner(
        agent=root_agent,
        app_name=APP_NAME,
        session_service=session_service,
    )


# --- Endpoints ---


@app.get("/health")
async def health():
    return {"status": "healthy", "agent": APP_NAME, "version": "3.0.0"}


@app.post("/api/sessions")
async def create_session(request: Request):
    """Create a new agent session."""
    body = await request.json() if request.headers.get("content-type") == "application/json" else {}
    user_id = body.get("user_id", f"user_{uuid.uuid4().hex[:8]}")
    session_id = body.get("session_id", f"sess_{uuid.uuid4().hex[:12]}")
    store_id = body.get("store_id", settings.rami_levy_default_store)

    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
        state={
            "session_id": session_id,
            "store_id": store_id,
            "authenticated": False,
            "handoff_ready": False,
        },
    )

    return {
        "session_id": session.id,
        "user_id": user_id,
        "store_id": store_id,
    }


@app.post("/api/chat")
async def chat(request: Request):
    """Send a message to the agent and stream responses via SSE.

    Request body:
    {
        "message": "Buy 2 milk and 3 eggs",
        "session_id": "sess_...",
        "user_id": "user_..."
    }
    """
    body = await request.json()
    message = body.get("message", "").strip()
    session_id = body.get("session_id")
    user_id = body.get("user_id", "default_user")

    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    runner = _get_runner()

    user_content = types.Content(
        role="user",
        parts=[types.Part.from_text(text=message)],
    )

    async def event_stream():
        try:
            async for event in runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=user_content,
            ):
                # Extract text from agent responses
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.text:
                            payload = json.dumps({
                                "type": "text",
                                "agent": event.author,
                                "text": part.text,
                                "turn_complete": getattr(event, "turn_complete", False),
                            })
                            yield f"data: {payload}

"

                        # Tool calls (for transparency)
                        if hasattr(part, "function_call") and part.function_call:
                            payload = json.dumps({
                                "type": "tool_call",
                                "agent": event.author,
                                "tool": part.function_call.name,
                                "args": dict(part.function_call.args) if part.function_call.args else {},
                            })
                            yield f"data: {payload}

"

                        if hasattr(part, "function_response") and part.function_response:
                            payload = json.dumps({
                                "type": "tool_result",
                                "agent": event.author,
                                "tool": part.function_response.name,
                                "result": part.function_response.response if part.function_response.response else {},
                            })
                            yield f"data: {payload}

"

                # State changes
                if event.actions and event.actions.state_delta:
                    payload = json.dumps({
                        "type": "state_update",
                        "delta": event.actions.state_delta,
                    })
                    yield f"data: {payload}

"

            # Signal stream end
            yield f"data: {json.dumps({'type': 'done'})}

"

        except Exception as e:
            logger.error("Stream error: %s", e, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}

"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/handoff/{session_id}")
async def get_handoff(session_id: str, user_id: str = "default_user"):
    """Retrieve the session handoff data (cookies + localStorage) for checkout.

    The frontend uses this to restore the browser session so the user can
    continue checkout without re-authenticating.
    """
    try:
        session = await session_service.get_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id,
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    handoff_data = session.state.get("handoff_data")
    if not handoff_data:
        raise HTTPException(status_code=404, detail="No handoff data available for this session")

    return JSONResponse(content=json.loads(handoff_data))


@app.get("/api/session/{session_id}/state")
async def get_session_state(session_id: str, user_id: str = "default_user"):
    """Get current session state (for debugging and frontend status display)."""
    try:
        session = await session_service.get_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id,
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Return safe subset of state
    state = session.state or {}
    return {
        "session_id": session_id,
        "authenticated": state.get("authenticated", False),
        "cart_item_count": state.get("cart_item_count", 0),
        "handoff_ready": state.get("handoff_ready", False),
        "store_id": state.get("store_id"),
        "user_email": state.get("user_email", ""),
    }


def main():
    uvicorn.run(
        "server:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level=settings.agent_log_level.lower(),
    )


if __name__ == "__main__":
    main()
