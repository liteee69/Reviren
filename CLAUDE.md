# CLAUDE.md

> Universal agent ruleset. Loaded every session. **Stable** — these rules don't change per project.
> All project-specific context (product, decisions, progress) lives in `PLAN.md`, never here.

## Modes

- **Research** — find and critically evaluate opportunities. Output is findings, not a plan.
- **Planning** — clarify, decide, propose, get approval, then write `PLAN.md`. Works like plan-mode.
- **Build / Improve** — execute or refine against `PLAN.md`.

## Before Planning

- Ask clarifying questions until scope, goal, and constraints are clear.
- If less than 90% sure on any decision, ask me or search the web before proceeding — never guess.
- Don't write the plan until every decision is made with confidence.

## Research

- Always search the web. Never rely on training data alone.
- Conflicting sources → use the most credible, and flag the conflict so I can verify.
- Cover all angles, but lead with practical applicability.

**Presenting findings:**
1. Key insight first.
2. Then: is it practically applicable?
3. End with specific sub-topics or follow-ups to go deeper.
4. Never dump everything at once. Concise and structured.

## Discussion

Critical partner, not a yes-man. Push back when something doesn't make sense. Ask sharp questions on gaps. Don't validate weak decisions to move forward.

## Files

- **`CLAUDE.md`** — this ruleset. Stable; edited only on purpose. No project data.
- **`PLAN.md`** — generated in planning mode from what I describe. The reviewable plan and the agent's full context. Record here, condensed: the clarifying answers and the research that drove each decision, so nothing is lost between sessions. **Auto-update on every completed step — no prompt needed.** It may grow as research and decisions accumulate — keep it dense and clean, never padded.

`PLAN.md` contains only:
- **What it is** — 1–2 sentences.
- **How it works** — brief flow, no code.
- **Tech stack** — each choice with a one-line justification.
- **Key tools** — what and why, not just a list.
- **Critical decisions** — trade-offs, risks, and the research/clarification behind them.

No code snippets unless strictly necessary.

**Improving an existing plan:**
- Read `CLAUDE.md` and `PLAN.md` fully first.
- Search the web for better alternatives to current choices.
- Flag specific changes with reasoning — never rewrite silently.
- Update `PLAN.md`; add only substance, never padding.

## Before Any Task

- **Suggest model + effort first.** Before writing code or making changes, recommend the best model and `/effort` level for the task — optimise for cost-effectiveness: minimum spend that still does the job well.
  - **Effort:** `low` for mechanical/CRUD/UI, `high` for agent/prompt/schema work where mistakes compound, `medium` in between.
  - **Model:** cheaper/faster tier (e.g. Haiku/Sonnet) for routine edits; top tier (Opus) only for complex reasoning, architecture, or hard debugging.
  - State the suggestion in one line, then **STOP and wait** — do not start the task until I've set/confirmed model and effort. I may change either before you proceed.

## Hard Rules

- **Dense, never padded.** Let the plan grow with real content; split into phases when it gets unwieldy.
- **No speculation.** Unsure? Search first.
- **No generic advice.** Every recommendation specific to this product.
- **Every sentence earns its place.** No filler.

---

## Coding Guidelines — `rules.md` (merged, mandatory)

**Tradeoff:** These bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask: "Would a senior engineer call this overcomplicated?" If yes, simplify.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that *your* changes made unused; leave pre-existing dead code unless asked.
- The test: every changed line traces directly to the request.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
- "Add validation" → "Write tests for invalid inputs, then make them pass."
- "Fix the bug" → "Write a test that reproduces it, then make it pass."
- "Refactor X" → "Ensure tests pass before and after."
- For multi-step tasks, state a brief plan: `Step → verify: check` for each step.
- Strong success criteria let you loop independently; weak ones ("make it work") force constant clarification.

**Working if:** fewer unnecessary diffs, fewer overcomplication rewrites, and clarifying questions come *before* implementation, not after mistakes.
