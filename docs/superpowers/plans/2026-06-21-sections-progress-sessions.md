# Sections, Progress & Session Planning Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3-level roadmap hierarchy (phases → sections → topics), 0–100% progress per topic rolled up to section/phase, and a fully rewritten AI session planner that generates subtask-level detail with cross-section balancing and automatic post-session progress updates.

**Architecture:** Extend the Drizzle schema with `roadmap_phases` and `sections` tables and a `subtasks` table; migrate existing flat `phase`-text topics into the new hierarchy; rewrite the session planning API to produce subtask-level plans; add a post-session `/api/sessions/end` route that uses Claude to calculate progress deltas.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM + drizzle-kit, Supabase Postgres, LangChain `initChatModel` (`claude-sonnet-4-6`), shadcn/ui, Tailwind v4, Zod 4, vitest (added in Task 1)

## Global Constraints

- All DB changes go through Drizzle migrations — never hand-edit Supabase directly
- Node.js runtime (`export const runtime = 'nodejs'`) on all API routes
- Session model: `claude-sonnet-4-6` via `sessionModel` from `@/lib/ai`
- Roadmap model: `gemini-3.1-pro-preview` via `roadmapModel` from `@/lib/ai`
- All new server actions use `'use server'` and call `revalidatePath` where needed
- shadcn/ui components only — no new UI libraries
- Phase titles must follow format `"Phase N: <Name>"`
- `topics.progress` is an integer 0–100, never negative, never > 100
- `progress_delta` is written exactly once per `session_topic` at session end

## File Map

**Modified:**
- `src/lib/db/schema.ts` — add `roadmapPhases`, `sections`, `subtasks`; update `topics`, `sessionTopics`
- `src/lib/agent/roadmap-schema.ts` — add `SectionSchema`; update `PhaseSchema`, `RoadmapOutputSchema`
- `src/lib/agent/roadmap-agent.ts` — update prompt to output sections
- `src/app/actions/roadmap.ts` — `saveRoadmap` writes phases → sections → topics
- `src/app/api/roadmap/import/route.ts` — update prompt for sections
- `src/app/roadmaps/[id]/page.tsx` — phase pills + section cards
- `src/app/roadmaps/[id]/add-topic.tsx` — accept `sectionId` instead of `phase`+`roadmapId`
- `src/app/actions/topic.ts` — update to use `sectionId`
- `src/app/api/sessions/plan/route.ts` — full rewrite
- `src/app/actions/session.ts` — `createSession` saves subtasks; add `markSubtaskDone`, `saveSessionProgress`
- `src/app/sessions/session-planner.tsx` — show subtasks, remove `estimatedMinutes`
- `src/app/sessions/[id]/page.tsx` — include subtasks in query
- `src/app/sessions/[id]/session-topics.tsx` — subtask checkboxes + end-session override UI

**Created:**
- `src/scripts/backfill-sections.ts` — one-time data migration
- `src/app/roadmaps/[id]/phase-tabs.tsx` — client pill tabs component
- `src/app/roadmaps/[id]/section-card.tsx` — section progress card
- `src/app/roadmaps/[id]/sections/[sectionId]/page.tsx` — section detail
- `src/app/roadmaps/[id]/sections/[sectionId]/section-topics.tsx` — topic list with progress
- `src/app/api/sessions/end/route.ts` — AI progress delta calculation
- `src/lib/progress.ts` — pure progress utility functions (tested)
- `src/lib/progress.test.ts` — vitest tests

---

## Task 1: DB Schema + Migration + Test Setup

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/progress.ts`
- Create: `src/lib/progress.test.ts`
- Create: `src/scripts/backfill-sections.ts`

**Interfaces:**
- Produces:
  - `roadmapPhases` table: `{ id, roadmapId, title, order, createdAt }`
  - `sections` table: `{ id, phaseId, title, description, order, createdAt }`
  - `topics` table updated: `sectionId` replaces `roadmapId`+`phase`; adds `progress`
  - `sessionTopics` table updated: adds `allocatedMinutes`, `progressDelta`
  - `subtasks` table: `{ id, sessionTopicId, description, isDone, resourceTitle, resourceUrl, order }`
  - `clampDelta(current, delta): number` — exported from `src/lib/progress.ts`
  - `calcSectionProgress(progresses: number[]): number` — exported from `src/lib/progress.ts`

- [ ] **Step 1: Add vitest**

```bash
npm install -D vitest @vitejs/plugin-react
```

Add to `package.json` scripts:
```json
"test": "vitest run"
```

Create `vitest.config.ts` at project root:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { environment: 'node' },
})
```

- [ ] **Step 2: Write failing tests for progress utilities**

Create `src/lib/progress.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { clampDelta, calcSectionProgress } from './progress'

describe('clampDelta', () => {
  it('adds delta to current progress', () => {
    expect(clampDelta(30, 20)).toBe(50)
  })
  it('clamps at 100', () => {
    expect(clampDelta(90, 20)).toBe(100)
  })
  it('never goes below current', () => {
    expect(clampDelta(50, 0)).toBe(50)
  })
  it('handles zero current', () => {
    expect(clampDelta(0, 40)).toBe(40)
  })
})

describe('calcSectionProgress', () => {
  it('averages topic progresses', () => {
    expect(calcSectionProgress([0, 50, 100])).toBe(50)
  })
  it('returns 0 for empty array', () => {
    expect(calcSectionProgress([])).toBe(0)
  })
  it('rounds to nearest integer', () => {
    expect(calcSectionProgress([33, 66])).toBe(50)
  })
})
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module './progress'`

- [ ] **Step 4: Create progress utilities**

Create `src/lib/progress.ts`:
```ts
export function clampDelta(current: number, delta: number): number {
  return Math.min(100, current + Math.max(0, delta))
}

export function calcSectionProgress(progresses: number[]): number {
  if (progresses.length === 0) return 0
  return Math.round(progresses.reduce((sum, p) => sum + p, 0) / progresses.length)
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test
```

Expected: PASS — 7 tests

- [ ] **Step 6: Update DB schema**

