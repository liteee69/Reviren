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

Extract phases, sections (subject domains), topics, descriptions, and any mentioned resources. Group topics by subject domain into sections within each phase. If no resources are mentioned for a topic, use an empty array.

Infer a clear title and description for the overall roadmap if not explicitly stated.

Phase titles must follow the format "Phase N: <Name>".
Section titles should be subject domain names (e.g. "Mathematics", "Python", "Electronics").
If the text has no clear sections, group all topics under a single section titled "General".

For each resource found, set purpose to "theory" if it is a learning source (book, video, article, course) or "practice" if it is an exercise/problem set/interactive tool.

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
