# Reviren — Plan

> **Status (2026-06-24):** Steps 1–14 complete + Step 15 (pre-generation questions) complete. Next: Feature A (Session Flow Redesign) → Feature B (Resource Strategy) → Feature 2 (Phase Exams).
> - ✅ 1–14. (see history below)
> - ✅ 15. Pre-generation questions layer — chat-style Q&A (3–5 domain-adaptive questions + optional follow-up) before roadmap generation; context injected into `formatOutput` prompt. Haiku for questions, Sonnet for roadmap agent (switched from Gemini Pro 2026-06-24 due to API instability — may revert).
>
> **Model config (2026-06-24):** Roadmap agent → Sonnet 4.6; Questions/follow-up → Haiku 4.5; Session/Feynman → Sonnet 4.6; Flashcards → Gemini Flash.
>
> **Known issues:** Resource deduplication in roadmap agent — `verifyResources` sometimes returns generic "best of" articles, causing the same URL to be reused across unrelated topics (14 unique URLs vs 92 in a well-generated roadmap). Root cause: Tavily search result quality varies by run. Fix deferred.
>
> **Anthropic + LangGraph compatibility notes (for future model switches):**
> - `withStructuredOutput` breaks inside LangGraph `streamEvents` for Anthropic (tool calling conflicts with streaming capture) → fix: direct `invoke` + regex JSON extraction in `formatOutput`
> - `result.content` is `[{type:'text',text:'...'}]` array for Anthropic, not a string → fix: `extractTextContent()` helper in `roadmap-agent.ts`
> - `ChatAnthropic` defaults `maxTokens` to 1024 — too low for roadmap JSON → set `maxTokens: 16000`
>
> **Step history:**
> - ✅ 1. Project setup — Next.js 16 + Tailwind v4 + shadcn/ui + Supabase + Drizzle + LangChain model wrappers + env vars
> - ✅ 2. Drizzle schema + migration — roadmaps, topics, sessions, session_topics, feynman_reviews, flashcards
> - ✅ 3. Roadmap agent — LangGraph.js graph (Gemini 3.1 Pro + Tavily) with SSE streaming
> - ✅ 4. Roadmap creation UI — topic input → agent → live progress → preview → save
> - ✅ 5. Roadmap viewer + editor — inline edit title/description, add/remove topics, add/remove/resources per topic, delete roadmap
> - ✅ 6. Roadmap import — paste text or upload .md/.pdf (.docx deferred) → Sonnet 4.6 parses → same preview → save
> - ✅ 7. Session planning — roadmap + hours → AI mode (Sonnet 4.6 prioritises topics) or manual checklist → create session
> - ✅ 8. Topic tracking — session view with checkboxes, mark covered, end session
> - ✅ 9. Feynman review — roadmap/topic selector → explanation → Sonnet 4.6 scoring → save
> - ✅ 10. Flashcards — create manually, generate via Gemini Flash, flip, mark known/unknown, delete
> - ✅ 11. Pomodoro timer — 25/5 and 50/10 modes, start/pause/reset, auto-switch phases
> - ✅ 12. Music player — YouTube lo-fi iframe in session view (show/hide)
> - ✅ 13. Dashboard — real DB data: roadmap count, sessions this week, unknown flashcard count, roadmap progress
> - ✅ 14. Sections, progress & session overhaul:
>   - Roadmap hierarchy: phases (pill tabs) → sections (cards) → topics (list with progress bars)
>   - Topic progress 0–100%, rolled up to section and phase level
>   - New DB tables: roadmap_phases, sections, subtasks; updated topics (sectionId, progress), session_topics (allocatedMinutes, progressDelta)
>   - AI session planning rewritten: cross-section balancing, 1h+ per topic, subtask-level detail with resources
>   - Session view: subtask checkboxes with live check-off
>   - Post-session: AI calculates progress delta per topic, hybrid override UI before saving
>   - File upload to roadmap import: .pdf and .md/.txt (via pdf-parse)

## What it is
A single-user web app for structured, self-directed learning: it generates custom AI-powered roadmaps, plans study sessions against your available time, tracks topic progress, and evaluates understanding via Feynman review. Personal use first; multi-user production is the stated trajectory.