Replace `src/lib/db/schema.ts` with:
```ts
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const roadmaps = pgTable('roadmaps', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const roadmapPhases = pgTable('roadmap_phases', {
  id: uuid('id').primaryKey().defaultRandom(),
  roadmapId: uuid('roadmap_id').notNull().references(() => roadmaps.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  order: integer('order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const sections = pgTable('sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  phaseId: uuid('phase_id').notNull().references(() => roadmapPhases.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  order: integer('order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const topics = pgTable('topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  sectionId: uuid('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  resources: jsonb('resources'),
  order: integer('order').notNull(),
  progress: integer('progress').notNull().default(0),
  isCompleted: boolean('is_completed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roadmapId: uuid('roadmap_id').notNull().references(() => roadmaps.id, { onDelete: 'cascade' }),
  plannedMinutes: integer('planned_minutes').notNull(),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const sessionTopics = pgTable('session_topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  topicId: uuid('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
  allocatedMinutes: integer('allocated_minutes').notNull().default(60),
  isCovered: boolean('is_covered').notNull().default(false),
  progressDelta: integer('progress_delta'),
})

export const subtasks = pgTable('subtasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionTopicId: uuid('session_topic_id').notNull().references(() => sessionTopics.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  isDone: boolean('is_done').notNull().default(false),
  resourceTitle: text('resource_title'),
  resourceUrl: text('resource_url'),
  order: integer('order').notNull(),
})

export const feynmanReviews = pgTable('feynman_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  topicId: uuid('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
  explanation: text('explanation').notNull(),
  score: integer('score'),
  feedbackSolid: text('feedback_solid'),
  feedbackMissing: text('feedback_missing'),
  topicsToFlag: jsonb('topics_to_flag'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const flashcards = pgTable('flashcards', {
  id: uuid('id').primaryKey().defaultRandom(),
  topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
  front: text('front').notNull(),
  back: text('back').notNull(),
  isKnown: boolean('is_known').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

- [ ] **Step 7: Generate and apply migration**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Expected: migration applied, new tables created, `topics.roadmap_id` and `topics.phase` columns removed.

If migration fails due to existing data (FK violations), the backfill script in the next step handles it. Apply schema changes manually via Supabase dashboard if needed for dev environment, then re-run migrate.

- [ ] **Step 8: Write and run backfill script**

Create `src/scripts/backfill-sections.ts`:
```ts
import { db } from '../lib/db'
import { roadmaps, roadmapPhases, sections, topics } from '../lib/db/schema'
import { eq } from 'drizzle-orm'

// Run BEFORE migration removes roadmap_id/phase columns.
// This script reads raw SQL since Drizzle schema no longer has those columns.
async function backfill() {
  const client = db.$client as import('postgres').Sql

  // Get all topics with their old columns
  const oldTopics = await client`
    SELECT id, roadmap_id, phase, description, resources, "order", is_completed
    FROM topics
    WHERE section_id IS NULL
  `

  if (oldTopics.length === 0) {
    console.log('No topics to backfill')
    return
  }

  // Group by roadmap_id then phase
  const byRoadmap = new Map<string, Map<string, typeof oldTopics>>()
  for (const t of oldTopics) {
    if (!byRoadmap.has(t.roadmap_id)) byRoadmap.set(t.roadmap_id, new Map())
    const byPhase = byRoadmap.get(t.roadmap_id)!
    if (!byPhase.has(t.phase)) byPhase.set(t.phase, [])
    byPhase.get(t.phase)!.push(t)
  }

  for (const [roadmapId, phaseMap] of byRoadmap) {
    // Sort phases by the number in "Phase N: ..."
    const sortedPhases = [...phaseMap.keys()].sort((a, b) => {
      const numA = parseInt(a.match(/Phase (\d+)/i)?.[1] ?? '0')
      const numB = parseInt(b.match(/Phase (\d+)/i)?.[1] ?? '0')
      return numA - numB
    })

    for (let phaseIndex = 0; phaseIndex < sortedPhases.length; phaseIndex++) {
      const phaseTitle = sortedPhases[phaseIndex]
      const [phase] = await db
        .insert(roadmapPhases)
        .values({ roadmapId, title: phaseTitle, order: phaseIndex })
        .returning({ id: roadmapPhases.id })

      // One default section per phase
      const [section] = await db
        .insert(sections)
        .values({ phaseId: phase.id, title: 'General', order: 0 })
        .returning({ id: sections.id })

      const phaseTopics = phaseMap.get(phaseTitle)!
      for (const t of phaseTopics) {
        await client`
          UPDATE topics
          SET section_id = ${section.id},
              progress = ${t.is_completed ? 100 : 0}
          WHERE id = ${t.id}
        `
      }
    }
  }

  console.log('Backfill complete')
}

backfill().catch(console.error).finally(() => process.exit())
```

Run:
```bash
npx tsx src/scripts/backfill-sections.ts
```

Expected: `Backfill complete` — all existing topics now have `section_id` set.

- [ ] **Step 9: Commit**

```bash
git add src/lib/db/schema.ts src/lib/progress.ts src/lib/progress.test.ts src/scripts/backfill-sections.ts vitest.config.ts package.json
git commit -m "feat: add roadmap_phases, sections, subtasks tables; progress utilities"
```

---

## Task 2: Roadmap Schema + Agent + Save Action

**Files:**
- Modify: `src/lib/agent/roadmap-schema.ts`
- Modify: `src/lib/agent/roadmap-agent.ts`
- Modify: `src/app/actions/roadmap.ts`
- Modify: `src/app/api/roadmap/import/route.ts`

**Interfaces:**
- Consumes: `roadmapPhases`, `sections`, `topics` from schema (Task 1)
- Produces:
  - `SectionSchema` — `{ title: string, topics: TopicSchema[] }`
  - `PhaseSchema` — `{ title: string, sections: SectionSchema[] }`
  - `RoadmapOutput` type updated — `phases[].sections[].topics[]`
  - `saveRoadmap(data: RoadmapOutput): Promise<string>` — saves full hierarchy, returns roadmapId

- [ ] **Step 1: Update roadmap schema**

Replace `src/lib/agent/roadmap-schema.ts`:
```ts
import { z } from 'zod'

export const ResourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  type: z.enum(['video', 'article', 'course', 'book', 'documentation']),
})

export const TopicSchema = z.object({
  title: z.string(),
  description: z.string(),
  resources: z.array(ResourceSchema),
})

export const SectionSchema = z.object({
  title: z.string(),
  topics: z.array(TopicSchema),
})

export const PhaseSchema = z.object({
  title: z.string(), // "Phase N: <Name>"
  sections: z.array(SectionSchema),
})

export const RoadmapOutputSchema = z.object({
  title: z.string(),
  description: z.string(),
  phases: z.array(PhaseSchema),
})

export type RoadmapOutput = z.infer<typeof RoadmapOutputSchema>
```

- [ ] **Step 2: Update roadmap agent prompt**

In `src/lib/agent/roadmap-agent.ts`, update the `formatOutput` prompt string (lines 34–49). Replace only the prompt template:

```ts
  const prompt = `You are a learning roadmap expert. Based on the research below, create a detailed, opinionated learning roadmap for: "${state.topic}".

## Topic research:
${state.topicSearchResults}

## Available resources:
${state.resourceSearchResults}

Rules:
- 3–5 phases, each with 2–4 sections (subject domains like "Mathematics", "Programming", "Electronics")
- Each section has 2–5 topics ordered from fundamental to advanced
- Group topics by subject domain into sections — never mix unrelated subjects in one section
- Every topic must have 2–4 real, specific resources with accurate URLs from the research
- Descriptions should explain WHY this topic matters, not just what it is
- Phase titles follow the format "Phase N: <Name>"
- Respond with valid JSON only, matching the schema exactly`
```

- [ ] **Step 3: Update saveRoadmap action**

Replace `src/app/actions/roadmap.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { roadmaps, roadmapPhases, sections, topics } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { RoadmapOutput } from '@/lib/agent/roadmap-schema'

