import { NextRequest, NextResponse } from 'next/server'
import { HumanMessage } from '@langchain/core/messages'
import { sessionModel } from '@/lib/ai'
import { db } from '@/lib/db'
import { topics, roadmaps } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { z } from 'zod'

export const runtime = 'nodejs'

const SessionPlanSchema = z.object({
  topics: z.array(
    z.object({
      topicId: z.string(),
      title: z.string(),
      phase: z.string(),
      estimatedMinutes: z.number(),
      reason: z.string(),
    })
  ),
})

export async function POST(req: NextRequest) {
  const { roadmapId, minutes } = await req.json()
  if (!roadmapId || !minutes) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const [roadmap] = await db.select().from(roadmaps).where(eq(roadmaps.id, roadmapId))
  if (!roadmap) return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })

  const topicList = await db
    .select()
    .from(topics)
    .where(eq(topics.roadmapId, roadmapId))
    .orderBy(asc(topics.order))

  const structured = sessionModel.withStructuredOutput(SessionPlanSchema)

  const topicsText = topicList
    .map(
      (t) =>
        `- [${t.id}] (${t.phase}) ${t.title}${t.isCompleted ? ' [COMPLETED]' : ''}: ${t.description ?? ''}`
    )
    .join('\n')

  const prompt = `You are a study session planner. Select and prioritise topics for a focused study session.

Roadmap: ${roadmap.title}
Available time: ${minutes} minutes

Topics (in roadmap order):
${topicsText}

Rules:
- Prefer incomplete topics over completed ones
- Prioritise topics earlier in the roadmap unless all are completed
- Total estimatedMinutes must not exceed ${minutes}
- Assign realistic minutes per topic (min 15, max 60)
- Give a 1-sentence reason per topic explaining why it is included
- Return only the selected topics`

  try {
    const plan = await structured.invoke([new HumanMessage(prompt)])
    return NextResponse.json(plan)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to plan session'
    return NextResponse.json({ error }, { status: 500 })
  }
}
