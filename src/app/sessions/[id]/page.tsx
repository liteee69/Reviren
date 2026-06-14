export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { sessions, sessionTopics, topics, roadmaps } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { PomodoroTimer } from './pomodoro'
import { MusicPlayer } from './music-player'
import { SessionTopics } from './session-topics'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [session] = await db.select().from(sessions).where(eq(sessions.id, id))
  if (!session) notFound()

  const [roadmap] = await db.select().from(roadmaps).where(eq(roadmaps.id, session.roadmapId))

  const sessionTopicRows = await db
    .select({
      id: sessionTopics.id,
      topicId: topics.id,
      title: topics.title,
      phase: topics.phase,
      isCovered: sessionTopics.isCovered,
    })
    .from(sessionTopics)
    .innerJoin(topics, eq(topics.id, sessionTopics.topicId))
    .where(eq(sessionTopics.sessionId, id))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Study session</h1>
        <p className="text-muted-foreground">
          {roadmap?.title} &mdash; {session.plannedMinutes} min planned
          {session.endedAt && ' · Ended'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PomodoroTimer />
        <MusicPlayer />
      </div>

      <SessionTopics
        sessionId={id}
        topics={sessionTopicRows}
        ended={!!session.endedAt}
      />
    </div>
  )
}