## How it works
1. **Create a roadmap** — type a topic (e.g. "robotics"). An agent runs a `search → structure → enrich → format` pipeline, using a web-search tool, and saves structured phases + subtopics + resources to the database. Alternatively, import an existing markdown/text roadmap.
2. **View / edit** — read the roadmap; add, edit, or remove topics.
3. **Plan a session** — pick available hours. *AI mode*: the model reads the roadmap + progress and returns a prioritised topic list sized to your time. *Manual mode*: pick topics yourself from a checklist.
4. **Run the session** — Pomodoro timer (25/5 or 50/10) plus an embedded YouTube lo-fi player run in the session view.
5. **Track progress** — post-session, check off covered topics. Uncovered topics auto-promote to priority for the next session.
6. **Feynman review** — write your explanation of a topic; the model scores it 1–10 and returns what was solid, what was missing, and which topics to flag next.
7. **Flashcards** — create cards manually or generate them from a topic; flip and mark known/unknown.
8. **Dashboard** — roadmap list, progress summary, last session.

No login for MVP: the app opens straight to the dashboard. Auth + multi-user is deferred but anticipated (see Critical decisions).

## Tech stack
- **Next.js 16 (App Router) + TypeScript** — frontend and API routes in one Vercel-native codebase; latest stable major, no migration debt from starting on 15.
- **Tailwind CSS v4** — CSS-first config (`@theme`), automatic content detection, faster native engine; no JS config file.
- **shadcn/ui** — accessible Radix-based components copied into the repo (full ownership, not a locked dependency); the standard pairing with Tailwind v4 and a big speed win for a UI-heavy app.
- **Supabase (PostgreSQL, no auth for MVP)** — managed Postgres as the data store; auth deferred, but schema designed so `user_id` can be added cleanly later.
- **Drizzle ORM + drizzle-kit** — type-safe queries and real migrations from day one, because the stated path is production with users (schema will evolve). Chosen over manual table creation so schema changes are versioned, not hand-applied.
- **LangGraph.js (`@langchain/langgraph` v1)** — agent orchestration as a stateful graph; chosen deliberately to gain hands-on LangGraph experience and because the graph model scales to the branching/multi-step flows expected as features grow. Runs inside Next.js API routes on the Node.js runtime. Agent code lives behind `/lib/agent`.
- **LangChain `initChatModel` (`@langchain/core` + `@langchain/anthropic` + `@langchain/google-genai`)** — universal model loader so each feature's model is a config value, not hardcoded; one identifier string swaps providers without touching call sites. Two providers wired from day one (Anthropic + Google).
- **Per-feature models (cost/quality-tiered):**
  - **Roadmap agent → Gemini 3.1 Pro** (`google-genai:gemini-3.1-pro-preview`) — near-frontier reasoning at best $/quality; roadmap accuracy is the core value.
  - **Session planning + Feynman scoring → Claude Sonnet 4.6** (`anthropic:claude-sonnet-4-6`) — solid judgment for prioritisation and honest, specific feedback.
  - **Flashcard generation → Gemini 3.5 Flash** (`google-genai:gemini-3.5-flash`) — simple structured transform; cheap + low latency for bulk decks.
  All read from env, swappable per feature (see Critical decisions).
- **Zod 4** — schemas for all structured LLM outputs (roadmap JSON, Feynman scores, flashcards) and runtime validation.
- **Tavily API** — default web-search tool for the roadmap agent; kept behind a thin wrapper so it can be replaced (see risk).
- **Vercel** — zero-config deploy; LLM/agent routes run on the **Node.js runtime** (not Edge).

## Key tools
- **LangGraph.js** — runs the roadmap agent as a graph (`search_topics → structure_phases → search_resources → format_output`); node-by-node control is clearer and more extensible than ad-hoc chaining, and the main learning goal of the project. Nodes use `.withStructuredOutput(zodSchema)` for validated JSON. Streams progress to the UI via Server-Sent Events from the route.
- **`initChatModel`** — single point where each feature's model/provider is chosen, read from env vars (`google-genai:gemini-3.1-pro-preview`, `anthropic:claude-sonnet-4-6`, `google-genai:gemini-3.5-flash`), so re-tiering or switching providers is a config change, not a rewrite.
- **Drizzle ORM** — typed schema in code is the source of truth; `drizzle-kit` generates and applies migrations. Catches query bugs at compile time as the app grows; makes adding auth/`user_id` and new tables a versioned migration instead of manual dashboard work.
- **shadcn/ui** — owned, accessible component primitives so UI work (dashboard, session view, flashcards, editor) is fast and consistent.
- **Tavily** — the agent's web search; structured results reduce model-side cleanup. Behind a wrapper for replaceability.
- **Zod** — one schema layer shared by LLM structured output and input validation.

