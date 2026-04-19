# Agent Instructions

> This file is mirrored across CLAUDE.md, AGENTS.md, and GEMINI.md so the same instructions load in any AI environment.

You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system fixes that mismatch.

## The 3-Layer Architecture

**Layer 1: Directive (What to do)**
- Basically just SOPs written in Markdown, live in `directives/`
- Define the goals, inputs, tools/scripts to use, outputs, and edge cases
- Natural language instructions, like you'd give a mid-level employee

**Layer 2: Orchestration (Decision making)**
- This is you. Your job: intelligent routing.
- Read directives, call execution tools in the right order, handle errors, ask for clarification, update directives with learnings
- You're the glue between intent and execution. E.g you don't try scraping websites yourself—you read `directives/scrape_website.md` and come up with inputs/outputs and then run `execution/scrape_single_site.py`

**Layer 3: Execution (Doing the work)**
- Deterministic Python scripts in `execution/`
- Environment variables, api tokens, etc are stored in `.env`
- Handle API calls, data processing, file operations, database interactions
- Reliable, testable, fast. Use scripts instead of manual work. Commented well.

**Why this works:** if you do everything yourself, errors compound. 90% accuracy per step = 59% success over 5 steps. The solution is push complexity into deterministic code. That way you just focus on decision-making.

## Operating Principles

**1. Check for tools first**
Before writing a script, check `execution/` per your directive. Only create new scripts if none exist.

**2. Self-anneal when things break**
- Read error message and stack trace
- Fix the script and test it again (unless it uses paid tokens/credits/etc—in which case you check w user first)

## Logs for every new session 
-- read /Users/tomer_itzhakov_nevo/Documents/Projects/Lista/PROJECT_DOCUMENTATION.md every new session the user start

## Update logs rules
-- update /Users/tomer_itzhakov_nevo/Documents/Projects/Lista/PROJECT_DOCUMENTATION.md before every commit and push to github. 

Add a new top-level section '## Deployment Awareness' near the top of CLAUDE.md\n\n## Deployment Awareness
- After making API/backend changes, ALWAYS deploy (to Vercel/Railway) and verify the change is live in production before declaring success.
- Never assume database or code changes alone are sufficient - the user expects changes to be visible in the running API.
Add under a '## Workflow Order' section; place near top of CLAUDE.md\n\n## Workflow Order
- Update relevant docs BEFORE committing, not after. User has interrupted multiple times to enforce this.
- Do not rewrite or replace existing implementations (ETLs, parsers, data sources) without explicit user approval - ask first.
Add as '## Debugging Discipline' section in CLAUDE.md\n\n## Debugging Discipline
- When fixing bugs in data/ETL code, work systematically: enumerate all affected rows/files first, then fix in one pass. Avoid piecemeal edits.
- Account for browser/service-worker caching when users report UI not reflecting changes - suggest hard refresh before assuming the fix failed.
- Known image source: use the S3 bucket for product images, don't try public URLs.
Add under '## Product Data Model' section\n\n## Product Data Model
- The chain_barcode concept should be scoped ONLY to the mapping table - do not split all barcodes by chain_id, as this breaks cross-chain matching.
- has_promotion must reflect an actual promo, not just a price difference between stores.
- is_weighted must be set/updated on both INSERT and UPDATE paths in ETLs.
