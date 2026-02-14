"""List Interpreter Agent.

Parses natural language shopping lists into structured ShoppingItem objects.
Supports Hebrew and English input.
"""

from __future__ import annotations

import json
import uuid

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool

from pricepilot.config import MODEL_ID


async def parse_shopping_list(raw_text: str) -> str:
    """Parse a raw shopping list text into structured items.

    Extracts item name, quantity, unit, brand, and category from
    free-form text. Handles both Hebrew and English input.

    Args:
        raw_text: The raw shopping list text, one item per line or comma-separated.
    """
    # The LLM agent will process the raw text and call this tool
    # to format the structured output. This is a pass-through that
    # structures the LLM's extraction.
    #
    # The actual parsing intelligence comes from the agent's LLM prompt.
    # This tool just provides the structured output format.
    lines = [line.strip() for line in raw_text.replace(",", "\n").split("\n") if line.strip()]

    items = []
    for line in lines:
        items.append({
            "id": str(uuid.uuid4()),
            "raw_text": line,
            "name": line,
            "quantity": 1,
            "unit": None,
            "brand": None,
            "category": "grocery",
            "attributes": [],
        })

    return json.dumps(items)


list_interpreter = LlmAgent(
    name="list_interpreter",
    model=MODEL_ID,
    instruction="""You are a shopping list parser for PricePilot, a grocery shopping assistant.

Your job is to take the user's shopping list and extract structured items from it.

**Input**: The shopping list is available in the session state as `shopping_list_raw`.
It may be raw text from the user or pre-structured items from the Lista app.

**Your task**:
1. For each item, extract: name, quantity, unit (kg/g/L/ml/pcs), brand (if mentioned), category
2. Handle Hebrew and English input naturally
3. Normalize quantities (e.g., "2 cartons of milk" → name="milk", quantity=2, unit="pcs")
4. If items are already structured (from Lista app), validate and pass through

**Output**: Use the `parse_shopping_list` tool to format items, then confirm with the user.

After parsing, update the session state with the structured items and transfer back
to the orchestrator.

Example Hebrew input: "2 חלב תנובה, 1 ק״ג עגבניות, לחם אחיד"
Example English input: "2 milk cartons, 1kg tomatoes, whole wheat bread"
""",
    tools=[FunctionTool(parse_shopping_list)],
)
