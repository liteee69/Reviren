import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { topics } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const roadmapId = req.nextUrl.searchParams.get('roadmapId')
  if (!roadmapId) return NextResponse.json({ error: 'Missing roadmapId' }, { status: 400 })

  const topicList = await db
    .select({
      id: topics.id,
      title: topics.title,
      phase: topics.phase,
      isCompleted: topics.isCompleted,
    })
    .from(topics)
    .where(eq(topics.roadmapId, roadmapId))
    .orderBy(asc(topics.order))

  return NextResponse.json({ topics: topicList })
}
