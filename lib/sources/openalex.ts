import { fetchReferences } from '@/lib/openalex/client'
import { oaId } from '@/lib/openalex/types'
import type { SourceWork } from './types'
import { decomposeQuery } from './decompose'

const MAILTO = 'siddhantbhat3@gmail.com'

function invertedIndexToAbstract(invertedIndex: Record<string, number[]> | null): string {
  if (!invertedIndex) return ''
  const wordMap: Record<number, string> = {}
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      wordMap[pos] = word
    }
  }
  return Object.keys(wordMap)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => wordMap[Number(k)])
    .join(' ')
}

async function fetchFromOpenAlex(query: string, limit: number): Promise<SourceWork[]> {
  const perPage = Math.min(limit, 200)

  const params = new URLSearchParams({
    search: query,
    filter: 'has_abstract:true,type:article',
    sort: 'cited_by_count:desc',
    'per-page': String(perPage),
    select: 'id,title,abstract_inverted_index,authorships,publication_year,cited_by_count,referenced_works,primary_location',
    mailto: MAILTO,
  })

  const url = `https://api.openalex.org/works?${params}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': `Nexus Research Tool (${MAILTO})` },
      signal: controller.signal,
      next: { revalidate: 0 },
    })
    clearTimeout(timer)

    if (!res.ok) {
      console.error(`[openalex] HTTP ${res.status} for query: "${query}"`)
      return []
    }

    const data = await res.json()
    const works = data.results ?? []

    return works
      .filter((w: { title?: string; abstract_inverted_index?: Record<string, number[]> | null }) =>
        w.title && w.abstract_inverted_index
      )
      .map((w: {
        id: string
        title: string
        abstract_inverted_index: Record<string, number[]>
        authorships?: { author?: { display_name?: string } }[]
        publication_year?: number | null
        cited_by_count?: number
        referenced_works?: string[]
        primary_location?: { source?: { display_name?: string | null } | null } | null
      }): SourceWork => ({
        id: oaId(w.id),
        title: w.title,
        abstract: invertedIndexToAbstract(w.abstract_inverted_index),
        authors: w.authorships?.map((a) => a.author?.display_name).filter((n): n is string => !!n) ?? [],
        year: w.publication_year ?? null,
        citationCount: w.cited_by_count ?? 0,
        venue: w.primary_location?.source?.display_name ?? null,
        referencedWorkIds: w.referenced_works?.map(oaId) ?? [],
        sourceProvider: 'openalex',
      }))
  } catch (err) {
    clearTimeout(timer)
    const reason = err instanceof Error ? err.message : String(err)
    console.warn(`[openalex] fetch failed for "${query}": ${reason}`)
    return []
  }
}

export async function fetchPapers(
  seedTopic: string,
  targetCount = 150
): Promise<{ papers: SourceWork[]; queries: string[] }> {
  const queries = await decomposeQuery(seedTopic)
  console.log('[openalex] Decomposed queries:', queries)

  const perQueryLimit = Math.ceil(targetCount / queries.length)

  const results = await Promise.allSettled(
    queries.map((q) => fetchFromOpenAlex(q, perQueryLimit))
  )

  const seen = new Set<string>()
  const papers: SourceWork[] = []

  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const p of r.value) {
        if (!seen.has(p.id)) {
          seen.add(p.id)
          papers.push(p)
        }
      }
    }
  }

  console.log(
    `[openalex] ${queries.length} queries → ${results.filter((r) => r.status === 'fulfilled').flatMap((r) => (r as PromiseFulfilledResult<SourceWork[]>).value).length} raw → ${papers.length} deduplicated`
  )

  if (papers.length < 40) {
    console.warn('[openalex] Paper count low after dedup, running broad fallback')
    const fallback = await fetchFromOpenAlex(seedTopic, targetCount)
    for (const p of fallback) {
      if (!seen.has(p.id)) {
        seen.add(p.id)
        papers.push(p)
      }
    }
    console.log(`[openalex] After broad fallback: ${papers.length} papers`)
  }

  return { papers, queries }
}

interface RecencyOpts {
  recentRatio?: number
  recentYears?: number
}

// Keep for fetchRefs in index.ts
export async function fetchReferencesNormalized(
  bareId: string,
  limit: number,
  opts?: RecencyOpts
): Promise<SourceWork[]> {
  const works = await fetchReferences(bareId, limit, opts)
  return works.map((w) => ({
    id: oaId(w.id),
    title: w.title || '',
    abstract: invertedIndexToAbstract(w.abstract_inverted_index),
    authors: w.authorships?.map((a) => a.author.display_name) ?? [],
    year: w.publication_year,
    citationCount: w.cited_by_count,
    venue: w.primary_location?.source?.display_name ?? null,
    referencedWorkIds: w.referenced_works?.map(oaId) ?? [],
    sourceProvider: 'openalex' as const,
  }))
}
