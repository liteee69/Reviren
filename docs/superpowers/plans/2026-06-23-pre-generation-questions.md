# Pre-generation Questions Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before roadmap generation, run a short conversational Q&A (3–5 domain-adaptive questions + optional follow-up) that collects user context (goal type, prior knowledge, time budget, specific topics, source URLs) and injects it into the `formatOutput` prompt so the roadmap is personalised.

**Architecture:** A new `/api/roadmap/questions` endpoint calls `roadmapModel` (Gemini 3.1 Pro) to generate domain-adaptive questions; a `/api/roadmap/questions/followup` endpoint decides if one follow-up is needed. Collected Q&A is serialised into a context string that flows through the existing `runRoadmapAgent(topic, context)` into the `formatOutput` node's prompt. The `create-roadmap.tsx` component gains two new states: `questioning` and `followup`, rendered as a chat-like exchange (AI message bubble → user textarea).

**Tech stack:** Next.js App Router API routes, LangChain `roadmapModel` (Gemini 3.1 Pro) with `.withStructuredOutput(zodSchema)`, Zod, React state machine in `create-roadmap.tsx`, vitest for unit tests.

## Global Constraints

- Node.js runtime (`export const runtime = 'nodejs'`) on all API routes.
- `roadmapModel` from `@/lib/ai` for all new LLM calls (Gemini 3.1 Pro — domain classification is critical quality work).
- Zod structured output for both new endpoints — no free-text JSON parsing.
- No new DB tables or schema changes — context is ephemeral (lives in component state, passed to generate route, injected into prompt).
- Follow existing import style and file conventions from the codebase.

---

### Task 1: Context helper + types + tests

**Files:**
- Create: `src/lib/agent/roadmap-context.ts`
- Create: `src/lib/agent/roadmap-context.test.ts`

**Interfaces:**
- Produces: `formatContext(questions: string[], answers: string, followUp?: string | null, followUpAnswer?: string): string` — used by Task 5 (UI) when calling the generate route.

- [ ] **Step 1: Write the failing test**

Create `src/lib/agent/roadmap-context.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatContext } from './roadmap-context'

describe('formatContext', () => {
  it('formats questions and answers into a context block', () => {
    const result = formatContext(
      ["What's your goal?", "Rate your knowledge 0–3.", "How much time do you have?"],
      "Career switch. About 1/10. 2 hours/day for 3 months.",
    )
    expect(result).toContain("What's your goal?")
    expect(result).toContain("Career switch.")
    expect(result).toContain("Rate your knowledge")
    expect(result).not.toContain("Follow-up")
  })

  it('includes follow-up exchange when provided', () => {
    const result = formatContext(
      ["What's your goal?"],
      "Exam prep.",
      "Which specific exam are you preparing for?",
      "GATE 2026",
    )
    expect(result).toContain("Which specific exam")
    expect(result).toContain("GATE 2026")
  })

  it('omits follow-up block when followUp is null', () => {
    const result = formatContext(["What's your goal?"], "Hobby project.", null)
    expect(result).not.toContain("Follow-up")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/kudr/dev/Reviren && npx vitest run src/lib/agent/roadmap-context.test.ts
```

Expected: FAIL — `Cannot find module './roadmap-context'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/agent/roadmap-context.ts`:

```typescript
export function formatContext(
  questions: string[],
  answers: string,
  followUp?: string | null,
  followUpAnswer?: string,
): string {
  const lines: string[] = [
    '## User context (personalise the roadmap to match this)',
    '',
    'Questions asked:',
    ...questions.map((q, i) => `${i + 1}. ${q}`),
    '',
    "User's answers:",
    answers,
  ]

  if (followUp && followUpAnswer) {
    lines.push('', 'Follow-up question:', followUp, '', "User's follow-up answer:", followUpAnswer)
  }

  return lines.join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/kudr/dev/Reviren && npx vitest run src/lib/agent/roadmap-context.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/roadmap-context.ts src/lib/agent/roadmap-context.test.ts
git commit -m "feat: add formatContext helper for roadmap Q&A context"
```

---

### Task 2: Questions API route

**Files:**
- Create: `src/app/api/roadmap/questions/route.ts`

**Interfaces:**
- Consumes: `roadmapModel` from `@/lib/ai`
- Input: `POST { topic: string }`
- Output: `{ questions: string[] }` (3–5 strings)

- [ ] **Step 1: Create the route**

