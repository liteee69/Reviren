'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { roadmaps, topics } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { RoadmapOutput } from '@/lib/agent/roadmap-schema'

export async function saveRoadmap(data: RoadmapOutput) {
  const [roadmap] = await db
    .insert(roadmaps)
    .values({ title: data.title, description: data.description })
    .returning({ id: roadmaps.id })

  const topicRows = data.phases.flatMap((phase, phaseIndex) =>
    phase.topics.map((topic, topicIndex) => ({
      roadmapId: roadmap.id,
      phase: phase.title,
      title: topic.title,
      description: topic.description,
      resources: topic.resources,
      order: phaseIndex * 100 + topicIndex,
    }))
  )

  await db.insert(topics).values(topicRows)

  revalidatePath('/roadmaps')
  return roadmap.id
}

export async function deleteRoadmap(id: string) {
  await db.delete(roadmaps).where(eq(roadmaps.id, id))
  revalidatePath('/roadmaps')
}
