'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { topics } from '@/lib/db/schema'
import { eq, max } from 'drizzle-orm'

export async function updateTopic(id: string, data: { title?: string; description?: string }) {
  await db.update(topics).set(data).where(eq(topics.id, id))
  revalidatePath('/roadmaps/[id]', 'page')
}

export async function updateTopicResources(
  id: string,
  resources: { title: string; url: string; type: string }[]
) {
  await db.update(topics).set({ resources }).where(eq(topics.id, id))
  revalidatePath('/roadmaps/[id]', 'page')
}

export async function deleteTopic(id: string) {
  await db.delete(topics).where(eq(topics.id, id))
  revalidatePath('/roadmaps/[id]', 'page')
}

export async function addTopic(sectionId: string, title: string, description: string) {
  const [{ maxOrder }] = await db
    .select({ maxOrder: max(topics.order) })
    .from(topics)
    .where(eq(topics.sectionId, sectionId))

  await db.insert(topics).values({
    sectionId,
    title,
    description: description || null,
    order: (maxOrder ?? 0) + 1,
  })

  revalidatePath('/roadmaps/[id]', 'page')
}
