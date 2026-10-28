import { StateGraph, Annotation, START, END } from '@langchain/langgraph'
import { HumanMessage } from '@langchain/core/messages'
import { roadmapModel } from '@/lib/ai'
import { searchWeb, searchWebFiltered, searchWebRaw, fetchPages } from '@/lib/tools/search'
import { RoadmapOutputSchema, type RoadmapOutput } from './roadmap-schema'

// --- Types ---

type TopicDraft = { title: string; description: string }
type SectionDraft = { title: string; topics: TopicDraft[] }
type PhaseDraft = { title: string; sections: SectionDraft[] }
type RoadmapDraft = { title: string; description: string; phases: PhaseDraft[] }

type ResourceEntry = {
  title: string
  url: string
  type: 'video' | 'article' | 'course' | 'book' | 'documentation'
  purpose: 'theory'
}

type TopicResourceEntry = { topicTitle: string; resource: ResourceEntry | null }
type SectionResourceEntry = { sectionTitle: string; topicResources: TopicResourceEntry[] }

// --- State ---

const State = Annotation.Root({
  topic: Annotation<string>,
  context: Annotation<string>,
  topicSearchResults: Annotation<string>,
  roadmapDraft: Annotation<RoadmapDraft | null>,
  sectionResources: Annotation<SectionResourceEntry[]>,
  roadmap: Annotation<RoadmapOutput | null>,
})

// --- Helpers ---

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((c: { type?: string }) => c.type === 'text')
      .map((c: { text?: string }) => c.text ?? '')
      .join('')
  }
  return ''
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON object found in model response')
  return JSON.parse(match[0])
}

// --- Resource finding for a single section ---

