# Plan/Buy Phase Separation — Design Spec

**Date**: 2026-04-25
**Owner**: Tomer (@tomerikoka)
**Status**: Brainstorm complete; ready for implementation plan

---

## 1. Goal

Resolve the tension between Lista's two roles — **cross-chain comparison tool** and **buying agent service** — by separating today's "basket" into two distinct concepts:

- **List** (Plan phase): persistent, store-agnostic items + quantities.
- **Order** (Buy phase): transient, store-specific cart that an agent executes.

v1 ships a single-store buying flow with per-item substitution confirmation. Multi-store orchestration (auto-split, manual split) is deferred to v2 and triggered when a second store agent ships.

## 2. Why this matters now

- One agent ships today: PricePilot v4 for Rami Levy.
- More agents are planned (Shufersal, Victory). Without resolving the basket's mental-model conflict first, every additional agent compounds the existing UX confusion ("this basket has items from 3 supermarkets — how do I check out?").
- The backend is already store-agnostic at the list level and single-store-per-run at the agent level. **Only the UI pretends the basket has a store identity.** This spec stops that pretense.

## 3. The model: two phases

### 3.1 Plan phase (List)
- The persistent object: items + quantities, no store affinity.
- The comparison engine renders **informationally**: per-chain totals, cheapest split estimate, missing items per store, below-min-order indicators.
- User actions: add / remove / edit items; save and reuse lists.
- No commitment, no agent activity.

### 3.2 Buy phase (Order)
- Entered via a single "Buy this list" CTA in the Plan phase.
- A distinct screen presents fulfilment options.
- v1 surfaces only Route 1 (Single store). Routes 2 and 3 are not implemented in v1.
- Once Buy starts, the underlying List is frozen for editing for the duration of the run.

## 4. v1 scope: Route 1 only

