export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import { roadmaps } from '@/lib/db/schema'
import { SessionPlanner } from './session-planner'

export default async function SessionsPage() {
  const roadmapList = await db
    .select({ id: roadmaps.id, title: roadmaps.title })
    .from(roadmaps)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plan a session</h1>
        <p className="text-muted-foreground">Pick your hours — get a prioritised topic list.</p>
      </div>
      <SessionPlanner roadmaps={roadmapList} />
    </div>
  )
}
