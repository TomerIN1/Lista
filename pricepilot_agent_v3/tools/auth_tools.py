from __future__ import annotations
"""Authentication tools using Playwright browser automation.

Rami Levy login requires a real browser because reCAPTCHA v3 blocks direct API
calls. The flow is:
  1. open_supermarket — navigate to the site
  2. start_login — enter email, triggers OTP
  3. submit_otp — user provides OTP, we submit it
  4. check_auth_status — verify authentication state

Key learnings from v2 testing:
  - Login modal opens via $nuxt.$root.$emit('OpenLoginModal'), not button click
  - OTP verify button text is "אמת קוד" (not "אישור")
  - SMS method selection screen appears sometimes after email submit
  - Token is in localStorage.ramilevy.authuser.user.token
"""

import asyncio
import logging

from google.adk.tools import ToolContext

from config import settings
from services.browser import BrowserManager
from services.observer import observer

logger = logging.getLogger(__name__)

MARKET_URL = f"{settings.rami_levy_base_url}/he/online/market"
LOGIN_TIMEOUT = 30000  # ms — increased from 15s


async def open_supermarket(tool_context: ToolContext) -> dict:
    """Open the Rami Levy supermarket website and initialize a browser session.

    Call this first before any other browser-based action.

    Returns:
        dict with status and current page URL.
    """
    session_id = tool_context.state.get("session_id", "default")
    observer.log_tool_start(session_id, "open_supermarket", {"url": MARKET_URL})
    try:
        manager = await BrowserManager.get_instance()
        bs = await manager.get_or_create_session(session_id)
        await bs.page.goto(MARKET_URL, wait_until="domcontentloaded", timeout=LOGIN_TIMEOUT)
        try:
            await bs.page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            await asyncio.sleep(3)

        current_url = bs.page.url

        # Dismiss overlays (cookies, promos)
        for sel in ['button:has-text("אישור")', 'button:has-text("הבנתי")', 'button:has-text("סגור")']:
            try:
                btn = bs.page.locator(sel).first
                if await btn.is_visible(timeout=1000):
                    await btn.click()
                    await asyncio.sleep(0.5)
            except Exception:
                pass

        tool_context.state["browser_active"] = True
        tool_context.state["current_url"] = current_url

        await observer.capture_screenshot(session_id, bs.page, "market_page_loaded")
        result = {
            "status": "success",
            "url": current_url,
            "message": "Rami Levy website loaded successfully.",
        }
        observer.log_tool_end(session_id, "open_supermarket", result, {
            "browser_active": True, "current_url": current_url,
        })
        logger.info("Opened supermarket: %s", current_url)
        return result
    except Exception as e:
        logger.error("Failed to open supermarket: %s", e, exc_info=True)
        observer.log_error(session_id, "open_supermarket", str(e))
        return {"status": "error", "message": f"Failed to open website: {e}"}


