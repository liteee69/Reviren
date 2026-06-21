# Sections, Progress & Session Planning Overhaul

**Date:** 2026-06-21
**Status:** Approved

## What this adds

Three interconnected features:
1. **Roadmap hierarchy** — phases → sections → topics (3 levels, replacing the current 2-level phase+topics flat structure)
2. **Topic progress** — 0–100% per topic, rolled up to section and phase level
3. **AI session planning overhaul** — time-block allocation, subtask generation, cross-section balancing, post-session automatic progress update

---

## Data Model

### New tables

**`roadmap_phases`**
- `id` uuid PK
- `roadmap_id` uuid FK → roadmaps (cascade delete)
- `title` text (e.g. "Phase 1: Fundamentals")
- `order` integer
- `created_at` timestamp

**`sections`**
- `id` uuid PK
- `phase_id` uuid FK → roadmap_phases (cascade delete)
- `title` text (e.g. "Mathematics", "Python", "Electronics")
- `description` text nullable
- `order` integer
- `created_at` timestamp

**`subtasks`**
- `id` uuid PK
- `session_topic_id` uuid FK → session_topics (cascade delete)
- `description` text — concrete action (e.g. "Watch 3Blue1Brown matrix multiplication video")
- `is_done` boolean default false
- `resource_title` text nullable
- `resource_url` text nullable
- `order` integer

### Modified tables

**`topics`**
- Drop `roadmap_id` (moved up to phases → sections)
- Drop `phase` text field (now a proper table)
- Add `section_id` uuid FK → sections (cascade delete)
- Add `progress` integer default 0 (0–100, written after each session)
- Keep: `title`, `description`, `resources` (jsonb), `order`, `is_completed`, `created_at`

**`session_topics`**
- Add `allocated_minutes` integer — time the AI assigned to this topic
- Add `progress_delta` integer nullable — % added at session end (written once on end)
- Keep: `session_id`, `topic_id`, `is_covered`

**`sessions`**
- Keep `roadmap_id` — sessions remain tied to one roadmap
- No other changes

### Progress rules (computed, not stored)
- **Topic progress** = `topics.progress` (persisted integer)
- **Section progress** = `AVG(topics.progress)` for all topics in section
- **Phase progress** = `AVG(section progress)` for all sections in phase

---

## Roadmap Agent Schema Update

Current output: `phases[{ title, topics[] }]`

New output: `phases[{ title, sections[{ title, description, topics[] }] }]`

The agent already thinks in subject domains — this makes sections explicit in the structured output. The Zod schema and LangGraph format node both update to reflect this. Import parser also updated to produce the same shape.

---

## AI Session Planning

### Endpoint
`POST /api/sessions/plan` — full rewrite

### Input
`{ roadmapId, hours }` — hours is a number (e.g. 2, 3, 4)

### What the AI does
1. Reads full roadmap: phases → sections → topics with current `progress` %
2. Selects topics using these rules:
   - Prefer topics with lower progress % (0% before 50%, 50% before 80%+)
   - Never assign topics already at 100%
   - Prefer cross-section balance (alternate domains where possible)
   - Two topics from the same section are allowed if time allows or topics are tightly sequential
   - Pair foundational + applied when possible (e.g. Linear Algebra + Python in same session)
3. Allocates time in whole/half hours, minimum 1h per topic:
   - 2h → 2 topics × 1h
   - 3h → 2 topics × 1.5h or 3 × 1h
   - 4h → 3 topics (mixed allocation)
4. For each topic generates 3–5 subtasks: concrete actions with resource attachments from existing `topics.resources`
5. Returns structured plan

### Output schema (Zod)
```
{
  topics: [{
    topicId: string,
    title: string,
    sectionTitle: string,
    allocatedMinutes: number,
    subtasks: [{
      description: string,
      resourceTitle: string | null,
      resourceUrl: string | null,
      order: number
    }]
  }]
}
```

### UI changes
- Remove `estimatedMinutes` label — subtasks make time use self-evident
- Each topic block shows subtasks inline (not collapsed)
- User can uncheck individual topics before starting

---

## Session View

- Topics listed with subtasks as checkboxes
- Checking a subtask → server action → `subtasks.is_done = true` (immediate write)
- Progress not updated until End Session

---

## Post-Session Progress (End Session)

1. User taps "End session"
2. New route `POST /api/sessions/end` fetches all session_topics + subtask done/total counts
3. For each topic, AI receives: `{ topicTitle, currentProgress, totalSubtasks, doneSubtasks }` → outputs `progressDelta` (integer, capped so `current + delta ≤ 100`)
4. **Manual override (hybrid):** UI shows calculated deltas pre-filled in number inputs, one per topic. User can adjust. "Confirm & save" writes everything.
5. On confirm: `topics.progress += delta`, `session_topics.progress_delta = delta`, `sessions.ended_at = now()`
6. User redirected to sessions list — progress bars already updated

*Future migration path: remove the override inputs → pure AI (A), or add a full review step UI → option B. Both are UI-only changes.*

---

## Roadmap Viewer UI

### Phase pills
- Horizontal scrollable row of rounded pill buttons
- Each pill: `Phase 1 · 64%` — title + phase-level average progress
- Active pill highlighted; switching is client-side (no reload)

### Section cards grid
- 2–3 column grid below the pills
- Each card: section title, progress bar, topic count, completed topic count
- Click → `/roadmaps/[id]/sections/[sectionId]`

### Section detail page (`/roadmaps/[id]/sections/[sectionId]`)
- Lists all topics ordered by `order`
- Each topic: title, description, progress bar (0–100%), resource count
- Same inline edit/delete as current topic cards

---

## What does NOT change
- Session creation flow (roadmap picker + hours input)
- Manual topic selection mode
- Feynman review
- Flashcards
- Pomodoro timer
- Music player
- Dashboard (will naturally reflect new progress data)

---

## Migration

Existing `topics.roadmap_id` and `topics.phase` must be migrated into the new hierarchy. Since this is a personal app with non-critical existing data, the migration script will:
1. Create one default phase per roadmap from distinct `phase` values
2. Create one default section per phase (titled "General")
3. Move all topics under their matching section
4. Set `topics.progress = 0` (or `100` if `is_completed = true`)

Drizzle migration handles schema; a one-time seed script handles data backfill.
