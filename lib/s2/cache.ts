import { createServerClient } from '@/lib/supabase/server'
import { batchPapers } from './client'
import type { S2Paper } from './types'

interface CachedPaper {
  s2_paper_id: string
  title: string
  abstract: string | null
  authors: string[] | null
  year: number | null
  citation_count: number
  embedding: number[] | null
  tldr: string | null
}

function toCached(p: S2Paper): CachedPaper {
  return {
    s2_paper_id: p.paperId,
    title: p.title,
    abstract: p.abstract ?? null,
    authors: p.authors?.map((a) => a.name) ?? null,
    year: p.year ?? null,
    citation_count: p.citationCount ?? 0,
    embedding: p.embedding?.vector ?? null,
    tldr: p.tldr?.text ?? null,
  }
}

export async function getPapersWithEmbeddings(ids: string[]): Promise<CachedPaper[]> {
  if (ids.length === 0) return []
  const db = createServerClient()

  // Try cache first
  const { data: cached } = await db
    .from('embedding_cache')
    .select('*')
    .in('s2_paper_id', ids)

  const cachedMap = new Map<string, CachedPaper>(
    (cached ?? []).map((r) => [r.s2_paper_id, r as CachedPaper])
  )

  const missing = ids.filter((id) => !cachedMap.has(id))

  if (missing.length > 0) {
    const fetched = await batchPapers(missing)
    const rows = fetched.map(toCached)

    // Write back to cache (upsert)
    if (rows.length > 0) {
      await db.from('embedding_cache').upsert(rows, { onConflict: 's2_paper_id' })
    }

    rows.forEach((r) => cachedMap.set(r.s2_paper_id, r))
  }

  return ids.map((id) => cachedMap.get(id)).filter(Boolean) as CachedPaper[]
}
