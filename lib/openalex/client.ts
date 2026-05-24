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

export async function searchWorks(query: string, limit = 25): Promise<OAWork[]> {
  const url =
    `${BASE}/works?search=${encodeURIComponent(query)}` +
    `&per-page=${limit}` +
    `&select=${WORK_FIELDS}` +
    `&mailto=${MAILTO}`
  const res = await oaFetch(url)
  const data: OASearchResponse = await res.json()
  return data.results ?? []
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
export async function fetchReferences(bareId: string, limit = 20): Promise<OAWork[]> {
  const fullId = `https://openalex.org/${bareId}`
  const filter = `cites:${encodeURIComponent(fullId)}`
  const url =
    `${BASE}/works?filter=${filter}` +
    `&per-page=${limit}` +
    `&select=${WORK_FIELDS}` +
    `&sort=cited_by_count:desc` +
    `&mailto=${MAILTO}`
  const res = await oaFetch(url)
  const data: OASearchResponse = await res.json()
  return data.results ?? []
}

export { oaId }
