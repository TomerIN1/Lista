"""Authentication tools for OTP-based store login.

These tools guide the user through a two-step OTP login flow:
1. request_login_otp — sends a verification code to the user's phone.
2. verify_login_otp — verifies the code and saves the auth token to state.

The agent handles the conversational flow (asking for email, relaying the
OTP prompt, collecting the code) while these tools do the HTTP work via
the store adapter.

Note on reCAPTCHA: The login endpoint may require a reCAPTCHA token. We
attempt the call with recaptcha=null first. If the store rejects it, we
return a clear error so the agent can fall back to the checkout URL.
"""

from __future__ import annotations

import logging
from typing import Any

from google.adk.tools import ToolContext

from pricepilot.stores import get_adapter

logger = logging.getLogger(__name__)


async def request_login_otp(
    store_name: str,
    email: str,
    tool_context: ToolContext,
    delivery_method: str = "sms",
) -> dict[str, Any]:
    """Request a login OTP code for a store account.

    The user provides their email, and the store sends a one-time
    verification code to their registered phone via SMS or voice call.
    The reCAPTCHA token is read from session state (set by the frontend).

    Args:
        store_name: Chain name (e.g. "Rami Levy").
        email: User's registered email address.
        tool_context: ADK ToolContext for state access.
        delivery_method: "sms" (default) or "voice".

    Returns:
        Dict with status ("otp_sent" on success), phone hint, or error.
    """
    adapter = get_adapter(store_name)
    if adapter is None:
        return {"status": "error", "error": f"Store '{store_name}' is not supported."}

    # reCAPTCHA token is injected into session state by the frontend/API layer
    recaptcha_token = tool_context.state.get("recaptcha_token")

    try:
        result = await adapter.request_login_otp(
            email=email,
            delivery_method=delivery_method,
            recaptcha_token=recaptcha_token,
        )
    except NotImplementedError:
        return {
            "status": "error",
            "error": f"OTP login is not supported for {store_name}.",
        }

    # Persist email in state so verify_login_otp can reference it.
    if result.get("status") == "otp_sent":
        tool_context.state["login_email"] = email
        tool_context.state["login_delivery_method"] = delivery_method

    return result


async def verify_login_otp(
    store_name: str,
    email: str,
    otp_code: str,
    tool_context: ToolContext,
    delivery_method: str = "sms",
) -> dict[str, Any]:
    """Verify a login OTP code and obtain an auth token.

    After the user receives the 6-digit code, they provide it here.
    On success, the auth_token is saved to session state so that
    subsequent tools (persist_cart_to_store, calculate_cart_preview)
    can use it automatically.

    Args:
        store_name: Chain name (e.g. "Rami Levy").
        email: User's registered email address.
        otp_code: 6-digit verification code from SMS/voice.
        tool_context: ADK ToolContext for state access.
        delivery_method: "sms" (default) or "voice".

    Returns:
        Dict with status ("success" and token) or error details.
    """
    adapter = get_adapter(store_name)
    if adapter is None:
        return {"status": "error", "error": f"Store '{store_name}' is not supported."}

    try:
        result = await adapter.verify_login_otp(
            email=email, otp_code=otp_code, delivery_method=delivery_method
        )
    except NotImplementedError:
        return {
            "status": "error",
            "error": f"OTP login is not supported for {store_name}.",
        }

    if result.get("status") == "success" and result.get("token"):
        # Save token to session state for downstream tools.
        tool_context.state["auth_token"] = result["token"]
        logger.info("Auth token saved to session state for %s", store_name)

        # Return success without exposing the raw token to the LLM.
        return {
            "status": "success",
            "message": f"Successfully logged in to {adapter.chain_name_he}.",
        }

    return result
