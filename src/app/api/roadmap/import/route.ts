import { NextRequest, NextResponse } from 'next/server'
import { HumanMessage } from '@langchain/core/messages'
import { sessionModel } from '@/lib/ai'
import { RoadmapOutputSchema } from '@/lib/agent/roadmap-schema'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { text } = await req.json()

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 })
  }

  const structured = sessionModel.withStructuredOutput(RoadmapOutputSchema)

  const prompt = `Parse the following learning roadmap text into a structured format.

Extract phases, topics, descriptions, and any mentioned resources. If resources are mentioned (books, videos, courses, links), include them with the appropriate type. If no resources are mentioned for a topic, use an empty array.

Infer a clear title and description for the overall roadmap if not explicitly stated.

Phase titles must follow the format "Phase N: <Name>".

Text to parse:
${text.trim()}`

  try {
    const roadmap = await structured.invoke([new HumanMessage(prompt)])
    return NextResponse.json({ roadmap })
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to parse roadmap'
    return NextResponse.json({ error }, { status: 500 })
  }
}
