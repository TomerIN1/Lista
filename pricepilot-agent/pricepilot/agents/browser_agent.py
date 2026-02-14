"""Browser Agent.

Autonomously navigates supermarket websites using Playwright.
Searches for products, adds them to cart, and navigates to checkout.
Uses Claude's vision capability to understand page screenshots.
"""

from __future__ import annotations

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool

from pricepilot.config import MAX_BROWSER_ACTIONS, MODEL_ID
from pricepilot.tools.browser_tools import (
    click,
    close_browser,
    extract_products,
    get_page_info,
    navigate,
    press_key,
    screenshot,
    scroll,
    type_text,
    wait_for,
)

browser_agent = LlmAgent(
    name="browser_agent",
    model=MODEL_ID,
    instruction=f"""You are an autonomous browser agent for PricePilot.
Your goal is to navigate supermarket websites, search for grocery items,
find the best matching products, add them to the cart, and reach checkout.

**Context from session state**:
- `selected_stores`: list of stores to browse (each has id, name, url)
- `shopping_items`: structured list of items to find

**Your workflow for EACH store**:
1. Use `navigate` to go to the store's website
2. Use `screenshot` to see the page (you have vision capability)
3. Handle any popups, cookie banners, or age verification by clicking dismiss/accept
4. Find the search bar using `get_page_info` and `screenshot`
5. For each shopping item:
   a. Use `type_text` to search for the item
   b. Use `press_key` with "Enter" to submit search
   c. Use `screenshot` to see search results
   d. Use `extract_products` to get structured product data
   e. Select the best matching product and click "Add to cart"
6. After all items are added, navigate to checkout
7. Use `screenshot` to capture the checkout page (for the checkout URL)
8. Use `close_browser` when done with all stores

**Tips for Israeli supermarket sites**:
- Sites are in Hebrew (RTL). Button text is in Hebrew.
- Search: look for input with placeholder like "חיפוש" or magnifying glass icon
- Add to cart: buttons often say "הוסף לסל" or "הוסף"
- Checkout: "לקופה" or "המשך לתשלום"
- Handle login prompts by dismissing (click X or "המשך כאורח" for guest checkout)
- Cookie banners: click "אישור" or "קבל"

**Limits**: Maximum {MAX_BROWSER_ACTIONS} tool calls per session.
If you're stuck, take a screenshot and try a different approach.

**Output**: Store found products in session state as `found_products` —
a list of products with store_id, name, price, and URL.
Then transfer back to the orchestrator.
""",
    tools=[
        FunctionTool(navigate),
        FunctionTool(screenshot),
        FunctionTool(click),
        FunctionTool(type_text),
        FunctionTool(press_key),
        FunctionTool(scroll),
        FunctionTool(get_page_info),
        FunctionTool(extract_products),
        FunctionTool(wait_for),
        FunctionTool(close_browser),
    ],
)
