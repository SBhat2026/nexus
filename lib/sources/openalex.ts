import { fetchReferences } from '@/lib/openalex/client'
import { oaId } from '@/lib/openalex/types'
import type { SourceWork, SourceConcept } from './types'
import { buildRetrievalPlan } from './decompose'
import { blendRank, coverageScore, type PlannedQuery } from './queryPlanner'
import { stripHtml } from '@/lib/sanitize'

const MAILTO = 'siddhantbhat3@gmail.com'

const SELECT_FIELDS =
  'id,title,abstract_inverted_index,authorships,publication_year,cited_by_count,referenced_works,primary_location,concepts,relevance_score'

interface OAResultWork {
  id: string
  title?: string
  abstract_inverted_index?: Record<string, number[]> | null
  authorships?: { author?: { display_name?: string } }[]
  publication_year?: number | null
  cited_by_count?: number
  referenced_works?: string[]
  primary_location?: { source?: { display_name?: string | null } | null } | null
  concepts?: { id?: string; display_name?: string; score?: number }[]
  relevance_score?: number | null
}

/** Map a raw OpenAlex work into our ScoredWork shape (shared across fetch rounds). */
function mapWork(w: OAResultWork): ScoredWork {
  return {
    id: oaId(w.id),
    title: stripHtml(w.title),
    abstract: invertedIndexToAbstract(w.abstract_inverted_index ?? null),
    authors: w.authorships?.map((a) => a.author?.display_name).filter((n): n is string => !!n) ?? [],
    year: w.publication_year ?? null,
    citationCount: w.cited_by_count ?? 0,
    venue: w.primary_location?.source?.display_name ?? null,
    referencedWorkIds: w.referenced_works?.map(oaId) ?? [],
    sourceProvider: 'openalex',
    concepts: (w.concepts ?? [])
      .filter((c): c is { id: string; display_name?: string; score?: number } => typeof c.id === 'string')
      .map((c): SourceConcept => ({ id: c.id, display_name: c.display_name ?? '', score: c.score ?? 0 })),
    relevanceScore: w.relevance_score ?? 0,
  }
}

/** Aggregate concept scores across a paper set; return the top-N concept ids. */
export function extractTopConceptIds(works: { concepts?: SourceConcept[] }[], topN = 5): string[] {
  const scores: Record<string, number> = {}
  for (const w of works) {
    for (const c of w.concepts ?? []) scores[c.id] = (scores[c.id] ?? 0) + c.score
  }
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([id]) => id)
}

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

type ScoredWork = SourceWork & { relevanceScore: number }

/**
 * Run one planned sub-query against OpenAlex. Precision sub-queries use the
 * `title_and_abstract.search` filter (terms ANDed in title/abstract); the recall
 * sub-query uses the `search` param. Critically, we sort by RELEVANCE (OpenAlex
 * default when searching) instead of citations — citation-sorting discards the
 * relevance ranking and floods the corpus with highly-cited but tangential papers.
 */
export async function fetchFromOpenAlex(
  planned: Pick<PlannedQuery, 'q' | 'field'>,
  limit: number,
): Promise<ScoredWork[]> {
  const perPage = Math.min(Math.max(limit, 1), 200)

  const baseFilter = 'has_abstract:true,type:article'
  const params = new URLSearchParams({
    filter: planned.field === 'taas'
      ? `${baseFilter},title_and_abstract.search:${planned.q}`
      : baseFilter,
    'per-page': String(perPage),
    select: SELECT_FIELDS,
    mailto: MAILTO,
  })
  // Relevance sort is implicit when a search is present; only attach `search` for the
  // recall query (filter-based search drives relevance for taas queries).
  if (planned.field === 'search') params.set('search', planned.q)

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
      console.error(`[openalex] HTTP ${res.status} for query: "${planned.q}"`)
      return []
    }

    const data = await res.json()
    const works: OAResultWork[] = data.results ?? []

    return works
      .filter((w) => w.title && w.abstract_inverted_index)
      .map(mapWork)
  } catch (err) {
    clearTimeout(timer)
    const reason = err instanceof Error ? err.message : String(err)
    console.warn(`[openalex] fetch failed for "${planned.q}": ${reason}`)
    return []
  }
}

/**
 * Concept bootstrapping: a second round anchored to OpenAlex's own taxonomy. Given
 * the top concept ids from round one, fetch more works tagged with those concepts.
 * There is no search term here, so sorting by citations (most-established first) is
 * appropriate — this round self-corrects domain errors by anchoring to what the
 * round-one papers actually ARE about.
 */
