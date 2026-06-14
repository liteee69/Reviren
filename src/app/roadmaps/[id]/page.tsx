export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { roadmaps, topics } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { TopicCard } from './topic-card'
import { AddTopic } from './add-topic'
import { DeleteRoadmapButton } from './delete-roadmap'

async function getRoadmap(id: string) {
  const [roadmap] = await db.select().from(roadmaps).where(eq(roadmaps.id, id))
  if (!roadmap) return null

  const topicList = await db
    .select()
    .from(topics)
    .where(eq(topics.roadmapId, id))
    .orderBy(asc(topics.order))

  const phases = topicList.reduce<Record<string, typeof topicList>>((acc, t) => {
    if (!acc[t.phase]) acc[t.phase] = []
    acc[t.phase].push(t)
    return acc
  }, {})

  return { roadmap, phases }
}

export default async function RoadmapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getRoadmap(id)
  if (!data) notFound()

  const { roadmap, phases } = data

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{roadmap.title}</h1>
          {roadmap.description && (
            <p className="text-muted-foreground mt-1">{roadmap.description}</p>
          )}
        </div>
        <DeleteRoadmapButton id={roadmap.id} title={roadmap.title} />
      </div>

      {Object.entries(phases).map(([phase, phaseTopics]) => (
        <div key={phase} className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {phase}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {phaseTopics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
          <AddTopic roadmapId={roadmap.id} phase={phase} />
        </div>
      ))}
    </div>
  )
}
