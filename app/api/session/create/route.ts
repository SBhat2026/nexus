import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { searchPapers } from '@/lib/s2/client'
import { getPapersWithEmbeddings } from '@/lib/s2/cache'
import { runClusteringPipeline } from '@/lib/clustering/pipeline'
import { buildGraph } from '@/lib/graphBuilder'
import { createServerClient } from '@/lib/supabase/server'

// Vercel max function duration
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const seedTopic: string = (body.seedTopic ?? '').trim()

    if (!seedTopic || seedTopic.length < 2 || seedTopic.length > 300) {
      return Response.json({ error: 'seedTopic must be 2-300 characters' }, { status: 400 })
    }

    // 1. Search S2 for papers (20 keyless, 30 with key — stay within 100 req/5min budget)
    const limit = process.env.SEMANTIC_SCHOLAR_API_KEY ? 30 : 20
    const searchResults = await searchPapers(seedTopic, limit)
    if (searchResults.length === 0) {
      return Response.json({ error: 'No papers found for this topic', sessionId: null, graph: null }, { status: 200 })
    }

    const paperIds = searchResults.map((p) => p.paperId).filter(Boolean)

    // 2. Batch-fetch full details + embeddings (with Supabase cache)
    const cached = await getPapersWithEmbeddings(paperIds)

    // Drop papers without embeddings
    const withEmbeddings = cached.filter((p) => p.embedding && p.embedding.length === 768)
    if (withEmbeddings.length < 3) {
      return Response.json({ error: 'Insufficient papers with embeddings for clustering' }, { status: 200 })
    }

    // 3. Run clustering pipeline
    const vectors = withEmbeddings.map((p) => p.embedding as number[])
    const pipeline = runClusteringPipeline(vectors)

    // 4. Build GraphData (assign UUIDs to papers)
    const papersMapped = withEmbeddings.map((p) => ({
      id: randomUUID(),
      s2PaperId: p.s2_paper_id,
      title: p.title,
      abstract: p.abstract ?? '',
      authors: p.authors ?? [],
      year: p.year ?? 0,
      citationCount: p.citation_count,
      tldr: p.tldr ?? undefined,
      s2Url: `https://www.semanticscholar.org/paper/${p.s2_paper_id}`,
    }))

    const graph = buildGraph(papersMapped, pipeline)

    // 5. Persist to Supabase
    const db = createServerClient()
    const sessionId = randomUUID()

    await db.from('sessions').insert({
      id: sessionId,
      seed_topic: seedTopic,
    })

    // Insert clusters
    const clusterRows = pipeline.clusters.map((c) => ({
      id: `${sessionId}-cluster-${c.clusterIndex}`,
      session_id: sessionId,
      label: `Cluster ${String.fromCharCode(65 + c.clusterIndex)}`,
      description: null,
      center_embedding: c.center,
      paper_count: c.memberIndices.length,
      field: null,
      is_pruned: false,
    }))
    if (clusterRows.length > 0) await db.from('clusters').insert(clusterRows)

    // Insert papers (non-outliers)
    const paperRows = papersMapped.map((p, i) => ({
      id: p.id,
      session_id: sessionId,
      s2_paper_id: p.s2PaperId,
      title: p.title,
      abstract: p.abstract,
      authors: p.authors,
      year: p.year,
      citation_count: p.citationCount,
      embedding: (withEmbeddings[i].embedding as number[]) ?? null,
      cluster_id: pipeline.assignments[i] >= 0
        ? `${sessionId}-cluster-${pipeline.assignments[i]}`
        : null,
      is_outlier: pipeline.outlierFlags[i],
      tldr: p.tldr ?? null,
      s2_url: p.s2Url,
    }))
    if (paperRows.length > 0) await db.from('papers').insert(paperRows)

    // Insert edges (only semantic_similarity cluster→paper; skip citations for now — no refs in search)
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

    // Fix graph node IDs to use the session-scoped cluster IDs
    const fixedGraph = {
      nodes: graph.nodes.map((n) => {
        if (n.nodeType === 'cluster') {
          return { ...n, id: `${sessionId}-${n.id}` }
        }
        if (n.nodeType === 'paper' || n.nodeType === 'outlier') {
          const clusterId = (n as { clusterId?: string | null }).clusterId
          if (clusterId) {
            return { ...n, clusterId: `${sessionId}-${clusterId}` }
          }
          const nearestId = (n as { nearestClusterId?: string }).nearestClusterId
          if (nearestId) {
            return { ...n, nearestClusterId: `${sessionId}-${nearestId}` }
          }
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
