from __future__ import annotations
"""Observability and control module for PricePilot Agent.

Provides structured session logging, screenshot capture, tool instrumentation,
and human-readable Markdown summaries. Designed as a singleton that NEVER
crashes the agent — every public method is wrapped in try/except.

Usage in tools:
    from services.observer import observer

    observer.log_tool_start(session_id, "tool_name", {"param": "value"})
    await observer.capture_screenshot(session_id, page, "step_name")
    observer.log_tool_end(session_id, "tool_name", result_dict)
    observer.log_error(session_id, "tool_name", "what went wrong")
"""

import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #

BASE_LOG_DIR = Path(
    os.environ.get(
        "PRICEPILOT_LOG_DIR",
        "/Users/tomer_itzhakov_nevo/Documents/Projects/Lista/logs_and_pictures/sessions",
    )
)

EVENT_TYPES = (
    "tool_call",
    "tool_result",
    "state_change",
    "error",
    "screenshot",
    "agent_thinking",
)


# --------------------------------------------------------------------------- #
# Data structures
# --------------------------------------------------------------------------- #


@dataclass
class SessionLog:
    """In-memory log buffer for a single agent session."""

    session_id: str
    log_dir: Path
    events: list[dict[str, Any]] = field(default_factory=list)
    screenshot_counter: int = 0
    start_time: float = field(default_factory=time.monotonic)
    # Track open tool calls so we can compute duration
    _pending_tools: dict[str, float] = field(default_factory=dict)

    @property
    def screenshot_dir(self) -> Path:
        return self.log_dir

    @property
    def json_path(self) -> Path:
        return self.log_dir / "session_log.json"

    @property
    def summary_path(self) -> Path:
        return self.log_dir / "session_summary.md"


# --------------------------------------------------------------------------- #
# Observer singleton
# --------------------------------------------------------------------------- #


