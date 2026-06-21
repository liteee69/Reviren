# Reviren — Plan

> **Status (2026-06-21):** All 13 original steps complete + step 14 (sections, progress, session overhaul) complete. App fully functional.
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

## What "done" looks like for v1
A working personal study app used daily for a robotics/AI self-learning journey: session planning works end-to-end, the roadmap agent produces accurate and usable roadmaps, Feynman review gives honest and useful feedback, deployed on Vercel — on a codebase ready to add auth and multi-user without a rewrite.
