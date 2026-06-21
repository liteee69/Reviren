export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import { roadmaps, roadmapPhases, sections, topics } from '@/lib/db/schema'
import { asc, eq } from 'drizzle-orm'
import { FeynmanReview } from './feynman-review'

export default async function FeynmanPage() {
  const roadmapList = await db
    .select({ id: roadmaps.id, title: roadmaps.title })
    .from(roadmaps)

  const topicList = await db
    .select({
      id: topics.id,
      title: topics.title,
      description: topics.description,
      roadmapId: roadmapPhases.roadmapId,
    })
    .from(topics)
    .innerJoin(sections, eq(sections.id, topics.sectionId))
    .innerJoin(roadmapPhases, eq(roadmapPhases.id, sections.phaseId))
    .orderBy(asc(topics.order))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Feynman review</h1>
        <p className="text-muted-foreground">
          Explain a topic in your own words. Get scored on understanding.
        </p>
      </div>
      <FeynmanReview roadmaps={roadmapList} topics={topicList} />
    </div>
  )
}