async def start_login(email: str, tool_context: ToolContext) -> dict:
    """Start the login process by entering the user's email address.

    This opens the login modal via Vue.js event, enters the email, and submits.
    Rami Levy sends an OTP code via SMS to the user's phone.
    After calling this, ask the user for the 6-digit code they received.

    Args:
        email: The user's email address registered with Rami Levy.

    Returns:
        dict with status indicating whether OTP was sent.
    """
    if not email or "@" not in email:
        return {"status": "error", "message": "Invalid email address."}

    session_id = tool_context.state.get("session_id", "default")
    observer.log_tool_start(session_id, "start_login", {"email": email})
    try:
        manager = await BrowserManager.get_instance()
        bs = await manager.get_session(session_id)
        if not bs:
            return {"status": "error", "message": "No browser session. Call open_supermarket first."}

        page = bs.page

        # Open login modal via Vue.js event (proven approach from v2)
        try:
            await page.evaluate("window.$nuxt.$root.$emit('OpenLoginModal')")
            await asyncio.sleep(2)
            logger.info("Login modal opened via Vue event")
        except Exception:
            # Fallback: try clicking login button
            logger.info("Vue event failed, trying button click")
            for sel in ['button:has-text("התחברות")', 'a:has-text("התחברות")', '.login-btn']:
                try:
                    btn = page.locator(sel).first
                    if await btn.is_visible(timeout=3000):
                        await btn.click()
                        await asyncio.sleep(2)
                        break
                except Exception:
                    pass

        await observer.capture_screenshot(session_id, page, "login_modal_opened")

        # Find and fill email input
        email_input = page.locator(
            'input[type="email"], input[type="tel"], input[placeholder*="מייל"], '
            'input[placeholder*="email"], input[placeholder*="אימייל"]'
        )
        await email_input.first.wait_for(state="visible", timeout=LOGIN_TIMEOUT)
        await email_input.first.fill(email)
        logger.info("Email entered: %s", email)

        # Submit email
        for sel in ['button:has-text("שלח")', 'button:has-text("התחברות")', 'button:has-text("המשך")', 'button[type="submit"]']:
            try:
                btn = page.locator(sel).first
                if await btn.is_visible(timeout=2000):
                    await btn.click()
                    logger.info("Email submitted via: %s", sel)
                    break
            except Exception:
                pass

        await asyncio.sleep(3)
        await observer.capture_screenshot(session_id, page, "after_email_submit")

        # Handle SMS method selection screen if it appears
        try:
            sms_btn = page.locator('text="הודעת SMS"').first
            if await sms_btn.is_visible(timeout=3000):
                logger.info("SMS method selection screen detected")
                await sms_btn.click()
                await asyncio.sleep(1)
                for sel in ['button:has-text("שלח קוד אימות")', 'button:has-text("שלח קוד")', 'button:has-text("שלח")']:
                    try:
                        btn = page.locator(sel).first
                        if await btn.is_visible(timeout=2000):
                            await btn.click()
                            break
                    except Exception:
                        pass
                await asyncio.sleep(3)
                await observer.capture_screenshot(session_id, page, "after_sms_method_select")
        except Exception:
            pass

        # Check if OTP input appeared (indicates code was sent)
        otp_visible = False
        for sel in ['input[placeholder*="קוד"]', 'input[maxlength="6"]', 'input[maxlength="1"]']:
            try:
                if await page.locator(sel).first.is_visible(timeout=5000):
                    otp_visible = True
                    break
            except Exception:
                pass

        bs.user_email = email
        tool_context.state["login_email"] = email
        tool_context.state["otp_sent"] = otp_visible

        if otp_visible:
            # Try to extract phone hint from page
            phone_hint = ""
            try:
                body_text = await page.evaluate("document.body.innerText")
                import re
                match = re.search(r'(\d{4})\s*$', body_text[:500])
                if match:
                    phone_hint = match.group(1)
            except Exception:
                pass

            result = {
                "status": "success",
                "message": f"OTP code sent via SMS. Ask the user for the 6-digit code.",
                "phone_hint": phone_hint,
            }
        else:
            result = {
                "status": "partial",
                "message": "Email submitted but OTP field not detected. The code may still arrive. Ask the user.",
            }

        observer.log_tool_end(session_id, "start_login", result, {
            "login_email": email, "otp_sent": otp_visible,
        })
        return result

    except Exception as e:
        logger.error("Login start failed: %s", e, exc_info=True)
        await observer.capture_screenshot(session_id, page, "login_error") if 'page' in dir() else None
        observer.log_error(session_id, "start_login", str(e), {"email": email})
        return {"status": "error", "message": f"Login failed: {e}"}


