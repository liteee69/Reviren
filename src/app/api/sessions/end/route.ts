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