Create `src/app/api/roadmap/questions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { roadmapModel } from '@/lib/ai'
import { HumanMessage } from '@langchain/core/messages'

export const runtime = 'nodejs'

const QuestionsSchema = z.object({
  questions: z.array(z.string()).min(3).max(5),
})

const QUESTIONS_PROMPT = (topic: string) => `You are personalising a learning roadmap for: "${topic}".

Ask 3–5 high-leverage questions. Always include:
1. Goal type — exam prep / career switch / hobby / university prep / professional upskilling
2. Prior knowledge — self-rate 0–3 per relevant sub-area of "${topic}"
3. Time budget — hours per day and total weeks available

Add these only when domain-appropriate:
- STEM/Engineering: "Do you have any hardware available?" or "Which specific framework or language are you targeting?"
- Law: "Which jurisdiction are you studying?" or "Are you preparing for a specific exam (bar, LSAT)?"
- Biology/Chemistry: "Do you have lab access, or is this purely theoretical?"
- Language learning: "What is your current level and your target use case (travel, business, fluency)?"
- Any domain: "Are there specific topics you want included?" and/or "Do you have URLs or resources you want the roadmap to reference?"

Keep each question short and conversational — one sentence, no sub-bullets.

Return JSON matching exactly: { "questions": ["...", "...", "..."] }`

export async function POST(req: NextRequest) {
  const body = await req.json()
  const topic = typeof body?.topic === 'string' ? body.topic.trim() : ''

  if (!topic) {
    return NextResponse.json({ error: 'Missing topic' }, { status: 400 })
  }

  const structured = roadmapModel.withStructuredOutput(QuestionsSchema)
  const result = await structured.invoke([new HumanMessage(QUESTIONS_PROMPT(topic))])

  return NextResponse.json({ questions: result.questions })
}
```

- [ ] **Step 2: Verify the route works manually**

Start dev server (`npm run dev`) and run:

```bash
curl -X POST http://localhost:3000/api/roadmap/questions \
  -H "Content-Type: application/json" \
  -d '{"topic": "robotics"}' | jq .
```

Expected: `{ "questions": ["...", "...", "..."] }` — 3 to 5 domain-appropriate strings.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/roadmap/questions/route.ts
git commit -m "feat: add /api/roadmap/questions endpoint for pre-generation Q&A"
```

---

### Task 3: Follow-up API route

**Files:**
- Create: `src/app/api/roadmap/questions/followup/route.ts`

**Interfaces:**
- Consumes: `roadmapModel` from `@/lib/ai`
- Input: `POST { topic: string, questions: string[], answers: string }`
- Output: `{ followUp: string | null }`

- [ ] **Step 1: Create the route**

Create `src/app/api/roadmap/questions/followup/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { roadmapModel } from '@/lib/ai'
import { HumanMessage } from '@langchain/core/messages'

export const runtime = 'nodejs'

