/**
 * Provider-agnostic embedding cache backed by Supabase.
 * Papers are keyed by external_id (OpenAlex ID like "W123").
 * Embeddings are 1024-dim (Jina jina-embeddings-v3).
 */
import { createServerClient } from '@/lib/supabase/server'
import { embedTexts, paperToText } from '@/lib/jina/client'
import { fetchWorksByIds, oaId } from '@/lib/openalex/client'
import { reconstructAbstract } from '@/lib/openalex/types'

export interface CachedPaper {
  external_id: string       // OpenAlex bare ID e.g. "W123"
  title: string
  abstract: string | null
  authors: string[] | null
  year: number | null
  citation_count: number
  embedding: number[] | null
  tldr: string | null
}

function workToRow(w: {
  id: string; title: string; abstract: string | null
  authors: string[]; year: number | null; citationCount: number
}): Omit<CachedPaper, 'embedding' | 'tldr'> {
  return {
    external_id: w.id,
    title: w.title,
    abstract: w.abstract,
    authors: w.authors,
    year: w.year,
    citation_count: w.citationCount,
  }
}

export async function getPapersWithEmbeddings(oaIds: string[]): Promise<CachedPaper[]> {
  if (oaIds.length === 0) return []
  const db = createServerClient()

  // Read cache (stored under s2_paper_id column — reused for OpenAlex IDs)
  const { data: cached } = await db
    .from('embedding_cache')
    .select('s2_paper_id,title,abstract,authors,year,citation_count,embedding,tldr')
    .in('s2_paper_id', oaIds)

  const cachedMap = new Map<string, CachedPaper>(
    (cached ?? []).map((r) => [
      r.s2_paper_id,
      {
        external_id: r.s2_paper_id,
        title: r.title,
        abstract: r.abstract,
        authors: r.authors,
        year: r.year,
        citation_count: r.citation_count,
        embedding: r.embedding,
        tldr: r.tldr,
      } as CachedPaper,
    ])
  )

  const missing = oaIds.filter((id) => {
    const paper = cachedMap.get(id)
    return !paper || !paper.embedding || paper.embedding.length !== 1024
  })

  if (missing.length > 0) {
    // Fetch paper metadata from OpenAlex
    const fullIds = missing.map((id) => `https://openalex.org/${id}`)
    const works = await fetchWorksByIds(fullIds)

    const papersForEmbedding = works.map((w) => {
      const abstract = reconstructAbstract(w.abstract_inverted_index)
      return {
        id: oaId(w.id),
        title: w.title || '',
        abstract,
        authors: w.authorships?.map((a) => a.author.display_name) ?? [],
        year: w.publication_year,
        citationCount: w.cited_by_count,
      }
    })

    // Embed all new papers in one Jina batch call
    const texts = papersForEmbedding.map((p) => paperToText(p.title, p.abstract))
    const embeddings = await embedTexts(texts)

    // Upsert to cache
    const rows = papersForEmbedding.map((p, i) => ({
      s2_paper_id: p.id,          // column reused for OpenAlex IDs
      title: p.title,
      abstract: p.abstract || null,
      authors: p.authors,
      year: p.year,
      citation_count: p.citationCount,
      embedding: embeddings[i] ?? null,
      tldr: null,
    }))

    if (rows.length > 0) {
      await db.from('embedding_cache').upsert(rows, { onConflict: 's2_paper_id' })
    }

    rows.forEach((r) => {
      cachedMap.set(r.s2_paper_id, {
        external_id: r.s2_paper_id,
        title: r.title,
        abstract: r.abstract,
        authors: r.authors,
        year: r.year,
        citation_count: r.citation_count,
        embedding: r.embedding,
        tldr: r.tldr,
      })
    })
  }

  return oaIds.map((id) => cachedMap.get(id)).filter(Boolean) as CachedPaper[]
}