async function findResourcesForSection(
  section: SectionDraft,
  roadmapTopic: string,
): Promise<SectionResourceEntry> {
  const topicList = section.topics.map(t => `- ${t.title}`).join('\n')

  // 1. Search for main source (blacklist applied)
  let candidates = await searchWebFiltered(
    `best free resource to learn "${section.title}" ${roadmapTopic}`,
    5,
  )

  // 2. Reddit fallback for niche topics (few or weak results)
  if (candidates.length < 2 || candidates.every(c => c.snippet.length < 100)) {
    const reddit = await searchWebRaw(
      `"${section.title}" best learning resource site:reddit.com`,
      3,
    )
    candidates = [...candidates, ...reddit]
  }

  // 3. Fetch page content of top candidates for Variant B coverage check
  const topUrls = candidates.slice(0, 3).map(c => c.url)
  const pageContent = await fetchPages(topUrls)

  const candidateList = candidates
    .slice(0, 5)
    .map((c, i) => `[${i + 1}] ${c.title}\nURL: ${c.url}\nSnippet: ${c.snippet}`)
    .join('\n\n')

  // 4. AI evaluates main source and coverage per topic
  const evaluationPrompt = `You are assigning a learning resource for the section "${section.title}" in a "${roadmapTopic}" roadmap.

Topics in this section:
${topicList}

Candidate sources:
${candidateList}

Page content fetched from candidates:
${pageContent}

Task:
1. Pick the single best source from candidates that covers this section most broadly. Prefer free, high-quality sources (YouTube playlists, official docs, free books, reputable guides). Reject anything behind a paywall.
2. For EACH topic, rate coverage by the chosen source: 0–100 (100 = fully covered by the source, 0 = not covered at all). Base this on the actual page content and video titles you can see above.
3. For topics with coverage < 90, provide a targeted search query to find a dedicated source for that specific topic.

Return ONLY valid JSON with no markdown:
{
  "mainSource": { "title": "...", "url": "...", "type": "video|article|book|documentation|course" },
  "topicCoverage": [
    { "topicTitle": "...", "coverage": 95, "fallbackQuery": null },
    { "topicTitle": "...", "coverage": 40, "fallbackQuery": "best free resource to learn X in Y" }
  ]
}`

  let mainSource: ResourceEntry | null = null
  let topicCoverage: Array<{ topicTitle: string; coverage: number; fallbackQuery: string | null }> = []

  try {
    const result = await roadmapModel.invoke([new HumanMessage(evaluationPrompt)])
    const parsed = extractJson(extractTextContent(result.content)) as {
      mainSource: { title: string; url: string; type: string }
      topicCoverage: Array<{ topicTitle: string; coverage: number; fallbackQuery: string | null }>
    }
    mainSource = { ...parsed.mainSource, type: parsed.mainSource.type as ResourceEntry['type'], purpose: 'theory' }
    topicCoverage = parsed.topicCoverage
  } catch {
    // If evaluation fails, assign main source from first candidate
    if (candidates[0]) {
      mainSource = { title: candidates[0].title, url: candidates[0].url, type: 'article', purpose: 'theory' }
    }
    topicCoverage = section.topics.map(t => ({ topicTitle: t.title, coverage: 0, fallbackQuery: `best free resource to learn "${t.title}" ${roadmapTopic}` }))
  }

  // 5. Find dedicated sources for topics with coverage < 90%
  const topicResources: TopicResourceEntry[] = await Promise.all(
    section.topics.map(async topic => {
      const coverage = topicCoverage.find(tc => tc.topicTitle === topic.title)

      if (!coverage || coverage.coverage >= 90) {
        return { topicTitle: topic.title, resource: mainSource }
      }

      // Needs dedicated source
      const fallbackQuery = coverage.fallbackQuery ?? `best free resource to learn "${topic.title}" ${roadmapTopic}`
      const fallbackCandidates = await searchWebFiltered(fallbackQuery, 3)

      if (fallbackCandidates.length === 0) {
        return { topicTitle: topic.title, resource: mainSource }
      }

      // Pick best fallback with a lightweight AI call
      try {
        const pickPrompt = `Pick the single best free learning resource for "${topic.title}" in the context of "${roadmapTopic}" from this list. Reject paywalled content.

${fallbackCandidates.map((c, i) => `[${i + 1}] ${c.title} — ${c.url}\n${c.snippet}`).join('\n\n')}

Return ONLY valid JSON: { "title": "...", "url": "...", "type": "video|article|book|documentation|course" }`

        const pickResult = await roadmapModel.invoke([new HumanMessage(pickPrompt)])
        const picked = extractJson(extractTextContent(pickResult.content)) as { title: string; url: string; type: string }
        return {
          topicTitle: topic.title,
          resource: { ...picked, type: picked.type as ResourceEntry['type'], purpose: 'theory' as const },
        }
      } catch {
        const fallback = fallbackCandidates[0]
        return {
          topicTitle: topic.title,
          resource: { title: fallback.title, url: fallback.url, type: 'article', purpose: 'theory' as const },
        }
      }
    }),
  )

  return { sectionTitle: section.title, topicResources }
}

// --- Graph nodes ---

async function searchTopics(state: typeof State.State) {
  const results = await searchWeb(
    `${state.topic} learning roadmap curriculum phases beginner to advanced`,
    8,
  )
  return { topicSearchResults: results }
}

async function structureRoadmap(state: typeof State.State) {
  const prompt = `You are a learning roadmap expert. Based on the research below, build a structured topic tree for: "${state.topic}".${state.context ? `\n\n${state.context}` : ''}

## Research:
${state.topicSearchResults}

## Rules:

### Sections (broad subject areas):
- Each phase has 2–4 sections. A section is a broad subject domain, not a narrow concept.
- Good section names: "Linear Algebra", "Python", "ROS 2", "Networking", "Web Security". Bad: "Geometry of Vectors", "Basic Python Syntax", "Introduction to Networking".
- Never name a section after a single concept (e.g. "Vectors", "Loops") — that is a topic, not a section.

### Topics (chapter-level concepts):
- Each section has 3–6 topics. A topic is a chapter-level concept — the kind you'd find as a chapter title in a textbook.
- Good topic names: "Vectors", "Matrices", "Eigenvalues", "Recursion", "PID Control". Bad: "Dot Product", "Cross Product", "Vector Norms", "For Loops", "While Loops".
- Do NOT split a concept into its sub-parts. "Vectors" is one topic — it covers dot product, cross product, norms, etc. internally. "Sorting Algorithms" is one topic — it covers bubble sort, merge sort, quicksort internally.
- Topic description must mention the key sub-concepts it covers and explain WHY this topic matters for the overall goal.

### Overall:
- 3–5 phases with week ranges in the title (e.g. "Phase 1: Foundations (Weeks 1–3)")
- A roadmap for a broad subject should have 20–40 topics total (not 80 — each topic is a chapter, not a sub-concept)
- DO NOT include any resources — structure only

Return ONLY a valid JSON object with no markdown:
{"title":"...","description":"...","phases":[{"title":"...","sections":[{"title":"...","topics":[{"title":"...","description":"..."}]}]}]}`

  const result = await roadmapModel.invoke([new HumanMessage(prompt)])
  const text = extractTextContent(result.content)
  const parsed = extractJson(text) as RoadmapDraft
  return { roadmapDraft: parsed }
}

