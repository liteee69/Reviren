export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { db } from '@/lib/db'
import { roadmaps, topics, sessions, flashcards } from '@/lib/db/schema'
import { eq, sql, gte, desc } from 'drizzle-orm'

export default async function DashboardPage() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    roadmapList,
    sessionCountRow,
    unknownCardCountRow,
    lastSessionRow,
  ] = await Promise.all([
    db
      .select({
        id: roadmaps.id,
        title: roadmaps.title,
        topicCount: sql<number>`count(${topics.id})::int`,
        completedCount: sql<number>`count(${topics.id}) filter (where ${topics.isCompleted} = true)::int`,
      })
      .from(roadmaps)
      .leftJoin(topics, eq(topics.roadmapId, roadmaps.id))
      .groupBy(roadmaps.id, roadmaps.title, roadmaps.createdAt)
      .orderBy(roadmaps.createdAt),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessions)
      .where(gte(sessions.createdAt, weekAgo)),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(flashcards)
      .where(eq(flashcards.isKnown, false)),

    db
      .select({ id: sessions.id, createdAt: sessions.createdAt, plannedMinutes: sessions.plannedMinutes })
      .from(sessions)
      .orderBy(desc(sessions.createdAt))
      .limit(1),
  ])

  const sessionCount = sessionCountRow[0]?.count ?? 0
  const unknownCards = unknownCardCountRow[0]?.count ?? 0
  const lastSession = lastSessionRow[0] ?? null

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Your learning at a glance.</p>
        </div>
        <Button asChild>
          <Link href="/roadmaps">New roadmap</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Roadmaps</CardDescription>
            <CardTitle className="text-3xl">{roadmapList.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sessions this week</CardDescription>
            <CardTitle className="text-3xl">{sessionCount}</CardTitle>
          </CardHeader>
          {lastSession && (
            <CardContent className="pt-0">
              <Link href={`/sessions/${lastSession.id}`} className="text-xs text-muted-foreground underline">
                Last: {new Date(lastSession.createdAt).toLocaleDateString()}
              </Link>
            </CardContent>
          )}
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Flashcards to review</CardDescription>
            <CardTitle className="text-3xl">{unknownCards}</CardTitle>
          </CardHeader>
          {unknownCards > 0 && (
            <CardContent className="pt-0">
              <Link href="/flashcards" className="text-xs text-muted-foreground underline">
                Go to flashcards
              </Link>
            </CardContent>
          )}
        </Card>
      </div>

      {roadmapList.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Your roadmaps</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {roadmapList.map((r) => {
              const progress = r.topicCount > 0
                ? Math.round((r.completedCount / r.topicCount) * 100)
                : 0
              return (
                <Link key={r.id} href={`/roadmaps/${r.id}`} className="block">
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{r.title}</CardTitle>
                        <Badge variant="secondary">{r.topicCount} topics</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Progress value={progress} />
                      <p className="text-sm text-muted-foreground">{progress}% complete</p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {roadmapList.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No roadmaps yet.{' '}
              <Link href="/roadmaps" className="underline">
                Generate your first one.
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
