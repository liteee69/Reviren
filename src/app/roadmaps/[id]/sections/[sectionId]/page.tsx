export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { sections, topics, roadmapPhases, roadmaps } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { SectionTopics } from './section-topics'

async function getSectionData(sectionId: string) {
  const [section] = await db.select().from(sections).where(eq(sections.id, sectionId))
  if (!section) return null

  const [phase] = await db.select().from(roadmapPhases).where(eq(roadmapPhases.id, section.phaseId))
  if (!phase) return null

  const [roadmap] = await db.select().from(roadmaps).where(eq(roadmaps.id, phase.roadmapId))
  if (!roadmap) return null

  const topicList = await db
    .select()
    .from(topics)
    .where(eq(topics.sectionId, sectionId))
    .orderBy(asc(topics.order))

  return { section, phase, roadmap, topics: topicList }
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ id: string; sectionId: string }>
}) {
  const { sectionId } = await params
  const data = await getSectionData(sectionId)
  if (!data) notFound()

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <a href={`/roadmaps/${data.roadmap.id}`} className="hover:underline">
            {data.roadmap.title}
          </a>
          <span>/</span>
          <span>{data.phase.title}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{data.section.title}</h1>
      </div>

      <SectionTopics
        topics={data.topics}
        sectionId={sectionId}
      />
    </div>
  )
}