export async function saveRoadmap(data: RoadmapOutput) {
  const [roadmap] = await db
    .insert(roadmaps)
    .values({ title: data.title, description: data.description })
    .returning({ id: roadmaps.id })

  for (let phaseIndex = 0; phaseIndex < data.phases.length; phaseIndex++) {
    const phase = data.phases[phaseIndex]
    const [phaseRow] = await db
      .insert(roadmapPhases)
      .values({ roadmapId: roadmap.id, title: phase.title, order: phaseIndex })
      .returning({ id: roadmapPhases.id })

    for (let sectionIndex = 0; sectionIndex < phase.sections.length; sectionIndex++) {
      const section = phase.sections[sectionIndex]
      const [sectionRow] = await db
        .insert(sections)
        .values({ phaseId: phaseRow.id, title: section.title, order: sectionIndex })
        .returning({ id: sections.id })

      const topicRows = section.topics.map((topic, topicIndex) => ({
        sectionId: sectionRow.id,
        title: topic.title,
        description: topic.description,
        resources: topic.resources,
        order: topicIndex,
      }))

      if (topicRows.length > 0) {
        await db.insert(topics).values(topicRows)
      }
    }
  }

  revalidatePath('/roadmaps')
  return roadmap.id
}

export async function deleteRoadmap(id: string) {
  await db.delete(roadmaps).where(eq(roadmaps.id, id))
  revalidatePath('/roadmaps')
}
```

- [ ] **Step 4: Update import route prompt**

In `src/app/api/roadmap/import/route.ts`, replace the prompt string:
```ts
  const prompt = `Parse the following learning roadmap text into a structured format.

Extract phases, sections (subject domains), topics, descriptions, and any mentioned resources. Group topics by subject domain into sections within each phase. If resources are mentioned (books, videos, courses, links), include them with the appropriate type. If no resources are mentioned for a topic, use an empty array.

Infer a clear title and description for the overall roadmap if not explicitly stated.

Phase titles must follow the format "Phase N: <Name>".
Section titles should be subject domain names (e.g. "Mathematics", "Python", "Electronics").
If the text has no clear sections, group all topics under a single section titled "General".

Text to parse:
${text.trim()}`
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent/roadmap-schema.ts src/lib/agent/roadmap-agent.ts src/app/actions/roadmap.ts src/app/api/roadmap/import/route.ts
git commit -m "feat: add sections to roadmap schema, agent prompt, and save action"
```

---

## Task 3: Roadmap Viewer UI

**Files:**
- Modify: `src/app/roadmaps/[id]/page.tsx`
- Create: `src/app/roadmaps/[id]/phase-tabs.tsx`
- Create: `src/app/roadmaps/[id]/section-card.tsx`
- Create: `src/app/roadmaps/[id]/sections/[sectionId]/page.tsx`
- Create: `src/app/roadmaps/[id]/sections/[sectionId]/section-topics.tsx`
- Modify: `src/app/roadmaps/[id]/add-topic.tsx`
- Modify: `src/app/actions/topic.ts`

**Interfaces:**
- Consumes: `roadmapPhases`, `sections`, `topics` from schema (Task 1); `calcSectionProgress` from `@/lib/progress` (Task 1)
- Produces:
  - `/roadmaps/[id]` — phase pills + section card grid
  - `/roadmaps/[id]/sections/[sectionId]` — topic list with progress bars

- [ ] **Step 1: Create phase tabs component**

Create `src/app/roadmaps/[id]/phase-tabs.tsx`:
```tsx
'use client'

import { useState } from 'react'

type Phase = {
  id: string
  title: string
  progress: number
  sections: Array<{
    id: string
    title: string
    progress: number
    topicCount: number
    completedCount: number
  }>
}

