'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { feynmanReviews } from '@/lib/db/schema'

export async function saveReview(
  topicId: string,
  explanation: string,
  score: number,
  feedbackSolid: string,
  feedbackMissing: string,
  topicsToFlag: string[]
) {
  await db.insert(feynmanReviews).values({
    topicId,
    explanation,
    score,
    feedbackSolid,
    feedbackMissing,
    topicsToFlag,
  })
  revalidatePath('/feynman')
}
