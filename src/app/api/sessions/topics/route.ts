import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { topics, sections, roadmapPhases } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const roadmapId = req.nextUrl.searchParams.get('roadmapId')
  if (!roadmapId) return NextResponse.json({ error: 'Missing roadmapId' }, { status: 400 })

  const phases = await db
    .select()
    .from(roadmapPhases)
    .where(eq(roadmapPhases.roadmapId, roadmapId))

  const result = []
  for (const phase of phases) {
    const sectionRows = await db
      .select()
      .from(sections)
      .where(eq(sections.phaseId, phase.id))
      .orderBy(asc(sections.order))

    for (const section of sectionRows) {
      const topicRows = await db
        .select()
        .from(topics)
        .where(eq(topics.sectionId, section.id))
        .orderBy(asc(topics.order))

      for (const topic of topicRows) {
        result.push({
          id: topic.id,
          title: topic.title,
          sectionTitle: section.title,
          isCompleted: topic.isCompleted,
        })
      }
    }
  }

  return NextResponse.json({ topics: result })
}