const FollowUpSchema = z.object({
  followUp: z.string().nullable(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const topic = typeof body?.topic === 'string' ? body.topic.trim() : ''
  const questions: string[] = Array.isArray(body?.questions) ? body.questions : []
  const answers = typeof body?.answers === 'string' ? body.answers.trim() : ''

  if (!topic || questions.length === 0 || !answers) {
    return NextResponse.json({ error: 'Missing topic, questions, or answers' }, { status: 400 })
  }

  const prompt = `A user is creating a learning roadmap for: "${topic}".

Questions asked:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

User's answers:
${answers}

Decide: does any answer open a meaningful branch that warrants ONE targeted follow-up question?

Good follow-up triggers:
- "exam prep" → ask which specific exam
- "career switch" → ask which role or company type
- "university prep" → ask which course or programme
- A vague or multi-part answer that needs one clarification

Return { "followUp": "..." } if a follow-up is warranted, or { "followUp": null } if answers are clear enough.
One follow-up only — never more. Keep it short and conversational.`

  const structured = roadmapModel.withStructuredOutput(FollowUpSchema)
  const result = await structured.invoke([new HumanMessage(prompt)])

  return NextResponse.json({ followUp: result.followUp })
}
```

- [ ] **Step 2: Verify the route works manually**

With dev server running:

```bash
curl -X POST http://localhost:3000/api/roadmap/questions/followup \
  -H "Content-Type: application/json" \
  -d '{"topic":"robotics","questions":["What is your goal?"],"answers":"exam prep"}' | jq .
```

Expected: `{ "followUp": "Which specific exam are you preparing for?" }` (or similar)

```bash
curl -X POST http://localhost:3000/api/roadmap/questions/followup \
  -H "Content-Type: application/json" \
  -d '{"topic":"robotics","questions":["What is your goal?"],"answers":"hobby project, just curious, no specific exam"}' | jq .
```

Expected: `{ "followUp": null }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/roadmap/questions/followup/route.ts
git commit -m "feat: add /api/roadmap/questions/followup endpoint"
```

---

### Task 4: Roadmap agent — context injection

**Files:**
- Modify: `src/lib/agent/roadmap-agent.ts`
- Modify: `src/app/api/roadmap/generate/route.ts`

**Interfaces:**
- `runRoadmapAgent(topic: string, context?: string): AsyncGenerator` — signature change; `context` defaults to `''`.

- [ ] **Step 1: Add `context` to the agent state and formatOutput prompt**

In `src/lib/agent/roadmap-agent.ts`, make these three changes:

**Change 1** — add `context` field to `State` (after `topic`):

```typescript
const State = Annotation.Root({
  topic: Annotation<string>,
  context: Annotation<string>,
  topicSearchResults: Annotation<string>,
  domains: Annotation<string[]>,
  theoryCandidates: Annotation<SearchResult[]>,
  practiceCandidates: Annotation<SearchResult[]>,
  verifiedResources: Annotation<string>,
  roadmap: Annotation<RoadmapOutput | null>,
})
```

**Change 2** — in `formatOutput`, inject context into the prompt. Replace the opening line of the prompt string:

Before:
```typescript
const prompt = `You are a learning roadmap expert. Based on the research below, create a detailed, opinionated learning roadmap for: "${state.topic}".`
```

After:
```typescript
const prompt = `You are a learning roadmap expert. Based on the research below, create a detailed, opinionated learning roadmap for: "${state.topic}".${state.context ? `\n\n${state.context}` : ''}`
```

**Change 3** — update `runRoadmapAgent` signature and initial state:

Before:
```typescript
export async function* runRoadmapAgent(topic: string) {
  let roadmap: RoadmapOutput | null = null

  const stream = graph.streamEvents(
    { topic, topicSearchResults: '', domains: [], theoryCandidates: [], practiceCandidates: [], verifiedResources: '', roadmap: null },
```

After:
```typescript
export async function* runRoadmapAgent(topic: string, context = '') {
  let roadmap: RoadmapOutput | null = null

  const stream = graph.streamEvents(
    { topic, context, topicSearchResults: '', domains: [], theoryCandidates: [], practiceCandidates: [], verifiedResources: '', roadmap: null },
```

- [ ] **Step 2: Pass context through the generate route**

In `src/app/api/roadmap/generate/route.ts`, update the body parsing and the agent call:

Before:
```typescript
const { topic } = await req.json()

if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
  return new Response('Missing topic', { status: 400 })
}
```

After:
```typescript
const { topic, context } = await req.json()

if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
  return new Response('Missing topic', { status: 400 })
}
const ctx = typeof context === 'string' ? context : ''
```

And update the agent call:

Before:
```typescript
for await (const event of runRoadmapAgent(topic.trim())) {
```

After:
```typescript
for await (const event of runRoadmapAgent(topic.trim(), ctx)) {
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd /Users/kudr/dev/Reviren && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent/roadmap-agent.ts src/app/api/roadmap/generate/route.ts
git commit -m "feat: inject user context into roadmap agent formatOutput prompt"
```

---

### Task 5: Create-roadmap UI — questioning and follow-up states

**Files:**
- Modify: `src/app/roadmaps/create-roadmap.tsx`

**Interfaces:**
- Consumes: `formatContext` from `@/lib/agent/roadmap-context`
- Consumes: `POST /api/roadmap/questions` → `{ questions: string[] }`
- Consumes: `POST /api/roadmap/questions/followup` → `{ followUp: string | null }`
- Consumes: `POST /api/roadmap/generate` with added `context` field

New state shape in the component:

```typescript
type Status = 'idle' | 'questioning' | 'followup' | 'generating' | 'importing' | 'done' | 'error'
```

New state variables to add alongside existing ones:
```typescript
const [questions, setQuestions] = useState<string[]>([])
const [answers, setAnswers] = useState('')
const [followUp, setFollowUp] = useState<string | null>(null)
const [followUpAnswer, setFollowUpAnswer] = useState('')
const [fetchingQuestions, setFetchingQuestions] = useState(false)
```

- [ ] **Step 1: Add new state variables and update Status type**

In `src/app/roadmaps/create-roadmap.tsx`, replace:

```typescript
type Status = 'idle' | 'generating' | 'importing' | 'done' | 'error'
```

With:

```typescript
type Status = 'idle' | 'questioning' | 'followup' | 'generating' | 'importing' | 'done' | 'error'
```

And add after `const [saving, setSaving] = useState(false)`:

```typescript
const [questions, setQuestions] = useState<string[]>([])
const [answers, setAnswers] = useState('')
const [followUp, setFollowUp] = useState<string | null>(null)
const [followUpAnswer, setFollowUpAnswer] = useState('')
const [fetchingQuestions, setFetchingQuestions] = useState(false)
```

- [ ] **Step 2: Add `startQuestioning` function**

Add this function after `switchMode`:

```typescript
async function startQuestioning() {
  if (!topic.trim()) return
  setFetchingQuestions(true)
  setStatus('idle')
  setError('')
  try {
    const res = await fetch('/api/roadmap/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to load questions')
    setQuestions(data.questions)
    setAnswers('')
    setStatus('questioning')
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Something went wrong')
  } finally {
    setFetchingQuestions(false)
  }
}
```

- [ ] **Step 3: Add `submitAnswers` function**

Add this function after `startQuestioning`:

```typescript
async function submitAnswers() {
  if (!answers.trim()) return
  setFetchingQuestions(true)
  try {
    const res = await fetch('/api/roadmap/questions/followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, questions, answers }),
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error ?? 'Failed')
    if (data.followUp) {
      setFollowUp(data.followUp)
      setFollowUpAnswer('')
      setStatus('followup')
    } else {
      setFollowUp(null)
      setStatus('followup') // no follow-up, but advance to show Generate button
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Something went wrong')
  } finally {
    setFetchingQuestions(false)
  }
}
```

- [ ] **Step 4: Update `generate` function to accept and pass context**

Replace the `generate` function's fetch call body line:

Before:
```typescript
body: JSON.stringify({ topic }),
```

After — import `formatContext` at the top of the file first:
```typescript
import { formatContext } from '@/lib/agent/roadmap-context'
```

Then update the generate function to build context before fetching. Replace:

```typescript
async function generate() {
  if (!topic.trim()) return
  setStatus('generating')
  setCompletedSteps([])
  setRoadmap(null)
  setError('')
  setCurrentLabel(STEPS[0].label)

  try {
    const res = await fetch('/api/roadmap/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    })
```

With:

```typescript
async function generate() {
  if (!topic.trim()) return
  setStatus('generating')
  setCompletedSteps([])
  setRoadmap(null)
  setError('')
  setCurrentLabel(STEPS[0].label)

  const context = questions.length > 0
    ? formatContext(questions, answers, followUp, followUpAnswer || undefined)
    : ''

  try {
    const res = await fetch('/api/roadmap/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, context }),
    })
```

- [ ] **Step 5: Update the `busy` flag and Generate button to use `startQuestioning`**

Replace:

```typescript
const busy = status === 'generating' || status === 'importing'
```

With:

```typescript
const busy = status === 'generating' || status === 'importing' || fetchingQuestions
```

In the JSX, replace the Generate mode input section:

```tsx
{mode === 'generate' ? (
  <div className="flex gap-2">
    <Input
      placeholder="e.g. robotics, distributed systems…"
      value={topic}
      onChange={e => setTopic(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && !busy && generate()}
      disabled={busy}
    />
    <Button onClick={generate} disabled={busy || !topic.trim()}>
      {status === 'generating' ? 'Generating…' : 'Generate'}
    </Button>
  </div>
```

With:

```tsx
{mode === 'generate' ? (
  <div className="flex gap-2">
    <Input
      placeholder="e.g. robotics, distributed systems…"
      value={topic}
      onChange={e => setTopic(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && !busy && status === 'idle' && startQuestioning()}
      disabled={busy || status !== 'idle'}
    />
    <Button
      onClick={startQuestioning}
      disabled={busy || !topic.trim() || status !== 'idle'}
    >
      {fetchingQuestions ? 'Loading…' : 'Generate'}
    </Button>
  </div>
```

- [ ] **Step 6: Add questioning and followup UI below the card**

After the closing `</Card>` tag and before the `{status === 'generating' && (` block, add:

```tsx
{(status === 'questioning' || status === 'followup') && (
  <div className="space-y-4">
    {/* AI message bubble */}
    <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm space-y-2">
      <p className="text-muted-foreground font-medium text-xs uppercase tracking-wide">Before generating</p>
      <ol className="space-y-1 list-decimal list-inside">
        {questions.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ol>
    </div>

    {/* User answer — only editable in questioning state */}
    <textarea
      placeholder="Type your answers here…"
      value={answers}
      onChange={e => setAnswers(e.target.value)}
      disabled={status !== 'questioning' || fetchingQuestions}
      rows={4}
      className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground resize-none disabled:opacity-50"
    />

    {status === 'questioning' && (
      <Button
        onClick={submitAnswers}
        disabled={!answers.trim() || fetchingQuestions}
      >
        {fetchingQuestions ? 'Checking…' : 'Next →'}
      </Button>
    )}

    {/* Follow-up exchange */}
    {status === 'followup' && followUp && (
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <p className="text-muted-foreground font-medium text-xs uppercase tracking-wide mb-2">One more thing</p>
          <p>{followUp}</p>
        </div>
        <textarea
          placeholder="Your answer…"
          value={followUpAnswer}
          onChange={e => setFollowUpAnswer(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground resize-none"
        />
        <Button onClick={generate} disabled={!followUpAnswer.trim()}>
          Generate Roadmap
        </Button>
      </div>
    )}

    {status === 'followup' && !followUp && (
      <Button onClick={generate}>Generate Roadmap</Button>
    )}
  </div>
)}
```

- [ ] **Step 7: Reset questioning state in `switchMode`**

Add resets inside `switchMode`:

```typescript
function switchMode(next: Mode) {
  setMode(next)
  setStatus('idle')
  setRoadmap(null)
  setError('')
  setQuestions([])
  setAnswers('')
  setFollowUp(null)
  setFollowUpAnswer('')
}
```

- [ ] **Step 8: Verify TypeScript and test the full flow in the browser**

```bash
cd /Users/kudr/dev/Reviren && npx tsc --noEmit
```

Expected: no errors.

Open `http://localhost:3000/roadmaps` → "Create a roadmap" → type "robotics" → click Generate.

Verify:
1. Questions appear in the muted bubble — 3–5 domain-appropriate questions.
2. Textarea is editable; "Next →" is disabled until text is entered.
3. After clicking "Next →", either a follow-up question appears or "Generate Roadmap" button appears.
4. If follow-up: fill in the answer → "Generate Roadmap" button appears.
5. Click "Generate Roadmap" → normal generation progress steps appear → roadmap preview shows.
6. Roadmap content reflects the user context (e.g. if "hobby" was selected, roadmap description should not be exam-focused).

- [ ] **Step 9: Commit**

```bash
git add src/app/roadmaps/create-roadmap.tsx
git commit -m "feat: add pre-generation Q&A questioning flow to roadmap creation UI"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| Conversational flow before roadmap generation | Task 5 (questioning UI) |
| Agent classifies domain + asks 3–5 domain-adaptive questions | Task 2 (questions route, prompt includes domain-adaptive logic) |
| Goal type question | Task 2 (prompt) |
| Prior knowledge question | Task 2 (prompt) |
| Time budget question | Task 2 (prompt) |
| Specific topics question | Task 2 (prompt, conditional) |
| Source URLs question | Task 2 (prompt, conditional) |
| Domain-specific extras (STEM, Law, Biology, Language) | Task 2 (prompt) |
| One targeted follow-up if answer opens a meaningful branch | Task 3 (followup route) |
| Agent generates roadmap with all answers woven in | Task 4 (context injection into formatOutput) |
| UX state machine: idle → questioning → generating → preview → saved | Task 5 (Status type update) |

### Placeholder scan

No TBD, TODO, or "implement later" in this plan.

### Type consistency

- `formatContext` defined in Task 1, imported and used in Task 5 — ✓
- `runRoadmapAgent(topic: string, context = '')` defined in Task 4, called from generate route in Task 4 — ✓
- `Status` type extended in Task 5 Step 1, used consistently in Steps 2–6 — ✓
- `questions: string[]`, `answers: string`, `followUp: string | null`, `followUpAnswer: string` — all defined in Step 1, used in Steps 2–6 — ✓
