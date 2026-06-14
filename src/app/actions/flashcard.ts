'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { flashcards } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function createCard(front: string, back: string, topicId?: string) {
  await db.insert(flashcards).values({ front, back, topicId: topicId ?? null })
  revalidatePath('/flashcards')
}

export async function saveGeneratedCards(
  cards: { front: string; back: string }[],
  topicId?: string
) {
  await db.insert(flashcards).values(
    cards.map((c) => ({ front: c.front, back: c.back, topicId: topicId ?? null }))
  )
  revalidatePath('/flashcards')
}

export async function toggleKnown(id: string, isKnown: boolean) {
  await db.update(flashcards).set({ isKnown }).where(eq(flashcards.id, id))
}

export async function deleteCard(id: string) {
  await db.delete(flashcards).where(eq(flashcards.id, id))
  revalidatePath('/flashcards')
}
