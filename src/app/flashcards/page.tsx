export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import { flashcards, topics, roadmaps } from '@/lib/db/schema'
import { eq, asc, desc } from 'drizzle-orm'
import { FlashcardsView } from './flashcards-view'

export default async function FlashcardsPage() {
  const cardRows = await db
    .select({
      id: flashcards.id,
      front: flashcards.front,
      back: flashcards.back,
      isKnown: flashcards.isKnown,
      topicTitle: topics.title,
    })
    .from(flashcards)
    .leftJoin(topics, eq(topics.id, flashcards.topicId))
    .orderBy(desc(flashcards.createdAt))

  const roadmapList = await db
    .select({ id: roadmaps.id, title: roadmaps.title })
    .from(roadmaps)

  const topicList = await db
    .select({
      id: topics.id,
      title: topics.title,
      description: topics.description,
      roadmapId: topics.roadmapId,
    })
    .from(topics)
    .orderBy(asc(topics.order))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Flashcards</h1>
        <p className="text-muted-foreground">Review and generate decks. Click a card to flip it.</p>
      </div>
      <FlashcardsView
        initialCards={cardRows}
        topics={topicList}
        roadmaps={roadmapList}
      />
    </div>
  )
}
