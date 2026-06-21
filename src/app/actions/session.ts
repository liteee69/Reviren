'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { sessions, sessionTopics, subtasks, topics } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
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
