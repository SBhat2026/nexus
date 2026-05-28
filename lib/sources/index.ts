import { fetchPapers as fetchPapersFromOA, fetchReferencesNormalized } from './openalex'
import { fetchPapersFromCore } from './core'
import type { SourceWork } from './types'

interface RecencyOpts {
  recentRatio?: number
  recentYears?: number
}

export async function fetchPapers(
  query: string,
  limit: number,
  _opts?: RecencyOpts
): Promise<{ works: SourceWork[]; provider: 'openalex' | 'core'; queries: string[] }> {
  try {
    const { papers, queries } = await fetchPapersFromOA(query, limit)
    if (papers.length >= 10) {
      console.log('[sources] provider: openalex, papers:', papers.length)
      return { works: papers, provider: 'openalex', queries }
    }
    console.warn('[sources] OpenAlex returned', papers.length, 'papers — falling back to CORE')
  } catch (err) {
    console.warn('[sources] OpenAlex threw, falling back to CORE:', err instanceof Error ? err.message : err)
  }

  try {
    const coreWorks = await fetchPapersFromCore(query, limit)
    console.log('[sources] provider: core, papers:', coreWorks.length)
    return { works: coreWorks, provider: 'core', queries: [query] }
  } catch (err) {
    throw new Error(
      `Unable to fetch papers — both OpenAlex and CORE are unavailable. Please try again. (${err instanceof Error ? err.message : err})`
    )
  }
}

export async function fetchRefs(
  bareId: string,
  seedTitle: string,
  limit: number,
  opts?: RecencyOpts
): Promise<{ works: SourceWork[]; provider: 'openalex' | 'core' }> {
  try {
    const works = await fetchReferencesNormalized(bareId, limit, opts)
    if (works.length >= 3) return { works, provider: 'openalex' }
  } catch {
    // fall through to CORE
  }

  try {
    const coreWorks = await fetchPapersFromCore(seedTitle, limit)
    return { works: coreWorks, provider: 'core' }
  } catch {
    return { works: [], provider: 'openalex' }
  }
}
