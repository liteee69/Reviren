export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { sessions, sessionTopics, topics, roadmaps, subtasks, sections } from '@/lib/db/schema'
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
      sectionTitle: sections.title,
      isCovered: sessionTopics.isCovered,
      allocatedMinutes: sessionTopics.allocatedMinutes,
    })
    .from(sessionTopics)
    .innerJoin(topics, eq(topics.id, sessionTopics.topicId))
    .innerJoin(sections, eq(sections.id, topics.sectionId))
    .where(eq(sessionTopics.sessionId, id))

  // Fetch subtasks for all session topics
  const allSubtasks = await Promise.all(
    sessionTopicRows.map(async (st) => {
      const rows = await db
        .select()
        .from(subtasks)
        .where(eq(subtasks.sessionTopicId, st.id))
      return { sessionTopicId: st.id, subtasks: rows }
    })
  )

  const subtasksBySessionTopic = Object.fromEntries(
    allSubtasks.map(({ sessionTopicId, subtasks: rows }) => [sessionTopicId, rows])
  )

  const enrichedTopics = sessionTopicRows.map((st) => ({
    ...st,
    subtasks: subtasksBySessionTopic[st.id] ?? [],
  }))

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
        topics={enrichedTopics}
        ended={!!session.endedAt}
      />
    </div>
  )
}
