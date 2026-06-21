import { StateGraph, Annotation, START, END } from '@langchain/langgraph'
import { HumanMessage } from '@langchain/core/messages'
import { roadmapModel } from '@/lib/ai'
import { searchWeb } from '@/lib/tools/search'
import { RoadmapOutputSchema, type RoadmapOutput } from './roadmap-schema'

const State = Annotation.Root({
  topic: Annotation<string>,
  topicSearchResults: Annotation<string>,
  resourceSearchResults: Annotation<string>,
  roadmap: Annotation<RoadmapOutput | null>,
})

async function searchTopics(state: typeof State.State) {
  const results = await searchWeb(
    `${state.topic} learning roadmap curriculum phases beginner to advanced`,
    8
  )
  return { topicSearchResults: results }
}

async function structureAndEnrich(state: typeof State.State) {
  const results = await searchWeb(
    `best resources tutorials courses books for learning ${state.topic}`,
    8
  )
  return { resourceSearchResults: results }
}

async function formatOutput(state: typeof State.State) {
  const structured = roadmapModel.withStructuredOutput(RoadmapOutputSchema, {
    method: 'json_mode',
  })

  const prompt = `You are a learning roadmap expert. Based on the research below, create a detailed, opinionated learning roadmap for: "${state.topic}".

## Topic research:
${state.topicSearchResults}

## Available resources:
${state.resourceSearchResults}

Rules:
- 3–5 phases, each with 2–4 sections (subject domains like "Mathematics", "Programming", "Electronics")
- Each section has 2–5 topics ordered from fundamental to advanced
- Group topics by subject domain into sections — never mix unrelated subjects in one section
- Every topic must have 2–4 real, specific resources with accurate URLs from the research
- Descriptions should explain WHY this topic matters, not just what it is
- Phase titles follow the format "Phase N: <Name>"
- Respond with valid JSON only, matching the schema exactly`

  const result = await structured.invoke([new HumanMessage(prompt)])
  return { roadmap: result }
}

const graph = new StateGraph(State)
  .addNode('searchTopics', searchTopics)
  .addNode('structureAndEnrich', structureAndEnrich)
  .addNode('formatOutput', formatOutput)
  .addEdge(START, 'searchTopics')
  .addEdge('searchTopics', 'structureAndEnrich')
  .addEdge('structureAndEnrich', 'formatOutput')
  .addEdge('formatOutput', END)
  .compile()

const nodeLabels: Record<string, string> = {
  searchTopics: 'Searching for curriculum structure...',
  structureAndEnrich: 'Finding resources...',
  formatOutput: 'Building your roadmap...',
}

export async function* runRoadmapAgent(topic: string) {
  let roadmap: RoadmapOutput | null = null

  const stream = graph.streamEvents(
    { topic, topicSearchResults: '', resourceSearchResults: '', roadmap: null },
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
