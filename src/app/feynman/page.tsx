export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import { roadmaps, topics } from '@/lib/db/schema'
import { asc } from 'drizzle-orm'
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
      roadmapId: topics.roadmapId,
    })
    .from(topics)
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
