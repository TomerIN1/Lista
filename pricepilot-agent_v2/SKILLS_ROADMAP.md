# PricePilot Agent — Skills Roadmap

> Last updated: 2026-03-28

## Category 1: Web Navigation & Browser Automation

| Skill | Have? | Need to Add? | Notes |
|-------|-------|-------------|-------|
| Page navigation | ✅ Yes | — | Playwright goto, redirects |
| Element interaction | ✅ Yes | — | Click, fill, modals, buttons |
| Dynamic content handling | ✅ Yes | — | wait_for_load, networkidle, asyncio.sleep fallbacks |
| Multi-tab/window management | ❌ No | ❌ Not now | No payment redirects yet |
| Cookie & session management | ✅ Yes | — | Isolated BrowserContext per session, cookie extraction |
| Screenshot & visual understanding | ❌ No | ❌ Not now | DOM parsing works fine for current sites |
| Error recovery | ✅ Yes | — | Browser crash recovery, page-dead detection, retry |

## Category 2: Authentication & Account Management

| Skill | Have? | Need to Add? | Notes |
|-------|-------|-------------|-------|
| Registration flow | ❌ No | ❌ Not now | Users already have store accounts |
| Login handling | ✅ Yes | — | Browser-based OTP login |
| OTP/2FA relay | ✅ Yes | — | Full OTP flow with retry |
| CAPTCHA delegation | ✅ Partial | ❌ Not now | Stealth patches auto-bypass reCAPTCHA; no manual solver |
| Session refresh | ✅ Partial | ⚠️ Later | TTL-based expiry exists, no token refresh |
| Password management | ❌ No | ❌ Not now | OTP-based, no passwords stored |
| Social login handling | ❌ No | ❌ Not now | Rami Levy uses OTP only |

## Category 3: Product Search & Discovery

| Skill | Have? | Need to Add? | Notes |
|-------|-------|-------------|-------|
| Natural language to search query | ✅ Yes | — | LLM handles in system prompt |
| Site search interaction | ✅ Yes | — | API-based catalog search |
| Product matching | ✅ Yes | — | `resolve_products` with LLM disambiguation |
| Fuzzy matching & synonyms | ✅ Partial | — | LLM handles; no structured synonym DB |
| Alternative suggestion | ❌ No | ✅ **Add** | `find_alternatives` — high impact |
| Price comparison | ❌ No | ✅ **Add** | `compare_prices` — blocked on 2nd store adapter |
| Nutritional/ingredient reading | ❌ No | ✅ **Add** | `get_product_details` — medium impact |
| Promotional awareness | ✅ Yes | — | Promotions extracted in cart preview |

## Category 4: Cart & Order Management

| Skill | Have? | Need to Add? | Notes |
|-------|-------|-------------|-------|
| Add to cart | ✅ Yes | — | Browser-based persist via fetch() |
| Quantity management | ✅ Partial | — | Set during resolve; no post-preview edit |
| Cart validation | ✅ Partial | — | Preview shows items; no explicit validation tool |
| Cart summarization | ✅ Yes | — | `calculate_cart_preview` returns formatted summary |
| Remove/replace items | ❌ No | ✅ **Add** | `modify_cart` — high impact |
| Minimum order handling | ❌ No | ⚠️ Later | Nice-to-have, store-specific |
| Delivery slot selection | ❌ No | ⚠️ Later | Needs store API research |

## Category 5: User Collaboration & Communication

| Skill | Have? | Need to Add? | Notes |
|-------|-------|-------------|-------|
| Conversational state tracking | ✅ Yes | — | ADK session state with all keys |
| Clarification asking | ✅ Yes | — | System prompt handles disambiguation |
| Progress reporting | ❌ No | ⚠️ Later | Batch resolve can be slow, no live updates |
| Decision presentation | ✅ Yes | — | LLM presents options from resolve |
| List management | ✅ Partial | — | Accepts text lists; no photo/voice input |
| Multi-language support | ✅ Yes | — | Hebrew + English in prompt and tools |
| Preference learning | ❌ No | ⚠️ Later | No cross-session memory yet |

