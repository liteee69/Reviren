'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { sessions, sessionTopics } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function createSession(roadmapId: string, plannedMinutes: number, topicIds: string[]) {
  const [session] = await db
    .insert(sessions)
    .values({ roadmapId, plannedMinutes })
    .returning({ id: sessions.id })

  if (topicIds.length > 0) {
    await db.insert(sessionTopics).values(
      topicIds.map((topicId) => ({ sessionId: session.id, topicId }))
    )
  }

  revalidatePath('/sessions')
  return session.id
}

export async function markTopicCovered(sessionTopicId: string, isCovered: boolean) {
  await db.update(sessionTopics).set({ isCovered }).where(eq(sessionTopics.id, sessionTopicId))
}

export async function endSession(id: string) {
  await db.update(sessions).set({ endedAt: new Date() }).where(eq(sessions.id, id))
  revalidatePath('/sessions')
}
