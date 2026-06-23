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

export type SearchResult = { title: string; url: string; snippet: string }

export async function searchWebRaw(query: string, maxResults = 5): Promise<SearchResult[]> {
  const response = await client.search(query, {
    maxResults,
    searchDepth: 'advanced',
  })

  return response.results.map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
  }))
}

export async function fetchPages(urls: string[]): Promise<string> {
  try {
    const response = await client.extract(urls)
    return response.results
      .map(r => `[${r.url}]\n${r.rawContent?.slice(0, 1500) ?? '(no content)'}`)
      .join('\n\n---\n\n')
  } catch {
    return '(fetch failed)'
  }
}
