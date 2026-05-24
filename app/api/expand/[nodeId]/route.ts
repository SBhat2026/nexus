import type { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { fetchReferences, oaId } from '@/lib/openalex/client'
import { getPapersWithEmbeddings } from '@/lib/papers/cache'
import { createServerClient } from '@/lib/supabase/server'
import type { PaperNode, GraphEdge } from '@/lib/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params
    const body = await req.json()
    const sessionId: string = body.sessionId ?? ''
    const externalId: string = body.s2PaperId ?? ''   // field name kept; holds OpenAlex ID

    if (!sessionId || !externalId) {
      return Response.json({ error: 'sessionId and s2PaperId required' }, { status: 400 })
    }

    // Fetch papers that cite this work (Go Deeper = find more context)
    const relatedWorks = await fetchReferences(externalId, 20)
    const relatedIds = relatedWorks.map((w) => oaId(w.id))

    const db = createServerClient()
    const { data: existing } = await db
      .from('papers')
      .select('s2_paper_id')
      .eq('session_id', sessionId)

    const existingIds = new Set((existing ?? []).map((r: { s2_paper_id: string }) => r.s2_paper_id))
    const newIds = relatedIds.filter((id) => !existingIds.has(id))

    if (newIds.length === 0) return Response.json({ newNodes: [], newEdges: [] })

    const cached = await getPapersWithEmbeddings(newIds)
    const withEmbeddings = cached.filter((p) => p.embedding?.length === 1024)

    const newNodes: PaperNode[] = []
    const newEdges: GraphEdge[] = []

    if (withEmbeddings.length > 0) {
      const rows = withEmbeddings.map((p) => ({
        id: randomUUID(),
        session_id: sessionId,
        s2_paper_id: p.external_id,
        title: p.title,
        abstract: p.abstract ?? null,
        authors: p.authors ?? [],
        year: p.year ?? null,
        citation_count: p.citation_count,
        embedding: p.embedding,
        cluster_id: null,
        is_outlier: false,
        tldr: null,
        s2_url: `https://openalex.org/${p.external_id}`,
      }))

      await db.from('papers').insert(rows)

      rows.forEach((r) => {
        newNodes.push({
          id: r.id,
          nodeType: 'paper',
          s2PaperId: r.s2_paper_id,
          title: r.title,
          abstract: r.abstract ?? '',
          authors: r.authors,
          year: r.year ?? 0,
          citationCount: r.citation_count,
          clusterId: null,
          isOutlier: false,
          s2Url: r.s2_url,
        })
        newEdges.push({
          id: `e-expand-${nodeId}-${r.id}`,
          source: nodeId,
          target: r.id,
          edgeType: 'citation',
          weight: 1,
        })
      })

      const edgeRows = newEdges.map((e) => ({
        session_id: sessionId,
        source_id: e.source,
        source_type: 'paper',
        target_id: e.target,
        target_type: 'paper',
        weight: e.weight,
        edge_type: e.edgeType,
      }))
      await db.from('edges').insert(edgeRows)
    }

    return Response.json({ newNodes, newEdges })
  } catch (err) {
    console.error('[expand/nodeId]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
