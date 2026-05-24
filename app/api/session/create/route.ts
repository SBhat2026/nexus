import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { searchWorks, oaId } from '@/lib/openalex/client'
import { reconstructAbstract } from '@/lib/openalex/types'
import { getPapersWithEmbeddings } from '@/lib/papers/cache'
import { runClusteringPipeline } from '@/lib/clustering/pipeline'
import { buildGraph } from '@/lib/graphBuilder'
import { createServerClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const seedTopic: string = (body.seedTopic ?? '').trim()

    if (!seedTopic || seedTopic.length < 2 || seedTopic.length > 300) {
      return Response.json({ error: 'seedTopic must be 2-300 characters' }, { status: 400 })
    }

    // 1. Search OpenAlex — free, no key, polite pool
    const works = await searchWorks(seedTopic, 25)
    if (works.length === 0) {
      return Response.json({ error: 'No papers found for this topic', sessionId: null, graph: null }, { status: 200 })
    }

    const bareIds = works.map((w) => oaId(w.id))

    // Pre-populate cache with abstract data from search results (avoids a second OA fetch)
    // Then getPapersWithEmbeddings will only call Jina for the embedding step
    const db = createServerClient()
    const existingIds = await db
      .from('embedding_cache')
      .select('s2_paper_id')
      .in('s2_paper_id', bareIds)
      .then((r) => new Set((r.data ?? []).map((x: { s2_paper_id: string }) => x.s2_paper_id)))

    const newWorks = works.filter((w) => !existingIds.has(oaId(w.id)))
    if (newWorks.length > 0) {
      // Insert metadata stubs so getPapersWithEmbeddings skips the OA re-fetch
      const stubs = newWorks.map((w) => ({
        s2_paper_id: oaId(w.id),
        title: w.title || '',
        abstract: reconstructAbstract(w.abstract_inverted_index) || null,
        authors: w.authorships?.map((a) => a.author.display_name) ?? [],
        year: w.publication_year,
        citation_count: w.cited_by_count,
        embedding: null,
        tldr: null,
      }))
      await db.from('embedding_cache').upsert(stubs, { onConflict: 's2_paper_id' })
    }

    // 2. Get papers with embeddings (Jina called only for missing embeddings)
    const papers = await getPapersWithEmbeddings(bareIds)
    const withEmbeddings = papers.filter((p) => p.embedding && p.embedding.length === 1024)

    if (withEmbeddings.length < 3) {
      return Response.json({ error: 'Insufficient papers with embeddings for clustering' }, { status: 200 })
    }

    // 3. Cluster
    const vectors = withEmbeddings.map((p) => p.embedding as number[])
    const pipeline = runClusteringPipeline(vectors)

    // 4. Build mapped papers (with citation edges from referenced_works)
    const oaIdToPaper = new Map(works.map((w) => [oaId(w.id), w]))
    const papersMapped = withEmbeddings.map((p) => {
      const work = oaIdToPaper.get(p.external_id)
      return {
        id: randomUUID(),
        s2PaperId: p.external_id,           // field name kept; now holds OpenAlex ID
        title: p.title,
        abstract: p.abstract ?? '',
        authors: p.authors ?? [],
        year: p.year ?? 0,
        citationCount: p.citation_count,
        referenceIds: work?.referenced_works?.map(oaId) ?? [],
        s2Url: `https://openalex.org/${p.external_id}`,
      }
    })

    const graph = buildGraph(papersMapped, pipeline)

    // 5. Persist to Supabase
    const sessionId = randomUUID()
    await db.from('sessions').insert({ id: sessionId, seed_topic: seedTopic })

    const clusterRows = pipeline.clusters.map((c) => ({
      id: `${sessionId}-cluster-${c.clusterIndex}`,
      session_id: sessionId,
      label: `Cluster ${String.fromCharCode(65 + c.clusterIndex)} (${c.memberIndices.length})`,
      description: null,
      center_embedding: c.center,
      paper_count: c.memberIndices.length,
      field: null,
      is_pruned: false,
    }))
    if (clusterRows.length > 0) await db.from('clusters').insert(clusterRows)

    const paperRows = papersMapped.map((p, i) => ({
      id: p.id,
      session_id: sessionId,
      s2_paper_id: p.s2PaperId,
      title: p.title,
      abstract: p.abstract,
      authors: p.authors,
      year: p.year,
      citation_count: p.citationCount,
      embedding: withEmbeddings[i].embedding,
      cluster_id: pipeline.assignments[i] >= 0
        ? `${sessionId}-cluster-${pipeline.assignments[i]}`
        : null,
      is_outlier: pipeline.outlierFlags[i],
      tldr: null,
      s2_url: p.s2Url,
    }))
    if (paperRows.length > 0) await db.from('papers').insert(paperRows)

    const edgeRows = graph.edges.slice(0, 200).map((e) => ({
      session_id: sessionId,
      source_id: e.source,
      source_type: 'node',
      target_id: e.target,
      target_type: 'node',
      weight: e.weight,
      edge_type: e.edgeType,
    }))
    if (edgeRows.length > 0) await db.from('edges').insert(edgeRows)

    // Fix cluster IDs in returned graph to use session-scoped IDs
    const fixedGraph = {
      nodes: graph.nodes.map((n) => {
        if (n.nodeType === 'cluster') return { ...n, id: `${sessionId}-${n.id}` }
        if (n.nodeType === 'paper' || n.nodeType === 'outlier') {
          const cid = (n as { clusterId?: string | null }).clusterId
          if (cid) return { ...n, clusterId: `${sessionId}-${cid}` }
          const nid = (n as { nearestClusterId?: string }).nearestClusterId
          if (nid) return { ...n, nearestClusterId: `${sessionId}-${nid}` }
        }
        return n
      }),
      edges: graph.edges.map((e) => ({
        ...e,
        source: e.source.startsWith('cluster-') ? `${sessionId}-${e.source}` : e.source,
        target: e.target.startsWith('cluster-') ? `${sessionId}-${e.target}` : e.target,
      })),
    }

    return Response.json({ sessionId, graph: fixedGraph })
  } catch (err) {
    console.error('[session/create]', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return Response.json({ error: message }, { status: 500 })
  }
}
