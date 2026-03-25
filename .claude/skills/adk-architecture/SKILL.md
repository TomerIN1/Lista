---
name: adk-architecture
description: Architecture selection guide for Google ADK — agent types, multi-agent patterns, and decision criteria grounded in official docs
---

# ADK Architecture Patterns

Use this skill when deciding how to structure an ADK agent system. Always recommend the **simplest architecture that works**.

## Decision Tree

```
Is the task focused with <5 tools?
  YES → Single LlmAgent
  NO → Does it need distinct specialist roles?
    YES → Are the steps deterministic/sequential?
      YES → Workflow Agent (Sequential/Loop/Parallel)
      NO  → Multi-Agent with LLM-driven delegation
    NO → Multi-Tool Single LlmAgent
```

## Agent Types (from official ADK)

### LlmAgent (alias: `Agent`)
Non-deterministic, LLM-powered. The core building block.

```python
from google.adk.agents.llm_agent import Agent

root_agent = Agent(
    model='gemini-2.5-flash',
    name='root_agent',
    description="Tells the current time in a specified city.",
    instruction="You are a helpful assistant. Use 'get_current_time' tool.",
    tools=[get_current_time],
)
```

**Key parameters**: `name`, `model` (required), `description`, `instruction` (supports `{state_var}` templates), `tools`, `sub_agents`, `output_key`, `output_schema`, `input_schema`, `include_contents`, `generate_content_config`, `before_agent_callback`, `after_agent_callback`, `before_model_callback`, `after_model_callback`, `before_tool_callback`, `after_tool_callback`, `planner`, `code_executor`

### SequentialAgent
Runs sub-agents one after another in order. Deterministic pipeline.

### ParallelAgent
Runs sub-agents concurrently. Branched contexts but shared state.

### LoopAgent
Repeats sub-agents until `max_iterations` or an agent triggers `escalate=True`.

### Custom Agents
Extend `BaseAgent`, implement `_run_async_impl()`:
```python
async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
    async for event in self.sub_agent.run_async(ctx):
        yield event
```

## Multi-Agent Patterns

### LLM-Driven Delegation (via sub_agents)
LLM generates `transfer_to_agent(agent_name='target')` to route between agents. Set via `sub_agents` parameter — auto-sets `parent_agent`.

```python
orchestrator = Agent(
    name="coordinator",
    model="gemini-2.5-flash",
    instruction="Route billing questions to billing_agent, technical to tech_agent.",
    sub_agents=[billing_agent, tech_agent],
)
```

### Agent-as-a-Tool (AgentTool)
Wrap an agent as a callable tool — parent controls when/how to call it and gets structured response back.

```python
from google.adk.tools import AgentTool

summarizer = Agent(name="summarizer", model="gemini-2.5-flash", ...)
main_agent = Agent(
    name="assistant",
    model="gemini-2.5-flash",
    tools=[AgentTool(agent=summarizer)],
)
```

**Key difference**: `sub_agents` = LLM decides routing via transfer. `AgentTool` = parent explicitly calls sub-agent as a tool.

### Shared State Between Agents
- All agents in a hierarchy share session state via `context.state['key']`
- Use `output_key` to auto-save an agent's response text to state
- State prefixes: (none)=session, `user:`=user-scoped, `app:`=app-scoped, `temp:`=invocation-only

## Official Multi-Agent Patterns (from docs)
1. **Coordinator/Dispatcher** — central agent routes to specialists
2. **Sequential Pipeline** — SequentialAgent chains steps
3. **Parallel Fan-Out/Gather** — ParallelAgent for concurrent work
4. **Hierarchical Task Decomposition** — nested agent trees
5. **Generator-Critic** — LoopAgent with generator + validator
6. **Iterative Refinement** — LoopAgent repeating until quality met
7. **Human-in-the-Loop** — LongRunningFunctionTool for approval gates

## Anti-Patterns to Avoid

1. **Over-engineering**: Don't use multi-agent when a single agent with 3 tools works
2. **God orchestrator**: Orchestrator should delegate, not do the work itself
3. **Circular dependencies**: Agents calling each other in loops
4. **Tool explosion**: >10 tools on one agent — split into specialists
5. **Mixing ADK versions**: Never combine ADK 1.0 and 2.0 patterns
6. **Ignoring `include_contents`**: Set to `'none'` for stateless agents that don't need conversation history
