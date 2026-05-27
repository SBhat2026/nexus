import type { OAWork, OASearchResponse } from './types'
import { OAError, oaId } from './types'

const BASE = 'https://api.openalex.org'

// Using polite pool — add email so OpenAlex gives us faster, dedicated servers
const MAILTO = 'siddhantbhat3@gmail.com'

const WORK_FIELDS = [
  'id',
  'title',
  'abstract_inverted_index',
  'authorships',
  'publication_year',
  'cited_by_count',
  'referenced_works',
  'primary_location',
].join(',')

async function oaFetch(url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { 'User-Agent': `Nexus/1.0 (mailto:${MAILTO})` },
    next: { revalidate: 0 },
  })
  if (res.status === 429) throw new OAError(429, 'OpenAlex rate limit')
  if (!res.ok) throw new OAError(res.status, `OpenAlex error: ${res.statusText}`)
  return res
}

interface RecencyOpts {
  recentRatio?: number  // fraction of limit from last `recentYears` years (default 0.7)
  recentYears?: number  // how many years back "recent" means (default 3)
}

function dedupeWorks(lists: OAWork[][]): OAWork[] {
  const seen = new Set<string>()
  const out: OAWork[] = []
  for (const work of lists.flat()) {
    const id = oaId(work.id)
    if (!seen.has(id)) { seen.add(id); out.push(work) }
  }
  return out
}

export async function searchWorks(query: string, limit = 25, opts?: RecencyOpts): Promise<OAWork[]> {
  const ratio = opts?.recentRatio ?? 0.7
  const years = opts?.recentYears ?? 3
  const currentYear = new Date().getFullYear()
  const baseFilter = 'has_abstract:true,type:article'

  if (ratio <= 0 || ratio >= 1) {
    const url =
      `${BASE}/works?search=${encodeURIComponent(query)}` +
      `&filter=${baseFilter}` +
      `&per-page=${limit}&select=${WORK_FIELDS}&mailto=${MAILTO}`
    const res = await oaFetch(url)
    const data: OASearchResponse = await res.json()
    return data.results ?? []
  }

  const recentLimit = Math.round(limit * ratio)
  const oldLimit = limit - recentLimit
  const fromDate = `${currentYear - years}-01-01`

  const [rRes, oRes] = await Promise.all([
    oaFetch(
      `${BASE}/works?search=${encodeURIComponent(query)}` +
      `&filter=${baseFilter},from_publication_date:${fromDate}` +
      `&per-page=${recentLimit}&select=${WORK_FIELDS}&mailto=${MAILTO}`
    ),
    oaFetch(
      `${BASE}/works?search=${encodeURIComponent(query)}` +
      `&filter=${baseFilter}` +
      `&per-page=${oldLimit}&select=${WORK_FIELDS}&mailto=${MAILTO}`
    ),
  ])
  const [rData, oData]: OASearchResponse[] = await Promise.all([rRes.json(), oRes.json()])
  return dedupeWorks([rData.results ?? [], oData.results ?? []])
}

export async function fetchWorksByIds(ids: string[]): Promise<OAWork[]> {
  if (ids.length === 0) return []
  // OpenAlex filter by pipe-separated IDs
  const filter = `ids.openalex:${ids.join('|')}`
  const url =
    `${BASE}/works?filter=${encodeURIComponent(filter)}` +
    `&per-page=${Math.min(ids.length, 200)}` +
    `&select=${WORK_FIELDS}` +
    `&mailto=${MAILTO}`
  const res = await oaFetch(url)
  const data: OASearchResponse = await res.json()
  return data.results ?? []
}

/** Fetch referenced works (up to limit) for a given OpenAlex bare ID like "W123". */
export async function fetchReferences(bareId: string, limit = 20, opts?: RecencyOpts): Promise<OAWork[]> {
  const ratio = opts?.recentRatio ?? 0.7
  const years = opts?.recentYears ?? 3
  const currentYear = new Date().getFullYear()
  const fullId = `https://openalex.org/${bareId}`
  const baseFilter = `cites:${encodeURIComponent(fullId)}`

  if (ratio <= 0 || ratio >= 1) {
    const url =
      `${BASE}/works?filter=${baseFilter}` +
      `&per-page=${limit}&select=${WORK_FIELDS}&sort=cited_by_count:desc&mailto=${MAILTO}`
    const res = await oaFetch(url)
    const data: OASearchResponse = await res.json()
    return data.results ?? []
  }

  const recentLimit = Math.round(limit * ratio)
  const oldLimit = limit - recentLimit
  const fromDate = `${currentYear - years}-01-01`

  const [rRes, oRes] = await Promise.all([
    oaFetch(
      `${BASE}/works?filter=${baseFilter},from_publication_date:${fromDate}` +
      `&per-page=${recentLimit}&select=${WORK_FIELDS}&sort=cited_by_count:desc&mailto=${MAILTO}`
    ),
    oaFetch(
      `${BASE}/works?filter=${baseFilter}` +
      `&per-page=${oldLimit}&select=${WORK_FIELDS}&sort=cited_by_count:desc&mailto=${MAILTO}`
    ),
  ])
  const [rData, oData]: OASearchResponse[] = await Promise.all([rRes.json(), oRes.json()])
  return dedupeWorks([rData.results ?? [], oData.results ?? []])
}

export { oaId }