### 4.1 What ships
- Plan/Buy mental separation in the UI: removal of per-chain "Send to PricePilot" CTAs in favour of a single "Buy this list" CTA.
- Buy phase entry screen showing per-chain cards.
- Route 1 path: user picks a chain → existing `PriceAgentChat` (`App.tsx:1222`) opens with that `storeName` → existing PricePilot v4 agent runs.
- Substitution UX upgrade: structured per-item confirmation cards in chat (replacing today's plain-text alternatives).
- Updated terminology in user-facing copy (Section 9).

### 4.2 What does NOT ship in v1
- Multi-store orchestrator (sequential N-agent runs).
- Auto-split route (Route 2).
- Manual-split route (Route 3) and its per-item store dropdown.
- Renaming of internal code identifiers (`BasketList`, `LiveBasketPanel`, etc.).
- Building Shufersal / Victory agents.
- Auto-apply substitution heuristic.

### 4.3 v2 trigger
v2 work begins when a second working store agent (Shufersal or Victory) is end-to-end shippable. At that point: build the orchestrator, ship Routes 2 + 3, handle below-sub-order-min and partial-success cases.

## 5. Reuse vs. change vs. new

### 5.1 Keep as-is
| Component | Why it stays |
|---|---|
| `BasketList` (`components/BasketList.tsx`) | Already store-agnostic. Becomes the Plan-phase view with no internal changes. |
| `find_replacements` tool (`pricepilot_agent_v4/tools/`) | Rami Levy related-items API is already wired. Substitution backend is done. |
| Agent OOS workflow (`pricepilot_agent_v4/agent.py:147-159`) | Already removes OOS items, calls `find_replacements`, asks the user, substitutes. |
| SSE + extension bridge (`services/extensionBridge.ts`, `pricepilot_extension/`) | Solid. Each new store gets a new content script, no architectural change. |
| Agent session model | One session = one store. Maps cleanly onto v1 (single-store) and onto v2 multi-store as N independent sessions. |
| `computeBasketComparison` (`utils/basketStrategies.ts`) | Used informationally in Plan phase and to power Buy entry cards. |
| `StoresStripV2` content/data | Same per-chain data continues to drive Plan-phase strip and Buy-phase entry cards. |

### 5.2 Reroute / repurpose
| Component | Change |
|---|---|
| `handleSendToPricePilot` (`components/ShoppingInputArea.tsx:97`) | Today calls `onCompare()`. New: opens Buy phase entry screen. |
| `KPIHero` (`components/KPIHero.tsx:85-91`) | Per-chain "Send to PricePilot" button removed. Replaced with a single "Buy this list" CTA driving the Buy phase entry. |
| Agent chat launch (`App.tsx:869`) | Continues to accept `storeName`. Source of `storeName` shifts from chain-strip click to Buy phase entry card click. |

### 5.3 New code
| Component | Role |
|---|---|
| `BuyPhaseEntry` component (new file under `components/`) | Modal/sheet listing per-chain cards. Mobile + desktop parity. v1 renders Route 1 cards only; Routes 2 + 3 hidden behind a feature flag or absent. |
| Substitution confirm card | New chat message variant in `PriceAgentChat`. Replaces plain-text alternative listing with structured selectable buttons using the existing `ChatMessage.buttons` field. |

## 6. Plan phase surface (v1)

- Layout unchanged from today: `LiveBasketPanel` left (RTL inline-end), catalog center, `RightRail` right. `StoresStripV2` above.
- `KPIHero` keeps the cheapest-chain summary card but its CTA becomes **"Buy this list"** (single button), not per-chain "Send to PricePilot".
- `BasketList` continues to support add / remove / edit while the user is in Plan phase.
- Clicking a chain chip in `StoresStripV2` continues to switch the KPI view (informational), as today. It does **not** open the agent.
- All "סל" / "basket" copy in user-visible strings is replaced per Section 9.

## 7. Buy phase surface (v1)

### 7.1 Entry screen (`BuyPhaseEntry`)
- Triggered by the "Buy this list" CTA in `KPIHero` (and the equivalent CTA in `MobileBasketSheet`).
- Title: **"איך לקנות"** / **"How to buy"**.
- Content: a vertical stack of per-chain cards for chains that deliver to the user's area. Each card shows:
  - Chain name.
  - Total cost (subtotal + delivery fee).
  - Matched items count (e.g., "12/12" or "11/12 · 1 חסר").
  - Delivery fee.
  - "מומלץ" / "Best" badge on the cheapest delivering chain.
  - "מתחת למינימום" / "Below min order" warning where applicable (reuses the existing detection logic in `BasketStrategyPicker.tsx:118`).
- Card click → launches `PriceAgentChat` with that chain as `storeName`.
- Mobile: full-screen sheet with the same vertical card stack. Desktop: centered modal with a max width.
- Routes 2 + 3 are not surfaced in v1 — entry screen renders Route 1 cards only. A "Coming soon" affordance for the absent routes is a possible future addition; not part of v1.

### 7.2 Route 1 flow
1. User opens Buy phase entry from Plan phase.
2. User taps a chain card.
3. `PriceAgentChat` opens with `storeName` set to that chain.
4. Existing PricePilot v4 agent runs its 10-step workflow.
5. For each item missing or out of stock, the agent calls `find_replacements` and emits a structured substitution prompt to chat (see §7.3).
6. User confirms or skips each alternative individually.
7. Agent completes verification and emits the handoff URL.
8. User clicks the link, completes payment on the chain's site.

### 7.3 Substitution confirm card
- Activated when the agent finds replacements for an OOS or missing item.
- Renders up to 3 alternative products with image, name, and price as selectable buttons.
- Button actions: `accept:<product_id>` to swap, `skip:<original_item>` to drop from this order.
- Routes through existing `handleButtonAction` → agent treats input as a user message.
- Important: substitutions live entirely inside the Buy phase. The List itself is never mutated by a substitution.

### 7.4 v1 edge cases
| Case | Handling |
|---|---|
| Item unavailable + no good replacement | Agent surfaces "couldn't add 'X'" with `Skip this item` / `Cancel and pick a different store` buttons. |
| Below minimum order at chosen chain | Buy entry card shows red ⚠ + delta to minimum. User picks a different chain or accepts the agent run anyway (chain may charge extra at checkout per its own policy). |
| Item missing at the only chosen chain | Dropped from this Order. Surfaced in the agent's final summary. The List retains the item for next time. |
| List edits during a Buy run | List editing UI is disabled while the agent is running. Copy: "Cancel current order to edit." |
| User cancels mid-flow | Honest copy: cart at the chain's site is not auto-emptied. User can clear it on the chain's site or check out anyway. |

## 8. Architecture diagram (textual)

```
PLAN PHASE                                          BUY PHASE
─────────                                           ────────
┌─────────────────────────────────────┐            ┌──────────────────────────┐
│ BasketList (store-agnostic items)   │  click     │ BuyPhaseEntry (NEW)      │
│ KPIHero ── [Buy this list] CTA ─────┼──────────▶│  ↳ chain cards (Route 1) │
│ StoresStripV2 (informational)       │            │  ↳ click → storeName     │
└─────────────────────────────────────┘            └────────┬─────────────────┘
                                                            │
                                              setOnlineStoreName + open chat
                                                            ▼
                                            ┌──────────────────────────────────┐
                                            │ PriceAgentChat (existing)        │
                                            │  ↳ Substitution confirm card NEW │
                                            └──────────┬───────────────────────┘
                                                       │ SSE
                                                       ▼
                                            ┌──────────────────────────────────┐
                                            │ pricepilot_agent_v4 (existing)   │
                                            │  ↳ find_replacements (existing)  │
                                            │  ↳ generate_handoff (existing)   │
                                            └──────────────────────────────────┘
```

## 9. Terminology (locked)

| Concept | Hebrew | English |
|---|---|---|
| Persistent shopping list | הרשימה שלי | My List |
| Transient checkout-ready cart | הזמנה | Order |
| Phase transition CTA | קנה את הרשימה | Buy this list |
| Buy phase screen | איך לקנות | How to buy |
| Single-store route | חנות אחת | One store |
| Auto-split route (v2) | פיצול חכם | Smart split |
| Manual-split route (v2) | חלוקה ידנית | Manual split |
| Substitution / alternative | חלופה | Alternative |
| Buying agent | PricePilot | PricePilot |

User-visible copy drops **"סל"** / **"basket"**. Internal code identifiers (`BasketList`, `LiveBasketPanel`, `MobileBasketSheet`, etc.) are not renamed in v1.

## 10. Implementation sequencing

The implementation plan that follows this spec must respect the project's established working rhythm: **build → validate → push → test → pass**, one increment at a time, ship to main, pause for explicit user review between increments (per `feedback_subagent_workflow.md`).

**Sequencing principle**: pure-UI work ships first; agent / `PriceAgentChat`-touching work ships last. The agent surface is high-stakes (a bug there breaks the buying flow end-to-end), so it gets focused attention as a single dedicated increment after the structural changes are validated.

Suggested increments (the implementation plan will finalize ordering, dependencies, and tasks per increment):

1. **Terminology + CTA swap.** *Pure UI.* Replace user-facing "סל" / "basket" copy with the locked names. Remove per-chain "Send to PricePilot" CTAs in `KPIHero`. Insert a single "Buy this list" CTA that, for now, opens the existing chat directly with the currently-selected chain (preserves working flow). Validate copy and CTA placement with user.
2. **Buy phase entry screen.** *Pure UI.* New `BuyPhaseEntry` component. "Buy this list" now opens this screen instead of the chat. Cards drive `PriceAgentChat` launch with `storeName`. Mobile + desktop parity. `PriceAgentChat` itself is unchanged. Validate that the new step lands users in the same agent flow as before.
3. **v1 edge-case polish (UI side).** *Pure UI.* Below-min badge on entry cards (uses existing min-order detection). List-edit freeze during Buy (`BasketList` disabled while agent is running). Missing-item summary copy. Honest cancel messaging. Validate each failure mode visually.
4. **Substitution confirm cards.** *Agent-touching — scheduled last by design.* Upgrade replacement UX in `PriceAgentChat` from plain text to structured buttons. Per-item confirmation. May require coordinating with the agent's chat output shape so replacement messages render as structured prompts. Validate end-to-end with at least one OOS item.

Each increment is independently shippable. Each gets validated by the user before the next is dispatched.

## 11. Out of scope / non-goals

- Renaming internal code identifiers. Deferred to a later cleanup pass.
- Multi-store orchestrator code. Held until v2 trigger.
- Generalizing the agent system instruction to be store-config-driven. Per-store agent modules remain duplicated, per the design principle that each store agent stays focused, deterministic, and independent.
- Building Shufersal / Victory agents. v1 assumes Rami Levy is the only working agent.
- Login / OTP / handoff URL changes. Existing PricePilot v4 flow unchanged.
- Auto-apply substitution heuristic. Held until per-item confirmation validates with users.
- Backend changes to the Python agent server. v1 is a UI-layer reorganization plus a chat-message-rendering upgrade; no agent-side changes are expected.
