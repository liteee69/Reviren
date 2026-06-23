import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { roadmapModel } from '@/lib/ai'
import { HumanMessage } from '@langchain/core/messages'

export const runtime = 'nodejs'

const FollowUpSchema = z.object({
  followUp: z.string().nullable(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const topic = typeof body?.topic === 'string' ? body.topic.trim() : ''
  const questions: string[] = Array.isArray(body?.questions) ? body.questions : []
  const answers = typeof body?.answers === 'string' ? body.answers.trim() : ''

  if (!topic || questions.length === 0 || !answers) {
    return NextResponse.json({ error: 'Missing topic, questions, or answers' }, { status: 400 })
  }

  const prompt = `A user is creating a learning roadmap for: "${topic}".

Questions asked:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

User's answers:
${answers}

Decide: does any answer open a meaningful branch that warrants ONE targeted follow-up question?

Good follow-up triggers:
- "exam prep" → ask which specific exam
- "career switch" → ask which role or company type
- "university prep" → ask which course or programme
- A vague or multi-part answer that needs one clarification

Return { "followUp": "..." } if a follow-up is warranted, or { "followUp": null } if answers are clear enough.
One follow-up only — never more. Keep it short and conversational.`

  const structured = roadmapModel.withStructuredOutput(FollowUpSchema)
  const result = await structured.invoke([new HumanMessage(prompt)])

  return NextResponse.json({ followUp: result.followUp })
}
