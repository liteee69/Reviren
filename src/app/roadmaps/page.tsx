export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import { roadmaps, topics } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { CreateRoadmap } from './create-roadmap'
import { RoadmapCard } from './roadmap-card'

async function getRoadmaps() {
  return db
    .select({
      id: roadmaps.id,
      title: roadmaps.title,
      description: roadmaps.description,
      topicCount: sql<number>`count(${topics.id})::int`,
    })
    .from(roadmaps)
    .leftJoin(topics, eq(topics.roadmapId, roadmaps.id))
    .groupBy(roadmaps.id, roadmaps.title, roadmaps.description, roadmaps.createdAt)
    .orderBy(roadmaps.createdAt)
}

export default async function RoadmapsPage() {
  const list = await getRoadmaps()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roadmaps</h1>
        <p className="text-muted-foreground">Generate a custom roadmap from any topic.</p>
      </div>

      <CreateRoadmap />

      {list.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Your library
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {list.map((r) => (
              <RoadmapCard key={r.id} {...r} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
