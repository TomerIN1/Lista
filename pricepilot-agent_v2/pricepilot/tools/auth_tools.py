"""Authentication tools for OTP-based store login.

These tools guide the user through a two-step OTP login flow:
1. request_login_otp — sends a verification code to the user's phone.
2. verify_login_otp — verifies the code and saves the auth token to state.

IMPORTANT: All error messages returned by these tools MUST be user-friendly
Hebrew text. The LLM will parrot whatever text it sees, so technical error
codes (recaptcha_required, auth_token_expired, etc.) must NEVER appear in
the returned dicts. Use _sanitize_error() to clean up adapter errors.
"""

from __future__ import annotations

import logging
from typing import Any

from google.adk.tools import ToolContext

from pricepilot.stores import get_adapter

logger = logging.getLogger(__name__)


def _sanitize_error(raw_error: str, store_he: str) -> str:
    """Map technical error strings to user-friendly Hebrew messages.

    The LLM sees these messages and may relay them to the user, so they
    must NEVER contain technical jargon.
    """
    lower = raw_error.lower()
    if "recaptcha" in lower or "captcha" in lower or "robot" in lower:
        return (
            f"ההתחברות ל-{store_he} לא זמינה כרגע. "
            "אפשר לעבור ישירות לקופה באתר."
        )
    if "network" in lower or "timeout" in lower or "connection" in lower:
        return f"בעיית תקשורת עם {store_he}. אפשר לנסות שוב מאוחר יותר."
    if "not found" in lower or "not registered" in lower:
        return f"כתובת המייל לא נמצאה בחשבון {store_he}. בדקו את הכתובת ונסו שוב."
    if "invalid" in lower or "wrong" in lower or "incorrect" in lower:
        return "הקוד שהוזן לא תקין. נסו שוב."
    if "expired" in lower:
        return "הקוד פג תוקף. רוצים שאשלח קוד חדש?"
    if "no_token" in lower:
        return f"ההתחברות ל-{store_he} לא הצליחה. אפשר לנסות שוב או לעבור לקופה."
    # Fallback — still safe, no technical terms
    return f"ההתחברות ל-{store_he} לא הצליחה כרגע. אפשר לעבור ישירות לקופה באתר."


async def request_login_otp(
    store_name: str,
    email: str,
    tool_context: ToolContext,
    delivery_method: str = "sms",
) -> dict[str, Any]:
    """Request a login verification code for a store account.

    The user provides their email, and the store sends a verification
    code to their registered phone via SMS or voice call.

    Args:
        store_name: Chain name (e.g. "Rami Levy").
        email: User's registered email address.
        tool_context: ADK ToolContext for state access.
        delivery_method: "sms" (default) or "voice".

    Returns:
        Dict with status ("otp_sent" on success), phone hint, or
        user-friendly Hebrew error message.
    """
    adapter = get_adapter(store_name)
    if adapter is None:
        return {
            "status": "error",
            "message": f"החנות '{store_name}' לא נתמכת כרגע.",
        }

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
            "message": f"התחברות ל-{adapter.chain_name_he} לא זמינה כרגע. אפשר לעבור ישירות לקופה.",
        }

    # Sanitize any error from the adapter before it reaches the LLM
    if result.get("status") == "error":
        raw = result.get("error", "") or result.get("message", "")
        logger.warning("OTP request error (raw): %s", raw)
        return {
            "status": "error",
            "message": _sanitize_error(raw, adapter.chain_name_he),
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
    """Verify a login verification code and complete login.

    After the user receives the 6-digit code, they provide it here.
    On success, the login session is saved so that subsequent tools
    (persist_cart_to_store, calculate_cart_preview) work automatically.

    Args:
        store_name: Chain name (e.g. "Rami Levy").
        email: User's registered email address.
        otp_code: 6-digit verification code from SMS/voice.
        tool_context: ADK ToolContext for state access.
        delivery_method: "sms" (default) or "voice".

    Returns:
        Dict with status ("success") or user-friendly Hebrew error.
    """
    adapter = get_adapter(store_name)
    if adapter is None:
        return {
            "status": "error",
            "message": f"החנות '{store_name}' לא נתמכת כרגע.",
        }

    try:
        result = await adapter.verify_login_otp(
            email=email, otp_code=otp_code, delivery_method=delivery_method
        )
    except NotImplementedError:
        return {
            "status": "error",
            "message": f"התחברות ל-{adapter.chain_name_he} לא זמינה כרגע.",
        }

    # Sanitize errors
    if result.get("status") == "error":
        raw = result.get("error", "") or result.get("message", "")
        logger.warning("OTP verify error (raw): %s", raw)
        return {
            "status": "error",
            "message": _sanitize_error(raw, adapter.chain_name_he),
        }

    if result.get("status") == "success" and result.get("token"):
        # Save token to session state for downstream tools.
        tool_context.state["auth_token"] = result["token"]
        logger.info("Auth token saved to session state for %s", store_name)

        # Return success without exposing the raw token to the LLM.
        return {
            "status": "success",
            "message": f"התחברת בהצלחה ל-{adapter.chain_name_he}! 🎉",
        }

    # Unexpected response — sanitize just in case
    return {
        "status": "error",
        "message": _sanitize_error("unknown", adapter.chain_name_he),
    }