## Critical decisions
- **LangGraph.js for the agent (clarification).** The AI SDK was considered for its simplicity, but you chose LangGraph.js deliberately — to gain hands-on experience with it, and because the stateful-graph model accommodates the more complex flows expected as the app grows. Trade-off accepted: more glue for Next.js streaming and a steeper learning curve than the AI SDK, in exchange for the learning value and headroom. Runs as a library inside Node.js API routes (the non-serverless limitation is LangGraph *Platform* only, which we don't use). Provider swapping is preserved via `initChatModel`.
- **Drizzle ORM with migrations from day one (clarification → research).** Brief said "create tables manually, no migrations" under a "just for me" assumption. You confirmed it's headed to production with users, so the schema will change (auth, `user_id`, new tables). Drizzle gives type-safe queries and versioned migrations now, avoiding a painful retrofit later. Small added setup cost; large payoff on the stated path.
- **Per-feature model tiering across two providers (clarification → research).** Researched current cross-provider pricing/quality (Claude, OpenAI, Google). Key finding: at single-user volume total AI spend is ~$3–7/mo regardless of choice, so the decision is quality-driven, not cost-driven. Chosen tiering: **Gemini 3.1 Pro** for the roadmap agent (near-frontier reasoning at $2/$12 — best quality-per-dollar where accuracy compounds), **Sonnet 4.6** for session planning + Feynman (good judgment for honest feedback), **Gemini 3.5 Flash** for flashcards (simple transform; cheap + fast). All via `initChatModel`, so re-tiering is one env change. Approx cost ~$3/mo. (Prices cached June 2026 — verify before relying long-term.)
- **Provider is swappable from day one (clarification → research).** Every LLM call routes through `initChatModel` reading a per-feature env var, so switching any feature's model/provider (e.g. roadmap → GPT-5.5, or Feynman → Opus 4.8) is a config change with no call-site edits. Cost to build this now ≈ zero; cost to retrofit later is high.
- **Auth deferred but anticipated (constraint + trajectory).** No Supabase Auth or `user_id` for MVP — app opens to the dashboard. But because multi-user is the stated goal, the Drizzle schema is designed so ownership columns drop in via a single migration when auth lands. Trade-off accepted: zero friction now, clean upgrade path preserved.
- **Stay in the JS/TS ecosystem (constraint).** All agent/LLM logic runs inside Next.js API routes on the Node.js runtime; no Python service. One codebase, one deploy.
- **Model ids — current and valid.** `gemini-3.1-pro-preview` (Google, GA Feb 2026, 2M context) + a Gemini Flash model for flashcards, and `claude-sonnet-4-6` (Anthropic). Each chosen for its feature's quality/cost/latency profile; all swappable via the abstraction above.
- **Next.js 16, Tailwind v4, shadcn/ui (research).** All current stable; starting here avoids near-term major upgrades. Tailwind v4 + shadcn/ui is the de-facto modern pairing and the fastest route to a polished, accessible UI.
- **Tavily acquisition risk (research flag — verify).** Free tier (1000 queries/mo) confirmed and ample for MVP, but Tavily was acquired by Nebius in **Feb 2026** (deal up to ~$400M), which may change pricing or direction. Mitigation: web search sits behind a thin wrapper (swap to Exa/Firecrawl/Brave if needed) without touching agent logic. *Verify current Tavily terms before depending on the free tier long-term.*
- **Streaming UX for the agent (research).** Roadmap generation is slow (multi-step + web search). Standard LangGraph-in-Next.js pattern is to stream graph events over Server-Sent Events so the user sees phases resolve rather than a spinner. Route must use the Node.js runtime with `dynamic = 'force-dynamic'` + `revalidate = 0`.

## Prerequisites (not yet set up — blockers for build start)
None of the external accounts exist yet. Before the build can run end-to-end, create:
- **Supabase** project → project URL + anon/service keys + database connection string (for Drizzle).
- **Anthropic** API key (Sonnet 4.6 — session planning + Feynman).
- **Google AI** (Gemini) API key (Gemini 3.1 Pro + 3.5 Flash — roadmap agent + flashcards).
- **Tavily** API key.
All go into `.env.local` (and Vercel env vars for deploy).

## Build order
1. Project setup — Next.js 16 + Tailwind v4 + shadcn/ui + Supabase client + Drizzle + `initChatModel` wrapper (`@langchain/anthropic` + `@langchain/google-genai`) + env vars
2. Drizzle schema + first migration — `roadmaps`, `sessions`, `flashcards`, `feynman_reviews`
3. Roadmap agent — `/lib/agent/roadmap-agent.ts` (LangGraph.js graph on **Gemini 3.1 Pro** + `.withStructuredOutput` + Zod) + Tavily tool behind wrapper
4. Roadmap creation UI — input → agent (streamed via SSE) → display → save
5. Roadmap viewer + editor
6. Roadmap import (markdown/text upload)
7. Session planning — AI mode (**Sonnet 4.6**) + manual mode
8. Topic tracking — post-session checklist → save to `sessions`
9. Feynman review — text input → **Sonnet 4.6** scoring (structured) → feedback display
10. Flashcards — create, flip, mark known/unknown, **Gemini 3.5 Flash** generation
11. Pomodoro timer
12. Music player — YouTube iframe embed
13. Dashboard — roadmap list, progress summary, last session

## Roadmap Quality — Planned Features (Step 15+)

Decisions locked through brainstorming on 2026-06-23. Not yet planned for build order.

### Feature 1: Pre-generation Questions Layer
A conversational flow (chat-like, not a form) that runs before roadmap generation starts.

**Flow:**
1. User types a topic → agent classifies domain (STEM, humanities, professional, creative, language, etc.)
2. Agent asks 3–5 high-leverage, domain-adaptive questions in 1–2 messages:
   - **Goal type** — exam prep / career switch / hobby / university prep (shapes entire structure)
   - **Prior knowledge** — self-rated 0–3 per relevant sub-domain; agent skips or compresses covered areas
   - **Time budget** — hours/day + total weeks; agent calibrates topic density and phase count
   - **Topics to cover** — any specific topics the user wants included; agent places them correctly in sequence and warns if prerequisites are missing
   - **Sources to attach** — URLs or resource names; agent classifies as primary resources (fold into topics) vs curriculum to match (shape phase structure)
3. One targeted follow-up if any answer opens a meaningful branch (e.g., "exam prep" → "which exam?")
4. Agent generates roadmap with all answers woven into the prompt

**Domain-adaptive question examples:**
- STEM/Engineering → "do you have any hardware?" / "are you targeting a specific framework or language?"
- Law → "are you studying for a specific exam (bar, LSAT)?" / "which jurisdiction?"
- Biology/Chemistry → "do you have lab access, or is this purely theoretical?"
- Language → "what's your current level and target use case (travel, business, fluency)?"

**UX state machine change:** `idle → questioning → generating → preview → saved` (currently skips questioning)

---

### Feature A: Session Flow Redesign

Decided 2026-06-24. Replaces the current subtask-heavy session model with a lightweight, self-directed learning loop.

**Core change:** remove micromanagement from sessions. No more "watch section 3, write in notebook." User decides how to study; the system provides direction and evaluates outcome.

**New session flow:**
1. User picks hours → planner selects 1–2 topics from 2–3 different sections (interleaving, based on cognitive science research — better long-term retention than single-topic blocks)
2. Session card shows per topic: title + description + recommended resources + estimated time orientation (e.g. "~45 min of material")
3. Strict ordering within each section (can't do Matrices before Vectors) but sections progress in parallel across sessions
4. Maximum 2–3 sections per session to avoid context-switching fatigue

**Post-session evaluation (Feynman-based):**
1. User writes what they learned per topic in their own words
2. AI compares explanation against topic's `learningOutcomes` (new field needed — see DB changes)
3. Decision per topic: done (remove from queue) / not done (stays, re-scheduled next session)
4. Bonus: if user covered more topics than planned → AI evaluates those too and marks done if understood

**DB changes needed:**
- Add `learningOutcomes` field to `topics` table — explicit criteria for AI evaluation (currently only `description`, too vague)
- `subtasks` table: deprioritise — no longer generated during session planning
- `feynmanReviews` becomes the primary post-session mechanism (not optional), linked per session

**What stays the same:** roadmap hierarchy (phases → sections → topics), Feynman review schema, progress tracking.

---

### Feature B: Resource Strategy

Decided 2026-06-24. Changes how the roadmap agent finds and selects resources. Practice resources deferred — focus is on learning content sources only for now.

**Agent graph order change:** structure is built first, resources are found after (current order is reversed — resources found before structure, causing quality issues).

**New resource search logic (per section):**

1. **Determine source type** — agent decides what format fits the section best before searching:
   - Visual/conceptual topics (Linear Algebra, Neural Networks) → YouTube playlist
   - Syntax/reference topics (Python stdlib, React) → official documentation
   - Deep theory (Algorithms, Math proofs) → book/textbook
   - Mixed → agent judges based on section character

2. **Find main source** — Tavily search with blacklist applied immediately. For niche topics where Tavily returns unknown sources: additional Reddit search ("best [topic] resources reddit") for honest community recommendations.

3. **Verify coverage (Variant B)** — agent inspects actual source content, not memory:
   - YouTube playlist → reads video titles in the playlist
   - Book → reads table of contents
   - Website → reads page structure/headings
   - If source is unknown (niche topic found via search) → always use Variant B

4. **Per-topic fallback** — for each topic where confidence of coverage < 90%: find a separate dedicated source for that topic only. Same blacklist applies.

**Blacklist (never include):** Udemy, Coursera, Pluralsight, LinkedIn Learning, edX paid tiers, Skillshare, Medium paywalled articles, SEO "top 10" listicles.

**Practice:** deferred. Often embedded in the learning source itself (books, interactive sites). Will be addressed separately.

---

### Feature 2: Phase Exams (On-Demand, Multiple Choice)

Generated on demand when the user finishes a phase and clicks "Take Phase Exam" — not pre-built at roadmap creation time.

**Generation:** Agent receives the phase's topic list + any Feynman review data from that phase → generates 10–20 multiple choice questions with plausible distractors (wrong answers that reflect real misconceptions, not obviously wrong). Generation prompt must explicitly require high-quality distractors.

**Phase-level only** for now — no per-topic quizzes yet.

**Optional** — user is not blocked from the next phase. May migrate to required later.

**After exam:** Show score + correct answers with explanations + flag weak topics. Weak topics surface in the next session plan (requires session planner to read exam results — **deferred design decision**, note below).

**DB change needed:** New `phase_exams` table — `id`, `phase_id`, `questions` (JSONB array of `{question, options[4], correctIndex, explanation}`), `created_at`. New `exam_attempts` table — `id`, `exam_id`, `answers` (JSONB), `score`, `taken_at`.

**Migration path:** Multiple choice → free-response (requires AI scoring step, similar to Feynman but for structured questions).

---

### Feature 3: Mid-Roadmap Project

A dedicated project phase auto-placed after the foundations boundary (detected by the agent — not a fixed phase number).

**Generation flow:**
1. After building the topic tree, agent identifies the phase where foundational skills are complete and advanced topics begin
2. Agent generates 3 project options appropriate to the domain (small / medium / ambitious scope):
   - STEM/Engineering → build something, implement an algorithm, run an experiment
   - Biology/Chemistry → literature review + experimental design
   - Law → mock case brief or hypothetical analysis
   - Psychology → case study or research proposal
   - Creative → portfolio piece or original work
   - Language → translate a real text, write an essay, recorded conversation
   - Business/Finance → financial model or market analysis
3. User picks one or names their own
4. Agent scaffolds the project into 4–8 ordered milestones, each mapped to roadmap skills it exercises + project-specific resources (starter templates, datasets, tools — different from topic resources)

**Milestone structure:** Week-level (coarser than session subtasks). Each milestone: title, goal sentence, skills exercised, suggested resources.

**In the roadmap:** Project appears as a dedicated phase (e.g., "Phase 3: Project — Hand Gesture Robot") with milestones instead of sections/topics.

---

## Deferred / optional

- **Import resource augmentation** — after parsing a .md import, run targeted web searches for topics that have no resources and attach verified results. Not worth it for user-curated files (resources are intentional); useful as an optional "enrich" action post-import. Would reuse `searchWebRaw` + `fetchPages` + the verify prompt from the agent pipeline, scoped only to empty-resource topics.

- **Exam results → session planning feedback loop** — if the user scores poorly on specific topics in a phase exam, the session planner reads those weak spots and reprioritizes them in the next session. Requires session planner to query `exam_attempts` and factor weak topics alongside uncovered topics. Discuss before building.

- **Project milestones in session planner** — when the active roadmap phase is a project phase, the session planner operates on milestones instead of topics. User selects milestones to work on in the session; completion tracking is milestone-based. Currently session planner is topic-only; this is a meaningful change. Discuss before building.

- **Gap audit node in roadmap agent** — after `formatOutput`, run a `gapAudit` node that checks the generated roadmap against a domain-specific checklist (for robotics: IMU, control theory, simulation, wireless comms, state machines, edge deployment) and injects missing topics. Requires per-domain checklists. High value for technical domains.

## What "done" looks like for v1
A working personal study app used daily for a robotics/AI self-learning journey: session planning works end-to-end, the roadmap agent produces accurate and usable roadmaps, Feynman review gives honest and useful feedback, deployed on Vercel — on a codebase ready to add auth and multi-user without a rewrite.
