import type { SourceWork } from './types'

interface CoreAuthor {
  name: string
}

interface CoreWork {
  id: number
  title?: string
  abstract?: string
  authors?: CoreAuthor[]
  yearPublished?: number
  citationCount?: number
  publisher?: string
}

interface CoreResponse {
  results?: CoreWork[]
}

export async function fetchPapersFromCore(query: string, limit: number): Promise<SourceWork[]> {
  const apiKey = process.env.CORE_API_KEY
  if (!apiKey) throw new Error('CORE_API_KEY not configured')

  const url = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=${limit}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`CORE API error: ${res.status} ${res.statusText}`)
  const data: CoreResponse = await res.json()
  return (data.results ?? []).map((r) => ({
    id: `core:${r.id}`,
    title: r.title ?? '',
    abstract: r.abstract ?? null,
    authors: r.authors?.map((a) => a.name) ?? [],
    year: r.yearPublished ?? null,
    citationCount: r.citationCount ?? 0,
    venue: r.publisher ?? null,
    referencedWorkIds: [],
    sourceProvider: 'core' as const,
  }))
}
