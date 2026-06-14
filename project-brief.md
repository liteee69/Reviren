# Project Brief — Focused Learning App

## What it is
A single-user web app for structured, self-directed learning. Generates custom AI-powered
roadmaps, plans study sessions, tracks topic progress, and evaluates understanding via
Feynman review. Personal use first, open to other users in a later version.

## Problem
Self-directed learners have no single tool that combines: custom roadmap generation,
intelligent session planning based on available time, progress tracking, and understanding
evaluation. Notion/Obsidian are too generic. Anki is flashcards only. Coursera locks you
into fixed courses. This fills that gap.

## MVP features (in scope)
1. **Roadmap generation** — user inputs a topic (e.g. "robotics") → LangGraph.js agent
   searches the web → structures phases + subtopics + best resources per topic → saves to
   Supabase
2. **Roadmap import** — upload an existing markdown/text roadmap as alternative to agent
   generation
3. **Roadmap viewer + editor** — read, edit, add/remove topics after generation
4. **Session planning (AI)** — pick hours → Claude reads roadmap + progress → returns
   prioritised topic list matched to time available
5. **Session planning (manual)** — pick hours → pick topics from roadmap checklist yourself
6. **Topic tracking** — post-session checklist → check off covered topics → uncovered topics
   become priority for next session automatically
7. **Feynman review** — type explanation of a topic → Claude scores it (1–10), returns what
   was solid, what was missing, which topics to flag for next session
8. **Flashcards** — create front/back cards manually or generate via Claude from a topic name
   → simple flip interface, mark known/unknown
9. **Pomodoro timer** — 25/5 or 50/10, configurable, runs in session view
10. **Music player** — embedded YouTube lo-fi playlist iframe in session view

## Out of scope for MVP
- Auth / multi-user (add when opening to other users)
- Voice input for Feynman review (v2)
- Spaced repetition / SM-2 scheduling (v2, start with simple flip cards)
- Mobile app
- Desktop app (Electron wrapper — add after web MVP is validated)
- Payments / subscription

## Hard constraints
- **No auth for MVP** — no Supabase Auth, no user_id on any table, app opens straight to
  dashboard. Single user, single instance.
- **Stay in JS/TS ecosystem** — no Python service. LangGraph.js runs inside Next.js API
  routes. One codebase, one deployment.
- **Vibe coding** — built with AI assistance (Claude Code). Simplicity and clarity in
  architecture matter more than clever abstractions.

## Stack decisions (already made, do not re-research)
- **Next.js 15 App Router + TypeScript** — frontend + API routes in one codebase,
  Vercel-native
- **Tailwind CSS** — fast styling
- **Supabase (PostgreSQL, no auth)** — database only, no user_id on tables for MVP
- **Claude API (claude-sonnet-4-6)** — session planning, Feynman scoring, flashcard
  generation
- **LangGraph.js (@langchain/langgraph)** — agent orchestration. Chose JS over Python
  because: production-stable since mid-2025 (42k weekly npm downloads), same core API as
  Python LangGraph (concepts transfer), runs natively in Next.js API routes with no separate
  service needed. Python LangGraph becomes relevant only if RAG pipelines or custom ML models
  are needed — neither is in scope.
- **Tavily API** — web search tool for the LangGraph agent. Returns structured,
  LLM-friendly results. Free tier: 1000 req/month. Standard in LangGraph examples.
- **Vercel** — zero config deployment with Next.js

## LangGraph agent design (roadmap generation)
Graph: `input → search_topics → structure_phases → search_resources → format_output`
- `search_topics`: searches what someone needs to learn for the given topic
- `structure_phases`: groups results into ordered learning phases with subtopics
- `search_resources`: for each topic, finds best video + book + course
- `format_output`: returns clean JSON saved to Supabase

## Supabase schema
```
roadmaps        — id, title, topic, phases (jsonb), created_at
sessions        — id, roadmap_id, planned_topics (jsonb), covered_topics (jsonb), hours, created_at
flashcards      — id, roadmap_id, front, back, created_at
feynman_reviews — id, session_id, topic, explanation, score, feedback (jsonb), created_at
```
No migrations needed for MVP — create tables manually in Supabase dashboard.

## Build order (priority sequence)
1. Project setup — Next.js 15 + Tailwind + Supabase client + env vars
2. Supabase tables
3. LangGraph roadmap agent — `/lib/agent/roadmap-agent.ts` + Tavily tool
4. Roadmap creation UI — input → agent → display → save
5. Roadmap viewer + editor
6. Roadmap import (markdown/text upload)
7. Session planning — AI mode + manual mode
8. Topic tracking — post-session checklist → save to sessions table
9. Feynman review — text input → Claude scoring → display feedback
10. Flashcards — create, flip, mark known/unknown, Claude generation
11. Pomodoro timer
12. Music player — YouTube iframe embed
13. Dashboard — roadmap list, progress summary, last session

## What "done" looks like for v1
A working personal study app used daily for a robotics/AI self-learning journey.
Session planning works end-to-end. Roadmap agent produces accurate, usable roadmaps.
Feynman review gives honest, useful feedback. Deployed on Vercel.
