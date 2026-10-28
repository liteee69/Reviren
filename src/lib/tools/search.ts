import { tavily } from '@tavily/core'

const client = tavily({ apiKey: process.env.TAVILY_API_KEY! })

export const BLACKLIST_DOMAINS = [
  'udemy.com',
  'coursera.org',
  'pluralsight.com',
  'linkedin.com',
  'skillshare.com',
  'edx.org',
]

export type SearchResult = { title: string; url: string; snippet: string }

export async function searchWeb(query: string, maxResults = 5): Promise<string> {
  const response = await client.search(query, {
    maxResults,
    searchDepth: 'advanced',
  })

  return response.results
    .map(r => `[${r.title}](${r.url})\n${r.content}`)
    .join('\n\n')
}

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

// Filtered search: excludes paid platforms and SEO listicles
export async function searchWebFiltered(query: string, maxResults = 5): Promise<SearchResult[]> {
  const response = await client.search(query, {
    maxResults,
    searchDepth: 'advanced',
    excludeDomains: BLACKLIST_DOMAINS,
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
