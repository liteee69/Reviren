import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { haiku } from '@/lib/ai'
import { HumanMessage } from '@langchain/core/messages'

export const runtime = 'nodejs'

const QuestionsSchema = z.object({
  questions: z.array(z.string()).min(3).max(5),
})

const QUESTIONS_PROMPT = (topic: string) => `You are personalising a learning roadmap for: "${topic}".

Ask 3–5 high-leverage questions. Always include:
1. Goal type — exam prep / career switch / hobby / university prep / professional upskilling
2. Prior knowledge — self-rate 0–3 per relevant sub-area of "${topic}"
3. Time budget — hours per day and total weeks available

Add these only when domain-appropriate:
- STEM/Engineering: "Do you have any hardware available?" or "Which specific framework or language are you targeting?"
- Law: "Which jurisdiction are you studying?" or "Are you preparing for a specific exam (bar, LSAT)?"
- Biology/Chemistry: "Do you have lab access, or is this purely theoretical?"
- Language learning: "What is your current level and your target use case (travel, business, fluency)?"
- Any domain: "Are there specific topics you want included?" and/or "Do you have URLs or resources you want the roadmap to reference?"

Keep each question short and conversational — one sentence, no sub-bullets.

Return JSON matching exactly: { "questions": ["...", "...", "..."] }`

export async function POST(req: NextRequest) {
  const body = await req.json()
  const topic = typeof body?.topic === 'string' ? body.topic.trim() : ''

  if (!topic) {
    return NextResponse.json({ error: 'Missing topic' }, { status: 400 })
  }

  const structured = haiku.withStructuredOutput(QuestionsSchema)
  const result = await structured.invoke([new HumanMessage(QUESTIONS_PROMPT(topic))])

  return NextResponse.json({ questions: result.questions })
}