## Category 6: Data Extraction & Parsing

| Skill | Have? | Need to Add? | Notes |
|-------|-------|-------------|-------|
| HTML/DOM parsing | ✅ Yes | — | Playwright page.evaluate, locators |
| Price extraction | ✅ Yes | — | Cart API response parsing |
| Stock status detection | ✅ Yes | — | `available_in` field checked per store |
| Delivery info extraction | ✅ Yes | — | Delivery fee parsed from cart response |
| Receipt/order confirmation parsing | ❌ No | ❌ Not now | No order placement yet |

## Category 7: Error Handling & Resilience

| Skill | Have? | Need to Add? | Notes |
|-------|-------|-------------|-------|
| Retry logic | ❌ No | ⚠️ Later | No exponential backoff on API calls |
| Graceful degradation | ✅ Yes | — | Fallback to checkout URL on auth failure |
| Site change detection | ❌ No | ❌ Not now | Premature — selectors work currently |
| Timeout management | ✅ Yes | — | Configurable timeouts on all browser ops |
| Conflict resolution | ❌ No | ⚠️ Later | No mid-flow stock change handling |
| Fallback strategies | ✅ Partial | — | Auth fallback exists; no store fallback |

## Category 8: Security & Privacy

| Skill | Have? | Need to Add? | Notes |
|-------|-------|-------------|-------|
| Credential encryption | ❌ No | ⚠️ Later | Tokens in session state, not encrypted |
| PII minimization | ✅ Partial | — | No logging of full tokens; OTP code is logged (should fix) |
| Consent management | ✅ Yes | — | Agent asks before saving cart |
| Payment safety | ✅ Yes | — | Agent never touches payment — redirects to store |
| Audit logging | ❌ No | ❌ Not now | Production-scale concern |

## Category 9: Domain Knowledge & Rules Engine

| Skill | Have? | Need to Add? | Notes |
|-------|-------|-------------|-------|
| Store-specific adapters | ✅ Yes | — | Abstract base + Rami Levy; others stubbed |
| Business rules | ❌ No | ⚠️ Later | No age/quantity restrictions |
| Kosher/dietary rules | ❌ No | ⚠️ Later | Good fit for ADK Skill (knowledge package) |
| Substitution rules | ❌ No | ✅ **Add** | Part of `find_alternatives` |
| Budget awareness | ❌ No | ✅ **Add** | Track spending vs user-set budget |
| Seasonal awareness | ❌ No | ❌ Not now | Low impact |

## Category 10: Orchestration & Planning

| Skill | Have? | Need to Add? | Notes |
|-------|-------|-------------|-------|
| Task decomposition | ✅ Yes | — | 5-phase flow in system prompt |
| Parallel execution | ❌ No | ⚠️ Later | Useful when multi-store comparison lands |
| Priority ordering | ❌ No | ❌ Not now | LLM handles naturally |
| Checkpoint/resume | ❌ No | ⚠️ Later | Session state partially covers this |
| Multi-store orchestration | ❌ No | ✅ **Add** | Core long-term value — needs 2nd adapter |

## Summary

| Status | Count |
|--------|-------|
| ✅ Already have | 28 |
| ✅ **Need to add** | 6 |
| ⚠️ Add later | 12 |
| ❌ Don't need now | 10 |

### The 6 to add (in priority order)

1. `find_alternatives` — product substitution when out of stock or too expensive
2. `modify_cart` — add/remove/update items after cart preview
3. `list_supported_stores` — store discovery tool
4. `get_product_details` — nutrition, ingredients, detailed info
5. `budget_awareness` — track spending vs user-set budget
6. `compare_prices` / multi-store — blocked on 2nd store adapter
