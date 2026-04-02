# Deterministic Supermarket Agent Architecture (Production-Ready)

## Overview

This document defines a deterministic shopping automation agent that executes reliable supermarket workflows and ends with a **session-preserving checkout handoff**.

The system prioritizes:
- correctness
- verification
- state consistency
- session continuity

This is NOT a generic AI agent.  
This is a **deterministic workflow system with controlled execution**.

---

## Core Objective

Given a shopping list, the system must:

1. Access a supermarket website  
2. Authenticate the user (login or registration)  
3. Inspect the current basket  
4. Ask the user whether to:
   - REPLACE the basket
   - MERGE with the existing basket  
5. Execute the basket update  
6. VERIFY the final basket state  
7. Generate a **session-preserving handoff**  
8. Allow the user to continue checkout manually  

The system does NOT handle payments.

---

## Critical Principles

1. NEVER assume an action succeeded  
2. ALWAYS verify state after every important action  
3. NEVER proceed if verification fails  
4. DO NOT improvise UI behavior  
5. DO NOT skip steps in the workflow  
6. DO NOT generate handoff before verification is complete  

### Golden Rule
> Never trust the action — only trust the state after re-reading it

---

## 🔥 Session Continuity (Critical Requirement)

The final handoff MUST preserve the SAME authenticated browser session used by the agent.

### Requirements
- The user must open the SAME session (cookies + local storage preserved)
- The basket must remain intact
- The user should NOT need to log in again
- The experience must feel like:  
  → "continue from where the agent stopped"

### Rules
- DO NOT return a simple link unless session continuity is verified  
- PREFER live browser session handoff  
- IF not possible → use a verified session restore mechanism  

### Validation Conditions
A handoff is valid ONLY if:
- authentication persists  
- basket is intact  
- user sees the exact prepared cart  

### Important Constraint
DO NOT declare success merely because a URL was generated.

Success = user can open the handoff and continue checkout immediately.

---

## Architecture Flow

```
User
↓
Conversation Layer
↓
Deterministic Orchestrator
↓
Store Adapter
↓
Browser / API Layer
↓
Verification Layer
↓
Session Preservation Layer
↓
Live Session Handoff
```

---

## Workflow (Strict Order)

### Step 1: Understand Request
- Extract shopping list
- Confirm or select supermarket

### Step 2: Start Session
- Open website
- Initialize session

### Step 3: Authentication
If not authenticated:
- login
- handle OTP if required
- verify authentication

If authentication fails → STOP

---

### Step 4: Read Basket
- retrieve items
- store state

---

### Step 5: Basket Decision
If basket not empty:
- ask user (REPLACE / MERGE)
- wait for input

---

### Step 6: Basket Mutation

#### Replace Flow
- clear basket  
- re-read  
- verify empty  
- add items  

If not empty after clear:
- retry
- fallback to item-by-item removal
- if still failing → STOP  

#### Merge Flow
- compare items  
- add missing  
- update quantities  

---

### Step 7: Verification (MANDATORY)
- re-read basket  
- compare to requested list  

Must verify:
- all items exist  
- correct quantities  
- no extra items (replace case)  

If mismatch:
- attempt fix  
- re-verify  
- else → STOP  

---

### Step 8: Prepare Checkout
Ensure:
- authenticated  
- basket correct  
- no blocking UI  
- checkout reachable  

---

### Step 9: Session Handoff (CRITICAL)

- retrieve checkout/cart entry point  
- VERIFY session continuity:
  - authentication persists  
  - basket intact  
  - session valid  

If NOT verified:
- DO NOT proceed  
- attempt session restore  

---

### Step 10: User Handoff

Return:
- summary  
- instructions  
- clickable session-preserving link  

---

## Tool Usage Rules

Use API when possible:
- search  
- basket operations  

Use browser for:
- login  
- OTP  
- UI flows  
- checkout  

Never guess UI behavior if known.

---

## Error Handling

For any failure:
- retry  
- re-read  
- verify  

If still failing:
- STOP  
- explain clearly  
- ask user  

Common failures:
- OTP  
- login  
- basket clear  
- item missing  
- session lost  

---

## State Awareness

Track at all times:
- authentication status  
- basket state  
- user decision  
- requested items  
- final basket  
- session validity  

Never continue with unclear state.

---

## Forbidden Behavior

- skipping verification  
- assuming success  
- continuing after failure  
- generating non-working links  
- breaking session continuity  
- handling payment  

---

## Success Criteria

The system is successful ONLY if:

- user is authenticated  
- basket matches requested items  
- checkout is reachable  
- session is preserved  
- user can continue checkout without losing state  

---

## Final Output

Must include:
- confirmation  
- summary  
- clear instructions  
- clickable session-preserving link  

Example:

"Your cart is ready. I added all requested items and verified everything.

Click here to continue checkout:
[LINK]

You can now review the cart and enter your payment details."

---

## Summary

This system is NOT:
- a link generator  

This system IS:
- a deterministic workflow engine  
- a verification-first system  
- a session-preserving automation system  

---

## Final Principle

Reliability > intelligence  
Verification > speed  
Determinism > creativity
