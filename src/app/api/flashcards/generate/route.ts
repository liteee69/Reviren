import { NextRequest, NextResponse } from 'next/server'
import { HumanMessage } from '@langchain/core/messages'
import { flashcardModel } from '@/lib/ai'
import { z } from 'zod'

export const runtime = 'nodejs'

const FlashcardBatchSchema = z.object({
  cards: z.array(
    z.object({
      front: z.string(),
      back: z.string(),
    })
  ),
})

export async function POST(req: NextRequest) {
  const { topicTitle, topicDescription } = await req.json()
  if (!topicTitle) return NextResponse.json({ error: 'Missing topicTitle' }, { status: 400 })

  const structured = flashcardModel.withStructuredOutput(FlashcardBatchSchema)

  const prompt = `Generate 5–8 flashcards for studying the following topic.

Topic: ${topicTitle}
${topicDescription ? `Description: ${topicDescription}` : ''}

Rules:
- front: a concise question or prompt (under 15 words)
- back: a clear, factual answer (under 40 words)
- Cover key concepts, definitions, and distinctions for this topic
- No duplicate cards`

  try {
    const result = await structured.invoke([new HumanMessage(prompt)])
    return NextResponse.json(result)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to generate flashcards'
    return NextResponse.json({ error }, { status: 500 })
  }
}
