---
name: adk-state-memory-artifacts
description: Guide for ADK sessions, state management, memory services, and artifact handling — when and how to use each persistence layer
---

# ADK State, Memory & Artifacts

Use this skill when designing persistence for ADK agents — choosing between sessions, state, memory, and artifacts.

## Quick Decision Guide

| Need | Use |
|------|-----|
| Current conversation data | Session state (no prefix) |
| User preferences across sessions | State with `user:` prefix |
| App-wide config/data | State with `app:` prefix |
| Temporary per-invocation data | State with `temp:` prefix |
| Cross-session knowledge recall | Memory service |
| File-like outputs (PDFs, images) | Artifacts |

---

## Sessions

### Session Object
```python
from google.adk.sessions import InMemorySessionService

session_service = InMemorySessionService()
session = await session_service.create_session(
    app_name="my_app",
    user_id="user_123",
    state={"language": "he"},  # initial state
)
```

Properties: `id`, `app_name`, `user_id`, `events`, `state`, `last_update_time`

### SessionService Implementations

| Service | Use Case | Notes |
|---------|----------|-------|
| `InMemorySessionService` | Dev/testing | Data lost on restart |
| `DatabaseSessionService` | Production (self-hosted) | SQLite/PostgreSQL/MySQL |
| `VertexAiSessionService` | Production (managed) | Google Cloud |

### DatabaseSessionService
```python
from google.adk.sessions import DatabaseSessionService

# SQLite
session_service = DatabaseSessionService(db_url="sqlite+aiosqlite:///./sessions.db")

# PostgreSQL (requires asyncpg)
session_service = DatabaseSessionService(db_url="postgresql+asyncpg://user:pass@host/db")

# MySQL (requires aiomysql)
session_service = DatabaseSessionService(db_url="mysql+aiomysql://user:pass@host/db")
```

---

## State

### State Prefixes

| Prefix | Scope | Persistence |
|--------|-------|-------------|
| (none) e.g. `"topic"` | Current session | With persistent SessionService |
| `user:` e.g. `"user:lang"` | All sessions for this user | With DB/Vertex SessionService |
| `app:` e.g. `"app:version"` | All users and sessions | With DB/Vertex SessionService |
| `temp:` e.g. `"temp:step"` | Current invocation only | Never persisted |

### Accessing State

**1. In tools via ToolContext:**
```python
def my_tool(query: str, tool_context: ToolContext) -> dict:
    lang = tool_context.state.get("user:language", "en")
    tool_context.state["last_query"] = query  # auto-tracked delta
    return {"status": "success"}
```

**2. Via agent `output_key`** — auto-saves agent response text to state:
```python
agent = Agent(
    name="summarizer",
    model="gemini-2.5-flash",
    output_key="summary",  # response saved to state["summary"]
)
```

**3. In instruction templates:**
```python
agent = Agent(
    instruction="Help the user. Their preferred language is {user:language}. Current topic: {topic?}",
    # {topic?} = optional, no error if missing
)
```

**4. Via callbacks:**
```python
def before_agent(callback_context: CallbackContext) -> Optional[Content]:
    callback_context.state["visits"] = callback_context.state.get("visits", 0) + 1
    return None
```

### Critical Rule
**NEVER** modify `session.state` directly after retrieving a session object. Always use `tool_context.state`, `callback_context.state`, or `EventActions(state_delta={...})`. Direct mutation bypasses delta tracking.

---

## Memory

Long-term, searchable recall **across sessions**. Only add when the app truly needs cross-session knowledge.

### When to Use Memory
- User preferences that should persist beyond sessions
- Learning from past interactions
- Building up knowledge over time

### When NOT to Use Memory
- Current conversation context → use state
- Simple config → use `user:` or `app:` state
- File outputs → use artifacts

### Memory Services

| Service | Search Type | Persistence |
|---------|-------------|-------------|
| `InMemoryMemoryService` | Keyword matching | None (dev only) |
| `VertexAiMemoryBankService` | Semantic search | Yes (production) |

### Memory API
```python
from google.adk.memory import InMemoryMemoryService

memory_service = InMemoryMemoryService()

# Add session contents to memory (call after meaningful sessions)
memory_service.add_session_to_memory(session)

# Search memory (in tools via tool_context)
def recall_info(query: str, tool_context: ToolContext) -> dict:
    results = tool_context.search_memory(query)
    return {"status": "success", "results": results}
```

### Built-in Memory Tools
```python
from google.adk.tools.preload_memory_tool import PreloadMemoryTool  # auto-retrieves at conversation start
from google.adk.tools.load_memory_tool import LoadMemory            # agent-initiated retrieval
```

---

## Artifacts

Versioned binary data (files, images, PDFs, audio) associated with session or user scope.

### Setup
```python
from google.adk.artifacts import InMemoryArtifactService

artifact_service = InMemoryArtifactService()  # dev
# Production: GcsArtifactService for Google Cloud Storage

runner = Runner(
    agent=agent,
    app_name="my_app",
    session_service=session_service,
    artifact_service=artifact_service,
)
```

### Save/Load in Tools
```python
from google.genai import types

async def generate_report(title: str, tool_context: ToolContext) -> dict:
    """Generate a PDF report."""
    pdf_bytes = create_pdf(title)

    # Save artifact (session-scoped)
    version = await tool_context.save_artifact(
        filename="report.pdf",
        artifact=types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
    )

    # Save artifact (user-scoped — accessible across sessions)
    await tool_context.save_artifact(
        filename="user:profile.png",
        artifact=types.Part.from_bytes(data=img_bytes, mime_type="image/png"),
    )

    return {"status": "success", "version": version}

async def get_report(tool_context: ToolContext) -> dict:
    """Get the latest report."""
    artifact = await tool_context.load_artifact("report.pdf")       # latest version
    artifact_v0 = await tool_context.load_artifact("report.pdf", version=0)  # specific version
    files = await tool_context.list_artifacts()
    return {"status": "success", "files": files}
```

### Artifact Services
| Service | Use Case |
|---------|----------|
| `InMemoryArtifactService` | Dev/testing |
| `GcsArtifactService` | Production (Google Cloud Storage) |

### Namespacing
- Plain filename (`"report.pdf"`) → session-scoped
- `"user:"` prefix (`"user:avatar.png"`) → user-scoped, accessible across all sessions
