---
name: adk-debugging
description: Debugging guide for ADK agents — common issues with tool calls, routing, state, memory, callbacks, and how to diagnose them
---

# ADK Debugging Guide

Use this skill when diagnosing issues with ADK agent systems.

## Quick Diagnosis

| Symptom | Likely Cause | Section |
|---------|-------------|---------|
| Tool calls fail or hallucinate params | Bad docstring/type hints | Tool Issues |
| Agent doesn't use the right tool | Vague tool descriptions | Tool Issues |
| Agent routes to wrong sub-agent | Unclear agent descriptions | Routing Issues |
| State not persisting | Wrong prefix or direct mutation | State Issues |
| Memory search returns nothing | Using InMemoryMemoryService | Memory Issues |
| Artifacts not found | Missing artifact_service on Runner | Artifact Issues |
| Callback not firing | Wrong callback name or signature | Callback Issues |

---

## Tool Issues

### LLM hallucinates tool parameters
**Cause**: Missing or vague docstrings, complex parameter types.
**Fix**:
1. Add detailed docstrings with Args section — this IS the schema the LLM sees
2. Use simple primitive types (`str`, `int`, `float`, `bool`)
3. Avoid nested dicts, custom objects, or complex generics as params
4. Add format hints: `date (str): ISO 8601 format YYYY-MM-DD`

### Tool returns error but agent ignores it
**Cause**: Inconsistent return shapes.
**Fix**: Always return `{"status": "error", "message": "..."}` — the LLM learns to check `status`.

### Tool not being called at all
**Cause**: Tool description doesn't match what agent is trying to do.
**Fix**: Make tool name and docstring clearly describe the action. The name should be a verb phrase.

### `tool_context` showing up in LLM tool schema
**Cause**: Including `tool_context` in the docstring Args section.
**Fix**: Never document `tool_context` in docstrings — ADK injects it automatically and hides it from the LLM.

---

## Routing Issues

### Agent delegates to wrong sub-agent
**Cause**: Sub-agent `description` fields are vague or overlapping.
**Fix**:
1. Make each sub-agent's `description` clearly distinct
2. Add routing hints in the orchestrator's `instruction`
3. Use `AgentTool` instead of `sub_agents` for more explicit control

### Transfer loops between agents
**Cause**: Agents transferring back and forth without resolution.
**Fix**:
1. Ensure one agent can fully handle a request before transferring back
2. Add clear "when to transfer" and "when NOT to transfer" in instructions
3. Consider using SequentialAgent for deterministic pipelines

---

## State Issues

### State not persisting between sessions
**Cause**: Using `InMemorySessionService` (data lost on restart) or missing prefix.
**Fix**:
1. For dev persistence: `DatabaseSessionService(db_url="sqlite+aiosqlite:///./sessions.db")`
2. Use `user:` prefix for cross-session user data
3. Use `app:` prefix for app-wide data

### State changes not visible
**Cause**: Directly modifying `session.state` instead of using context.
**Fix**: Always use `tool_context.state["key"] = value` or `callback_context.state["key"] = value`. Never do `session.state["key"] = value` — this bypasses delta tracking.

### `temp:` state leaking across invocations
**This shouldn't happen** — `temp:` prefix is invocation-scoped by design. If you see this, check that you're not accidentally using a non-temp key.

### Instruction template `{key}` shows literal text
**Cause**: State key doesn't exist.
**Fix**: Use `{key?}` (with `?`) for optional state variables that may not be set yet.

---

## Memory Issues

### Memory search returns no results
**Causes**:
1. Using `InMemoryMemoryService` — only keyword matching, no semantic search
2. Never called `memory_service.add_session_to_memory(session)`
3. Query doesn't match stored content

**Fix**:
1. For production: use `VertexAiMemoryBankService` for semantic search
2. Ensure you're adding completed sessions to memory
3. Check that meaningful content exists in the sessions you've added

### Memory added but agent doesn't use it
**Cause**: No memory tool provided to the agent.
**Fix**: Add `PreloadMemoryTool` (auto-loads at start) or `LoadMemory` (agent-initiated) to the agent's tools list.

---

## Artifact Issues

### `save_artifact` / `load_artifact` fails
**Cause**: `artifact_service` not provided to Runner.
**Fix**:
```python
from google.adk.artifacts import InMemoryArtifactService

runner = Runner(
    agent=agent,
    app_name="app",
    session_service=session_service,
    artifact_service=InMemoryArtifactService(),  # Required!
)
```

### Artifact not found across sessions
**Cause**: Using session-scoped filename.
**Fix**: Use `"user:filename.pdf"` prefix for user-scoped artifacts accessible across sessions.

---

## Callback Issues

### Callback not firing
**Cause**: Wrong callback name or signature.
**Fix**: Use exact names and signatures:
```python
# Agent-level
def before_agent(callback_context: CallbackContext) -> Optional[Content]: ...
def after_agent(callback_context: CallbackContext) -> Optional[Content]: ...

# Model-level
def before_model(callback_context: CallbackContext, llm_request: LlmRequest) -> Optional[LlmResponse]: ...
def after_model(callback_context: CallbackContext, llm_response: LlmResponse) -> Optional[LlmResponse]: ...

# Tool-level
def before_tool(callback_context: CallbackContext, tool_name: str, tool_args: dict) -> Optional[dict]: ...
def after_tool(callback_context: CallbackContext, tool_name: str, tool_args: dict, tool_result: dict) -> Optional[dict]: ...
```

### Callback return value confusion
- Return `None` → proceed normally
- Return a value → **override** (skip the agent/model/tool call and use your return value instead)

---

## General Debugging Tools

### ADK Web UI
```bash
adk web --port 8000
```
Best debugging tool — shows full event trace, tool calls, state changes, agent routing.

### ADK CLI (verbose)
```bash
adk run my_agent
```
Interactive terminal session for quick testing.

### Logging
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Event Inspection
The Runner event loop follows: Agent yields event → pauses → Runner commits state → resumes agent. Check events for:
- `content` — what was generated
- `actions.state_delta` — state changes
- `actions.transfer_to_agent` — routing decisions
- `error_code` / `error_message` — failures
- `turn_complete` — whether the turn ended
