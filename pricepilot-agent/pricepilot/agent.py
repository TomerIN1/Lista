"""Root agent definition — the entry point ADK discovers.

Google ADK looks for a `root_agent` variable in the top-level agent module.
We export the orchestrator agent as the root.
"""

from pricepilot.agents.orchestrator import orchestrator_agent

root_agent = orchestrator_agent
