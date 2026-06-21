export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { roadmaps, roadmapPhases, sections, topics } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { DeleteRoadmapButton } from './delete-roadmap'
import { PhaseTabs } from './phase-tabs'
import { calcSectionProgress } from '@/lib/progress'

async function getRoadmapData(id: string) {
  const [roadmap] = await db.select().from(roadmaps).where(eq(roadmaps.id, id))
  if (!roadmap) return null

  const phases = await db
    .select()
    .from(roadmapPhases)
    .where(eq(roadmapPhases.roadmapId, id))
    .orderBy(asc(roadmapPhases.order))

  const phasesWithSections = await Promise.all(
    phases.map(async (phase) => {
      const sectionRows = await db
        .select()
        .from(sections)
        .where(eq(sections.phaseId, phase.id))
        .orderBy(asc(sections.order))

      const sectionsWithProgress = await Promise.all(
        sectionRows.map(async (section) => {
          const topicRows = await db
            .select({ progress: topics.progress, isCompleted: topics.isCompleted })
            .from(topics)
            .where(eq(topics.sectionId, section.id))

          const progress = calcSectionProgress(topicRows.map((t) => t.progress))
          const completedCount = topicRows.filter((t) => t.isCompleted).length

          return {
            id: section.id,
            title: section.title,
            progress,
            topicCount: topicRows.length,
            completedCount,
          }
        })
      )

      const phaseProgress = calcSectionProgress(sectionsWithProgress.map((s) => s.progress))

      return { id: phase.id, title: phase.title, progress: phaseProgress, sections: sectionsWithProgress }
    })
  )

  return { roadmap, phases: phasesWithSections }
}

export default async function RoadmapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getRoadmapData(id)
  if (!data) notFound()

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.roadmap.title}</h1>
          {data.roadmap.description && (
            <p className="text-muted-foreground mt-1">{data.roadmap.description}</p>
          )}
        </div>
        <DeleteRoadmapButton id={data.roadmap.id} title={data.roadmap.title} />
      </div>

      {data.phases.length === 0 ? (
        <p className="text-sm text-muted-foreground">No phases yet. Generate or import a roadmap to get started.</p>
      ) : (
        <PhaseTabs phases={data.phases} roadmapId={id} />
      )}
    </div>
  )
}
