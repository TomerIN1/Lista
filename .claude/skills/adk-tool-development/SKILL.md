---
name: adk-tool-development
description: Guide for building robust ADK tools — FunctionTool, ToolContext, LongRunningFunctionTool, built-in tools, and LLM-friendly patterns
---

# ADK Tool Development

Use this skill when creating, reviewing, or debugging tools for ADK agents.

## Function Tools

Functions are auto-wrapped by ADK. **Docstrings become tool descriptions for the LLM. Type hints define parameter schemas.**

### Python
```python
def get_weather(city: str, unit: str = "Celsius") -> dict:
    """Get weather for a city.

    Args:
        city (str): The city name.
        unit (str): Temperature unit (Celsius or Fahrenheit).
    """
    return {"status": "success", "city": city, "temp": "18C"}

agent = Agent(model='gemini-2.5-flash', tools=[get_weather])
```

### TypeScript
```typescript
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

const tool = new FunctionTool({
    name: 'getWeather',
    description: 'Gets weather for a city',
    parameters: z.object({ city: z.string().describe('City name') }),
    execute: async ({city}) => ({temp: "18C"}),
});
```

### Go
```go
type Args struct {
    City string `json:"city" jsonschema:"City name"`
}
func getWeather(ctx tool.Context, args Args) (map[string]any, error) { ... }
tool, _ := functiontool.New(functiontool.Config{Name: "get_weather", Description: "..."}, getWeather)
```

## ToolContext

Injected automatically when you add a `tool_context: ToolContext` parameter. **Do NOT include `tool_context` in docstrings** — it's framework-injected and invisible to the LLM.

```python
from google.adk.tools import ToolContext

def save_preference(key: str, value: str, tool_context: ToolContext) -> dict:
    """Save a user preference.

    Args:
        key: The preference name.
        value: The preference value.
    """
    tool_context.state[f"user:{key}"] = value
    return {"status": "success"}
```

### ToolContext Capabilities
| Method/Property | Purpose |
|----------------|---------|
| `tool_context.state` | Read/write session state with delta tracking |
| `tool_context.actions.transfer_to_agent` | Route to another agent |
| `tool_context.actions.escalate` | Exit a LoopAgent |
| `tool_context.actions.skip_summarization` | Bypass LLM summary of tool result |
| `tool_context.save_artifact(filename, artifact)` | Save binary artifact |
| `tool_context.load_artifact(filename)` | Load artifact |
| `tool_context.list_artifacts()` | List available artifacts |
| `tool_context.search_memory(query)` | Search long-term memory |
| `tool_context.request_credential(auth_config)` | OAuth/credential flow |
| `tool_context.get_auth_response()` | Get credential response |

## LongRunningFunctionTool

For async operations that need external approval or take significant time:

```python
from google.adk.tools import LongRunningFunctionTool

def request_approval(action: str, details: str) -> dict:
    """Request human approval for an action.

    Args:
        action: The action requiring approval.
        details: Details about the action.
    """
    return {"status": "pending", "message": f"Awaiting approval for: {action}"}

approval_tool = LongRunningFunctionTool(func=request_approval)
```

## Built-in Tools

### Google Search
```python
from google.adk.tools import google_search

agent = Agent(model='gemini-2.5-flash', tools=[google_search])
```
**Constraint**: Only one tool per agent when using google_search. Gemini 2+ only.

### Code Execution
```python
from google.adk.code_executors import BuiltInCodeExecutor

agent = Agent(model='gemini-2.5-flash', code_executor=BuiltInCodeExecutor())
```
**Constraint**: Only one tool per agent when using code executor.

## Return Shape Best Practices

Always return dicts with a `"status"` key:

```python
# Success
{"status": "success", "data": {...}}

# Error
{"status": "error", "error_type": "not_found", "message": "Product not found"}

# Pending (for long-running)
{"status": "pending", "message": "Awaiting approval"}
```

## Parameter Design Rules

| Rule | Example |
|------|---------|
| Use simple primitive types | `str`, `int`, `float`, `bool` |
| Provide defaults for optional params | `limit: int = 10` |
| Document formats in docstring | `date (str): ISO 8601 format YYYY-MM-DD` |
| Keep params flat | Avoid nested dicts/objects |
| Use descriptive names | `store_name` not `sn` |
| Minimize parameters | <5 per tool ideally |
| Use Literal for fixed options | `status: Literal["active", "inactive"]` |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| No docstring | Always add — it's the LLM's only guide to the tool |
| Including `tool_context` in docstring | Framework-injected, invisible to LLM |
| Raising unhandled exceptions | Catch and return error dicts |
| Returning raw strings | Return structured dicts with `status` |
| Too many params (>5) | Split into multiple focused tools |
| Complex nested param types | LLM hallucinates shapes — keep flat |

## Tool Organization

```
project/
├── tools/
│   ├── __init__.py          # Export all tools
│   ├── search_tools.py      # Search-related tools
│   ├── price_tools.py       # Pricing tools
│   └── store_tools.py       # Store management tools
```

Group by domain, not by technical similarity. Test tools independently before wiring to agents.
