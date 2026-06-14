import { tavily } from '@tavily/core'

const client = tavily({ apiKey: process.env.TAVILY_API_KEY! })

export async function searchWeb(query: string, maxResults = 5): Promise<string> {
  const response = await client.search(query, {
    maxResults,
    searchDepth: 'advanced',
  })

  return response.results
    .map(r => `[${r.title}](${r.url})\n${r.content}`)
    .join('\n\n')
}
