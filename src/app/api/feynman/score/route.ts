import { NextRequest, NextResponse } from 'next/server'
import { HumanMessage } from '@langchain/core/messages'
import { sessionModel } from '@/lib/ai'
import { z } from 'zod'

export const runtime = 'nodejs'

const FeynmanScoreSchema = z.object({
  score: z.number(),
  feedbackSolid: z.string(),
  feedbackMissing: z.string(),
  topicsToFlag: z.array(z.string()),
})

export async function POST(req: NextRequest) {
  const { topicTitle, topicDescription, explanation } = await req.json()
  if (!topicTitle || !explanation) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const structured = sessionModel.withStructuredOutput(FeynmanScoreSchema)

  const prompt = `You are evaluating a student's Feynman-style explanation of a technical topic.

Topic: ${topicTitle}
${topicDescription ? `Description: ${topicDescription}` : ''}

Student's explanation:
${explanation}

Score the understanding from 1 (completely wrong) to 10 (expert-level, correct and clear).
Be honest and specific. Identify what the student got right (feedbackSolid), what was missing or incorrect (feedbackMissing), and list 1–3 related topics they should study next to strengthen their understanding (topicsToFlag).`

  try {
    const result = await structured.invoke([new HumanMessage(prompt)])
    return NextResponse.json(result)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to score explanation'
    return NextResponse.json({ error }, { status: 500 })
  }
}
