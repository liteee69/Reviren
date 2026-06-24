import { StateGraph, Annotation, START, END } from '@langchain/langgraph'
import { HumanMessage } from '@langchain/core/messages'
import { roadmapModel } from '@/lib/ai'
import { searchWeb, searchWebRaw, fetchPages, type SearchResult } from '@/lib/tools/search'
import { RoadmapOutputSchema, type RoadmapOutput } from './roadmap-schema'

const State = Annotation.Root({
  topic: Annotation<string>,
  context: Annotation<string>,
  topicSearchResults: Annotation<string>,
  domains: Annotation<string[]>,
  theoryCandidates: Annotation<SearchResult[]>,
  practiceCandidates: Annotation<SearchResult[]>,
  verifiedResources: Annotation<string>,
  roadmap: Annotation<RoadmapOutput | null>,
})

async function extractDomains(topicResearch: string, topic: string): Promise<string[]> {
  const result = await roadmapModel.invoke([new HumanMessage(
    `From this learning roadmap research for "${topic}", list the 6-10 key subject domains that need dedicated learning resources.\n` +
    `Return ONLY a JSON array of short domain names. Example: ["Linear Algebra", "Python", "ROS 2", "Computer Vision", "Reinforcement Learning"]\n\n` +
    `Research:\n${topicResearch.slice(0, 3000)}`
  )])
  try {
    const content = typeof result.content === 'string' ? result.content : ''
    const match = content.match(/\[[\s\S]*?\]/)
    return match ? JSON.parse(match[0]) : [topic]
  } catch {
    return [topic]
  }
}

async function searchTopics(state: typeof State.State) {
  const results = await searchWeb(
    `${state.topic} learning roadmap curriculum phases beginner to advanced`,
    8
  )
  const domains = await extractDomains(results, state.topic)
  return { topicSearchResults: results, domains }
}

async function findTheoryResources(state: typeof State.State) {
  const searches = await Promise.all(
    state.domains.map(d => searchWebRaw(`best "${d}" tutorial course free highly recommended`, 3))
  )
  return { theoryCandidates: searches.flat() }
}

async function findPracticeResources(state: typeof State.State) {
  const searches = await Promise.all(
    state.domains.map(d => searchWebRaw(`free "${d}" practice exercises problems interactive`, 3))
  )
  return { practiceCandidates: searches.flat() }
}

async function verifyResources(state: typeof State.State) {
  const allCandidates = [
    ...state.theoryCandidates.map(r => ({ ...r, purpose: 'theory' })),
    ...state.practiceCandidates.map(r => ({ ...r, purpose: 'practice' })),
  ]

  const urls = [...new Set(allCandidates.map(r => r.url))].slice(0, 30)
  const pageContent = await fetchPages(urls)

  const candidateList = allCandidates
    .map(r => `[${r.purpose.toUpperCase()}] ${r.title} — ${r.url}\nSnippet: ${r.snippet}`)
    .join('\n\n')

  const verificationPrompt = `You are evaluating learning resources for: "${state.topic}".

## Candidates found:
${candidateList}

## Page content fetched:
${pageContent}

Task: From the candidates above, select the best resources for teaching "${state.topic}".
Evaluate each on: reputation of the author/institution, quality of content visible in the page, accessibility (free, no paywall), and relevance to the topic.

Return a curated shortlist as plain text in this format — include only resources you are confident are high quality:

THEORY:
- [title] | [url] | [one sentence on why it's the best choice]

PRACTICE:
- [title] | [url] | [one sentence on why it's the best choice]

Include 6–8 options per category, ordered best-first. Exclude anything behind a paywall or with thin content.`

  const result = await roadmapModel.invoke([new HumanMessage(verificationPrompt)])
  return { verifiedResources: typeof result.content === 'string' ? result.content : '' }
}

async function formatOutput(state: typeof State.State) {
  const structured = roadmapModel.withStructuredOutput(RoadmapOutputSchema)

  const prompt = `You are a learning roadmap expert. Based on the research below, create a detailed, opinionated learning roadmap for: "${state.topic}".${state.context ? `\n\n${state.context}` : ''}

## Topic research:
${state.topicSearchResults}

## Verified resources (quality-checked):
${state.verifiedResources}

## Step 1 — Structure (do this first, ignore resources entirely)
Build the topic tree:
- 3–5 phases with week ranges in the title (e.g. "Phase 1: Foundations (Weeks 1–3)")
- Each phase has 2–4 sections. Section names must be short, standard subject-area names (1–3 words). Good: "Mathematics", "Physics & Electronics", "Python", "C++", "ROS 2". Bad: "Essential Mathematics", "Basic Electronics & Arduino", "Machine Learning Foundations".
- Each section has 3–8 topics. Topic names must be standard textbook/chapter names (1–4 words) — the kind you would see on a university syllabus. Good: "Linear Algebra", "Calculus", "OOP in Python", "PID Control", "Kalman Filter". Bad: "Vectors and Matrix Operations", "Derivatives and Gradients", "Object-Oriented Programming (OOP) in Python".
- A roadmap for a broad subject like robotics should have 40–80 topics total across all phases
- Descriptions explain WHY this topic matters, not just what it is

## Step 2 — Resources (assign after structure is complete)
For each topic, assign resources from the verified list above:
- 1 theory resource: the best video series or free book for this specific topic
- 1 practice resource: a free site with exercises or interactive problems for this topic
- If no verified resource fits a topic precisely, use the closest match from the list — it is acceptable for multiple related topics to share the same resource URL
- Never invent URLs — only use URLs from the verified list above
- Set purpose: "theory" or "practice" accordingly
- Set type: "video" for YouTube/video content, "course" for structured courses, "book" for books/textbooks, "article" for written guides/docs, "documentation" for official reference docs

Respond with valid JSON only, matching the schema exactly`

  const result = await structured.invoke([new HumanMessage(prompt)])
  return { roadmap: result }
}

const graph = new StateGraph(State)
  .addNode('searchTopics', searchTopics)
  .addNode('findTheoryResources', findTheoryResources)
  .addNode('findPracticeResources', findPracticeResources)
  .addNode('verifyResources', verifyResources)
  .addNode('formatOutput', formatOutput)
  .addEdge(START, 'searchTopics')
  .addEdge('searchTopics', 'findTheoryResources')
  .addEdge('searchTopics', 'findPracticeResources')
  .addEdge(['findTheoryResources', 'findPracticeResources'], 'verifyResources')
  .addEdge('verifyResources', 'formatOutput')
  .addEdge('formatOutput', END)
  .compile()

const nodeLabels: Record<string, string> = {
  searchTopics: 'Searching for curriculum structure...',
  findTheoryResources: 'Finding theory resources...',
  findPracticeResources: 'Finding practice resources...',
  verifyResources: 'Verifying resource quality...',
  formatOutput: 'Building your roadmap...',
}

export async function* runRoadmapAgent(topic: string, context = '') {
  let roadmap: RoadmapOutput | null = null

  const stream = graph.streamEvents(
    { topic, context, topicSearchResults: '', domains: [], theoryCandidates: [], practiceCandidates: [], verifiedResources: '', roadmap: null },
    { version: 'v2' }
  )

  for await (const event of stream) {
    if (event.event === 'on_chain_end' && event.name in nodeLabels) {
      yield { node: event.name, label: nodeLabels[event.name] }
    }

    // Capture the final roadmap from the formatOutput node output
    if (event.event === 'on_chain_end' && event.name === 'formatOutput') {
      roadmap = event.data?.output?.roadmap ?? null
    }
  }

  yield { node: 'done', roadmap }
}
