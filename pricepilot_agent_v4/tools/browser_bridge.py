from __future__ import annotations
"""Browser bridge — coordinates tool execution between cloud agent and Chrome extension.

When the agent calls a browser tool (read_cart, add_items, etc.), the tool function
calls request_browser_action() which:
1. Generates a unique request_id
2. Pushes a browser_action_request event into the session's SSE queue
3. Awaits an asyncio.Event until the extension responds (or timeout)

The extension response arrives via POST /api/tool-response/{session_id}, which calls
resolve_browser_action() to unblock the waiting tool.
"""

import asyncio
import logging
import uuid

logger = logging.getLogger(__name__)

# Pending requests awaiting extension responses
_pending_events: dict[str, asyncio.Event] = {}
_pending_results: dict[str, dict] = {}

# Per-session SSE queues for injecting browser_action_request events
_sse_queues: dict[str, asyncio.Queue] = {}

DEFAULT_TIMEOUT = 60  # seconds


def register_sse_queue(session_id: str) -> asyncio.Queue:
    """Register an SSE queue for a session. Called when /api/chat starts."""
    queue: asyncio.Queue = asyncio.Queue()
    _sse_queues[session_id] = queue
    logger.debug("Registered SSE queue for session %s", session_id)
    return queue


def unregister_sse_queue(session_id: str) -> None:
    """Remove the SSE queue when the chat stream ends."""
    _sse_queues.pop(session_id, None)
    logger.debug("Unregistered SSE queue for session %s", session_id)


async def request_browser_action(
    session_id: str,
    tool_name: str,
    args: dict,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict:
    """Request the Chrome extension to execute a browser tool.

    Pushes a browser_action_request into the session's SSE queue and waits
    for the extension to respond via resolve_browser_action().

    Args:
        session_id: The ADK session ID.
        tool_name: Name of the browser tool (e.g. "read_cart").
        args: Tool arguments dict.
        timeout: Max seconds to wait for extension response.

    Returns:
        The result dict from the extension, or an error dict on timeout.
    """
    request_id = f"breq_{uuid.uuid4().hex[:12]}"

    event = asyncio.Event()
    _pending_events[request_id] = event

    # Push the request into the SSE queue so the frontend receives it
    queue = _sse_queues.get(session_id)
    if queue is None:
        _pending_events.pop(request_id, None)
        logger.error("No SSE queue for session %s — is /api/chat active?", session_id)
        return {
            "status": "error",
            "message": "No active chat stream. The browser bridge requires an open SSE connection.",
        }

    await queue.put({
        "type": "browser_action_request",
        "request_id": request_id,
        "tool": tool_name,
        "args": args,
    })
    logger.info("Sent browser_action_request: %s tool=%s args=%s", request_id, tool_name, args)

    try:
        await asyncio.wait_for(event.wait(), timeout=timeout)
        result = _pending_results.pop(request_id, {
            "status": "error",
            "message": "Extension responded but no result was stored.",
        })
        logger.info("Browser action resolved: %s → %s | %s", request_id, result.get("status"), result.get("message", ""))
        return result
    except asyncio.TimeoutError:
        logger.warning("Browser action timeout (%ss): %s tool=%s", timeout, request_id, tool_name)
        return {
            "status": "error",
            "message": (
                f"Browser extension did not respond within {int(timeout)} seconds for '{tool_name}'. "
                "Is the PricePilot extension installed and is rami-levy.co.il open?"
            ),
        }
    finally:
        _pending_events.pop(request_id, None)
        _pending_results.pop(request_id, None)


def resolve_browser_action(request_id: str, result: dict) -> bool:
    """Called by POST /api/tool-response to deliver the extension's result.

    Returns True if the request was found and resolved, False otherwise.
    """
    event = _pending_events.get(request_id)
    if event is None:
        logger.warning("resolve_browser_action: unknown request_id %s (expired or duplicate?)", request_id)
        return False

    _pending_results[request_id] = result
    event.set()
    logger.info("Resolved browser action: %s", request_id)
    return True