export function PhaseTabs({ phases, roadmapId }: { phases: Phase[]; roadmapId: string }) {
  const [activeId, setActiveId] = useState(phases[0]?.id ?? '')
  const active = phases.find((p) => p.id === activeId)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {phases.map((phase) => (
          <button
            key={phase.id}
            onClick={() => setActiveId(phase.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              phase.id === activeId
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {phase.title}
            <span className="ml-2 opacity-60">{phase.progress}%</span>
          </button>
        ))}
      </div>

      {active && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.sections.map((section) => (
            <a key={section.id} href={`/roadmaps/${roadmapId}/sections/${section.id}`}>
              <SectionCard section={section} />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionCard({
  section,
}: {
  section: { title: string; progress: number; topicCount: number; completedCount: number }
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 hover:border-foreground/20 transition-colors cursor-pointer">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-sm">{section.title}</h3>
        <span className="text-xs text-muted-foreground shrink-0">{section.progress}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-foreground transition-all"
          style={{ width: `${section.progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {section.completedCount}/{section.topicCount} topics done
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite roadmap page**

Replace `src/app/roadmaps/[id]/page.tsx`:
```tsx
export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { roadmaps, roadmapPhases, sections, topics } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { DeleteRoadmapButton } from './delete-roadmap'
import { PhaseTabs } from './phase-tabs'
import { calcSectionProgress } from '@/lib/progress'

async function getRoadmapData(id: string) {
  const [roadmap] = await db.select().from(roadmaps).where(eq(roadmaps.id, id))
  if (!roadmap) return null

  const phases = await db
    .select()
    .from(roadmapPhases)
    .where(eq(roadmapPhases.roadmapId, id))
    .orderBy(asc(roadmapPhases.order))

  const phasesWithSections = await Promise.all(
    phases.map(async (phase) => {
      const sectionRows = await db
        .select()
        .from(sections)
        .where(eq(sections.phaseId, phase.id))
        .orderBy(asc(sections.order))

      const sectionsWithProgress = await Promise.all(
        sectionRows.map(async (section) => {
          const topicRows = await db
            .select({ progress: topics.progress, isCompleted: topics.isCompleted })
            .from(topics)
            .where(eq(topics.sectionId, section.id))

          const progress = calcSectionProgress(topicRows.map((t) => t.progress))
          const completedCount = topicRows.filter((t) => t.isCompleted).length

          return {
            id: section.id,
            title: section.title,
            progress,
            topicCount: topicRows.length,
            completedCount,
          }
        })
      )

      const phaseProgress = calcSectionProgress(sectionsWithProgress.map((s) => s.progress))

      return { id: phase.id, title: phase.title, progress: phaseProgress, sections: sectionsWithProgress }
    })
  )

  return { roadmap, phases: phasesWithSections }
}

export default async function RoadmapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getRoadmapData(id)
  if (!data) notFound()

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.roadmap.title}</h1>
          {data.roadmap.description && (
            <p className="text-muted-foreground mt-1">{data.roadmap.description}</p>
          )}
        </div>
        <DeleteRoadmapButton id={data.roadmap.id} title={data.roadmap.title} />
      </div>

      {data.phases.length === 0 ? (
        <p className="text-sm text-muted-foreground">No phases yet. Generate or import a roadmap to get started.</p>
      ) : (
        <PhaseTabs phases={data.phases} roadmapId={id} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create section detail page**

Create `src/app/roadmaps/[id]/sections/[sectionId]/page.tsx`:
```tsx
export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { sections, topics, roadmapPhases, roadmaps } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { SectionTopics } from './section-topics'

async function getSectionData(sectionId: string) {
  const [section] = await db.select().from(sections).where(eq(sections.id, sectionId))
  if (!section) return null

  const [phase] = await db.select().from(roadmapPhases).where(eq(roadmapPhases.id, section.phaseId))
  if (!phase) return null

  const [roadmap] = await db.select().from(roadmaps).where(eq(roadmaps.id, phase.roadmapId))
  if (!roadmap) return null

  const topicList = await db
    .select()
    .from(topics)
    .where(eq(topics.sectionId, sectionId))
    .orderBy(asc(topics.order))

  return { section, phase, roadmap, topics: topicList }
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ id: string; sectionId: string }>
}) {
  const { sectionId } = await params
  const data = await getSectionData(sectionId)
  if (!data) notFound()

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <a href={`/roadmaps/${data.roadmap.id}`} className="hover:underline">
            {data.roadmap.title}
          </a>
          <span>/</span>
          <span>{data.phase.title}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{data.section.title}</h1>
      </div>

      <SectionTopics
        topics={data.topics}
        sectionId={sectionId}
        roadmapId={data.roadmap.id}
      />
    </div>
  )
}
```

- [ ] **Step 4: Create section topics component**

Create `src/app/roadmaps/[id]/sections/[sectionId]/section-topics.tsx`:
```tsx
'use client'

import { Card, CardContent } from '@/components/ui/card'

type Topic = {
  id: string
  title: string
  description: string | null
  progress: number
  resources: unknown
  isCompleted: boolean
}

export function SectionTopics({
  topics,
  sectionId,
  roadmapId,
}: {
  topics: Topic[]
  sectionId: string
  roadmapId: string
}) {
  if (topics.length === 0) {
    return <p className="text-sm text-muted-foreground">No topics in this section yet.</p>
  }

  return (
    <div className="space-y-3">
      {topics.map((topic) => (
        <Card key={topic.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className={`text-sm font-medium ${topic.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                  {topic.title}
                </p>
                {topic.description && (
                  <p className="text-xs text-muted-foreground">{topic.description}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{topic.progress}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{ width: `${topic.progress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Update add-topic action**

`src/app/actions/topic.ts` — check what currently exists and update any `roadmapId`/`phase` references to use `sectionId`. The `AddTopic` component should pass `sectionId`. Update accordingly so new topics insert with `sectionId`.

- [ ] **Step 6: Verify dev server**

```bash
npm run dev
```

Navigate to `/roadmaps/[id]`. Expected: phase pills at top, section cards below. Click a section → section detail page with topic list and progress bars.

- [ ] **Step 7: Commit**

```bash
git add src/app/roadmaps/
git commit -m "feat: roadmap viewer with phase pills, section cards, and topic progress bars"
```

---

## Task 4: Session Planning API Rewrite

**Files:**
- Modify: `src/app/api/sessions/plan/route.ts`

**Interfaces:**
- Consumes: `roadmaps`, `roadmapPhases`, `sections`, `topics` from schema; `sessionModel` from `@/lib/ai`
- Produces:
  - `POST /api/sessions/plan` — accepts `{ roadmapId, hours }`, returns:
    ```ts
    {
      topics: Array<{
        topicId: string
        title: string
        sectionTitle: string
        allocatedMinutes: number
        subtasks: Array<{
          description: string
          resourceTitle: string | null
          resourceUrl: string | null
          order: number
        }>
      }>
    }
    ```

- [ ] **Step 1: Rewrite the plan route**

Replace `src/app/api/sessions/plan/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { HumanMessage } from '@langchain/core/messages'
import { sessionModel } from '@/lib/ai'
import { db } from '@/lib/db'
import { topics, sections, roadmapPhases, roadmaps } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { z } from 'zod'

export const runtime = 'nodejs'

const SubtaskPlanSchema = z.object({
  description: z.string(),
  resourceTitle: z.string().nullable(),
  resourceUrl: z.string().nullable(),
  order: z.number().int(),
})

const SessionPlanTopicSchema = z.object({
  topicId: z.string(),
  title: z.string(),
  sectionTitle: z.string(),
  allocatedMinutes: z.number().int().min(30),
  subtasks: z.array(SubtaskPlanSchema).min(2).max(6),
})

const SessionPlanSchema = z.object({
  topics: z.array(SessionPlanTopicSchema).min(1).max(6),
})

export async function POST(req: NextRequest) {
  const { roadmapId, hours } = await req.json()
  if (!roadmapId || !hours) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const [roadmap] = await db.select().from(roadmaps).where(eq(roadmaps.id, roadmapId))
  if (!roadmap) return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })

  const phases = await db
    .select()
    .from(roadmapPhases)
    .where(eq(roadmapPhases.roadmapId, roadmapId))
    .orderBy(asc(roadmapPhases.order))

  type TopicEntry = {
    topicId: string
    title: string
    description: string | null
    progress: number
    resources: unknown
    sectionTitle: string
    phaseTitle: string
  }

  const allTopics: TopicEntry[] = []

  for (const phase of phases) {
    const sectionRows = await db
      .select()
      .from(sections)
      .where(eq(sections.phaseId, phase.id))
      .orderBy(asc(sections.order))

    for (const section of sectionRows) {
      const topicRows = await db
        .select()
        .from(topics)
        .where(eq(topics.sectionId, section.id))
        .orderBy(asc(topics.order))

      for (const topic of topicRows) {
        if (topic.progress < 100) {
          allTopics.push({
            topicId: topic.id,
            title: topic.title,
            description: topic.description,
            progress: topic.progress,
            resources: topic.resources,
            sectionTitle: section.title,
            phaseTitle: phase.title,
          })
        }
      }
    }
  }

  if (allTopics.length === 0) {
    return NextResponse.json({ error: 'All topics are complete' }, { status: 400 })
  }

  const totalMinutes = Math.round(hours * 60)

  const topicsText = allTopics
    .map((t) => {
      const resources = Array.isArray(t.resources)
        ? (t.resources as Array<{ title: string; url: string; type: string }>)
            .map((r) => `    - [${r.type}] ${r.title}: ${r.url}`)
            .join('\n')
        : '    (none)'
      return [
        `- [${t.topicId}] ${t.phaseTitle} / ${t.sectionTitle} / ${t.title} (progress: ${t.progress}%)`,
        t.description ? `  What it covers: ${t.description}` : '',
        `  Resources:\n${resources}`,
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const prompt = `You are a study session planner for the roadmap: "${roadmap.title}".

Available study time: ${hours} hours (${totalMinutes} minutes total)

Topics not yet complete (ordered by phase → section):
${topicsText}

Your job:
1. Select 1–4 topics to cover in this session
2. Allocate time: minimum 60 minutes per topic, in 30-minute increments (e.g. 60, 90, 120 min). Total must not exceed ${totalMinutes} minutes.
3. Prefer topics with lower progress % — prioritise 0% over 50%, 50% over 80%+
4. Balance across sections: prefer different subject domains (e.g. Math + Python together, not two Math topics unless time clearly allows or they are sequential)
5. Two topics from the same section are allowed when time permits or when topics are tightly sequential (e.g. Vectors → Matrices)
6. Pair foundational topics with applied ones when possible (theory + practice in same session)
7. For each topic, generate 3–5 concrete subtasks that describe exactly what to do during that time block
8. For each subtask, attach a resource from the topic's resource list when relevant (use title and url from the list above). Leave resourceTitle and resourceUrl null if no relevant resource exists.
9. Subtask descriptions must be specific actions, not vague goals. Good: "Watch the 3Blue1Brown linear algebra series episode on matrix multiplication (link in resources)". Bad: "Study linear algebra".

Return a JSON object matching the schema exactly.`

  try {
    const structured = sessionModel.withStructuredOutput(SessionPlanSchema)
    const plan = await structured.invoke([new HumanMessage(prompt)])
    return NextResponse.json(plan)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to plan session'
    return NextResponse.json({ error }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Manual smoke test**

With dev server running (`npm run dev`), open browser console and run:
```js
const res = await fetch('/api/sessions/plan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ roadmapId: '<any-roadmap-id-from-db>', hours: 2 }),
})
console.log(await res.json())
```

Expected: `{ topics: [...] }` with `allocatedMinutes`, `subtasks`, no `estimatedMinutes`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sessions/plan/route.ts
git commit -m "feat: rewrite session planning API with subtasks and cross-section balancing"
```

---

## Task 5: Session Planner UI + createSession Update

**Files:**
- Modify: `src/app/actions/session.ts`
- Modify: `src/app/sessions/session-planner.tsx`

**Interfaces:**
- Consumes: `/api/sessions/plan` response from Task 4
- Produces:
  - `createSession(roadmapId, plannedMinutes, topicPlans): Promise<string>` — saves session, session_topics with `allocatedMinutes`, and subtasks
  - Updated `session-planner.tsx` — shows subtasks inline, no `estimatedMinutes` label

- [ ] **Step 1: Update createSession action**

Replace `src/app/actions/session.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { sessions, sessionTopics, subtasks, topics } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { clampDelta } from '@/lib/progress'

type SubtaskInput = {
  description: string
  resourceTitle: string | null
  resourceUrl: string | null
  order: number
}

type TopicPlan = {
  topicId: string
  allocatedMinutes: number
  subtasks: SubtaskInput[]
}

export async function createSession(
  roadmapId: string,
  plannedMinutes: number,
  topicPlans: TopicPlan[]
) {
  const [session] = await db
    .insert(sessions)
    .values({ roadmapId, plannedMinutes })
    .returning({ id: sessions.id })

  for (const plan of topicPlans) {
    const [st] = await db
      .insert(sessionTopics)
      .values({
        sessionId: session.id,
        topicId: plan.topicId,
        allocatedMinutes: plan.allocatedMinutes,
      })
      .returning({ id: sessionTopics.id })

    if (plan.subtasks.length > 0) {
      await db.insert(subtasks).values(
        plan.subtasks.map((s) => ({
          sessionTopicId: st.id,
          description: s.description,
          resourceTitle: s.resourceTitle,
          resourceUrl: s.resourceUrl,
          order: s.order,
        }))
      )
    }
  }

  revalidatePath('/sessions')
  return session.id
}

export async function markTopicCovered(sessionTopicId: string, isCovered: boolean) {
  await db.update(sessionTopics).set({ isCovered }).where(eq(sessionTopics.id, sessionTopicId))
}

export async function markSubtaskDone(subtaskId: string, isDone: boolean) {
  await db.update(subtasks).set({ isDone }).where(eq(subtasks.id, subtaskId))
}

export async function saveSessionProgress(
  sessionId: string,
  deltas: Array<{ sessionTopicId: string; topicId: string; delta: number }>
) {
  for (const { sessionTopicId, topicId, delta } of deltas) {
    const [topic] = await db.select({ progress: topics.progress }).from(topics).where(eq(topics.id, topicId))
    if (!topic) continue

    const newProgress = clampDelta(topic.progress, delta)
    await db.update(topics).set({ progress: newProgress, isCompleted: newProgress >= 100 }).where(eq(topics.id, topicId))
    await db.update(sessionTopics).set({ progressDelta: delta }).where(eq(sessionTopics.id, sessionTopicId))
  }

  await db.update(sessions).set({ endedAt: new Date() }).where(eq(sessions.id, sessionId))
  revalidatePath('/sessions')
  revalidatePath('/roadmaps')
}

export async function endSession(id: string) {
  await db.update(sessions).set({ endedAt: new Date() }).where(eq(sessions.id, id))
  revalidatePath('/sessions')
}
```

- [ ] **Step 2: Update session planner UI**

Replace `src/app/sessions/session-planner.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createSession } from '@/app/actions/session'

type Subtask = {
  description: string
  resourceTitle: string | null
  resourceUrl: string | null
  order: number
}

type AiTopic = {
  topicId: string
  title: string
  sectionTitle: string
  allocatedMinutes: number
  subtasks: Subtask[]
}

type ManualTopic = { id: string; title: string; sectionTitle: string; isCompleted: boolean }
type Roadmap = { id: string; title: string }

export function SessionPlanner({ roadmaps }: { roadmaps: Roadmap[] }) {
  const router = useRouter()
  const [roadmapId, setRoadmapId] = useState(roadmaps[0]?.id ?? '')
  const [hours, setHours] = useState(2)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'ai' | 'manual' | null>(null)
  const [aiTopics, setAiTopics] = useState<AiTopic[]>([])
  const [manualTopics, setManualTopics] = useState<ManualTopic[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minutes = Math.round(hours * 60)

  async function planWithAI() {
    setLoading(true)
    setMode('ai')
    setError(null)
    setSelectedIds(new Set())
    try {
      const res = await fetch('/api/sessions/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roadmapId, hours }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiTopics(data.topics)
      setSelectedIds(new Set(data.topics.map((t: AiTopic) => t.topicId)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to plan session')
      setMode(null)
    } finally {
      setLoading(false)
    }
  }

  async function pickManually() {
    setLoading(true)
    setMode('manual')
    setError(null)
    setSelectedIds(new Set())
    try {
      const res = await fetch(`/api/sessions/topics?roadmapId=${roadmapId}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setManualTopics(data.topics)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load topics')
      setMode(null)
    } finally {
      setLoading(false)
    }
  }

  function toggleTopic(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function startSession() {
    setStarting(true)
    try {
      if (mode === 'ai') {
        const selected = aiTopics.filter((t) => selectedIds.has(t.topicId))
        const id = await createSession(
          roadmapId,
          minutes,
          selected.map((t) => ({
            topicId: t.topicId,
            allocatedMinutes: t.allocatedMinutes,
            subtasks: t.subtasks,
          }))
        )
        router.push(`/sessions/${id}`)
      } else {
        const id = await createSession(
          roadmapId,
          minutes,
          [...selectedIds].map((topicId) => ({ topicId, allocatedMinutes: 60, subtasks: [] }))
        )
        router.push(`/sessions/${id}`)
      }
    } catch {
      setStarting(false)
    }
  }

  if (roadmaps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No roadmaps yet. <a href="/roadmaps" className="underline">Create one first.</a>
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Plan your session</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Roadmap</label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={roadmapId}
                onChange={(e) => { setRoadmapId(e.target.value); setMode(null) }}
                disabled={loading}
              >
                {roadmaps.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Hours</label>
              <Input
                type="number" min={1} max={8} step={0.5}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-24"
                disabled={loading}
              />
            </div>
            <Button onClick={planWithAI} disabled={loading || !roadmapId}>
              {loading && mode === 'ai' ? 'Planning…' : 'Plan with AI'}
            </Button>
            <Button variant="outline" onClick={pickManually} disabled={loading || !roadmapId}>
              {loading && mode === 'manual' ? 'Loading…' : 'Pick manually'}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {mode === 'ai' && !loading && aiTopics.length > 0 && (
        <div className="space-y-3">
          {aiTopics.map((t) => (
            <Card key={t.topicId}>
              <CardContent className="p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedIds.has(t.topicId)}
                    onChange={() => toggleTopic(t.topicId)}
                  />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.sectionTitle} · {Math.round(t.allocatedMinutes / 60 * 10) / 10}h</p>
                  </div>
                </label>
                <ul className="space-y-2 pl-6">
                  {t.subtasks.map((s, i) => (
                    <li key={i} className="text-xs text-muted-foreground space-y-0.5">
                      <p>{s.description}</p>
                      {s.resourceUrl && (
                        <a href={s.resourceUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs underline text-foreground/70 hover:text-foreground">
                          {s.resourceTitle ?? s.resourceUrl}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mode === 'manual' && !loading && (
        <Card>
          <CardHeader><CardTitle>Select topics</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {manualTopics.map((t) => (
              <label key={t.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.has(t.id)}
                  onChange={() => toggleTopic(t.id)}
                />
                <span className={`text-sm ${t.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                  {t.sectionTitle} / {t.title}
                </span>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {mode && !loading && selectedIds.size > 0 && (
        <Button onClick={startSession} disabled={starting}>
          {starting ? 'Starting…' : `Start session (${selectedIds.size} topic${selectedIds.size > 1 ? 's' : ''})`}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update /api/sessions/topics route to return sectionTitle**

Open `src/app/api/sessions/topics/route.ts`. Update the query to join through sections to get `sectionTitle`. If it currently returns `phase`, replace with `sectionTitle`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { topics, sections, roadmapPhases } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const roadmapId = req.nextUrl.searchParams.get('roadmapId')
  if (!roadmapId) return NextResponse.json({ error: 'Missing roadmapId' }, { status: 400 })

  const phases = await db
    .select()
    .from(roadmapPhases)
    .where(eq(roadmapPhases.roadmapId, roadmapId))

  const result = []
  for (const phase of phases) {
    const sectionRows = await db
      .select()
      .from(sections)
      .where(eq(sections.phaseId, phase.id))
      .orderBy(asc(sections.order))

    for (const section of sectionRows) {
      const topicRows = await db
        .select()
        .from(topics)
        .where(eq(topics.sectionId, section.id))
        .orderBy(asc(topics.order))

      for (const topic of topicRows) {
        result.push({
          id: topic.id,
          title: topic.title,
          sectionTitle: section.title,
          isCompleted: topic.isCompleted,
        })
      }
    }
  }

  return NextResponse.json({ topics: result })
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/session.ts src/app/sessions/session-planner.tsx src/app/api/sessions/topics/route.ts
git commit -m "feat: session planner shows subtasks inline; createSession saves subtasks"
```

---

## Task 6: Session View with Subtask Checkboxes

**Files:**
- Modify: `src/app/sessions/[id]/page.tsx`
- Modify: `src/app/sessions/[id]/session-topics.tsx`

**Interfaces:**
- Consumes: `markSubtaskDone` from `@/app/actions/session` (Task 5); `subtasks` table (Task 1)
- Produces: session view shows subtask checkboxes per topic; checking a subtask writes `isDone` immediately

- [ ] **Step 1: Update session page query to include subtasks**

Replace `src/app/sessions/[id]/page.tsx`:
```tsx
export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { sessions, sessionTopics, topics, roadmaps, subtasks, sections } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { PomodoroTimer } from './pomodoro'
import { MusicPlayer } from './music-player'
import { SessionTopics } from './session-topics'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [session] = await db.select().from(sessions).where(eq(sessions.id, id))
  if (!session) notFound()

  const [roadmap] = await db.select().from(roadmaps).where(eq(roadmaps.id, session.roadmapId))

  const sessionTopicRows = await db
    .select({
      id: sessionTopics.id,
      topicId: topics.id,
      title: topics.title,
      sectionTitle: sections.title,
      isCovered: sessionTopics.isCovered,
      allocatedMinutes: sessionTopics.allocatedMinutes,
    })
    .from(sessionTopics)
    .innerJoin(topics, eq(topics.id, sessionTopics.topicId))
    .innerJoin(sections, eq(sections.id, topics.sectionId))
    .where(eq(sessionTopics.sessionId, id))

  const subtaskRows = await db
    .select()
    .from(subtasks)
    .where(
      eq(
        subtasks.sessionTopicId,
        // fetch for all session topic ids
        sessionTopicRows.length > 0 ? sessionTopicRows[0].id : ''
      )
    )

  // Fetch subtasks for all session topics
  const allSubtasks = await Promise.all(
    sessionTopicRows.map(async (st) => {
      const rows = await db
        .select()
        .from(subtasks)
        .where(eq(subtasks.sessionTopicId, st.id))
      return { sessionTopicId: st.id, subtasks: rows }
    })
  )

  const subtasksBySessionTopic = Object.fromEntries(
    allSubtasks.map(({ sessionTopicId, subtasks }) => [sessionTopicId, subtasks])
  )

  const enrichedTopics = sessionTopicRows.map((st) => ({
    ...st,
    subtasks: subtasksBySessionTopic[st.id] ?? [],
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Study session</h1>
        <p className="text-muted-foreground">
          {roadmap?.title} &mdash; {session.plannedMinutes} min planned
          {session.endedAt && ' · Ended'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PomodoroTimer />
        <MusicPlayer />
      </div>

      <SessionTopics
        sessionId={id}
        topics={enrichedTopics}
        ended={!!session.endedAt}
      />
    </div>
  )
}
```

- [ ] **Step 2: Update session-topics component**

Replace `src/app/sessions/[id]/session-topics.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { markTopicCovered, markSubtaskDone } from '@/app/actions/session'

type Subtask = {
  id: string
  description: string
  isDone: boolean
  resourceTitle: string | null
  resourceUrl: string | null
  order: number
}

type SessionTopic = {
  id: string
  topicId: string
  title: string
  sectionTitle: string
  isCovered: boolean
  allocatedMinutes: number
  subtasks: Subtask[]
}

export function SessionTopics({
  sessionId,
  topics,
  ended,
}: {
  sessionId: string
  topics: SessionTopic[]
  ended: boolean
}) {
  const router = useRouter()
  const [covered, setCovered] = useState<Record<string, boolean>>(
    Object.fromEntries(topics.map((t) => [t.id, t.isCovered]))
  )
  const [done, setDone] = useState<Record<string, boolean>>(
    Object.fromEntries(topics.flatMap((t) => t.subtasks.map((s) => [s.id, s.isDone])))
  )
  const [ending, setEnding] = useState(false)

  async function toggleCovered(id: string) {
    const next = !covered[id]
    setCovered((prev) => ({ ...prev, [id]: next }))
    await markTopicCovered(id, next)
  }

  async function toggleSubtask(id: string) {
    const next = !done[id]
    setDone((prev) => ({ ...prev, [id]: next }))
    await markSubtaskDone(id, next)
  }

  function handleEnd() {
    setEnding(true)
    router.push(`/sessions/${sessionId}/end`)
  }

  const coveredCount = Object.values(covered).filter(Boolean).length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Topics</span>
            <span className="text-sm font-normal text-muted-foreground">
              {coveredCount}/{topics.length} covered
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {topics.map((t) => {
            const doneCount = t.subtasks.filter((s) => done[s.id]).length
            return (
              <div key={t.id} className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={covered[t.id] ?? false}
                    onChange={() => toggleCovered(t.id)}
                    disabled={ended}
                  />
                  <div className="space-y-0.5">
                    <p className={`text-sm font-medium ${covered[t.id] ? 'line-through text-muted-foreground' : ''}`}>
                      {t.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.sectionTitle} · {Math.round(t.allocatedMinutes / 60 * 10) / 10}h
                      {t.subtasks.length > 0 && ` · ${doneCount}/${t.subtasks.length} subtasks`}
                    </p>
                  </div>
                </label>

                {t.subtasks.length > 0 && (
                  <ul className="space-y-2 pl-6">
                    {t.subtasks
                      .sort((a, b) => a.order - b.order)
                      .map((s) => (
                        <li key={s.id} className="space-y-0.5">
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5 shrink-0"
                              checked={done[s.id] ?? false}
                              onChange={() => toggleSubtask(s.id)}
                              disabled={ended}
                            />
                            <p className={`text-xs ${done[s.id] ? 'line-through text-muted-foreground' : 'text-muted-foreground'}`}>
                              {s.description}
                            </p>
                          </label>
                          {s.resourceUrl && (
                            <a
                              href={s.resourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pl-5 text-xs underline text-foreground/60 hover:text-foreground"
                            >
                              {s.resourceTitle ?? s.resourceUrl}
                            </a>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {!ended && (
        <Button variant="outline" onClick={handleEnd} disabled={ending}>
          {ending ? 'Going to summary…' : 'End session'}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/sessions/[id]/page.tsx src/app/sessions/[id]/session-topics.tsx
git commit -m "feat: session view shows subtask checkboxes with live check-off"
```

---

## Task 7: Post-Session Progress (End Route + Override UI)

**Files:**
- Create: `src/app/api/sessions/end/route.ts`
- Create: `src/app/sessions/[id]/end/page.tsx`

**Interfaces:**
- Consumes: `saveSessionProgress` from `@/app/actions/session` (Task 5); `sessionModel` from `@/lib/ai`; `clampDelta` from `@/lib/progress`
- Produces:
  - `POST /api/sessions/end` — accepts `{ sessionId }`, returns `{ deltas: [{ sessionTopicId, topicId, topicTitle, currentProgress, suggestedDelta }] }`
  - `/sessions/[id]/end` — override page: shows AI deltas, editable inputs, confirm button

- [ ] **Step 1: Create end session API route**

Create `src/app/api/sessions/end/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { HumanMessage } from '@langchain/core/messages'
import { sessionModel } from '@/lib/ai'
import { db } from '@/lib/db'
import { sessions, sessionTopics, topics, subtasks } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export const runtime = 'nodejs'

const DeltaSchema = z.object({
  deltas: z.array(
    z.object({
      topicId: z.string(),
      progressDelta: z.number().int().min(0).max(100),
    })
  ),
})

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json()
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId))
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const sessionTopicRows = await db
    .select({
      id: sessionTopics.id,
      topicId: sessionTopics.topicId,
      isCovered: sessionTopics.isCovered,
    })
    .from(sessionTopics)
    .where(eq(sessionTopics.sessionId, sessionId))

  const topicData = await Promise.all(
    sessionTopicRows.map(async (st) => {
      const [topic] = await db
        .select({ title: topics.title, progress: topics.progress })
        .from(topics)
        .where(eq(topics.id, st.topicId))

      const subtaskRows = await db
        .select({ isDone: subtasks.isDone, description: subtasks.description })
        .from(subtasks)
        .where(eq(subtasks.sessionTopicId, st.id))

      const doneCount = subtaskRows.filter((s) => s.isDone).length
      const totalCount = subtaskRows.length

      return {
        sessionTopicId: st.id,
        topicId: st.topicId,
        topicTitle: topic?.title ?? 'Unknown',
        currentProgress: topic?.progress ?? 0,
        isCovered: st.isCovered,
        doneSubtasks: doneCount,
        totalSubtasks: totalCount,
        subtaskDescriptions: subtaskRows.map((s) => `[${s.isDone ? 'done' : 'skipped'}] ${s.description}`),
      }
    })
  )

  const prompt = `You are calculating study progress for a session.

For each topic below, output a progressDelta (integer 0–100) representing how much progress was made.
The delta will be added to the current progress and capped at 100.

Rules:
- If the topic is covered and most subtasks are done (≥70%): delta = 25–40
- If the topic is covered and some subtasks done (30–70%): delta = 10–25
- If the topic is covered but few subtasks done (<30%): delta = 5–15
- If the topic was not marked covered: delta = 0–10 based on subtask completion
- Never return a delta that would push progress past 100 (the caller caps it, but keep it reasonable)

Topics:
${topicData
  .map(
    (t) => `- topicId: ${t.topicId}
  Title: ${t.topicTitle}
  Current progress: ${t.currentProgress}%
  Covered: ${t.isCovered}
  Subtasks: ${t.doneSubtasks}/${t.totalSubtasks} done
  ${t.subtaskDescriptions.join('; ')}`
  )
  .join('\n\n')}`

  try {
    const structured = sessionModel.withStructuredOutput(DeltaSchema)
    const result = await structured.invoke([new HumanMessage(prompt)])

    const deltas = topicData.map((t) => {
      const aiDelta = result.deltas.find((d) => d.topicId === t.topicId)
      return {
        sessionTopicId: t.sessionTopicId,
        topicId: t.topicId,
        topicTitle: t.topicTitle,
        currentProgress: t.currentProgress,
        suggestedDelta: aiDelta?.progressDelta ?? 0,
      }
    })

    return NextResponse.json({ deltas })
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to calculate progress'
    return NextResponse.json({ error }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create end session page**

Create `src/app/sessions/[id]/end/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { saveSessionProgress } from '@/app/actions/session'

type Delta = {
  sessionTopicId: string
  topicId: string
  topicTitle: string
  currentProgress: number
  suggestedDelta: number
}

export default function EndSessionPage({ params }: { params: { id: string } }) {
  const sessionId = params.id
  const router = useRouter()
  const [deltas, setDeltas] = useState<Delta[]>([])
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/sessions/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setDeltas(data.deltas)
        setOverrides(
          Object.fromEntries(data.deltas.map((d: Delta) => [d.sessionTopicId, d.suggestedDelta]))
        )
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  async function handleConfirm() {
    setSaving(true)
    try {
      await saveSessionProgress(
        sessionId,
        deltas.map((d) => ({
          sessionTopicId: d.sessionTopicId,
          topicId: d.topicId,
          delta: overrides[d.sessionTopicId] ?? d.suggestedDelta,
        }))
      )
      router.push('/sessions')
    } catch {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Calculating progress…</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Session summary</h1>
        <p className="text-muted-foreground">Review and adjust progress before saving.</p>
      </div>

      <div className="space-y-3">
        {deltas.map((d) => {
          const override = overrides[d.sessionTopicId] ?? d.suggestedDelta
          const newProgress = Math.min(100, d.currentProgress + override)
          return (
            <Card key={d.sessionTopicId}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium">{d.topicTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.currentProgress}% → {newProgress}%
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground shrink-0">Progress gained</label>
                  <Input
                    type="number"
                    min={0}
                    max={100 - d.currentProgress}
                    value={override}
                    onChange={(e) =>
                      setOverrides((prev) => ({
                        ...prev,
                        [d.sessionTopicId]: Math.max(0, Math.min(100 - d.currentProgress, Number(e.target.value))),
                      }))
                    }
                    className="w-20 h-7 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground transition-all"
                    style={{ width: `${newProgress}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Button onClick={handleConfirm} disabled={saving}>
        {saving ? 'Saving…' : 'Confirm & save progress'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: PASS — 7 tests (from Task 1)

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: End-to-end manual test**

1. Start dev server: `npm run dev`
2. Create or use an existing roadmap — verify phase pills and section cards appear
3. Plan a session with AI (2 hours) — verify no `estimatedMinutes` shown, subtasks visible
4. Start the session — verify subtask checkboxes appear under each topic
5. Check a few subtasks, mark a topic covered, click "End session"
6. Verify redirect to `/sessions/[id]/end` with AI-suggested deltas pre-filled
7. Adjust one delta manually, click "Confirm & save progress"
8. Verify redirect to `/sessions`, then check roadmap page — section progress bars updated

- [ ] **Step 6: Commit**

```bash
git add src/app/api/sessions/end/ src/app/sessions/
git commit -m "feat: post-session progress with AI delta calculation and manual override"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Phase pills (pill tabs at top of roadmap page) — Task 3
- ✅ Section cards with progress — Task 3
- ✅ Section detail page with topic progress bars — Task 3
- ✅ `roadmap_phases`, `sections`, `subtasks` tables — Task 1
- ✅ `topics.progress` 0–100 — Task 1
- ✅ `session_topics.allocated_minutes`, `progress_delta` — Task 1
- ✅ Roadmap agent outputs sections — Task 2
- ✅ `saveRoadmap` writes phases → sections → topics — Task 2
- ✅ Import route prompt updated — Task 2
- ✅ Session planning API rewrite with subtasks — Task 4
- ✅ `estimatedMinutes` removed from UI — Task 5
- ✅ Cross-section balancing in AI prompt — Task 4
- ✅ Same-section pairs allowed when appropriate — Task 4
- ✅ Min 1h per topic, time-block allocation — Task 4
- ✅ Resources from existing topic data — Task 4
- ✅ `createSession` saves subtasks — Task 5
- ✅ Subtask checkboxes in session view — Task 6
- ✅ `/api/sessions/end` AI delta calculation — Task 7
- ✅ Hybrid override UI — Task 7
- ✅ `saveSessionProgress` writes `topics.progress` and `session_topics.progress_delta` — Task 5
- ✅ Progress cap at 100 via `clampDelta` — Task 1
- ✅ Data backfill for existing topics — Task 1
- ✅ Section progress = avg of topics, phase progress = avg of sections — Task 3

**Type consistency check:**
- `createSession` signature in actions matches usage in session-planner ✅
- `saveSessionProgress` signature matches end page usage ✅
- `SubtaskInput` type in session.ts matches what session-planner passes ✅
- `calcSectionProgress` and `clampDelta` exported from `@/lib/progress`, imported consistently ✅
- `SessionPlanSchema` in plan route matches `AiTopic` type in session-planner ✅