async function findSectionResources(state: typeof State.State) {
  if (!state.roadmapDraft) throw new Error('No draft roadmap')

  const allSections = state.roadmapDraft.phases.flatMap(p => p.sections)

  const sectionResources = await Promise.all(
    allSections.map(section => findResourcesForSection(section, state.topic)),
  )

  return { sectionResources }
}

async function assembleRoadmap(state: typeof State.State) {
  if (!state.roadmapDraft) throw new Error('No draft roadmap')

  // Build lookup: sectionTitle → topicTitle → resource
  const resourceMap = new Map<string, Map<string, ResourceEntry | null>>()
  for (const sr of state.sectionResources) {
    const topicMap = new Map<string, ResourceEntry | null>()
    for (const tr of sr.topicResources) {
      topicMap.set(tr.topicTitle, tr.resource)
    }
    resourceMap.set(sr.sectionTitle, topicMap)
  }

  const roadmap: RoadmapOutput = {
    title: state.roadmapDraft.title,
    description: state.roadmapDraft.description,
    phases: state.roadmapDraft.phases.map(phase => ({
      title: phase.title,
      sections: phase.sections.map(section => ({
        title: section.title,
        topics: section.topics.map(topic => {
          const resource = resourceMap.get(section.title)?.get(topic.title) ?? null
          return {
            title: topic.title,
            description: topic.description,
            resources: resource ? [resource] : [],
          }
        }),
      })),
    })),
  }

  return { roadmap: RoadmapOutputSchema.parse(roadmap) }
}

// --- Graph ---

const graph = new StateGraph(State)
  .addNode('searchTopics', searchTopics)
  .addNode('structureRoadmap', structureRoadmap)
  .addNode('findSectionResources', findSectionResources)
  .addNode('assembleRoadmap', assembleRoadmap)
  .addEdge(START, 'searchTopics')
  .addEdge('searchTopics', 'structureRoadmap')
  .addEdge('structureRoadmap', 'findSectionResources')
  .addEdge('findSectionResources', 'assembleRoadmap')
  .addEdge('assembleRoadmap', END)
  .compile()

const nodeLabels: Record<string, string> = {
  searchTopics: 'Searching for curriculum structure...',
  structureRoadmap: 'Building topic tree...',
  findSectionResources: 'Finding quality resources per section...',
  assembleRoadmap: 'Assembling your roadmap...',
}

export async function* runRoadmapAgent(topic: string, context = '') {
  let roadmap: RoadmapOutput | null = null

  const stream = graph.streamEvents(
    {
      topic,
      context,
      topicSearchResults: '',
      roadmapDraft: null,
      sectionResources: [],
      roadmap: null,
    },
    { version: 'v2' },
  )

  for await (const event of stream) {
    if (event.event === 'on_chain_end' && event.name in nodeLabels) {
      yield { node: event.name, label: nodeLabels[event.name] }
    }

    if (event.event === 'on_chain_end' && event.name === 'assembleRoadmap') {
      roadmap = event.data?.output?.roadmap ?? null
    }
  }

  yield { node: 'done', roadmap }
}
