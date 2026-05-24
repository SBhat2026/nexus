import type {
  S2Paper,
  S2SearchResponse,
  S2RefsResponse,
  S2CitationsResponse,
} from './types'
import { S2Error } from './types'

const BASE = 'https://api.semanticscholar.org/graph/v1'

// Fields requested for all full-paper fetches
const PAPER_FIELDS =
  'title,abstract,authors,year,citationCount,referenceCount,embedding,tldr,externalIds'

const SEARCH_FIELDS = 'title,authors,year,citationCount,paperId'

function headers(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' }
  const key = process.env.SEMANTIC_SCHOLAR_API_KEY
  if (key) h['x-api-key'] = key
  return h
}

async function fetchWithRetry(url: string, init?: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { ...init, headers: { ...headers(), ...(init?.headers ?? {}) } })
    if (res.status === 429) {
      const delay = 2 ** attempt * 1000
      await new Promise((r) => setTimeout(r, delay))
      continue
    }
    return res
  }
  throw new S2Error(429, 'S2 rate limit exceeded after retries')
}

export async function searchPapers(query: string, limit = 30): Promise<S2Paper[]> {
  const url = `${BASE}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${SEARCH_FIELDS}`
  const res = await fetchWithRetry(url)
  if (!res.ok) throw new S2Error(res.status, `S2 search failed: ${res.statusText}`)
  const data: S2SearchResponse = await res.json()
  return data.data ?? []
}

export async function batchPapers(ids: string[]): Promise<S2Paper[]> {
  if (ids.length === 0) return []
  const url = `${BASE}/paper/batch?fields=${PAPER_FIELDS}`
  const res = await fetchWithRetry(url, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new S2Error(res.status, `S2 batch failed: ${res.statusText}`)
  const data: S2Paper[] = await res.json()
  return data.filter(Boolean)
}

export async function getReferences(paperId: string, limit = 20): Promise<S2Paper[]> {
  const url = `${BASE}/paper/${paperId}/references?fields=${PAPER_FIELDS}&limit=${limit}`
  const res = await fetchWithRetry(url)
  if (!res.ok) throw new S2Error(res.status, `S2 refs failed: ${res.statusText}`)
  const data: S2RefsResponse = await res.json()
  return (data.data ?? []).map((r) => r.citedPaper).filter(Boolean)
}

export async function getCitations(paperId: string, limit = 20): Promise<S2Paper[]> {
  const url = `${BASE}/paper/${paperId}/citations?fields=${PAPER_FIELDS}&limit=${limit}`
  const res = await fetchWithRetry(url)
  if (!res.ok) throw new S2Error(res.status, `S2 citations failed: ${res.statusText}`)
  const data: S2CitationsResponse = await res.json()
  return (data.data ?? []).map((r) => r.citingPaper).filter(Boolean)
}