async def submit_otp(otp_code: str, tool_context: ToolContext) -> dict:
    """Submit the OTP code the user received via SMS to complete login.

    Args:
        otp_code: The 6-digit code from SMS.

    Returns:
        dict with status indicating whether login succeeded.
    """
    if not otp_code or not otp_code.strip():
        return {"status": "error", "message": "OTP code cannot be empty."}

    session_id = tool_context.state.get("session_id", "default")
    observer.log_tool_start(session_id, "submit_otp", {"otp_length": len(otp_code.strip())})
    try:
        manager = await BrowserManager.get_instance()
        bs = await manager.get_session(session_id)
        if not bs:
            return {"status": "error", "message": "No browser session. Call open_supermarket first."}

        page = bs.page
        code = otp_code.strip()

        # Find and fill OTP input
        entered = False
        for sel in ['input[placeholder*="קוד"]', 'input[maxlength="6"]']:
            try:
                inp = page.locator(sel).first
                if await inp.is_visible(timeout=5000):
                    await inp.fill(code)
                    entered = True
                    logger.info("OTP entered in: %s", sel)
                    break
            except Exception:
                pass

        # Try split digit inputs
        if not entered:
            splits = page.locator('input[maxlength="1"]')
            count = await splits.count()
            if count >= 6:
                for i, digit in enumerate(code[:6]):
                    await splits.nth(i).fill(digit)
                entered = True
                logger.info("OTP entered in %d split fields", count)

        if not entered:
            await observer.capture_screenshot(session_id, page, "otp_input_not_found")
            return {"status": "error", "message": "Could not find OTP input field."}

        await asyncio.sleep(1)
        await observer.capture_screenshot(session_id, page, "otp_filled")

        # Click verify button — "אמת קוד" is the correct text!
        clicked = False
        for sel in ['button:has-text("אמת קוד")', 'button:has-text("אמת")', 'button:has-text("אישור")', 'button:has-text("שלח")', 'button[type="submit"]']:
            try:
                btn = page.locator(sel).first
                if await btn.is_visible(timeout=2000):
                    await btn.click()
                    clicked = True
                    logger.info("OTP submitted via: %s", sel)
                    break
            except Exception:
                pass

        if not clicked:
            # Fallback: press Enter
            await page.keyboard.press("Enter")
            logger.info("OTP submitted via Enter key")

        # Wait for login to complete
        await asyncio.sleep(5)
        await observer.capture_screenshot(session_id, page, "after_otp_submit")

        # Extract JWT token from localStorage (Rami Levy specific)
        token = None
        for attempt in range(10):
            try:
                token = await page.evaluate("""() => {
                    try {
                        return JSON.parse(localStorage.getItem('ramilevy')).authuser.user.token;
                    } catch(e) { return null; }
                }""")
                if token:
                    logger.info("Token extracted (attempt %d, length=%d)", attempt + 1, len(token))
                    break
            except Exception:
                pass
            await asyncio.sleep(2)

        if token:
            bs.authenticated = True
            bs.auth_token = token
            tool_context.state["authenticated"] = True
            tool_context.state["user_email"] = bs.user_email
            tool_context.state["auth_token"] = token

            # Persist storage state so next session reuses same device identity
            await manager.save_storage_state(session_id)

            result = {
                "status": "success",
                "message": "Login successful. User is authenticated.",
                "authenticated": True,
            }
            observer.log_tool_end(session_id, "submit_otp", result, {
                "authenticated": True, "user_email": bs.user_email,
            })
            observer.log_state_change(session_id, "User authenticated", {
                "authenticated": True, "user_email": bs.user_email,
            })
            return result
        else:
            # Check for error messages on page
            error_text = ""
            try:
                body = await page.evaluate("document.body.innerText")
                if "שגוי" in body:
                    error_text = "Wrong OTP code."
                elif "פג" in body:
                    error_text = "OTP expired."
            except Exception:
                pass

            result = {
                "status": "error",
                "message": f"Could not verify login. {error_text} Ask user to try again.",
                "authenticated": False,
            }
            observer.log_tool_end(session_id, "submit_otp", result, {
                "authenticated": False, "error": error_text,
            })
            return result

    except Exception as e:
        logger.error("OTP submission failed: %s", e, exc_info=True)
        observer.log_error(session_id, "submit_otp", str(e))
        return {"status": "error", "message": f"OTP submission failed: {e}"}


async def check_auth_status(tool_context: ToolContext) -> dict:
    """Check whether the current browser session is authenticated.

    Returns:
        dict with authentication status and details.
    """
    session_id = tool_context.state.get("session_id", "default")
    observer.log_tool_start(session_id, "check_auth_status", {})
    try:
        manager = await BrowserManager.get_instance()
        bs = await manager.get_session(session_id)
        if not bs:
            result = {
                "status": "success",
                "authenticated": False,
                "message": "No browser session exists.",
            }
            observer.log_tool_end(session_id, "check_auth_status", result)
            return result

        page = bs.page

        # Check localStorage for Rami Levy auth token
        has_token = await page.evaluate("""() => {
            try {
                const data = JSON.parse(localStorage.getItem('ramilevy'));
                return !!(data && data.authuser && data.authuser.user && data.authuser.user.token);
            } catch(e) { return false; }
        }""")

        bs.authenticated = has_token
        tool_context.state["authenticated"] = has_token

        result = {
            "status": "success",
            "authenticated": has_token,
            "email": bs.user_email if has_token else "",
            "message": (
                "User is authenticated." if has_token
                else "User is NOT authenticated. Login required."
            ),
        }
        observer.log_tool_end(session_id, "check_auth_status", result, {
            "authenticated": has_token,
        })
        return result

    except Exception as e:
        logger.error("Auth check failed: %s", e, exc_info=True)
        observer.log_error(session_id, "check_auth_status", str(e))
        return {"status": "error", "message": f"Auth check failed: {e}"}