async function fetchByConcepts(conceptIds: string[], limit: number): Promise<ScoredWork[]> {
  if (conceptIds.length === 0) return []
  const perPage = Math.min(Math.max(limit, 1), 200)
  const params = new URLSearchParams({
    filter: `has_abstract:true,type:article,concepts.id:${conceptIds.join('|')}`,
    sort: 'cited_by_count:desc',
    'per-page': String(perPage),
    select: SELECT_FIELDS,
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
    if (!res.ok) return []
    const data = await res.json()
    const works: OAResultWork[] = data.results ?? []
    return works.filter((w) => w.title && w.abstract_inverted_index).map(mapWork)
  } catch {
    clearTimeout(timer)
    return []
  }
}

export async function fetchPapers(
  seedTopic: string,
  targetCount = 150,
  forcedDomain?: string,
): Promise<{ papers: SourceWork[]; queries: string[]; domain: string | null; ambiguities: string[] }> {
  const { plan, domain, ambiguities } = await buildRetrievalPlan(seedTopic, { augment: true, forcedDomain })
  const queries = plan.map((p) => p.q)
  console.log('[openalex] Query plan:', plan.map((p) => `${p.q} [${p.field} w=${p.weight.toFixed(2)} ${p.role}]`).join(' | '))
  if (domain) console.log(`[openalex] Detected domain: ${domain}${ambiguities.length ? ` · ambiguities: ${ambiguities.join('; ')}` : ''}`)

  // Allocate the paper budget by weight, with a floor so small-weight facets still
  // contribute a few candidates. Over-fetch ~1.6× so the blended re-rank has a pool.
  const pool = Math.ceil(targetCount * 1.6)
  const results = await Promise.allSettled(
    plan.map((p) => fetchFromOpenAlex(p, Math.max(8, Math.round(pool * p.weight))))
  )

  // Aggregate candidates, summing the weight of every sub-query that surfaced each
  // paper (multi-query agreement → higher boost) and keeping the best relevance seen.
  const agg = new Map<string, ScoredWork & { weightBoost: number }>()
  results.forEach((r, qi) => {
    if (r.status !== 'fulfilled') return
    const w = plan[qi].weight
    for (const p of r.value) {
      const ex = agg.get(p.id)
      if (ex) {
        ex.weightBoost += w
        if (p.relevanceScore > ex.relevanceScore) ex.relevanceScore = p.relevanceScore
      } else {
        agg.set(p.id, { ...p, weightBoost: w })
      }
    }
  })

  // Concept bootstrapping (round 2): anchor to OpenAlex's taxonomy of the round-1
  // papers, pulling in more works that share their top concepts. Self-corrects
  // domain mismatches. Skipped silently when no concepts are present.
  const topConceptIds = extractTopConceptIds([...agg.values()], 5).slice(0, 3)
  if (topConceptIds.length > 0) {
    const conceptWorks = await fetchByConcepts(topConceptIds, 50)
    let added = 0
    for (const p of conceptWorks) {
      if (!agg.has(p.id)) { agg.set(p.id, { ...p, weightBoost: 0.1 }); added++ }
    }
    console.log(`[openalex] Concept bootstrap (${topConceptIds.length} concepts) → +${added} papers`)
  }

  let candidates = [...agg.values()]
  const rawCount = results.reduce((s, r) => s + (r.status === 'fulfilled' ? r.value.length : 0), 0)
  console.log(`[openalex] ${plan.length} queries → ${rawCount} raw → ${candidates.length} unique candidates`)

  if (candidates.length < 40) {
    console.warn('[openalex] Candidate count low, running broad relevance fallback')
    const fallback = await fetchFromOpenAlex({ q: seedTopic, field: 'search' }, targetCount)
    for (const p of fallback) {
      if (!agg.has(p.id)) {
        agg.set(p.id, { ...p, weightBoost: 0.05 })
      }
    }
    candidates = [...agg.values()]
    console.log(`[openalex] After broad fallback: ${candidates.length} candidates`)
  }

  // Blended re-rank: relevance-primary, rewarding cross-query agreement + impact, with
  // a light prompt-coverage prior so on-topic papers float up over tangential ones.
  const blend = blendRank(candidates.map((c) => ({
    relevance: c.relevanceScore,
    citations: c.citationCount,
    weightBoost: c.weightBoost,
  })))
  const scored = candidates.map((c, i) => ({
    work: c,
    score: 0.85 * blend[i] + 0.15 * coverageScore(seedTopic, `${c.title} ${c.abstract}`),
  }))
  scored.sort((a, b) => b.score - a.score)

  const papers: SourceWork[] = scored.slice(0, targetCount).map((s) => {
    // Strip internal scoring fields before returning a clean SourceWork.
    const { relevanceScore: _rel, weightBoost: _wb, ...rest } = s.work
    void _rel; void _wb
    return rest as SourceWork
  })

  return { papers, queries, domain, ambiguities }
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
    title: stripHtml(w.title),
    abstract: invertedIndexToAbstract(w.abstract_inverted_index),
    authors: w.authorships?.map((a) => a.author.display_name) ?? [],
    year: w.publication_year,
    citationCount: w.cited_by_count,
    venue: w.primary_location?.source?.display_name ?? null,
    referencedWorkIds: w.referenced_works?.map(oaId) ?? [],
    sourceProvider: 'openalex' as const,
  }))
}
