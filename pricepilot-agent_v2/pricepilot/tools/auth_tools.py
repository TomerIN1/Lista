"""Browser-based authentication tools for OTP login via Playwright.

These tools replace the old httpx-based OTP tools that were blocked by
reCAPTCHA. The new approach uses a headless Chromium browser to automate
the login flow on the store's actual website, where reCAPTCHA auto-passes
because the request originates from the correct domain with a real browser
fingerprint.

Architecture:
- A single Playwright Browser instance is lazily created on first login.
- Each login flow gets its own BrowserContext (isolated cookies/storage).
- The BrowserContext + Page are stored in a module-level dict keyed by
  ADK session_id, so they persist between the two tool calls
  (browser_request_otp -> browser_verify_otp).
- After successful login or timeout, the context is closed and removed.

Tool design:
- browser_request_otp: Opens rami-levy.co.il, triggers login modal,
  enters email, submits. reCAPTCHA auto-solves. Returns phone hint.
- browser_verify_otp: Uses the same browser page, enters OTP code,
  waits for JWT to appear in localStorage, saves to tool_context state.

IMPORTANT: All error messages returned to the LLM are user-friendly
Hebrew text. Technical details are logged but never surfaced.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

from google.adk.tools import ToolContext

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Browser session management
# ------------------------------------------------------------------

# Timeout for the entire OTP request flow (navigate + fill + submit)
BROWSER_OTP_REQUEST_TIMEOUT_S = 45
# Timeout for OTP verification (enter code + wait for JWT)
BROWSER_OTP_VERIFY_TIMEOUT_S = 30
# Maximum time a browser session can stay alive before auto-cleanup (5 min)
SESSION_TTL_S = 300

# Rami Levy site URLs and selectors
RL_HOME_URL = "https://www.rami-levy.co.il/he"

# Token extraction JS — matches the existing LoginConfig.token_extraction_js
TOKEN_EXTRACTION_JS = """
() => {
    try {
        const s = JSON.parse(localStorage.getItem('ramilevy'));
        if (s && s.authuser && s.authuser.user && s.authuser.user.token) {
            return JSON.stringify({
                token: s.authuser.user.token,
                userId: s.authuser.user.id
            });
        }
        return null;
    } catch(e) { return null; }
}
"""

# CSS selector for the OTP code input field(s)
OTP_INPUT_SELECTOR = (
    'input[name="otp"], '
    'input[name="otp_code"], '
    'input[name="code"], '
    'input[placeholder*="קוד"], '
    'input[placeholder*="code"], '
    'input[type="tel"][maxlength="6"], '
    'input[maxlength="6"], '
    'input[inputmode="numeric"]'
)

# CSS selector for split-digit OTP inputs (some sites use 6 separate fields)
DIGIT_INPUT_SELECTOR = (
    'input[maxlength="1"][inputmode="numeric"], '
    'input[maxlength="1"][type="tel"]'
)


@dataclass
class _BrowserSession:
    """Holds Playwright objects for an in-progress login flow or cart ops.

    After OTP verification, the session transitions from "login" phase to
    "authenticated" phase. The browser context stays alive so cart operations
    can use the authenticated session (cookies + localStorage JWT).
    """

    context: Any  # playwright BrowserContext
    page: Any  # playwright Page
    email: str  # email used for this login attempt
    created_at: float = field(default_factory=time.monotonic)
    authenticated: bool = False  # True after successful OTP verification

    @property
    def is_expired(self) -> bool:
        # Authenticated sessions get a longer TTL (15 min) since they're
        # used for cart operations after login.
        ttl = SESSION_TTL_S * 3 if self.authenticated else SESSION_TTL_S
        return (time.monotonic() - self.created_at) > ttl


# Module-level state: session_id -> _BrowserSession
_active_sessions: dict[str, _BrowserSession] = {}

# Single shared Browser instance (lazy-initialized).
# Using Any type to avoid importing playwright at module level (it may
# not be installed in all environments, and we only need it at runtime).
_browser: Any = None
_browser_lock = asyncio.Lock()


_playwright_instance: Any = None


async def _get_browser() -> Any:
    """Get or create the shared Playwright Browser instance.

    Uses a lock to prevent multiple concurrent browser launches.
    If the browser has crashed, it is re-created automatically.
    """
    global _browser, _playwright_instance

    async with _browser_lock:
        # Check if existing browser is still alive
        if _browser is not None:
            try:
                if _browser.is_connected():
                    return _browser
            except Exception:
                pass
            logger.warning("Browser died, re-creating...")
            _browser = None

        from playwright.async_api import async_playwright

        if _playwright_instance is None:
            _playwright_instance = await async_playwright().start()

        _browser = await _playwright_instance.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                # NOTE: do NOT use --single-process — it crashes in containers
            ],
        )
        logger.info("Playwright browser launched (headless Chromium)")
        return _browser


async def _cleanup_session(session_id: str) -> None:
    """Close and remove a browser session."""
    bs = _active_sessions.pop(session_id, None)
    if bs is None:
        return
    try:
        await bs.page.close()
    except Exception:
        pass
    try:
        await bs.context.close()
    except Exception:
        pass
    logger.info("Browser session cleaned up: %s", session_id)


async def _cleanup_expired_sessions() -> None:
    """Remove any sessions that have exceeded their TTL.

    Called opportunistically before creating new sessions. This keeps
    memory bounded without needing a background task.
    """
    expired = [
        sid for sid, bs in _active_sessions.items() if bs.is_expired
    ]
    for sid in expired:
        logger.warning("Cleaning up expired browser session: %s", sid)
        await _cleanup_session(sid)


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
        return (
            f"כתובת המייל לא נמצאה בחשבון {store_he}. "
            "בדקו את הכתובת ונסו שוב."
        )
    if "invalid" in lower or "wrong" in lower or "incorrect" in lower:
        return "הקוד שהוזן לא תקין. נסו שוב."
    if "expired" in lower:
        return "הקוד פג תוקף. רוצים שאשלח קוד חדש?"
    if "no_token" in lower:
        return (
            f"ההתחברות ל-{store_he} לא הצליחה. "
            "אפשר לנסות שוב או לעבור לקופה."
        )
    # Fallback
    return (
        f"ההתחברות ל-{store_he} לא הצליחה כרגע. "
        "אפשר לעבור ישירות לקופה באתר."
    )


def _get_session_id(tool_context: ToolContext) -> str:
    """Extract a stable session ID from the ADK ToolContext.

    The session_id must be consistent across browser_request_otp and
    browser_verify_otp calls within the same ADK session.
    """
    # Prefer the explicit session_id if set by the server
    sid = tool_context.state.get("session_id")
    if sid:
        return str(sid)
    # Fallback: use the ToolContext's own identity (less reliable but
    # ensures we don't crash)
    return str(id(tool_context))


# ------------------------------------------------------------------
# ADK Tools
# ------------------------------------------------------------------


async def browser_request_otp(
    store_name: str,
    email: str,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Request a login verification code using a real browser session.

    Opens the store website in a headless browser, navigates to the login
    form, enters the user's email, and submits. The reCAPTCHA auto-passes
    because the browser is on the correct domain.

    The browser page stays open between this call and browser_verify_otp
    so the user can enter the OTP code on the same page.

    Args:
        store_name: Chain name (e.g. "Rami Levy"). Currently only
            Rami Levy is supported.
        email: User's registered email address.
        tool_context: ADK ToolContext for session state access.

    Returns:
        Dict with status ("otp_sent" on success) and phone hint, or
        user-friendly Hebrew error message.
    """
    store_he = "רמי לוי"

    if "rami" not in store_name.lower() and "רמי" not in store_name:
        return {
            "status": "error",
            "message": f"התחברות בדפדפן אינה נתמכת עבור '{store_name}' כרגע.",
        }

    session_id = _get_session_id(tool_context)

    # Clean up any expired sessions and any prior session for this user
    await _cleanup_expired_sessions()
    if session_id in _active_sessions:
        await _cleanup_session(session_id)

    context = None  # Track for cleanup on early errors

    try:
        browser = await _get_browser()

        # Create an isolated browser context per login flow.
        # Each context has its own cookies and localStorage, so concurrent
        # users never interfere with each other.
        context = await browser.new_context(
            locale="he-IL",
            timezone_id="Asia/Jerusalem",
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()

        # Apply stealth patches to avoid bot detection by reCAPTCHA
        try:
            from playwright_stealth import stealth_async
            await stealth_async(page)
        except ImportError:
            logger.warning("playwright-stealth not installed, skipping stealth patches")

        # Navigate to Rami Levy homepage
        logger.info(
            "Navigating to %s for session %s", RL_HOME_URL, session_id
        )
        await page.goto(
            RL_HOME_URL, wait_until="domcontentloaded", timeout=30_000
        )

        # Wait for the page to be interactive (rami-levy.co.il is heavy,
        # networkidle may never fire — use a generous timeout and fall back)
        try:
            await page.wait_for_load_state("networkidle", timeout=20_000)
        except Exception:
            logger.info("networkidle timeout, proceeding anyway")
            # Give it a bit more time for JS to initialize
            await asyncio.sleep(2)

        # --- Dismiss any blocking overlays (cookie consent, promos) ---
        try:
            for sel in [
                'button:has-text("אישור")',
                'button:has-text("הבנתי")',
                'button:has-text("סגור")',
                '.close', '[aria-label="Close"]',
                'button:has-text("OK")',
            ]:
                btn = page.locator(sel).first
                if await btn.is_visible(timeout=1_000):
                    await btn.click(force=True)
                    logger.info("Dismissed overlay via: %s", sel)
                    await asyncio.sleep(0.5)
                    break
        except Exception:
            pass

        # --- Open login modal ---
        # Strategy 1: Vue.js event (avoids click interception by overlays)
        try:
            await page.evaluate(
                "window.$nuxt && window.$nuxt.$root && window.$nuxt.$root.$emit('OpenLoginModal')"
            )
            logger.info("Emitted OpenLoginModal event")
        except Exception as e:
            logger.info("$nuxt emit returned: %s", e)

        # Wait for the modal to appear (it may take a moment)
        await asyncio.sleep(2)

        # Strategy 2: If modal didn't open, try clicking the login button
        modal_visible = False
        try:
            modal_visible = await page.locator('.modal.show').first.is_visible(
                timeout=3_000
            )
        except Exception:
            pass

        if not modal_visible:
            logger.info("Modal not visible, trying direct click")
            try:
                login_btn = page.locator('[aria-label="התחברות"]').first
                await login_btn.click(timeout=5_000, force=True)
                logger.info("Login button clicked (force)")
                await asyncio.sleep(2)
            except Exception as click_err:
                logger.error("Failed to open login modal: %s", click_err)
                await context.close()
                return {
                    "status": "error",
                    "message": _sanitize_error("timeout", store_he),
                }
        else:
            logger.info("Login modal is visible")

        # --- Fill email ---
        email_input = page.locator(
            'input[type="email"], '
            'input[name="email"], '
            'input[name="username"], '
            'input[placeholder*="מייל"], '
            'input[placeholder*="email"], '
            'input[placeholder*="אימייל"]'
        ).first

        try:
            await email_input.wait_for(state="visible", timeout=8_000)
        except Exception:
            logger.error("Email input not found in login modal")
            await context.close()
            return {
                "status": "error",
                "message": _sanitize_error("timeout", store_he),
            }

        await email_input.fill(email)
        logger.info("Email entered for session %s", session_id)

        # --- Submit the form ---
        submit_btn = page.locator(
            'button[type="submit"], '
            'button:has-text("שליחת קוד"), '
            'button:has-text("שלחו לי קוד"), '
            'button:has-text("התחברות"), '
            'button:has-text("כניסה"), '
            'button:has-text("שליחה"), '
            '.login-submit, '
            '.send-otp-btn'
        ).first

        try:
            await submit_btn.click(timeout=5_000)
            logger.info("Login form submitted for session %s", session_id)
        except Exception as submit_err:
            logger.info(
                "Submit button click failed, pressing Enter: %s", submit_err
            )
            await email_input.press("Enter")

        # --- Wait for OTP input to appear (= OTP was sent) ---
        otp_input = page.locator(OTP_INPUT_SELECTOR).first

        try:
            await otp_input.wait_for(
                state="visible",
                timeout=BROWSER_OTP_REQUEST_TIMEOUT_S * 1_000,
            )
            logger.info(
                "OTP input appeared — code was sent for session %s",
                session_id,
            )
        except Exception:
            # Try to read any error message shown on the page
            error_text = ""
            try:
                error_el = page.locator(
                    '.error-message, .alert-danger, [role="alert"]'
                ).first
                error_text = await error_el.text_content(timeout=2_000) or ""
            except Exception:
                pass
            logger.warning(
                "OTP input did not appear for session %s. Page error: %s",
                session_id,
                error_text,
            )
            await context.close()
            return {
                "status": "error",
                "message": _sanitize_error(error_text or "timeout", store_he),
            }

        # --- Extract phone hint from the page (optional) ---
        phone_hint = None
        try:
            hint_el = page.locator(
                ':has-text("נשלח"), :has-text("SMS"), :has-text("טלפון")'
            ).first
            hint_text = await hint_el.text_content(timeout=3_000)
            if hint_text:
                digits = re.findall(r"\d{4}", hint_text)
                if digits:
                    phone_hint = digits[-1]
        except Exception:
            pass  # Phone hint is best-effort

        # --- Store the browser session for the verify step ---
        _active_sessions[session_id] = _BrowserSession(
            context=context,
            page=page,
            email=email,
        )

        # Save login metadata to ADK session state
        tool_context.state["login_email"] = email
        tool_context.state["login_delivery_method"] = "sms"

        result: dict[str, Any] = {
            "status": "otp_sent",
            "delivery_method": "sms",
        }
        if phone_hint:
            result["phone_last_digits"] = phone_hint

        return result

    except Exception as exc:
        logger.exception(
            "browser_request_otp failed for session %s: %s", session_id, exc
        )
        # Ensure cleanup on unexpected failure
        if session_id in _active_sessions:
            await _cleanup_session(session_id)
        elif context is not None:
            try:
                await context.close()
            except Exception:
                pass
        return {
            "status": "error",
            "message": _sanitize_error(str(exc), store_he),
        }


async def browser_verify_otp(
    store_name: str,
    otp_code: str,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Verify a login OTP code using the browser session from browser_request_otp.

    Enters the 6-digit OTP code into the login form that is already open
    from the previous browser_request_otp call, waits for the login to
    complete, then extracts the JWT from localStorage.

    On success, saves the auth token to tool_context.state["auth_token"].

    Cleanup behavior:
    - On success or hard failure: browser session is closed.
    - On "wrong code" error: browser session is KEPT alive so the user
      can retry with a new code without re-requesting the OTP.

    Args:
        store_name: Chain name (e.g. "Rami Levy").
        otp_code: 6-digit verification code from SMS.
        tool_context: ADK ToolContext for session state access.

    Returns:
        Dict with status ("success") or user-friendly Hebrew error.
    """
    store_he = "רמי לוי"
    session_id = _get_session_id(tool_context)
    bs = _active_sessions.get(session_id)

    if bs is None:
        logger.warning("No browser session found for session %s", session_id)
        return {
            "status": "error",
            "message": "פג תוקף ההתחברות. רוצים שאשלח קוד אימות חדש?",
        }

    if bs.is_expired:
        await _cleanup_session(session_id)
        return {
            "status": "error",
            "message": "פג תוקף ההתחברות. רוצים שאשלח קוד אימות חדש?",
        }

    page = bs.page
    should_cleanup = True  # Default: cleanup after this call

    try:
        # --- Debug: log page state ---
        try:
            page_url = page.url
            logger.info(
                "browser_verify_otp: page URL=%s for session %s",
                page_url, session_id,
            )
        except Exception as e:
            logger.error(
                "browser_verify_otp: page is dead for session %s: %s",
                session_id, e,
            )
            return {
                "status": "error",
                "message": "פג תוקף ההתחברות. רוצים שאשלח קוד אימות חדש?",
            }

        # --- Find OTP input (should already be visible) ---
        otp_input = page.locator(OTP_INPUT_SELECTOR).first

        try:
            await otp_input.wait_for(state="visible", timeout=5_000)
            logger.info("OTP input found for session %s", session_id)
        except Exception:
            # Debug: dump all visible inputs on the page
            try:
                all_inputs = await page.evaluate("""
                    () => Array.from(document.querySelectorAll('input:not([type=hidden])')).map(
                        el => ({tag: el.tagName, type: el.type, name: el.name,
                                placeholder: el.placeholder, maxLength: el.maxLength,
                                visible: el.offsetParent !== null})
                    ).slice(0, 20)
                """)
                logger.error(
                    "OTP input not visible. All inputs: %s",
                    json.dumps(all_inputs, default=str),
                )
            except Exception:
                logger.error("OTP input not visible, couldn't dump inputs")
            return {
                "status": "error",
                "message": _sanitize_error("timeout", store_he),
            }

        # --- Enter OTP code ---
        # Handle split digit inputs (some sites use 6 separate fields)
        digit_inputs = page.locator(DIGIT_INPUT_SELECTOR)
        digit_count = await digit_inputs.count()
        logger.info(
            "Digit inputs found: %d, OTP code: %s, session: %s",
            digit_count, otp_code, session_id,
        )

        if digit_count >= 4:
            for i, digit in enumerate(otp_code[:digit_count]):
                try:
                    await digit_inputs.nth(i).fill(digit)
                except Exception:
                    break
            logger.info(
                "OTP entered digit-by-digit for session %s", session_id
            )
        else:
            await otp_input.fill(otp_code)
            logger.info("OTP entered in single input for session %s", session_id)

        # --- Submit ---
        verify_btn = page.locator(
            'button[type="submit"], '
            'button:has-text("אימות"), '
            'button:has-text("אישור"), '
            'button:has-text("כניסה"), '
            'button:has-text("התחברות"), '
            'button:has-text("verify"), '
            '.verify-otp-btn, '
            '.login-submit'
        ).first

        try:
            await verify_btn.click(timeout=5_000)
            logger.info("OTP verify button clicked for session %s", session_id)
        except Exception as e:
            logger.info("Submit btn failed (%s), pressing Enter", e)
            await otp_input.press("Enter")

        logger.info("OTP submitted for session %s", session_id)

        # --- Poll localStorage for the JWT token ---
        # The site saves the token to localStorage["ramilevy"] after
        # successful authentication.
        token_data = None
        deadline = time.monotonic() + BROWSER_OTP_VERIFY_TIMEOUT_S
        poll_count = 0

        while time.monotonic() < deadline:
            poll_count += 1
            # Check for token
            try:
                raw = await page.evaluate(TOKEN_EXTRACTION_JS)
                if raw:
                    token_data = json.loads(raw)
                    if token_data and token_data.get("token"):
                        logger.info(
                            "JWT found after %d polls for session %s",
                            poll_count, session_id,
                        )
                        break
                    token_data = None
            except Exception as e:
                if poll_count <= 2:
                    logger.warning("Token extraction error (poll %d): %s", poll_count, e)

            # Check for "wrong code" error on the page
            try:
                error_el = page.locator(
                    '.error-message, .alert-danger, [role="alert"]'
                ).first
                if await error_el.is_visible(timeout=500):
                    error_text = (
                        await error_el.text_content(timeout=1_000) or ""
                    )
                    wrong_code_keywords = [
                        "שגוי", "לא תקין", "incorrect", "invalid", "wrong"
                    ]
                    if any(kw in error_text for kw in wrong_code_keywords):
                        logger.warning("OTP wrong code: %s", error_text)
                        should_cleanup = False  # Keep session for retry
                        return {
                            "status": "error",
                            "message": "הקוד שהוזן לא תקין. נסו שוב.",
                        }
            except Exception:
                pass

            # Log page URL periodically (it may navigate after OTP)
            if poll_count % 5 == 0:
                try:
                    cur_url = page.url
                    logger.info(
                        "Polling for token... poll=%d url=%s session=%s",
                        poll_count, cur_url, session_id,
                    )
                except Exception:
                    pass

            await asyncio.sleep(1)

        if not token_data or not token_data.get("token"):
            # Debug: dump localStorage keys to understand what the site stored
            try:
                ls_keys = await page.evaluate(
                    "() => Object.keys(localStorage).slice(0, 20)"
                )
                logger.error(
                    "JWT not found. localStorage keys: %s, page URL: %s, session: %s",
                    ls_keys, page.url, session_id,
                )
            except Exception:
                logger.error(
                    "JWT not found in localStorage after OTP for session %s",
                    session_id,
                )
            return {
                "status": "error",
                "message": _sanitize_error("no_token", store_he),
            }

        # --- Success: save token and cookies to session state ---
        token = token_data["token"]
        tool_context.state["auth_token"] = token
        if token_data.get("userId"):
            tool_context.state["store_user_id"] = str(token_data["userId"])

        # Extract browser cookies — needed for cart persistence
        try:
            cookies = await page.context.cookies()
            cookie_str = "; ".join(
                f"{c['name']}={c['value']}" for c in cookies
            )
            tool_context.state["browser_cookies"] = cookie_str
            logger.info(
                "Extracted %d cookies for session %s", len(cookies), session_id,
            )
        except Exception as e:
            logger.warning("Failed to extract cookies: %s", e)

        logger.info(
            "Auth token extracted for session %s (user_id: %s)",
            session_id,
            token_data.get("userId"),
        )

        # KEEP the browser session alive for cart operations.
        # Mark it as authenticated so it gets extended TTL and can be
        # used by browser_add_to_cart.
        should_cleanup = False
        bs.authenticated = True
        # Refresh the creation time so the extended TTL starts from now
        bs.created_at = time.monotonic()

        return {
            "status": "success",
            "message": f"התחברת בהצלחה ל-{store_he}! 🎉",
        }

    except Exception as exc:
        logger.exception(
            "browser_verify_otp failed for session %s: %s", session_id, exc
        )
        return {
            "status": "error",
            "message": _sanitize_error(str(exc), store_he),
        }
    finally:
        if should_cleanup:
            await _cleanup_session(session_id)


# ------------------------------------------------------------------
# Browser-based cart operations
# ------------------------------------------------------------------


def get_authenticated_session(session_id: str) -> _BrowserSession | None:
    """Get an authenticated browser session if one exists and is alive.

    Used by cart_tools to check whether browser-based cart persistence
    is available.
    """
    bs = _active_sessions.get(session_id)
    if bs is None:
        return None
    if bs.is_expired:
        return None
    if not bs.authenticated:
        return None
    return bs


async def browser_add_to_cart(
    session_id: str,
    items: dict[str, int],
    store_id: str,
) -> dict[str, Any]:
    """Add items to cart using the authenticated browser session.

    This executes a fetch() call from within the browser page context,
    which carries the full authentication state (cookies, localStorage
    JWT, CSRF tokens). Unlike an external httpx call, this is
    indistinguishable from the user clicking "add to cart" on the site.

    The Rami Levy site uses POST /api/v2/cart with the items payload.
    When called from an authenticated browser session, this endpoint
    both calculates prices AND persists the cart to the user's account.

    Args:
        session_id: ADK session ID to look up the browser session.
        items: {store_product_id: quantity} mapping.
        store_id: Branch/store ID (e.g. "331").

    Returns:
        Dict with status and cart data or error message.
    """
    bs = _active_sessions.get(session_id)
    if bs is None or not bs.authenticated:
        return {
            "status": "error",
            "error": "no_browser_session",
            "message": "אין חיבור פעיל. צריך להתחבר מחדש.",
        }

    if bs.is_expired:
        await _cleanup_session(session_id)
        return {
            "status": "error",
            "error": "session_expired",
            "message": "פג תוקף ההתחברות. צריך להתחבר מחדש.",
        }

    page = bs.page

    try:
        # Verify the page is still alive
        try:
            _ = page.url
        except Exception:
            logger.error("Browser page is dead for session %s", session_id)
            await _cleanup_session(session_id)
            return {
                "status": "error",
                "error": "page_dead",
                "message": "פג תוקף ההתחברות. צריך להתחבר מחדש.",
            }

        # Build the cart payload — same shape the Rami Levy site uses
        # when adding items from their UI.
        from datetime import datetime, timedelta, timezone

        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime(
            "%Y-%m-%dT00:00:00.000Z"
        )

        cart_payload = {
            "store": store_id,
            "isClub": 0,
            "supplyAt": tomorrow,
            "items": {str(k): str(v) for k, v in items.items()},
            "meta": None,
        }

        logger.info(
            "browser_add_to_cart: session=%s, store=%s, item_count=%d",
            session_id, store_id, len(items),
        )

        # Execute the cart API call from within the browser.
        # This is the key difference: the fetch() runs in the browser
        # context with all cookies and auth headers automatically attached.
        # The site's JS framework (Nuxt/Vue) sets up request interceptors
        # that add the Authorization and ecomtoken headers from localStorage.
        result = await page.evaluate(
            """async (payload) => {
                try {
                    // Read the auth token from localStorage (same as the site does)
                    let token = null;
                    try {
                        const rlData = JSON.parse(localStorage.getItem('ramilevy'));
                        if (rlData && rlData.authuser && rlData.authuser.user) {
                            token = rlData.authuser.user.token;
                        }
                    } catch(e) {}

                    const headers = {
                        'Content-Type': 'application/json;charset=UTF-8',
                        'locale': 'he',
                        'Accept': 'application/json, text/plain, */*',
                    };
                    if (token) {
                        headers['Authorization'] = 'Bearer ' + token;
                        headers['ecomtoken'] = token;
                    }

                    const resp = await fetch('/api/v2/cart', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(payload),
                        credentials: 'include',
                    });

                    const data = await resp.json();
                    return {
                        ok: resp.ok,
                        status: resp.status,
                        data: data,
                    };
                } catch(e) {
                    return {
                        ok: false,
                        status: 0,
                        error: e.message || String(e),
                    };
                }
            }""",
            cart_payload,
        )

        logger.info(
            "browser_add_to_cart response: ok=%s, status=%s, session=%s",
            result.get("ok"), result.get("status"), session_id,
        )

        if not result.get("ok"):
            error_msg = result.get("error", "")
            status_code = result.get("status", 0)

            if status_code == 401:
                logger.warning("Browser cart call returned 401 — token expired")
                await _cleanup_session(session_id)
                return {
                    "status": "error",
                    "error": "auth_expired",
                    "message": "פג תוקף ההתחברות. צריך להתחבר מחדש.",
                }

            logger.error(
                "Browser cart call failed: status=%s, error=%s",
                status_code, error_msg,
            )
            return {
                "status": "error",
                "error": "cart_api_error",
                "message": "לא הצלחתי לשמור את העגלה. אפשר לנסות שוב.",
            }

        # Success — the cart is now persisted in the user's account
        data = result.get("data", {})
        cart_status = data.get("status")
        logger.info(
            "Browser cart persisted: data.status=%s, session=%s",
            cart_status, session_id,
        )

        return {
            "status": "success",
            "cart_data": data,
        }

    except Exception as exc:
        logger.exception(
            "browser_add_to_cart failed for session %s: %s", session_id, exc
        )
        return {
            "status": "error",
            "error": "browser_error",
            "message": "שגיאה בשמירת העגלה. אפשר לנסות שוב.",
        }


async def cleanup_browser_session(session_id: str) -> None:
    """Public cleanup entry point for cart_tools to call after persistence."""
    await _cleanup_session(session_id)


# ------------------------------------------------------------------
# Cleanup hook for server shutdown
# ------------------------------------------------------------------


async def shutdown_browser() -> None:
    """Close all browser sessions and the shared browser instance.

    Call this from the FastAPI shutdown event to ensure clean exit.
    On Cloud Run, this runs when the container is being terminated.
    """
    global _browser

    for session_id in list(_active_sessions.keys()):
        await _cleanup_session(session_id)

    if _browser is not None:
        try:
            await _browser.close()
            logger.info("Playwright browser closed")
        except Exception:
            pass
        _browser = None