class Observer:
    """Central observability hub — one instance per process."""

    _instance: Observer | None = None

    def __init__(self) -> None:
        self._sessions: dict[str, SessionLog] = {}

    # -- singleton ---------------------------------------------------------- #

    @classmethod
    def get_instance(cls) -> Observer:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # -- session management ------------------------------------------------- #

    def get_or_create_session(self, session_id: str) -> SessionLog:
        """Return the log for *session_id*, creating a timestamped dir if new."""
        if session_id not in self._sessions:
            # Create a unique timestamped folder so sessions never mix
            from datetime import datetime
            ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            short_id = session_id[-8:] if len(session_id) > 8 else session_id
            folder_name = f"{ts}_{short_id}"
            log_dir = BASE_LOG_DIR / folder_name
            log_dir.mkdir(parents=True, exist_ok=True)
            self._sessions[session_id] = SessionLog(
                session_id=session_id,
                log_dir=log_dir,
            )
        return self._sessions[session_id]

    # -- event helpers ------------------------------------------------------ #

    def _append(self, session_id: str, event: dict[str, Any]) -> None:
        """Append an event and flush to disk."""
        try:
            slog = self.get_or_create_session(session_id)
            event.setdefault("timestamp", _now_iso())
            slog.events.append(event)
            self._flush_json(slog)
        except Exception:
            logger.debug("Observer._append failed", exc_info=True)

    def _flush_json(self, slog: SessionLog) -> None:
        """Write the full event list to the JSON log file."""
        try:
            with open(slog.json_path, "w", encoding="utf-8") as fh:
                json.dump(slog.events, fh, ensure_ascii=False, indent=2, default=str)
        except Exception:
            logger.debug("Observer._flush_json failed", exc_info=True)

    # -- public API: tool lifecycle ----------------------------------------- #

    def log_tool_start(
        self,
        session_id: str,
        tool_name: str,
        input_data: dict[str, Any] | None = None,
    ) -> None:
        """Record the start of a tool invocation."""
        try:
            slog = self.get_or_create_session(session_id)
            slog._pending_tools[tool_name] = time.monotonic()
            self._append(session_id, {
                "event_type": "tool_call",
                "tool_name": tool_name,
                "input_data": _safe_serialize(input_data),
            })
        except Exception:
            logger.debug("log_tool_start failed", exc_info=True)

    def log_tool_end(
        self,
        session_id: str,
        tool_name: str,
        output_data: dict[str, Any] | None = None,
        state_snapshot: dict[str, Any] | None = None,
    ) -> None:
        """Record the successful end of a tool invocation."""
        try:
            slog = self.get_or_create_session(session_id)
            start = slog._pending_tools.pop(tool_name, None)
            duration_ms = round((time.monotonic() - start) * 1000) if start else None
            self._append(session_id, {
                "event_type": "tool_result",
                "tool_name": tool_name,
                "output_data": _safe_serialize(output_data),
                "duration_ms": duration_ms,
                "state_snapshot": _safe_serialize(state_snapshot),
            })
        except Exception:
            logger.debug("log_tool_end failed", exc_info=True)

    def log_error(
        self,
        session_id: str,
        tool_name: str,
        error: str,
        input_data: dict[str, Any] | None = None,
    ) -> None:
        """Record an error during tool execution."""
        try:
            slog = self.get_or_create_session(session_id)
            start = slog._pending_tools.pop(tool_name, None)
            duration_ms = round((time.monotonic() - start) * 1000) if start else None
            self._append(session_id, {
                "event_type": "error",
                "tool_name": tool_name,
                "error": str(error),
                "input_data": _safe_serialize(input_data),
                "duration_ms": duration_ms,
            })
        except Exception:
            logger.debug("log_error failed", exc_info=True)

    def log_state_change(
        self,
        session_id: str,
        description: str,
        state_snapshot: dict[str, Any] | None = None,
    ) -> None:
        """Record a state change (auth status, cart contents, etc.)."""
        try:
            self._append(session_id, {
                "event_type": "state_change",
                "description": description,
                "state_snapshot": _safe_serialize(state_snapshot),
            })
        except Exception:
            logger.debug("log_state_change failed", exc_info=True)

    def log_thinking(
        self,
        session_id: str,
        thought: str,
    ) -> None:
        """Record an agent thinking / reasoning step."""
        try:
            self._append(session_id, {
                "event_type": "agent_thinking",
                "thought": thought,
            })
        except Exception:
            logger.debug("log_thinking failed", exc_info=True)

    # -- screenshot capture ------------------------------------------------- #

    async def capture_screenshot(
        self,
        session_id: str,
        page: Any,
        step_name: str,
    ) -> str | None:
        """Capture a PNG screenshot and log it.

        Args:
            session_id: Current session identifier.
            page: Playwright Page object.
            step_name: Human-readable label (used in filename).

        Returns:
            Absolute path to the saved screenshot, or None on failure.
        """
        try:
            slog = self.get_or_create_session(session_id)
            slog.screenshot_counter += 1
            safe_name = _safe_filename(step_name)
            filename = f"{slog.screenshot_counter}_{safe_name}.png"
            filepath = slog.screenshot_dir / filename

            await page.screenshot(path=str(filepath), full_page=False)

            self._append(session_id, {
                "event_type": "screenshot",
                "screenshot_path": str(filepath),
                "step_name": step_name,
                "index": slog.screenshot_counter,
            })
            return str(filepath)

        except Exception:
            logger.debug("capture_screenshot failed", exc_info=True)
            return None

    # -- summary generation ------------------------------------------------- #

    def generate_summary(
        self,
        session_id: str,
        final_status: str = "unknown",
    ) -> str | None:
        """Write a Markdown summary and return its path.

        Args:
            session_id: Session to summarize.
            final_status: Overall outcome — "success", "failure", "partial", etc.

        Returns:
            Path to the generated .md file, or None on failure.
        """
        try:
            slog = self.get_or_create_session(session_id)
            lines: list[str] = []

            lines.append(f"# PricePilot Session Summary")
            lines.append(f"")
            lines.append(f"**Session ID:** `{session_id}`  ")
            lines.append(f"**Generated:** {_now_iso()}  ")
            lines.append(f"**Status:** {final_status}  ")
            lines.append(f"**Total events:** {len(slog.events)}  ")
            lines.append("")
            lines.append("---")
            lines.append("")
            lines.append("## Timeline")
            lines.append("")

            for evt in slog.events:
                ts = evt.get("timestamp", "?")
                etype = evt.get("event_type", "?")

                if etype == "tool_call":
                    tool = evt.get("tool_name", "?")
                    inp = _brief(evt.get("input_data"))
                    lines.append(f"### {ts} -- CALL `{tool}`")
                    lines.append(f"")
                    lines.append(f"**Input:** `{inp}`")
                    lines.append("")

                elif etype == "tool_result":
                    tool = evt.get("tool_name", "?")
                    dur = evt.get("duration_ms")
                    out = _brief(evt.get("output_data"))
                    dur_str = f" ({dur} ms)" if dur is not None else ""
                    lines.append(f"### {ts} -- RESULT `{tool}`{dur_str}")
                    lines.append(f"")
                    lines.append(f"**Output:** `{out}`")
                    lines.append("")

                elif etype == "error":
                    tool = evt.get("tool_name", "?")
                    err = evt.get("error", "?")
                    lines.append(f"### {ts} -- ERROR `{tool}`")
                    lines.append(f"")
                    lines.append(f"> **{err}**")
                    lines.append("")

                elif etype == "screenshot":
                    step = evt.get("step_name", "?")
                    path = evt.get("screenshot_path", "")
                    lines.append(f"### {ts} -- SCREENSHOT: {step}")
                    lines.append(f"")
                    lines.append(f"![{step}]({path})")
                    lines.append("")

                elif etype == "state_change":
                    desc = evt.get("description", "?")
                    lines.append(f"### {ts} -- STATE CHANGE")
                    lines.append(f"")
                    lines.append(f"{desc}")
                    lines.append("")

                elif etype == "agent_thinking":
                    thought = evt.get("thought", "")
                    lines.append(f"### {ts} -- THINKING")
                    lines.append(f"")
                    lines.append(f"_{thought}_")
                    lines.append("")

            # Final state snapshot from last event that has one
            final_state = None
            for evt in reversed(slog.events):
                if evt.get("state_snapshot"):
                    final_state = evt["state_snapshot"]
                    break

            if final_state:
                lines.append("---")
                lines.append("")
                lines.append("## Final State")
                lines.append("")
                lines.append("```json")
                lines.append(json.dumps(final_state, ensure_ascii=False, indent=2, default=str))
                lines.append("```")
                lines.append("")

            # Errors summary
            errors = [e for e in slog.events if e.get("event_type") == "error"]
            if errors:
                lines.append("---")
                lines.append("")
                lines.append("## Errors")
                lines.append("")
                for err_evt in errors:
                    lines.append(
                        f"- **`{err_evt.get('tool_name', '?')}`**: {err_evt.get('error', '?')}"
                    )
                lines.append("")

            md_text = "\n".join(lines)
            with open(slog.summary_path, "w", encoding="utf-8") as fh:
                fh.write(md_text)

            return str(slog.summary_path)

        except Exception:
            logger.debug("generate_summary failed", exc_info=True)
            return None


# --------------------------------------------------------------------------- #
# Module-level singleton
# --------------------------------------------------------------------------- #

observer = Observer.get_instance()


# --------------------------------------------------------------------------- #
# Helpers (private)
# --------------------------------------------------------------------------- #


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def _safe_filename(name: str) -> str:
    """Sanitize a step name for use in a filename."""
    return "".join(c if c.isalnum() or c in ("_", "-") else "_" for c in name)[:60]


def _safe_serialize(obj: Any) -> Any:
    """Return a JSON-safe representation, truncating huge values."""
    if obj is None:
        return None
    try:
        # Round-trip through JSON to catch non-serializable values
        text = json.dumps(obj, ensure_ascii=False, default=str)
        if len(text) > 5000:
            return json.loads(text[:5000] + '..."')
        return json.loads(text)
    except Exception:
        return str(obj)[:2000]


def _brief(obj: Any, max_len: int = 200) -> str:
    """Compact string for inline Markdown display."""
    if obj is None:
        return "(none)"
    try:
        text = json.dumps(obj, ensure_ascii=False, default=str)
    except Exception:
        text = str(obj)
    if len(text) > max_len:
        return text[: max_len - 3] + "..."
    return text
