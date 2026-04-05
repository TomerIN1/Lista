from __future__ import annotations
"""FastAPI server for PricePilot Agent v4.

Provides:
- /api/sessions — create a new agent session
- /api/chat — SSE endpoint (merges ADK events + browser bridge events)
- /api/tool-response/{session_id} — receives Chrome extension tool results
- /api/session/{session_id}/state — session state (debugging)
- /health — health check
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
from google.adk.sessions import InMemorySessionService
from google.genai import types

# Ensure project root is importable
sys.path.insert(0, str(Path(__file__).parent))

from config import settings
from tools.browser_bridge import (
    register_sse_queue,
    resolve_browser_action,
    unregister_sse_queue,
)

logging.basicConfig(
    level=getattr(logging, settings.agent_log_level),
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

APP_NAME = "pricepilot"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info("PricePilot Agent v4 starting up (browser-bridge mode)")
    yield
    logger.info("PricePilot Agent v4 shut down")


app = FastAPI(
    title="PricePilot Agent v4",
    description="Deterministic supermarket shopping agent — browser bridge architecture",
    version="4.0.0",
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
    return {"status": "healthy", "agent": APP_NAME, "version": "4.0.0", "mode": "browser-bridge"}


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

    The SSE stream merges two sources:
    1. ADK runner events (text, tool_call, tool_result, state_update)
    2. Browser bridge events (browser_action_request — forwarded to the Chrome extension)

    The ADK runner runs in a background task so that browser_action_request events
    can be emitted while a tool function is awaiting the extension's response.
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
        # Register a bridge queue for this session
        bridge_queue = register_sse_queue(session_id)
        # ADK events go into this queue from a background task
        adk_queue: asyncio.Queue = asyncio.Queue()

        async def run_adk():
            """Run the ADK agent in a background task, pushing events to adk_queue."""
            try:
                async for event in runner.run_async(
                    user_id=user_id,
                    session_id=session_id,
                    new_message=user_content,
                ):
                    await adk_queue.put(("adk", event))
            except Exception as e:
                await adk_queue.put(("error", e))
            finally:
                await adk_queue.put(("done", None))

        adk_task = asyncio.create_task(run_adk())

        try:
            adk_done = False
            while not adk_done:
                # Wait on both queues concurrently
                adk_get = asyncio.ensure_future(adk_queue.get())
                bridge_get = asyncio.ensure_future(bridge_queue.get())

                done, pending = await asyncio.wait(
                    [adk_get, bridge_get],
                    return_when=asyncio.FIRST_COMPLETED,
                )

                # Cancel whichever didn't finish
                for task in pending:
                    task.cancel()
                    try:
                        await task
                    except (asyncio.CancelledError, Exception):
                        pass

                for task in done:
                    result = task.result()

                    # --- Bridge event ---
                    if isinstance(result, dict) and result.get("type") == "browser_action_request":
                        payload = json.dumps(result)
                        yield f"data: {payload}\n\n"
                        continue

                    # --- ADK event (tuple) ---
                    if isinstance(result, tuple):
                        tag, value = result

                        if tag == "done":
                            adk_done = True
                            continue

                        if tag == "error":
                            payload = json.dumps({"type": "error", "message": str(value)})
                            yield f"data: {payload}\n\n"
                            adk_done = True
                            continue

                        if tag == "adk":
                            event = value
                            # Text and tool events
                            if event.content and event.content.parts:
                                for part in event.content.parts:
                                    if part.text:
                                        payload = json.dumps({
                                            "type": "text",
                                            "agent": event.author,
                                            "text": part.text,
                                            "turn_complete": getattr(event, "turn_complete", False),
                                        })
                                        yield f"data: {payload}\n\n"

                                    if hasattr(part, "function_call") and part.function_call:
                                        payload = json.dumps({
                                            "type": "tool_call",
                                            "agent": event.author,
                                            "tool": part.function_call.name,
                                            "args": dict(part.function_call.args) if part.function_call.args else {},
                                        })
                                        yield f"data: {payload}\n\n"

                                    if hasattr(part, "function_response") and part.function_response:
                                        payload = json.dumps({
                                            "type": "tool_result",
                                            "agent": event.author,
                                            "tool": part.function_response.name,
                                            "result": part.function_response.response if part.function_response.response else {},
                                        })
                                        yield f"data: {payload}\n\n"

                            # State changes
                            if event.actions and event.actions.state_delta:
                                payload = json.dumps({
                                    "type": "state_update",
                                    "delta": event.actions.state_delta,
                                })
                                yield f"data: {payload}\n\n"

            # Signal stream end
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            logger.error("Stream error: %s", e, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        finally:
            unregister_sse_queue(session_id)
            if not adk_task.done():
                adk_task.cancel()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/tool-response/{session_id}")
async def tool_response(session_id: str, request: Request):
    """Receive a tool result from the Chrome extension (via the frontend).

    The frontend forwards the extension's response here to unblock the
    waiting tool function in the agent.
    """
    body = await request.json()
    request_id = body.get("request_id")
    result = body.get("result")

    if not request_id:
        raise HTTPException(status_code=400, detail="request_id is required")
    if result is None:
        raise HTTPException(status_code=400, detail="result is required")

    resolved = resolve_browser_action(request_id, result)
    if not resolved:
        raise HTTPException(status_code=404, detail=f"No pending request with id {request_id}")

    return {"ok": True}


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
