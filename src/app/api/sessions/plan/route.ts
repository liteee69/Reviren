import { NextRequest, NextResponse } from 'next/server'
import { HumanMessage } from '@langchain/core/messages'
import { sessionModel } from '@/lib/ai'
import { db } from '@/lib/db'
import { topics, sections, roadmapPhases, roadmaps } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { z } from 'zod'

export const runtime = 'nodejs'

const SubtaskPlanSchema = z.object({
  description: z.string(),
  resourceTitle: z.string().nullable(),
  resourceUrl: z.string().nullable(),
  order: z.number().int(),
})

const SessionPlanTopicSchema = z.object({
  topicId: z.string(),
  title: z.string(),
  sectionTitle: z.string(),
  allocatedMinutes: z.number().int().min(30),
  subtasks: z.array(SubtaskPlanSchema).min(2).max(6),
})

const SessionPlanSchema = z.object({
  topics: z.array(SessionPlanTopicSchema).min(1).max(4),
})

export async function POST(req: NextRequest) {
  const { roadmapId, hours } = await req.json()
  if (!roadmapId || !hours) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  if (typeof hours !== 'number' || hours < 0.5 || hours > 12) {
    return NextResponse.json({ error: 'Hours must be between 0.5 and 12' }, { status: 400 })
  }

  const [roadmap] = await db.select().from(roadmaps).where(eq(roadmaps.id, roadmapId))
  if (!roadmap) return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })

  const phases = await db
    .select()
    .from(roadmapPhases)
    .where(eq(roadmapPhases.roadmapId, roadmapId))
    .orderBy(asc(roadmapPhases.order))

  type TopicEntry = {
    topicId: string
    title: string
    description: string | null
    progress: number
    resources: unknown
    sectionTitle: string
    phaseTitle: string
  }

  const allTopics: TopicEntry[] = []

  for (const phase of phases) {
    const sectionRows = await db
      .select()
      .from(sections)
      .where(eq(sections.phaseId, phase.id))
      .orderBy(asc(sections.order))

    for (const section of sectionRows) {
      const topicRows = await db
        .select()
        .from(topics)
        .where(eq(topics.sectionId, section.id))
        .orderBy(asc(topics.order))

      for (const topic of topicRows) {
        if (topic.progress < 100) {
          allTopics.push({
            topicId: topic.id,
            title: topic.title,
            description: topic.description,
            progress: topic.progress,
            resources: topic.resources,
            sectionTitle: section.title,
            phaseTitle: phase.title,
          })
        }
      }
    }
  }

  if (allTopics.length === 0) {
    return NextResponse.json({ error: 'All topics are complete' }, { status: 400 })
  }

  const totalMinutes = Math.round(hours * 60)

  const topicsText = allTopics
    .map((t) => {
      const resources = Array.isArray(t.resources)
        ? (t.resources as Array<{ title: string; url: string; type: string }>)
            .map((r) => `    - [${r.type}] ${r.title}: ${r.url}`)
            .join('\n')
        : '    (none)'
      return [
        `- [${t.topicId}] ${t.phaseTitle} / ${t.sectionTitle} / ${t.title} (progress: ${t.progress}%)`,
        t.description ? `  What it covers: ${t.description}` : '',
        `  Resources:\n${resources}`,
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const prompt = `You are a study session planner for the roadmap: "${roadmap.title}".

Available study time: ${hours} hours (${totalMinutes} minutes total)

Topics not yet complete (ordered by phase → section):
${topicsText}

Your job:
1. Select 1–4 topics to cover in this session
2. Allocate time: minimum 60 minutes per topic, in 30-minute increments (e.g. 60, 90, 120 min). Total must not exceed ${totalMinutes} minutes.
3. Prefer topics with lower progress % — prioritise 0% over 50%, 50% over 80%+
4. Balance across sections: prefer different subject domains (e.g. Math + Python together, not two Math topics unless time clearly allows or they are sequential)
5. Two topics from the same section are allowed when time permits or when topics are tightly sequential (e.g. Vectors → Matrices)
6. Pair foundational topics with applied ones when possible (theory + practice in same session)
7. For each topic, generate 3–5 concrete subtasks that describe exactly what to do during that time block
8. For each subtask, attach a resource from the topic's resource list when relevant (use title and url from the list above). Leave resourceTitle and resourceUrl null if no relevant resource exists.
9. Subtask descriptions must be specific actions, not vague goals. Good: "Watch the 3Blue1Brown linear algebra series episode on matrix multiplication (link in resources)". Bad: "Study linear algebra".

Return a JSON object matching the schema exactly.`

  try {
    const structured = sessionModel.withStructuredOutput(SessionPlanSchema)
    const plan = await structured.invoke([new HumanMessage(prompt)])
    return NextResponse.json(plan)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to plan session'
    return NextResponse.json({ error }, { status: 500 })
  }
}
