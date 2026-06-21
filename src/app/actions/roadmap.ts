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
